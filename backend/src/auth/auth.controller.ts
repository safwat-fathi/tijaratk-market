import { AuthExceptionFilter } from '../common/filters/auth-exceptions.filter';
import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { VerifyPasswordResetDto } from './dto/verify-password-reset.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { AuthGuard } from '@nestjs/passport';
@ApiTags('auth')
@Controller('auth')
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Login with phone and password',
    description: 'Login with phone and password',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Return JWT access token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.phone,
      loginDto.pass,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('signup')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Register a new tenant',
    description: 'Register a new tenant/store owner',
  })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: 'Tenant successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset/request')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request merchant password reset OTP',
    description: 'Sends a WhatsApp OTP if the merchant phone exists',
  })
  @ApiBody({ type: RequestPasswordResetDto })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.phone);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify merchant password reset OTP',
    description: 'Verifies the OTP and updates the merchant password',
  })
  @ApiBody({ type: VerifyPasswordResetDto })
  async verifyPasswordReset(@Body() dto: VerifyPasswordResetDto) {
    return this.authService.verifyPasswordReset(
      dto.phone,
      dto.otp,
      dto.password,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('update-password')
  @UseGuards(AuthGuard('jwt'), ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user password',
    description: 'Updates the password for a logged-in user',
  })
  @ApiBody({ type: UpdatePasswordDto })
  async updatePassword(@Req() req: Request, @Body() dto: UpdatePasswordDto) {
    const userId = (req as any).user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User not found in token');
    }
    return this.authService.updatePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
