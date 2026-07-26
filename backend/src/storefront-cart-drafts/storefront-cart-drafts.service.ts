import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { access, rm } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  Order,
  OrderItemSelectionMode as PrismaSelectionMode,
  OrderSource,
  Prisma,
  Product,
  StorefrontCartDraft,
  Tenant,
  TenantCategory,
  TenantStatus,
} from '../../generated/prisma/client';
import { DbTenantContext } from 'src/common/contexts/db-tenant.context';
import { OrderItemSelectionMode } from 'src/common/enums/order-item-selection-mode.enum';
import { OrderType } from 'src/common/enums/order-type.enum';
import { ProductOrderMode } from 'src/common/enums/product-order-mode.enum';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { UnavailableItemAction } from 'src/common/enums/unavailable-item-action.enum';
import type { MetaTrackingContext } from 'src/meta-conversions/meta-conversions.types';
import type { Ga4TrackingContext } from 'src/google-analytics/google-analytics.types';
import { OrdersService } from 'src/orders/orders.service';
import { CreateOrderDto, CreateOrderItemDto } from 'src/orders/dto/create-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { CheckoutStorefrontCartDraftDto } from './dto/checkout-storefront-cart-draft.dto';
import {
  StorefrontCartDraftItemDto,
  UpdateStorefrontCartDraftDto,
} from './dto/update-storefront-cart-draft.dto';

const DRAFT_TTL_MS = 24 * 60 * 60 * 1_000;
const CHECKOUT_LOCK_TIMEOUT_MS = 5 * 60 * 1_000;

type DraftWithRelations = Prisma.StorefrontCartDraftGetPayload<{
  include: {
    items: { include: { product: true } };
    delivery_area: true;
    completed_order: {
      include: { customer: { include: { global_customer: true } } };
    };
  };
}>;

type PrescriptionUpload = Pick<
  Express.Multer.File,
  'filename' | 'mimetype' | 'originalname' | 'path'
>;

type MerchantTenant = Pick<Tenant, 'id' | 'category' | 'status'>;

/** Owns anonymous merchant cart persistence, validation, and final checkout. */
@Injectable()
export class StorefrontCartDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly ordersService: OrdersService,
  ) {}

  /** Resolves a non-expired draft and returns current tenant-scoped product data. */
  async getDraft(tenantSlug: string, token?: string) {
    if (!token?.trim()) return null;
    const tenant = await this.requireMerchantTenant(tenantSlug);
    return this.withTenant(tenant.id, async (manager) => {
      const draft = await this.findDraft(manager, tenant.id, token);
      return draft ? this.serializeDraft(manager, draft) : null;
    });
  }

  /** Replaces the serializable draft contents after validating every merchant product. */
  async saveDraft(
    tenantSlug: string,
    token: string | undefined,
    input: UpdateStorefrontCartDraftDto,
  ) {
    const tenant = await this.requireMerchantTenant(tenantSlug);
    const uniqueItems = Array.from(
      new Map(input.items.map((item) => [item.product_id, item])).values(),
    );

    const savedToken = await this.withTenant(tenant.id, async (manager) => {
      const products = uniqueItems.length
        ? await manager.product.findMany({
            where: {
              id: { in: uniqueItems.map((item) => item.product_id) },
              tenant_id: tenant.id,
              status: ProductStatus.ACTIVE,
              deleted_at: null,
              is_available: true,
            },
          })
        : [];
      const productsById = new Map(products.map((product) => [product.id, product]));
      if (products.length !== uniqueItems.length) {
        throw new BadRequestException(
          'بعض المنتجات لم تعد متاحة في هذا المتجر. راجع السلة وحاول مرة أخرى.',
        );
      }
      for (const item of uniqueItems) {
        this.validateSelection(item, productsById.get(item.product_id));
      }

      if (input.delivery_area_id) {
        await this.requireDeliveryArea(manager, tenant.id, input.delivery_area_id);
      }

      const existing = token?.trim()
        ? await this.findDraft(manager, tenant.id, token)
        : null;
      if (
        existing?.checkout_started_at &&
        existing.checkout_started_at >
          new Date(Date.now() - CHECKOUT_LOCK_TIMEOUT_MS)
      ) {
        throw new ConflictException('جاري تأكيد الطلب بالفعل. انتظر لحظة.');
      }
      const expiresAt = new Date(Date.now() + DRAFT_TTL_MS);
      const draft = existing?.completed_order_id
        ? null
        : existing;
      let persisted: StorefrontCartDraft;
      if (draft) {
        const updated = await manager.storefrontCartDraft.updateMany({
          where: {
            id: draft.id,
            completed_order_id: null,
            OR: [
              { checkout_started_at: null },
              {
                checkout_started_at: {
                  lt: new Date(Date.now() - CHECKOUT_LOCK_TIMEOUT_MS),
                },
              },
            ],
          },
          data: {
            delivery_area_id: input.delivery_area_id ?? null,
            free_text_payload: input.free_text_payload?.trim() || null,
            unavailable_item_action:
              input.unavailable_item_action ??
              UnavailableItemAction.SUGGEST_REPLACEMENT,
            order_source: this.normalizeOrderSource(
              input.order_source ?? draft.order_source,
            ),
            source_metadata: this.normalizeSourceMetadata(
              input.source_metadata,
            ),
            prescription_unavailability_action:
              input.prescription_unavailability_action?.trim() || null,
            checkout_started_at: null,
            expires_at: expiresAt,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('جاري تأكيد الطلب بالفعل. انتظر لحظة.');
        }
        persisted = await manager.storefrontCartDraft.findUniqueOrThrow({
          where: { id: draft.id },
        });
      } else {
        persisted = await manager.storefrontCartDraft.create({
          data: {
            tenant_id: tenant.id,
            delivery_area_id: input.delivery_area_id ?? null,
            free_text_payload: input.free_text_payload?.trim() || null,
            unavailable_item_action:
              input.unavailable_item_action ??
              UnavailableItemAction.SUGGEST_REPLACEMENT,
            order_source: this.normalizeOrderSource(input.order_source),
            source_metadata: this.normalizeSourceMetadata(
              input.source_metadata,
            ),
            prescription_unavailability_action:
              input.prescription_unavailability_action?.trim() || null,
            expires_at: expiresAt,
          },
        });
      }

      await manager.storefrontCartDraftItem.deleteMany({
        where: { draft_id: persisted.id },
      });
      if (uniqueItems.length > 0) {
        await manager.storefrontCartDraftItem.createMany({
          data: uniqueItems.map((item) => ({
            draft_id: persisted.id,
            product_id: item.product_id,
            selection_mode: item.selection_mode as PrismaSelectionMode,
            selection_quantity:
              item.selection_mode === OrderItemSelectionMode.QUANTITY
                ? item.selection_quantity
                : null,
            selection_grams:
              item.selection_mode === OrderItemSelectionMode.WEIGHT
                ? item.selection_grams
                : null,
            selection_amount_egp:
              item.selection_mode === OrderItemSelectionMode.PRICE
                ? item.selection_amount_egp
                : null,
            unit_option_id:
              item.selection_mode === OrderItemSelectionMode.QUANTITY
                ? item.unit_option_id?.trim() || null
                : null,
            item_note: item.item_note?.trim() || null,
          })),
        });
      }
      return persisted.token;
    });

    return this.getDraft(tenantSlug, savedToken);
  }

  /** Attaches a validated pharmacy prescription to an existing draft. */
  async attachPrescription(
    tenantSlug: string,
    token: string | undefined,
    upload: PrescriptionUpload | undefined,
  ) {
    if (!upload) throw new BadRequestException('اختر ملف الروشتة أولاً.');
    let attached = false;
    try {
      const tenant = await this.requireMerchantTenant(tenantSlug);
      if (tenant.category !== TenantCategory.pharmacy) {
        throw new ForbiddenException('رفع الروشتة متاح للصيدليات فقط.');
      }
      if (!token?.trim()) throw new BadRequestException('سلة الطلب غير متاحة.');

      let previousPath: string | null = null;
      await this.withTenant(tenant.id, async (manager) => {
        const draft = await this.findDraft(manager, tenant.id, token);
        if (!draft || draft.completed_order_id) {
          throw new NotFoundException('انتهت صلاحية سلة الطلب.');
        }
        if (
          draft.checkout_started_at &&
          draft.checkout_started_at >
            new Date(Date.now() - CHECKOUT_LOCK_TIMEOUT_MS)
        ) {
          throw new ConflictException('جاري تأكيد الطلب بالفعل. انتظر لحظة.');
        }
        previousPath = draft.prescription_file_path;
        const updated = await manager.storefrontCartDraft.updateMany({
          where: {
            id: draft.id,
            completed_order_id: null,
            OR: [
              { checkout_started_at: null },
              {
                checkout_started_at: {
                  lt: new Date(Date.now() - CHECKOUT_LOCK_TIMEOUT_MS),
                },
              },
            ],
          },
          data: {
            prescription_file_path: upload.path,
            prescription_original_filename: upload.originalname.trim().slice(0, 255),
            prescription_mime_type: upload.mimetype.trim().slice(0, 120),
            expires_at: new Date(Date.now() + DRAFT_TTL_MS),
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('جاري تأكيد الطلب بالفعل. انتظر لحظة.');
        }
      });
      attached = true;
      if (previousPath && previousPath !== upload.path) {
        await this.deleteDraftFile(previousPath);
      }
      return this.getDraft(tenantSlug, token);
    } catch (error) {
      if (!attached) await this.deleteDraftFile(upload.path);
      throw error;
    }
  }

  /** Removes an unsubmitted prescription from a draft. */
  async removePrescription(tenantSlug: string, token?: string) {
    if (!token?.trim()) return null;
    const tenant = await this.requireMerchantTenant(tenantSlug);
    let filePath: string | null = null;
    await this.withTenant(tenant.id, async (manager) => {
      const draft = await this.findDraft(manager, tenant.id, token);
      if (!draft || draft.completed_order_id) return;
      if (
        draft.checkout_started_at &&
        draft.checkout_started_at >
          new Date(Date.now() - CHECKOUT_LOCK_TIMEOUT_MS)
      ) {
        throw new ConflictException('جاري تأكيد الطلب بالفعل. انتظر لحظة.');
      }
      filePath = draft.prescription_file_path;
      const updated = await manager.storefrontCartDraft.updateMany({
        where: {
          id: draft.id,
          completed_order_id: null,
          OR: [
            { checkout_started_at: null },
            {
              checkout_started_at: {
                lt: new Date(Date.now() - CHECKOUT_LOCK_TIMEOUT_MS),
              },
            },
          ],
        },
        data: {
          prescription_file_path: null,
          prescription_original_filename: null,
          prescription_mime_type: null,
          prescription_unavailability_action: null,
          expires_at: new Date(Date.now() + DRAFT_TTL_MS),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('جاري تأكيد الطلب بالفعل. انتظر لحظة.');
      }
    });
    if (filePath) await this.deleteDraftFile(filePath);
    return this.getDraft(tenantSlug, token);
  }

  /** Claims and finalizes a draft exactly once through the existing order service. */
  async checkout(
    tenantSlug: string,
    token: string | undefined,
    input: CheckoutStorefrontCartDraftDto,
    metaTrackingContext?: MetaTrackingContext,
    ga4TrackingContext?: Ga4TrackingContext,
  ) {
    if (!token?.trim()) throw new BadRequestException('سلة الطلب غير متاحة.');
    const tenant = await this.requireMerchantTenant(tenantSlug);
    const staleBefore = new Date(Date.now() - CHECKOUT_LOCK_TIMEOUT_MS);

    const claimed = await this.withTenant(tenant.id, async (manager) => {
      const current = await this.findDraft(manager, tenant.id, token);
      if (!current) throw new NotFoundException('انتهت صلاحية سلة الطلب.');
      if (current.completed_order) {
        return { completed: current.completed_order, draft: current } as const;
      }
      const result = await manager.storefrontCartDraft.updateMany({
        where: {
          id: current.id,
          completed_order_id: null,
          OR: [
            { checkout_started_at: null },
            { checkout_started_at: { lt: staleBefore } },
          ],
        },
        data: { checkout_started_at: new Date() },
      });
      if (result.count !== 1) {
        throw new ConflictException('جاري تأكيد الطلب بالفعل. انتظر لحظة.');
      }
      return { completed: null, draft: current } as const;
    });

    if (claimed.completed) {
      return this.serializeCompletedOrder(claimed.completed);
    }

    const draft = claimed.draft;
    const activeItems = draft.items.filter(
      (item) =>
        item.product.tenant_id === tenant.id &&
        item.product.status === ProductStatus.ACTIVE &&
        item.product.deleted_at === null &&
        item.product.is_available,
    );
    if (
      activeItems.length === 0 &&
      !draft.free_text_payload?.trim() &&
      !draft.prescription_file_path
    ) {
      await this.releaseCheckoutClaim(tenant.id, draft.id);
      throw new BadRequestException('أضف منتجاً أو طلباً خاصاً قبل المتابعة.');
    }
    if (!draft.delivery_area_id) {
      await this.releaseCheckoutClaim(tenant.id, draft.id);
      throw new BadRequestException('حدد منطقة التوصيل من السلة أولاً.');
    }
    if (!input.customer.address?.trim() && !input.delivery_address?.trim()) {
      await this.releaseCheckoutClaim(tenant.id, draft.id);
      throw new BadRequestException('اكتب عنوان توصيل واضح.');
    }

    try {
      const prescription = await this.toPrescriptionUpload(draft);
      const createOrderDto: CreateOrderDto = {
        customer: {
          ...input.customer,
          address:
            input.delivery_address?.trim() || input.customer.address?.trim(),
        },
        items: activeItems.map((item) => this.toOrderItem(item)),
        order_type:
          activeItems.length > 0 ? OrderType.CATALOG : OrderType.FREE_TEXT,
        free_text_payload: draft.free_text_payload?.trim()
          ? { text: draft.free_text_payload.trim() }
          : undefined,
        notes: input.notes?.trim() || undefined,
        delivery_area_id: draft.delivery_area_id,
        delivery_slot: input.delivery_slot,
        card_on_delivery_requested: input.card_on_delivery_requested,
        unavailable_item_action:
          draft.unavailable_item_action as UnavailableItemAction,
        prescription_unavailability_action:
          draft.prescription_unavailability_action ?? undefined,
        order_source: draft.order_source,
        source_metadata: this.toSourceMetadata(draft.source_metadata),
      };
      const order = await this.ordersService.createForTenantSlug(
        tenantSlug,
        createOrderDto,
        prescription ?? undefined,
        metaTrackingContext,
        {
          preservePrescriptionOnFailure: true,
          ga4TrackingContext,
          afterPersist: async (manager, persistedOrder) => {
            await manager.storefrontCartDraft.update({
              where: { id: draft.id },
              data: {
                completed_order_id: persistedOrder.id,
                checkout_started_at: null,
              },
            });
          },
        },
      );
      return order;
    } catch (error) {
      await this.releaseCheckoutClaim(tenant.id, draft.id);
      throw error;
    }
  }

  /** Resolves an active public tenant that is not a zone operator storefront. */
  private async requireMerchantTenant(slug: string): Promise<MerchantTenant> {
    const tenant = await this.tenantsService.findOneBySlug(slug);
    if (!tenant || tenant.status !== TenantStatus.active) {
      throw new NotFoundException('المتجر غير موجود.');
    }
    const zone = await this.prisma.zoneStorefront.findUnique({
      where: { operator_tenant_id: tenant.id },
      select: { id: true },
    });
    if (zone) throw new NotFoundException('المتجر غير موجود.');
    return tenant;
  }

  /** Finds a non-expired draft and the relations required by cart or checkout. */
  private async findDraft(
    manager: Prisma.TransactionClient,
    tenantId: number,
    token: string,
  ): Promise<DraftWithRelations | null> {
    return manager.storefrontCartDraft.findFirst({
      where: {
        tenant_id: tenantId,
        token: token.trim(),
        expires_at: { gt: new Date() },
      },
      include: {
        items: { include: { product: true }, orderBy: { id: 'asc' } },
        delivery_area: true,
        completed_order: {
          include: { customer: { include: { global_customer: true } } },
        },
      },
    });
  }

  /** Removes invalid selections and derives authoritative draft totals. */
  private async serializeDraft(
    manager: Prisma.TransactionClient,
    draft: DraftWithRelations,
  ) {
    const validItems = draft.items.filter(
      (item) =>
        item.product.tenant_id === draft.tenant_id &&
        item.product.status === ProductStatus.ACTIVE &&
        item.product.deleted_at === null &&
        item.product.is_available,
    );
    const invalidProductIds = draft.items
      .filter((item) => !validItems.includes(item))
      .map((item) => item.product_id);
    const delivery = draft.delivery_area_id
      ? await manager.tenantDeliveryArea.findFirst({
          where: {
            tenant_id: draft.tenant_id,
            area_id: draft.delivery_area_id,
            is_active: true,
            deleted_at: null,
            area: {
              is_active: true,
              deleted_at: null,
              parent_area_id: { not: null },
              parent_area: {
                is: {
                  is_active: true,
                  deleted_at: null,
                },
              },
            },
          },
          select: { delivery_fee: true },
        })
      : null;
    const subtotal = validItems.reduce(
      (sum, item) => sum + this.resolveLineTotal(item),
      0,
    );
    const deliveryFee = delivery ? Number(delivery.delivery_fee) : null;
    return {
      token: draft.token,
      items: validItems.map((item) => ({
        product_id: item.product_id,
        selection_mode: item.selection_mode,
        selection_quantity: item.selection_quantity
          ? Number(item.selection_quantity)
          : undefined,
        selection_grams: item.selection_grams ?? undefined,
        selection_amount_egp: item.selection_amount_egp
          ? Number(item.selection_amount_egp)
          : undefined,
        unit_option_id: item.unit_option_id ?? undefined,
        item_note: item.item_note ?? undefined,
        product: item.product,
      })),
      invalid_product_ids: invalidProductIds,
      free_text_payload: draft.free_text_payload ?? '',
      unavailable_item_action: draft.unavailable_item_action,
      order_source: draft.order_source,
      source_metadata: draft.source_metadata,
      delivery_area_id: delivery ? draft.delivery_area_id : null,
      delivery_area: delivery ? draft.delivery_area : null,
      delivery_fee: deliveryFee,
      subtotal: Number(subtotal.toFixed(2)),
      estimated_total:
        deliveryFee === null
          ? null
          : Number((subtotal + deliveryFee).toFixed(2)),
      has_prescription: Boolean(draft.prescription_file_path),
      prescription_original_filename: draft.prescription_original_filename,
      prescription_unavailability_action:
        draft.prescription_unavailability_action,
      expires_at: draft.expires_at,
      completed: Boolean(draft.completed_order_id),
    };
  }

  /** Verifies that the submitted selection matches the product order mode. */
  private validateSelection(
    item: StorefrontCartDraftItemDto,
    product: Product | undefined,
  ): void {
    if (!product) throw new BadRequestException('المنتج غير متاح.');
    const expectedMode =
      product.order_mode === ProductOrderMode.WEIGHT
        ? OrderItemSelectionMode.WEIGHT
        : product.order_mode === ProductOrderMode.PRICE
          ? OrderItemSelectionMode.PRICE
          : OrderItemSelectionMode.QUANTITY;
    if (item.selection_mode !== expectedMode) {
      throw new BadRequestException(`طريقة طلب ${product.name} غير صالحة.`);
    }
    if (item.unit_option_id && expectedMode !== OrderItemSelectionMode.QUANTITY) {
      throw new BadRequestException(`وحدة ${product.name} غير صالحة.`);
    }
    if (item.unit_option_id && expectedMode === OrderItemSelectionMode.QUANTITY) {
      const config = product.order_config as {
        quantity?: { unit_options?: Array<{ id?: string }> };
      } | null;
      const valid = config?.quantity?.unit_options?.some(
        (option) => option.id === item.unit_option_id,
      );
      if (!valid) throw new BadRequestException(`وحدة ${product.name} غير صالحة.`);
    }
  }

  /** Requires an active delivery-area association for the merchant. */
  private async requireDeliveryArea(
    manager: Prisma.TransactionClient,
    tenantId: number,
    areaId: number,
  ): Promise<void> {
    const area = await manager.tenantDeliveryArea.findFirst({
      where: {
        tenant_id: tenantId,
        area_id: areaId,
        is_active: true,
        deleted_at: null,
        area: {
          is_active: true,
          deleted_at: null,
          parent_area_id: { not: null },
          parent_area: {
            is: {
              is_active: true,
              deleted_at: null,
            },
          },
        },
      },
      select: { area_id: true },
    });
    if (!area) throw new BadRequestException('منطقة التوصيل غير متاحة.');
  }

  /** Converts a validated draft selection to the existing order DTO contract. */
  private toOrderItem(
    item: DraftWithRelations['items'][number],
  ): CreateOrderItemDto {
    return {
      product_id: item.product_id,
      name: item.product.name,
      quantity: '1',
      notes: item.item_note ?? undefined,
      selection_mode: item.selection_mode as OrderItemSelectionMode,
      selection_quantity: item.selection_quantity
        ? Number(item.selection_quantity)
        : undefined,
      selection_grams: item.selection_grams ?? undefined,
      selection_amount_egp: item.selection_amount_egp
        ? Number(item.selection_amount_egp)
        : undefined,
      unit_option_id: item.unit_option_id ?? undefined,
    };
  }

  /** Calculates one estimated line total from current tenant product pricing. */
  private resolveLineTotal(item: DraftWithRelations['items'][number]): number {
    if (item.selection_mode === PrismaSelectionMode.price) {
      return Number(item.selection_amount_egp ?? 0);
    }
    const price = Number(item.product.current_price ?? 0);
    if (!(price > 0)) return 0;
    if (item.selection_mode === PrismaSelectionMode.weight) {
      return (Number(item.selection_grams ?? 0) / 1_000) * price;
    }
    return (
      Number(item.selection_quantity ?? 0) *
      this.resolveUnitMultiplier(item.product.order_config, item.unit_option_id) *
      price
    );
  }

  /** Resolves the selected quantity-unit price multiplier. */
  private resolveUnitMultiplier(orderConfig: unknown, unitOptionId: string | null) {
    if (!unitOptionId || !orderConfig || typeof orderConfig !== 'object') return 1;
    const config = orderConfig as {
      quantity?: { unit_options?: Array<{ id?: string; multiplier?: number }> };
    };
    const option = config.quantity?.unit_options?.find(
      (candidate) => candidate.id === unitOptionId,
    );
    const multiplier = Number(option?.multiplier ?? 1);
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }

  /** Rehydrates a draft-owned upload for the existing order service. */
  private async toPrescriptionUpload(
    draft: DraftWithRelations,
  ): Promise<PrescriptionUpload | null> {
    if (!draft.prescription_file_path) return null;
    try {
      await access(draft.prescription_file_path);
    } catch {
      throw new BadRequestException('ملف الروشتة لم يعد متاحاً. ارفعه مرة أخرى.');
    }
    return {
      path: draft.prescription_file_path,
      filename: basename(draft.prescription_file_path),
      originalname:
        draft.prescription_original_filename ?? basename(draft.prescription_file_path),
      mimetype: draft.prescription_mime_type ?? 'application/octet-stream',
    };
  }

  /** Narrows persisted JSON to order-source metadata. */
  private toSourceMetadata(value: Prisma.JsonValue | null) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  /** Keeps attribution metadata free of arbitrary or customer-identifying fields. */
  private normalizeSourceMetadata(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonObject | undefined {
    if (!value) return undefined;
    const landingSource =
      value.landingSource === 'directory' || value.landingSource === 'qr'
        ? value.landingSource
        : undefined;
    const normalizeText = (candidate: unknown, maxLength: number) =>
      typeof candidate === 'string'
        ? candidate.trim().slice(0, maxLength) || undefined
        : undefined;
    const areaSlug = normalizeText(value.areaSlug, 120);
    const categorySlug = normalizeText(value.categorySlug, 120);
    const landedAt = normalizeText(value.landedAt, 40);
    if (!landingSource) return undefined;
    return {
      landingSource,
      ...(areaSlug ? { areaSlug } : {}),
      ...(categorySlug ? { categorySlug } : {}),
      ...(landedAt ? { landedAt } : {}),
    };
  }

  /** Limits anonymous storefront attribution to browser-origin order sources. */
  private normalizeOrderSource(value?: OrderSource): OrderSource {
    return value === OrderSource.directory
      ? OrderSource.directory
      : OrderSource.storefront;
  }

  /** Restores the public fields returned by an already-completed checkout. */
  private serializeCompletedOrder(
    order: NonNullable<DraftWithRelations['completed_order']> & Order,
  ) {
    const accessCode = order?.customer?.global_customer?.access_code;
    const {
      ga_client_id: _gaClientId,
      ga_session_id: _gaSessionId,
      ...safeOrder
    } = order;
    return {
      ...safeOrder,
      customer_access_code: accessCode ?? undefined,
    };
  }

  /** Makes a failed checkout claim retryable. */
  private async releaseCheckoutClaim(tenantId: number, draftId: number) {
    await this.withTenant(tenantId, (manager) =>
      manager.storefrontCartDraft.updateMany({
        where: { id: draftId, completed_order_id: null },
        data: { checkout_started_at: null },
      }),
    );
  }

  /** Best-effort deletes a file only from the draft prescription directory. */
  private async deleteDraftFile(path: string): Promise<void> {
    const prescriptionsRoot = resolve(process.cwd(), 'uploads', 'prescriptions');
    const candidate = resolve(path);
    if (!candidate.startsWith(`${prescriptionsRoot}/`)) return;
    await rm(candidate, { force: true }).catch(() => undefined);
  }

  /** Runs cart operations under PostgreSQL and AsyncLocalStorage tenant scope. */
  private async withTenant<T>(
    tenantId: number,
    callback: (manager: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (manager) => {
      await manager.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
      return DbTenantContext.run({ tenantId, manager }, () => callback(manager));
    });
  }
}
