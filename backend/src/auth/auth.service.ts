import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import twilio from 'twilio';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import {
  TenantStatus,
  User,
  UserRole,
} from '../../generated/prisma/client';
import { TenantsService } from '../tenants/tenants.service';
import { SignupDto } from './dto/signup.dto';
import { formatPhoneNumber } from 'src/common/utils/phone.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private twilioClient: twilio.Twilio | null = null;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private tenantsService: TenantsService,
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
  ) {}

  async validateUser(
    phone: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    const normalizedPhone = formatPhoneNumber(phone);

    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: { tenant: { select: { status: true } } },
    });
    if (!user) {
      return null;
    }
    const isMatch = await bcrypt.compare(pass, user.password);
    if (isMatch) {
      this.assertTenantCanLogin(user.tenant.status);
      // Create a copy and remove password to safely satisfy strict typing
      const result = { ...user } as Partial<User>;
      delete result.password;
      delete (result as Partial<User> & { tenant?: unknown }).tenant;
      return result as Omit<User, 'password'>;
    }
    return null;
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
      phone: user.phone,
      tenantId: user.tenant_id,
      role: user.role,
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

  async signup(signupDto: SignupDto) {
    const { phone: rawPhone, password, storeName, name, category } = signupDto;

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

      await this.usersService.create(
        {
          phone,
          password,
          name,
          role: UserRole.owner,
          tenant_id: tenant.id,
        },
        tx,
      );
    });

    return {
      status: TenantStatus.pending,
      code: 'MERCHANT_APPLICATION_RECEIVED',
      message: 'تم استلام طلب انضمام متجرك وسيتم التواصل معك بعد المراجعة.',
    };
  }

  private isNotificationsEnabled(): boolean {
    return String(process.env.WHATSAPP_NOTIFICATIONS_ENABLED) !== 'false';
  }

  private getTwilioClient(): twilio.Twilio | null {
    if (this.twilioClient) {
      return this.twilioClient;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.AUTH_TOKEN;

    if (!accountSid || !authToken) {
      this.logger.warn('Twilio env vars are missing; Verify will fail.');
      return null;
    }

    this.twilioClient = twilio(accountSid, authToken);
    return this.twilioClient;
  }

  private maskPhone(value: string): string {
    const visibleSuffix = value.slice(-4);
    return `${'*'.repeat(Math.max(0, value.length - 4))}${visibleSuffix}`;
  }

  async requestPasswordReset(rawPhone: string) {
    const phone = formatPhoneNumber(rawPhone);
    const user = await this.usersService.findOneByPhone(phone);

    if (!user) {
      return {
        success: true,
        message: 'If this phone exists, a reset code has been sent.',
      };
    }

    try {
      if (!this.isNotificationsEnabled()) {
        this.logger.log(`Notifications disabled; would send Verify SMS to ${phone}.`);
      } else {
        const client = this.getTwilioClient();
        const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

        if (!client || !serviceSid) {
          throw new Error('Twilio client or TWILIO_VERIFY_SERVICE_SID is missing');
        }

        const to = phone.startsWith('+') ? phone : `+${phone}`;
        this.logger.log(`Sending Verify SMS to ${this.maskPhone(to)}`);
        
        await client.verify.v2
          .services(serviceSid)
          .verifications.create({ to, channel: 'sms' });
          
        this.logger.log(`Verify SMS sent to ${this.maskPhone(to)}`);
      }
    } catch (error) {
      this.logger.error('Failed to send Verify SMS', error);
      throw new BadRequestException('Could not send reset code. Please try again later.');
    }

    return {
      success: true,
      message: 'If this phone exists, a reset code has been sent.',
    };
  }

  async verifyPasswordReset(rawPhone: string, otp: string, password: string) {
    const phone = formatPhoneNumber(rawPhone);
    const user = await this.usersService.findOneByPhone(phone);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    let isValid = false;

    if (!this.isNotificationsEnabled()) {
      this.logger.log(`Notifications disabled; mocking Verify check for ${phone} as true.`);
      isValid = true;
    } else {
      const client = this.getTwilioClient();
      const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

      if (!client || !serviceSid) {
        this.logger.warn('Twilio client or TWILIO_VERIFY_SERVICE_SID is missing');
        throw new BadRequestException('Invalid or expired reset code');
      }

      const to = phone.startsWith('+') ? phone : `+${phone}`;

      try {
        const verificationCheck = await client.verify.v2
          .services(serviceSid)
          .verificationChecks.create({ to, code: otp });
        
        isValid = verificationCheck.status === 'approved';
      } catch (error) {
        this.logger.error(`Failed to check Verify token for ${to}`, error);
        isValid = false;
      }
    }

    if (!isValid) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  async updatePassword(userId: number, currentPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPass, user.password);
    if (!isMatch) {
      throw new BadRequestException('Incorrect current password');
    }

    const passwordHash = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });

    return {
      success: true,
      message: 'Password updated successfully',
    };
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
