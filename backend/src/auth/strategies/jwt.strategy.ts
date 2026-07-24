import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantStatus } from '../../../generated/prisma/client';
import { MERCHANT_ACCESS_TOKEN_TYPE } from '../auth-token.constants';

const cookieTokenExtractor = (request: Request): string | null => {
  if (!request?.cookies) {
    return null;
  }

  const token: unknown = request.cookies.access_token;
  if (typeof token !== 'string' || !token.trim()) {
    return null;
  }

  return token;
};

type JwtPayload = {
  sub: number;
  tokenType?: string;
  authVersion?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
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
    });
  }

  async validate(payload: JwtPayload) {
    if (
      payload.tokenType &&
      payload.tokenType !== MERCHANT_ACCESS_TOKEN_TYPE
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: { select: { status: true } } },
    });

    const tokenAuthVersion = payload.authVersion ?? 0;
    if (
      !user ||
      user.tenant.status !== TenantStatus.active ||
      user.auth_version !== tokenAuthVersion
    ) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,
      phone: user.phone,
      tenant_id: user.tenant_id,
      role: user.role,
    };
  }
}
