import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import CONSTANTS from 'src/common/constants';
import { UploadFile } from 'src/common/decorators/upload-file.decorator';
import { prescriptionFileFilter } from 'src/common/utils/file-filters';
import { MetaConversionsService } from 'src/meta-conversions/meta-conversions.service';
import { CheckoutStorefrontCartDraftDto } from './dto/checkout-storefront-cart-draft.dto';
import { UpdateStorefrontCartDraftDto } from './dto/update-storefront-cart-draft.dto';
import { StorefrontCartDraftsService } from './storefront-cart-drafts.service';
import { GoogleAnalyticsService } from 'src/google-analytics/google-analytics.service';

const CART_TOKEN_HEADER = 'x-storefront-cart-token';

/** Public, opaque-token API used by the merchant storefront server actions. */
@ApiTags('Storefront cart drafts')
@Controller('storefront-cart-drafts')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class StorefrontCartDraftsController {
  constructor(
    private readonly draftsService: StorefrontCartDraftsService,
    private readonly metaConversionsService: MetaConversionsService,
    private readonly googleAnalyticsService: GoogleAnalyticsService,
  ) {}

  @Get(':tenant_slug')
  @ApiOperation({ summary: 'Resolve the current anonymous merchant cart' })
  @ApiHeader({ name: CART_TOKEN_HEADER, required: false })
  @ApiResponse({ status: HttpStatus.OK })
  /** Returns the active draft addressed by the optional opaque token. */
  getDraft(
    @Param('tenant_slug') tenantSlug: string,
    @Headers(CART_TOKEN_HEADER) token?: string,
  ) {
    return this.draftsService.getDraft(tenantSlug, token);
  }

  @Put(':tenant_slug')
  @ApiOperation({ summary: 'Create or replace an anonymous merchant cart' })
  @ApiHeader({ name: CART_TOKEN_HEADER, required: false })
  @ApiBody({ type: UpdateStorefrontCartDraftDto })
  @ApiResponse({ status: HttpStatus.OK })
  /** Creates or replaces a merchant-scoped draft snapshot. */
  saveDraft(
    @Param('tenant_slug') tenantSlug: string,
    @Headers(CART_TOKEN_HEADER) token: string | undefined,
    @Body() input: UpdateStorefrontCartDraftDto,
  ) {
    return this.draftsService.saveDraft(tenantSlug, token, input);
  }

  @Post(':tenant_slug/prescription')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Attach a temporary prescription to a pharmacy cart' })
  @ApiHeader({ name: CART_TOKEN_HEADER, required: true })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['prescription_file'],
      properties: {
        prescription_file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UploadFile('prescription_file', {
    dest: join(process.cwd(), 'uploads', 'prescriptions'),
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'prescriptions'),
      filename: (_request, file, callback) => {
        const extension = extname(file.originalname || '').toLowerCase();
        callback(
          null,
          `draft-prescription-${Date.now()}-${randomUUID()}${extension}`,
        );
      },
    }),
    fileFilter: prescriptionFileFilter,
    limits: { fileSize: CONSTANTS.UPLOAD.MAX_IMAGE_SIZE_BYTES },
  })
  @ApiResponse({ status: HttpStatus.CREATED })
  /** Stores a validated temporary pharmacy prescription. */
  attachPrescription(
    @Param('tenant_slug') tenantSlug: string,
    @Headers(CART_TOKEN_HEADER) token: string | undefined,
    @UploadedFile() upload?: Express.Multer.File,
  ) {
    return this.draftsService.attachPrescription(tenantSlug, token, upload);
  }

  @Delete(':tenant_slug/prescription')
  @ApiOperation({ summary: 'Remove a temporary prescription from a cart' })
  @ApiHeader({ name: CART_TOKEN_HEADER, required: true })
  @ApiResponse({ status: HttpStatus.OK })
  /** Detaches and deletes a temporary prescription. */
  removePrescription(
    @Param('tenant_slug') tenantSlug: string,
    @Headers(CART_TOKEN_HEADER) token?: string,
  ) {
    return this.draftsService.removePrescription(tenantSlug, token);
  }

  @Post(':tenant_slug/checkout')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Finalize a merchant cart exactly once' })
  @ApiHeader({ name: CART_TOKEN_HEADER, required: true })
  @ApiBody({ type: CheckoutStorefrontCartDraftDto })
  @ApiResponse({ status: HttpStatus.CREATED })
  /** Finalizes the draft using consented request-level attribution. */
  checkout(
    @Req() request: Request,
    @Param('tenant_slug') tenantSlug: string,
    @Headers(CART_TOKEN_HEADER) token: string | undefined,
    @Body() input: CheckoutStorefrontCartDraftDto,
  ) {
    return this.draftsService.checkout(
      tenantSlug,
      token,
      input,
      this.metaConversionsService.buildTrackingContext(
        request,
        'tenant',
        `/${encodeURIComponent(tenantSlug)}/checkout`,
      ),
      this.googleAnalyticsService.buildTrackingContext(
        request,
        input.ga_client_id,
        input.ga_session_id,
      ),
    );
  }
}
