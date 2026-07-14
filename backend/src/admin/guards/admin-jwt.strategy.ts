import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminAuditService } from 'src/admin-audit/admin-audit.service';
import {
  AdminAuditEntityType,
  AdminAuditOutcome,
} from '../../../generated/prisma/client';

const cookieTokenExtractor = (request: Request): string | null => {
  if (!request?.cookies) {
    return null;
  }

  const token: unknown = request.cookies.admin_access_token;
  if (typeof token !== 'string' || !token.trim()) {
    return null;
  }

  return token;
};

type AdminJwtPayload = {
  sub: number;
  phone: string;
  role: string;
};

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAuditService: AdminAuditService,
    configService: ConfigService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET is required to validate authentication tokens.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieTokenExtractor,
      ]),
      secretOrKey: jwtSecret,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request & { requestId?: string },
    payload: AdminJwtPayload,
  ) {
    if (payload.role !== 'admin') {
      throw new UnauthorizedException('Not an admin token');
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        is_active: true,
      },
    });

    if (!user || !user.is_active) {
      if (user) {
        const forwarded = request.headers['x-forwarded-for'];
        await this.adminAuditService.record({
          actor: { id: user.id, name: user.name, role: user.role },
          entityType: AdminAuditEntityType.admin,
          entityId: user.id,
          action: 'admin.authentication.denied',
          title: 'تم رفض مصادقة مسؤول غير نشط',
          outcome: AdminAuditOutcome.denied,
          requestId: request.requestId,
          ipAddress:
            typeof forwarded === 'string'
              ? forwarded.split(',')[0]?.trim()
              : request.ip,
          metadata: { denial_code: 'ADMIN_INACTIVE' },
        });
      }
      throw new UnauthorizedException();
    }

    return {
      userId: payload.sub,
      phone: user.phone,
      name: user.name,
      role: user.role,
    };
  }
}
