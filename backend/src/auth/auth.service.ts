import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  Prisma,
  TenantStatus,
  User,
  UserRole,
} from '../../generated/prisma/client';
import { TenantsService } from '../tenants/tenants.service';
import { SignupDto } from './dto/signup.dto';
import {
  formatPhoneNumber,
  maskPhoneNumber,
} from 'src/common/utils/phone.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { PushNotificationsService } from 'src/push-notifications/push-notifications.service';
import {
  getDatabaseTargetFingerprint,
  getRuntimeIdentity,
} from 'src/common/utils/runtime-identity.util';
import { TwilioVerifyService } from './twilio-verify.service';
import {
  MERCHANT_ACCESS_TOKEN_TYPE,
  PHONE_CHANGE_CHALLENGE_TOKEN_TYPE,
  PHONE_CHANGE_CHALLENGE_TTL_SECONDS,
  PhoneChangeChallengePayload,
} from './auth-token.constants';
import { hashPassword } from 'src/common/utils/password.util';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import {
  ActivityEntityTypes,
  ActivitySources,
} from 'src/activity-log/constants/activity-types';

type AuthenticationFailureStage =
  | 'user_not_found'
  | 'password_mismatch'
  | 'tenant_status_blocked'
  | 'signup_password_verification_failed';

type CredentialAuditContext = {
  requestId?: string;
  ipAddress?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly runtimeIdentity = getRuntimeIdentity();
  private readonly databaseTargetFingerprint = getDatabaseTargetFingerprint();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private tenantsService: TenantsService,
    private prisma: PrismaService,
    private pushNotificationsService: PushNotificationsService,
    private twilioVerifyService: TwilioVerifyService,
    private activityLogService: ActivityLogService,
  ) {}

  async validateUser(
    phone: string,
    pass: string,
    requestId?: string,
  ): Promise<Omit<User, 'password'> | null> {
    const normalizedPhone = formatPhoneNumber(phone);

    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: { tenant: { select: { status: true } } },
    });
    if (!user) {
      this.logAuthenticationFailure(
        'user_not_found',
        normalizedPhone,
        requestId,
      );
      return null;
    }
    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      this.logAuthenticationFailure(
        'password_mismatch',
        normalizedPhone,
        requestId,
      );
      return null;
    }

    try {
      this.assertTenantCanLogin(user.tenant.status);
    } catch (error) {
      this.logAuthenticationFailure(
        'tenant_status_blocked',
        normalizedPhone,
        requestId,
        user.tenant.status,
      );
      throw error;
    }

    // Create a copy and remove password to safely satisfy strict typing
    const result = { ...user } as Partial<User>;
    delete result.password;
    delete (result as Partial<User> & { tenant?: unknown }).tenant;
    return result as Omit<User, 'password'>;
  }

  /** Logs a non-sensitive authentication failure with worker correlation data. */
  private logAuthenticationFailure(
    stage: AuthenticationFailureStage,
    phone: string,
    requestId?: string,
    tenantStatus?: TenantStatus,
  ): void {
    this.logger.warn(
      JSON.stringify({
        event: 'merchant_authentication_failed',
        stage,
        requestId: requestId || 'none',
        maskedPhone: maskPhoneNumber(phone),
        tenantStatus: tenantStatus || 'unknown',
        ...this.runtimeIdentity,
        databaseTargetFingerprint: this.databaseTargetFingerprint,
      }),
    );
  }

  private assertTenantCanLogin(status: TenantStatus): void {
    const statusErrors: Partial<
      Record<TenantStatus, { code: string; message: string }>
    > = {
      [TenantStatus.pending]: {
        code: 'MERCHANT_APPROVAL_PENDING',
        message:
          'طلب الانضمام قيد المراجعة. سنتواصل معك بعد مراجعة البيانات والمستندات القانونية.',
      },
      [TenantStatus.rejected]: {
        code: 'MERCHANT_APPLICATION_REJECTED',
        message: 'تعذر اعتماد طلب الانضمام. تواصل معنا لمراجعة الطلب.',
      },
      [TenantStatus.inactive]: {
        code: 'MERCHANT_ACCOUNT_INACTIVE',
        message: 'الحساب غير نشط حالياً. تواصل معنا للمساعدة.',
      },
      [TenantStatus.suspended]: {
        code: 'MERCHANT_ACCOUNT_SUSPENDED',
        message: 'الحساب موقوف حالياً. تواصل معنا للمساعدة.',
      },
    };
    const error = statusErrors[status];
    if (error) throw new ForbiddenException(error);
  }

  login(user: Omit<User, 'password'>) {
    const payload = {
      sub: user.id,
      tokenType: MERCHANT_ACCESS_TOKEN_TYPE,
      authVersion: user.auth_version,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        tenant_id: user.tenant_id,
        name: user.name,
      },
    };
  }

  async signup(signupDto: SignupDto, requestId?: string) {
    const {
      phone: rawPhone,
      password,
      storeName,
      name,
      category,
      address,
    } = signupDto;

    const phone = formatPhoneNumber(rawPhone);

    // Check if user with phone already exists
    const existingUser = await this.usersService.findOneByPhone(phone);
    if (existingUser) {
      throw new BadRequestException(
        'User with this phone number already exists',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const tenant = await this.tenantsService.create(
        storeName,
        phone,
        category,
        tx,
        TenantStatus.pending,
      );

      await tx.tenantDirectoryProfile.create({
        data: {
          tenant_id: tenant.id,
          display_name: storeName,
          address,
        },
      });

      const user = await this.usersService.create(
        {
          phone,
          password,
          name,
          role: UserRole.owner,
          tenant_id: tenant.id,
        },
        tx,
      );

      const storedPasswordMatches = await bcrypt.compare(
        password,
        user.password,
      );
      if (!storedPasswordMatches) {
        this.logAuthenticationFailure(
          'signup_password_verification_failed',
          phone,
          requestId,
        );
        throw new InternalServerErrorException(
          'Could not create merchant credentials',
        );
      }

      await this.pushNotificationsService.enqueueMerchantRegistration(tx, {
        tenantId: tenant.id,
        storeName,
      });
    });

    return {
      status: TenantStatus.pending,
      code: 'MERCHANT_APPLICATION_RECEIVED',
      message: 'تم استلام طلب انضمام متجرك وسيتم التواصل معك بعد المراجعة.',
    };
  }

  /**
   * Starts a non-enumerating merchant password reset.
   */
  async requestPasswordReset(rawPhone: string) {
    const phone = formatPhoneNumber(rawPhone);
    const user = await this.usersService.findOneByPhone(phone);

    if (user) {
      try {
        await this.twilioVerifyService.startSmsVerification(phone);
      } catch {
        this.logger.warn(
          JSON.stringify({
            event: 'merchant_password_reset_delivery_failed',
            maskedPhone: maskPhoneNumber(phone),
          }),
        );
      }
    }

    return {
      success: true,
      message: 'If this phone exists, a reset code has been sent.',
    };
  }

  /**
   * Verifies a reset code and invalidates all existing merchant sessions.
   */
  async verifyPasswordReset(
    rawPhone: string,
    otp: string,
    password: string,
    audit: CredentialAuditContext = {},
  ) {
    const phone = formatPhoneNumber(rawPhone);
    const user = await this.usersService.findOneByPhone(phone);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const isValid = await this.twilioVerifyService.checkCodeByPhone(phone, otp);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    await this.updatePasswordAndInvalidateSessions(
      user,
      password,
      'user.password_reset',
      'تمت إعادة تعيين كلمة المرور',
      audit,
    );

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  /**
   * Updates an authenticated merchant password and invalidates all sessions.
   */
  async updatePassword(
    userId: number,
    currentPass: string,
    newPass: string,
    audit: CredentialAuditContext = {},
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPass, user.password);
    if (!isMatch) {
      throw new BadRequestException('Incorrect current password');
    }

    await this.updatePasswordAndInvalidateSessions(
      user,
      newPass,
      'user.password_changed',
      'تم تغيير كلمة المرور',
      audit,
    );

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  /**
   * Starts an owner-only phone change after verifying the current password.
   */
  async requestPhoneChange(
    userId: number,
    currentPassword: string,
    rawNewPhone: string,
  ) {
    const newPhone = formatPhoneNumber(rawNewPhone);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { id: true, phone: true } } },
    });

    this.assertOwnerCanChangePhone(user);
    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!passwordMatches) {
      throw new BadRequestException('Incorrect current password');
    }
    if (newPhone === user.phone || newPhone === user.tenant.phone) {
      throw new BadRequestException('New phone must differ from current phone');
    }

    await this.assertPhoneAvailable(
      newPhone,
      user.id,
      user.tenant_id,
      this.prisma,
    );

    let verificationSid: string;
    try {
      const verification =
        await this.twilioVerifyService.startSmsVerification(newPhone);
      verificationSid = verification.sid;
    } catch {
      throw new ServiceUnavailableException(
        'Could not send verification code. Please try again later.',
      );
    }

    return this.createPhoneChangeChallenge({
      userId: user.id,
      tenantId: user.tenant_id,
      newPhone,
      verificationSid,
    });
  }

  /**
   * Resends a phone-change code using a still-valid signed challenge.
   */
  async resendPhoneChange(userId: number, challengeToken: string) {
    const challenge = this.verifyPhoneChangeChallenge(
      challengeToken,
      userId,
    );
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { id: true, phone: true } } },
    });

    this.assertOwnerCanChangePhone(user);
    if (user.tenant_id !== challenge.tenantId) {
      throw new BadRequestException('Invalid or expired phone change');
    }
    await this.assertPhoneAvailable(
      challenge.newPhone,
      user.id,
      user.tenant_id,
      this.prisma,
    );

    let verificationSid: string;
    try {
      const verification =
        await this.twilioVerifyService.startSmsVerification(
          challenge.newPhone,
        );
      verificationSid = verification.sid;
    } catch {
      throw new ServiceUnavailableException(
        'Could not send verification code. Please try again later.',
      );
    }

    return this.createPhoneChangeChallenge({
      userId: user.id,
      tenantId: user.tenant_id,
      newPhone: challenge.newPhone,
      verificationSid,
    });
  }

  /**
   * Verifies and atomically commits an owner login/store phone change.
   */
  async verifyPhoneChange(
    userId: number,
    challengeToken: string,
    otp: string,
    audit: CredentialAuditContext = {},
  ) {
    const challenge = this.verifyPhoneChangeChallenge(
      challengeToken,
      userId,
    );
    const isValid =
      await this.twilioVerifyService.checkCodeByVerificationSid(
        challenge.verificationSid,
        otp,
      );
    if (!isValid) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { tenant: { select: { id: true, phone: true } } },
      });
      this.assertOwnerCanChangePhone(user);
      if (user.tenant_id !== challenge.tenantId) {
        throw new BadRequestException('Invalid or expired phone change');
      }

      await this.assertPhoneAvailable(
        challenge.newPhone,
        user.id,
        user.tenant_id,
        tx,
      );
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(user.tenant_id)}, true)`;

      await tx.user.update({
        where: { id: user.id },
        data: {
          phone: challenge.newPhone,
          auth_version: { increment: 1 },
        },
      });
      await tx.tenant.update({
        where: { id: user.tenant_id },
        data: { phone: challenge.newPhone },
      });
      await this.activityLogService.create(
        {
          tenantId: user.tenant_id,
          actorUserId: user.id,
          entityType: ActivityEntityTypes.User,
          entityId: user.id,
          action: 'user.phone_changed',
          title: 'تم تغيير رقم هاتف الحساب والمتجر',
          oldValues: { phone: user.phone },
          newValues: { phone: challenge.newPhone },
          metadata: { sessionsInvalidated: true },
          source: ActivitySources.Dashboard,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
        tx,
      );
    });

    return {
      success: true,
      message: 'Phone number updated successfully',
    };
  }

  /** Commits a password hash, session invalidation, and activity atomically. */
  private async updatePasswordAndInvalidateSessions(
    user: User,
    password: string,
    action: 'user.password_reset' | 'user.password_changed',
    title: string,
    audit: CredentialAuditContext,
  ): Promise<void> {
    const hashedPassword = await hashPassword(password);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(user.tenant_id)}, true)`;
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          auth_version: { increment: 1 },
        },
      });
      await this.activityLogService.create(
        {
          tenantId: user.tenant_id,
          actorUserId: user.id,
          entityType: ActivityEntityTypes.User,
          entityId: user.id,
          action,
          title,
          metadata: { sessionsInvalidated: true },
          source: ActivitySources.Dashboard,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
        tx,
      );
    });
  }

  /** Rejects missing and non-owner users for shared merchant phone changes. */
  private assertOwnerCanChangePhone(
    user:
      | (User & { tenant: { id: number; phone: string } })
      | null,
  ): asserts user is User & { tenant: { id: number; phone: string } } {
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.role !== UserRole.owner) {
      throw new ForbiddenException('Only the merchant owner can change phone');
    }
  }

  /** Enforces global user and tenant phone uniqueness on a chosen client. */
  private async assertPhoneAvailable(
    phone: string,
    userId: number,
    tenantId: number,
    db: Prisma.TransactionClient,
  ): Promise<void> {
    const [phoneUser, phoneTenant] = await Promise.all([
      db.user.findUnique({ where: { phone }, select: { id: true } }),
      db.tenant.findUnique({ where: { phone }, select: { id: true } }),
    ]);

    if (
      (phoneUser && phoneUser.id !== userId) ||
      (phoneTenant && phoneTenant.id !== tenantId)
    ) {
      throw new ConflictException('Phone number is already in use');
    }
  }

  /** Signs a short-lived challenge tied to one Twilio verification SID. */
  private createPhoneChangeChallenge(
    payload: Omit<PhoneChangeChallengePayload, 'tokenType'>,
  ) {
    const challengeToken = this.jwtService.sign(
      {
        ...payload,
        tokenType: PHONE_CHANGE_CHALLENGE_TOKEN_TYPE,
      },
      { expiresIn: PHONE_CHANGE_CHALLENGE_TTL_SECONDS },
    );

    return {
      challengeToken,
      maskedPhone: maskPhoneNumber(payload.newPhone),
      expiresInSeconds: PHONE_CHANGE_CHALLENGE_TTL_SECONDS,
    };
  }

  /** Validates challenge purpose, expiry, shape, and authenticated ownership. */
  private verifyPhoneChangeChallenge(
    challengeToken: string,
    userId: number,
  ): PhoneChangeChallengePayload {
    try {
      const payload =
        this.jwtService.verify<PhoneChangeChallengePayload>(challengeToken);
      if (
        payload.tokenType !== PHONE_CHANGE_CHALLENGE_TOKEN_TYPE ||
        payload.userId !== userId ||
        !Number.isInteger(payload.tenantId) ||
        !payload.newPhone ||
        !payload.verificationSid
      ) {
        throw new Error('Invalid phone-change challenge payload');
      }
      return payload;
    } catch {
      throw new BadRequestException('Invalid or expired phone change');
    }
  }

  // Helper for registering via API if needed (or seeding)
  async register(
    phone: string,
    pass: string,
    tenantId: number,
    role: UserRole,
  ) {
    return this.usersService.create({
      phone,
      password: pass,
      name: phone, // fallback to phone if no name is provided in register helper
      tenant_id: tenantId,
      role,
    });
  }
}
