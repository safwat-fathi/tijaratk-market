import { Injectable, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { User, UserRole } from '../../generated/prisma/client';
import { TenantsService } from '../tenants/tenants.service';
import { SignupDto } from './dto/signup.dto';
import { formatPhoneNumber } from 'src/common/utils/phone.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';

@Injectable()
export class AuthService {
  private static readonly PASSWORD_RESET_OTP_TTL_MINUTES = 10;
  private static readonly PASSWORD_RESET_MAX_ATTEMPTS = 5;

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

    const user =
      await this.usersService.findOneByPhoneWithPassword(normalizedPhone);
    if (!user) {
      return null;
    }
    const isMatch = await bcrypt.compare(pass, user.password);
    if (user && isMatch) {
      // Create a copy and remove password to safely satisfy strict typing
      const result = { ...user } as Partial<User>;
      delete result.password;
      return result as Omit<User, 'password'>;
    }
    return null;
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

    // 1. Create Tenant
    const tenant = await this.tenantsService.create(storeName, phone, category);

    // 2. Create User (Owner)
    const user = await this.usersService.create({
      phone,
      password,
      name,
      role: UserRole.owner,
      tenant_id: tenant.id, // Link to the new tenant
    });

    // 3. Return Login Response
    return this.login(user);
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

    const activeOtp = await this.prisma.passwordResetOtp.findFirst({
      where: {
        phone,
        consumed_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (activeOtp) {
      return {
        success: true,
        message: 'If this phone exists, a reset code has been sent.',
      };
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(
      Date.now() + AuthService.PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000,
    );

    await this.prisma.passwordResetOtp.create({
      data: {
        phone,
        otp_hash: otpHash,
        expires_at: expiresAt,
      },
    });

    await this.whatsappService.sendTemplatedMessage({
      key: 'merchant_password_reset_otp',
      to: phone,
      payload: {
        otp,
        expiresInMinutes: AuthService.PASSWORD_RESET_OTP_TTL_MINUTES,
      },
    });

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

    const resetOtp = await this.prisma.passwordResetOtp.findFirst({
      where: {
        phone,
        consumed_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!resetOtp) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    if (resetOtp.attempt_count >= AuthService.PASSWORD_RESET_MAX_ATTEMPTS) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const isValidOtp = await bcrypt.compare(otp, resetOtp.otp_hash);
    if (!isValidOtp) {
      await this.prisma.passwordResetOtp.update({
        where: { id: resetOtp.id },
        data: { attempt_count: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired reset code');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash },
      }),
      this.prisma.passwordResetOtp.update({
        where: { id: resetOtp.id },
        data: { consumed_at: new Date() },
      }),
    ]);

    return {
      success: true,
      message: 'Password reset successfully',
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
