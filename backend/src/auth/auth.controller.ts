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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { VerifyPasswordResetDto } from './dto/verify-password-reset.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { RequestPhoneChangeDto } from './dto/request-phone-change.dto';
import { ResendPhoneChangeDto } from './dto/resend-phone-change.dto';
import { VerifyPhoneChangeDto } from './dto/verify-phone-change.dto';
import {
  CredentialChangeResponseDto,
  PhoneChangeChallengeResponseDto,
} from './dto/auth-responses.dto';

type AuthenticatedRequest = Request & {
  requestId?: string;
  user?: {
    userId?: number;
    tenant_id?: number;
    role?: string;
  };
};

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
  async login(@Body() loginDto: LoginDto, @Req() req: AuthenticatedRequest) {
    const user = await this.authService.validateUser(
      loginDto.phone,
      loginDto.pass,
      req.requestId,
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
    summary: 'Submit a merchant application',
    description:
      'Create a pending tenant/store owner application for admin review',
  })
  @ApiBody({ type: SignupDto })
  @ApiResponse({
    status: 201,
    description: 'Merchant application received without issuing a token',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async signup(@Body() signupDto: SignupDto, @Req() req: AuthenticatedRequest) {
    return this.authService.signup(signupDto, req.requestId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset/request')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request merchant password reset OTP',
    description:
      'Starts a Twilio Verify SMS flow without revealing account existence',
  })
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiResponse({ status: 200, type: CredentialChangeResponseDto })
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
  @ApiResponse({ status: 200, type: CredentialChangeResponseDto })
  async verifyPasswordReset(
    @Body() dto: VerifyPasswordResetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.verifyPasswordReset(
      dto.phone,
      dto.otp,
      dto.password,
      { requestId: req.requestId, ipAddress: req.ip },
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
  @ApiResponse({ status: 200, type: CredentialChangeResponseDto })
  async updatePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdatePasswordDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not found in token');
    }
    return this.authService.updatePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      { requestId: req.requestId, ipAddress: req.ip },
    );
  }

  /** Starts a verified login and store-contact phone change for an owner. */
  @HttpCode(HttpStatus.OK)
  @Post('phone-change/request')
  @UseGuards(AuthGuard('jwt'), ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request merchant phone change',
    description:
      'Verifies the owner password and sends an SMS code to the new number',
  })
  @ApiBody({ type: RequestPhoneChangeDto })
  @ApiResponse({ status: 200, type: PhoneChangeChallengeResponseDto })
  @ApiResponse({ status: 403, description: 'Merchant owner role required' })
  @ApiResponse({ status: 409, description: 'Phone number is already in use' })
  async requestPhoneChange(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RequestPhoneChangeDto,
  ) {
    return this.authService.requestPhoneChange(
      this.authenticatedUserId(req),
      dto.currentPassword,
      dto.newPhone,
    );
  }

  /** Resends the SMS code for a valid phone-change challenge. */
  @HttpCode(HttpStatus.OK)
  @Post('phone-change/resend')
  @UseGuards(AuthGuard('jwt'), ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend merchant phone-change verification code' })
  @ApiBody({ type: ResendPhoneChangeDto })
  @ApiResponse({ status: 200, type: PhoneChangeChallengeResponseDto })
  async resendPhoneChange(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ResendPhoneChangeDto,
  ) {
    return this.authService.resendPhoneChange(
      this.authenticatedUserId(req),
      dto.challengeToken,
    );
  }

  /** Verifies the SMS code and commits the owner/store phone change. */
  @HttpCode(HttpStatus.OK)
  @Post('phone-change/verify')
  @UseGuards(AuthGuard('jwt'), ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify and commit merchant phone change' })
  @ApiBody({ type: VerifyPhoneChangeDto })
  @ApiResponse({ status: 200, type: CredentialChangeResponseDto })
  @ApiResponse({ status: 409, description: 'Phone number is already in use' })
  async verifyPhoneChange(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyPhoneChangeDto,
  ) {
    return this.authService.verifyPhoneChange(
      this.authenticatedUserId(req),
      dto.challengeToken,
      dto.otp,
      { requestId: req.requestId, ipAddress: req.ip },
    );
  }

  /** Returns the authenticated merchant ID or rejects a malformed session. */
  private authenticatedUserId(req: AuthenticatedRequest): number {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not found in token');
    }
    return userId;
  }
}
