import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

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

  async validate(payload: AdminJwtPayload) {
    if (payload.role !== 'admin') {
      throw new UnauthorizedException('Not an admin token');
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      userId: payload.sub,
      phone: payload.phone,
      role: payload.role,
    };
  }
}
