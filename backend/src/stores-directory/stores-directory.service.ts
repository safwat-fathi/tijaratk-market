import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import {
  DirectoryEventType,
  DirectoryStatus,
  Prisma,
  ProductStatus,
  TenantCategory,
  TenantStatus,
} from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDirectoryEventDto } from './dto/create-directory-event.dto';
import { UpdateDirectoryProfileDto } from './dto/update-directory-profile.dto';
import {
  CreateDirectoryAreaDto,
  UpdateDirectoryAreaDto,
} from './dto/directory-area.dto';
import { rankAreaSearchResults } from './utils/area-search.util';

const CATEGORY_DEFINITIONS = [
  {
    slug: 'supermarkets',
    label: 'Supermarkets',
    tenantCategory: TenantCategory.grocery,
  },
  {
    slug: 'pharmacies',
    label: 'Pharmacies',
    tenantCategory: TenantCategory.pharmacy,
  },
] as const;

const PUBLIC_DIRECTORY_EVENT_TYPES = new Set<DirectoryEventType>([
  DirectoryEventType.area_page_visit,
  DirectoryEventType.category_page_visit,
  DirectoryEventType.store_click,
  DirectoryEventType.whatsapp_click,
]);

const MIN_ACTIVE_PRODUCTS_FOR_READINESS = 25;
const MIN_PRODUCT_CATEGORIES_FOR_READINESS = 5;
const COMPLETE_READINESS_SCORE = 70;
const PARTIAL_READINESS_SCORE = 40;

type DirectoryCategorySlug = (typeof CATEGORY_DEFINITIONS)[number]['slug'];

type StoreCardTenant = {
  id: number;
  name: string;
  slug: string;
  phone: string;
  category: TenantCategory;
  status: TenantStatus;
  delivery_available: boolean;
  delivery_starts_at: string | null;
  delivery_ends_at: string | null;
  directory_profile: {
    display_name: string | null;
    logo_url: string | null;
    address: string | null;
    area_id: number | null;
    profile_completion_score: number;
    area?: { name_ar: string; name_en: string | null } | null;
  } | null;
};

type StoreProductStats = {
  activeProductsCount: number;
  availableProductsCount: number;
  productsCategoriesCount: number;
};

type StoreReadinessLevel = 'complete' | 'partial' | 'poor';

type StoreBadge =
  | 'open_now'
  | 'new_store'
  | 'complete_profile'
  | 'delivery_available';

type ReadinessInput = {
  logoUrl?: string | null;
  activeProductsCount: number;
  availableProductsCount: number;
  productsCategoriesCount: number;
  deliveryAvailable: boolean;
  areaId?: number | null;
  deliveryStartsAt?: string | null;
  deliveryEndsAt?: string | null;
};

/**
 * StoresDirectoryService powers public SEO directory pages and directory admin workflows.
 */
@Injectable()
export class StoresDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns active areas, category counts, and featured stores for the directory landing.
   */
  async getStoresLanding() {
    const deliveryAreas = await this.findPublicDeliveryAreas();

    const uniqueTenants = this.getUniqueTenantsFromDeliveryAreas(deliveryAreas);
    const categoryCounts = this.buildCategoryCounts(uniqueTenants);
    const featuredTenants = uniqueTenants.slice(0, 8);
    const deliveryFees = this.buildDeliveryFeeMap(deliveryAreas);

    return {
      areas: this.toPublicAreaSummaries(deliveryAreas),
      categories: CATEGORY_DEFINITIONS.map((category) => ({
        slug: category.slug,
        label: category.label,
        tenantCategory: category.tenantCategory,
        storesCount: categoryCounts.get(category.slug) ?? 0,
      })),
      featuredStores: this.toStoreCards(
        featuredTenants,
        undefined,
        undefined,
        undefined,
        deliveryFees,
      ),
      seo: {
        title: 'Stores Directory | Tijaratk',
        description:
          'Browse supermarkets and pharmacies in your area and order directly from local stores.',
      },
    };
  }

  /**
   * Returns active areas for autocomplete and directory navigation.
   */
  async findAreas(search?: string) {
    const normalizedSearch = search?.trim();
    const deliveryAreas = await this.findPublicDeliveryAreas();
    const publicAreas = this.toPublicAreaRows(deliveryAreas);

    if (!normalizedSearch) {
      return publicAreas.slice(0, 20);
    }

    return rankAreaSearchResults(publicAreas, normalizedSearch, 20);
  }

  /**
   * Returns the SEO payload for a public area page.
   */
  async getAreaPage(areaSlug: string) {
    const area = await this.findActiveArea(areaSlug);
    const deliveryAreas = await this.findPublicDeliveryAreas({
      areaId: area.id,
    });
    const featuredTenants = deliveryAreas
      .slice(0, 6)
      .map((item) => item.tenant);
    const deliveryFees = this.buildDeliveryFeeMap(deliveryAreas);

    return {
      area: this.toAreaDto(area),
      categories: this.buildAreaCategories(deliveryAreas),
      featuredStores: this.toStoreCards(
        featuredTenants,
        area.name_ar,
        area.slug,
        undefined,
        deliveryFees,
      ),
      seo: {
        title:
          area.seo_title ||
          `Stores in ${area.name_en || area.name_ar} | Tijaratk`,
        description:
          area.seo_description ||
          `Browse supermarkets and pharmacies delivering in ${area.name_en || area.name_ar}.`,
      },
    };
  }

  /**
   * Returns paginated public store cards by delivery area and category.
   */
  async getCategoryPage(
    areaSlug: string,
    categorySlug: string,
    options: {
      search?: string;
      openNow?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const area = await this.findActiveArea(areaSlug);
    const category = this.resolveCategory(categorySlug);
    const page = Number.isFinite(options.page) ? Math.max(1, options.page!) : 1;
    const limit = Number.isFinite(options.limit)
      ? Math.min(50, Math.max(1, options.limit!))
      : 20;
    const normalizedSearch = options.search?.trim();

    const baseWhere: Prisma.TenantDeliveryAreaWhereInput = {
      area_id: area.id,
      is_active: true,
      deleted_at: null,
      tenant: {
        status: TenantStatus.active,
        deleted_at: null,
        operated_zone_storefront: { is: null },
        category: category.tenantCategory,
        directory_profile: {
          is: {
            directory_status: DirectoryStatus.listed,
            deleted_at: null,
            ...(normalizedSearch
              ? {
                  OR: [
                    {
                      display_name: {
                        contains: normalizedSearch,
                        mode: 'insensitive',
                      },
                    },
                    {
                      tenant: {
                        name: {
                          contains: normalizedSearch,
                          mode: 'insensitive',
                        },
                      },
                    },
                  ],
                }
              : {}),
          },
        },
      },
    };

    const rows = await this.prisma.tenantDeliveryArea.findMany({
      where: baseWhere,
      include: this.publicDeliveryAreaInclude(),
      orderBy: [{ tenant: { id: 'asc' } }],
    });

    const tenantIds = rows.map((row) => row.tenant.id);
    const productStats = await this.getProductStatsByTenantIds(tenantIds);
    const rankingDate = this.formatRankingDate(new Date());

    const rankedRows = rows
      .map((row) => {
        const stats = this.getStatsForTenant(productStats, row.tenant.id);
        const readinessScore = this.calculateReadinessScore({
          logoUrl: row.tenant.directory_profile?.logo_url,
          activeProductsCount: stats.activeProductsCount,
          availableProductsCount: stats.availableProductsCount,
          productsCategoriesCount: stats.productsCategoriesCount,
          deliveryAvailable: row.tenant.delivery_available,
          areaId: row.tenant.directory_profile?.area_id,
          deliveryStartsAt: row.tenant.delivery_starts_at,
          deliveryEndsAt: row.tenant.delivery_ends_at,
        }).score;
        const isOpenNow = this.isDeliveryAvailableNow(row.tenant);
        const readinessLevel = this.getReadinessLevel(readinessScore);

        return {
          row,
          stats,
          readinessScore,
          readinessLevel,
          isOpenNow,
          bucketPriority: this.getBucketPriority({
            isDirectoryVisible: true,
            status: row.tenant.status,
            availableProductsCount: stats.availableProductsCount,
            readinessScore,
            isOpenNow,
            deliveryAvailable: row.tenant.delivery_available,
          }),
          dailyRotationScore: this.getDailyRotationScore({
            tenantId: row.tenant.id,
            areaSlug: area.slug,
            categorySlug: category.slug,
            date: rankingDate,
          }),
        };
      })
      .filter((item) => item.bucketPriority < 99)
      .filter((item) => !options.openNow || item.isOpenNow)
      .sort(
        (a, b) =>
          a.bucketPriority - b.bucketPriority ||
          this.readinessRank(b.readinessLevel) -
            this.readinessRank(a.readinessLevel) ||
          a.dailyRotationScore - b.dailyRotationScore ||
          a.row.tenant.id - b.row.tenant.id,
      );

    const total = rankedRows.length;
    const paginatedRows = rankedRows.slice((page - 1) * limit, page * limit);
    const stores = this.toStoreCards(
      paginatedRows.map((item) => item.row.tenant),
      area.name_ar,
      area.slug,
      new Map(
        paginatedRows.map((item) => [
          item.row.tenant.id,
          {
            readinessLevel: item.readinessLevel,
            productsCategoriesCount: item.stats.productsCategoriesCount,
            badges: this.buildStoreBadges(
              item.isOpenNow,
              item.row.tenant.delivery_available,
              item.readinessLevel,
            ),
          },
        ]),
      ),
      new Map(
        paginatedRows.map((item) => [
          item.row.tenant.id,
          Number(item.row.delivery_fee),
        ]),
      ),
    );

    return {
      area: this.toAreaDto(area),
      category: {
        slug: category.slug,
        label: category.label,
        tenantCategory: category.tenantCategory,
      },
      stores,
      pagination: {
        page,
        limit,
        total,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
      seo: {
        title: `${category.label} in ${area.name_en || area.name_ar} | Tijaratk`,
        description: `Discover ${category.label.toLowerCase()} delivering in ${area.name_en || area.name_ar}.`,
        canonicalUrl: `/stores/${area.slug}/${category.slug}`,
      },
    };
  }

  /**
   * Records a public directory analytics event.
   */
  async createEvent(dto: CreateDirectoryEventDto) {
    if (!PUBLIC_DIRECTORY_EVENT_TYPES.has(dto.event_type)) {
      throw new BadRequestException('Unsupported public directory event type');
    }

    const [tenant, area] = await Promise.all([
      dto.tenant_slug
        ? this.prisma.tenant.findFirst({
            where: {
              slug: dto.tenant_slug.trim(),
              operated_zone_storefront: { is: null },
            },
            select: { id: true },
          })
        : null,
      dto.area_slug
        ? this.prisma.directoryArea.findUnique({
            where: { slug: dto.area_slug.trim() },
            select: { id: true },
          })
        : null,
    ]);

    if (dto.tenant_slug && !tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (dto.area_slug && !area) {
      throw new NotFoundException('Directory area not found');
    }

    return this.prisma.directoryEvent.create({
      data: {
        event_type: dto.event_type,
        tenant_id: tenant?.id,
        area_id: area?.id,
        category_slug: this.normalizeOptionalText(dto.category_slug, 64),
        visitor_key: this.normalizeOptionalText(dto.visitor_key, 128),
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Returns the authenticated merchant directory profile, creating a draft if missing.
   */
  async getMerchantProfile(tenantId: number) {
    return this.ensureDirectoryProfile(tenantId);
  }

  /**
   * Updates the authenticated merchant directory profile and delivery areas.
   */
  async updateMerchantProfile(
    tenantId: number,
    dto: UpdateDirectoryProfileDto,
  ) {
    return this.updateDirectoryProfile(tenantId, dto);
  }

  /**
   * Lists active directory areas for merchant selection.
   */
  async merchantFindAreas() {
    return this.prisma.directoryArea.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
    });
  }

  /**
   * Lists directory areas for admin management.
   */
  async adminFindAreas() {
    return this.prisma.directoryArea.findMany({
      where: { deleted_at: null },
      orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
    });
  }

  /**
   * Creates a directory area.
   */
  async adminCreateArea(dto: CreateDirectoryAreaDto) {
    return this.prisma.directoryArea.create({
      data: this.toCreateAreaData(dto),
    });
  }

  /**
   * Updates a directory area.
   */
  async adminUpdateArea(id: number, dto: UpdateDirectoryAreaDto) {
    await this.ensureAreaExists(id);

    return this.prisma.directoryArea.update({
      where: { id },
      data: this.toUpdateAreaData(dto),
    });
  }

  /**
   * Updates a tenant directory profile by admin.
   */
  async adminUpdateTenantProfile(
    tenantId: number,
    dto: UpdateDirectoryProfileDto,
  ) {
    return this.updateDirectoryProfile(tenantId, dto);
  }

  /**
   * Deletes a directory area.
   */
  async adminDeleteArea(id: number) {
    await this.ensureAreaExists(id);

    const [profileCount, deliveryAreaCount] = await Promise.all([
      this.prisma.tenantDirectoryProfile.count({
        where: { area_id: id },
      }),
      this.prisma.tenantDeliveryArea.count({
        where: { area_id: id },
      }),
    ]);

    if (profileCount > 0 || deliveryAreaCount > 0) {
      throw new BadRequestException(
        'Cannot delete area currently in use by a tenant',
      );
    }

    return this.prisma.directoryArea.delete({
      where: { id },
    });
  }

  async recalculateTenantReadiness(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        delivery_available: true,
        delivery_starts_at: true,
        delivery_ends_at: true,
        directory_profile: {
          select: {
            logo_url: true,
            area_id: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const stats = await this.getProductStatsForTenant(tenantId);
    const readiness = this.calculateReadinessScore({
      logoUrl: tenant.directory_profile?.logo_url,
      activeProductsCount: stats.activeProductsCount,
      availableProductsCount: stats.availableProductsCount,
      productsCategoriesCount: stats.productsCategoriesCount,
      deliveryAvailable: tenant.delivery_available,
      areaId: tenant.directory_profile?.area_id,
      deliveryStartsAt: tenant.delivery_starts_at,
      deliveryEndsAt: tenant.delivery_ends_at,
    });

    await this.prisma.tenantDirectoryProfile.upsert({
      where: { tenant_id: tenantId },
      update: {
        profile_completion_score: readiness.score,
        missing_fields: readiness.missingFields as Prisma.InputJsonValue,
      },
      create: {
        tenant_id: tenantId,
        display_name: tenant.name,
        directory_status: DirectoryStatus.draft,
        profile_completion_score: readiness.score,
        missing_fields: readiness.missingFields as Prisma.InputJsonValue,
      },
    });

    return readiness;
  }

  private async ensureDirectoryProfile(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const profile = await this.prisma.tenantDirectoryProfile.upsert({
      where: { tenant_id: tenantId },
      update: {},
      create: {
        tenant_id: tenantId,
        display_name: tenant.name,
        directory_status: DirectoryStatus.draft,
        ...(await this.calculateReadinessForTenantInput(tenantId, {
          logoUrl: null,
          areaId: null,
        })),
      },
      include: this.merchantProfileInclude(),
    });

    return this.withDeliveryAreaIds(profile);
  }

  private async updateDirectoryProfile(
    tenantId: number,
    dto: UpdateDirectoryProfileDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const existingProfile = await this.prisma.tenantDirectoryProfile.findUnique(
      {
        where: { tenant_id: tenantId },
      },
    );
    const areaId = dto.area_id ?? existingProfile?.area_id ?? null;
    if (areaId) {
      await this.ensureAreaExists(areaId);
    }

    const profileData = this.toProfileData(dto);
    const completion = await this.calculateReadinessForTenantInput(tenantId, {
      logoUrl: dto.logo_url ?? existingProfile?.logo_url,
      areaId,
    });

    const profile = await this.prisma.$transaction(async (tx) => {
      await tx.tenantDirectoryProfile.upsert({
        where: { tenant_id: tenantId },
        update: {
          ...profileData,
          ...completion,
        },
        create: {
          tenant_id: tenantId,
          directory_status: dto.directory_status ?? DirectoryStatus.draft,
          display_name:
            this.normalizeOptionalText(dto.display_name, 120) ?? tenant.name,
          logo_url: this.normalizeOptionalText(dto.logo_url),
          cover_url: this.normalizeOptionalText(dto.cover_url),
          address: this.normalizeOptionalText(dto.address, 500),
          area_id: dto.area_id ?? null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          seo_title: this.normalizeOptionalText(dto.seo_title, 180),
          seo_description: this.normalizeOptionalText(dto.seo_description, 300),
          ...completion,
        },
      });

      return tx.tenantDirectoryProfile.findUniqueOrThrow({
        where: { tenant_id: tenantId },
        include: this.merchantProfileInclude(),
      });
    });

    return this.withDeliveryAreaIds(profile);
  }

  private merchantProfileInclude() {
    return {
      area: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          phone: true,
          category: true,
          status: true,
          delivery_available: true,
          delivery_starts_at: true,
          delivery_ends_at: true,
          tenant_delivery_areas: {
            where: { deleted_at: null },
            select: {
              id: true,
              area_id: true,
              delivery_fee: true,
              is_active: true,
              area: true,
            },
            orderBy: { area_id: 'asc' },
          },
        },
      },
    } satisfies Prisma.TenantDirectoryProfileInclude;
  }

  private withDeliveryAreaIds<
    T extends {
      tenant?: {
        tenant_delivery_areas?: Array<{
          area_id: number;
          delivery_fee: Prisma.Decimal;
          is_active: boolean;
        }>;
      } | null;
    },
  >(profile: T) {
    return {
      ...profile,
      delivery_area_ids:
        profile.tenant?.tenant_delivery_areas
          ?.filter((area) => area.is_active)
          .map((area) => area.area_id) ?? [],
      delivery_areas:
        profile.tenant?.tenant_delivery_areas?.map((area) => ({
          ...area,
          delivery_fee: Number(area.delivery_fee),
        })) ?? [],
    };
  }

  private async findActiveArea(slug: string) {
    const area = await this.prisma.directoryArea.findFirst({
      where: { slug: slug.trim(), is_active: true, deleted_at: null },
    });

    if (!area) {
      throw new NotFoundException('Directory area not found');
    }

    return area;
  }

  private async ensureAreaExists(id: number) {
    const area = await this.prisma.directoryArea.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });

    if (!area) {
      throw new NotFoundException('Directory area not found');
    }
  }

  private resolveCategory(slug: string) {
    const category = CATEGORY_DEFINITIONS.find((item) => item.slug === slug);
    if (!category) {
      throw new NotFoundException('Directory category not found');
    }
    return category;
  }

  private async findPublicDeliveryAreas(options?: { areaId?: number }) {
    return this.prisma.tenantDeliveryArea.findMany({
      where: {
        is_active: true,
        deleted_at: null,
        ...(options?.areaId ? { area_id: options.areaId } : {}),
        area: { is_active: true, deleted_at: null },
        tenant: {
          status: TenantStatus.active,
          deleted_at: null,
          operated_zone_storefront: { is: null },
          category: {
            in: CATEGORY_DEFINITIONS.map((item) => item.tenantCategory),
          },
          directory_profile: {
            is: {
              directory_status: DirectoryStatus.listed,
              deleted_at: null,
            },
          },
        },
      },
      include: this.publicDeliveryAreaInclude(),
      orderBy: [{ area: { sort_order: 'asc' } }, { tenant: { name: 'asc' } }],
    });
  }

  private publicDeliveryAreaInclude() {
    return {
      area: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          phone: true,
          category: true,
          status: true,
          delivery_available: true,
          delivery_starts_at: true,
          delivery_ends_at: true,
          directory_profile: {
            select: {
              display_name: true,
              logo_url: true,
              address: true,
              area_id: true,
              profile_completion_score: true,
              area: { select: { name_ar: true, name_en: true } },
            },
          },
        },
      },
    } satisfies Prisma.TenantDeliveryAreaInclude;
  }

  private buildCategoryCounts(tenants: StoreCardTenant[]) {
    const counts = new Map<DirectoryCategorySlug, number>();

    for (const tenant of tenants) {
      const category = CATEGORY_DEFINITIONS.find(
        (item) => item.tenantCategory === tenant.category,
      );
      if (category) {
        counts.set(category.slug, (counts.get(category.slug) ?? 0) + 1);
      }
    }

    return counts;
  }

  private getUniqueTenantsFromDeliveryAreas(
    deliveryAreas: Awaited<
      ReturnType<StoresDirectoryService['findPublicDeliveryAreas']>
    >,
  ) {
    const tenantsById = new Map<number, StoreCardTenant>();

    for (const deliveryArea of deliveryAreas) {
      if (!tenantsById.has(deliveryArea.tenant.id)) {
        tenantsById.set(deliveryArea.tenant.id, deliveryArea.tenant);
      }
    }

    return Array.from(tenantsById.values());
  }

  private buildAreaCategories(
    deliveryAreas: Awaited<
      ReturnType<StoresDirectoryService['findPublicDeliveryAreas']>
    >,
  ) {
    return CATEGORY_DEFINITIONS.map((category) => {
      const categoryRows = deliveryAreas.filter(
        (item) => item.tenant.category === category.tenantCategory,
      );

      return {
        slug: category.slug,
        label: category.label,
        tenantCategory: category.tenantCategory,
        storesCount: categoryRows.length,
        availableNowCount: categoryRows.filter((item) =>
          this.isDeliveryAvailableNow(item.tenant),
        ).length,
      };
    });
  }

  private toPublicAreaSummaries(
    deliveryAreas: Awaited<
      ReturnType<StoresDirectoryService['findPublicDeliveryAreas']>
    >,
  ) {
    const areasById = new Map<
      number,
      {
        id: number;
        nameAr: string;
        nameEn: string | null;
        slug: string;
        city: string | null;
        governorate: string | null;
        storesCount: number;
        categoryCounts: Record<DirectoryCategorySlug, number>;
      }
    >();

    for (const deliveryArea of deliveryAreas) {
      const category = CATEGORY_DEFINITIONS.find(
        (item) => item.tenantCategory === deliveryArea.tenant.category,
      );
      const existing = areasById.get(deliveryArea.area_id);
      if (existing) {
        existing.storesCount += 1;
        if (category) {
          existing.categoryCounts[category.slug] += 1;
        }
        continue;
      }

      areasById.set(deliveryArea.area_id, {
        id: deliveryArea.area.id,
        nameAr: deliveryArea.area.name_ar,
        nameEn: deliveryArea.area.name_en,
        slug: deliveryArea.area.slug,
        city: deliveryArea.area.city,
        governorate: deliveryArea.area.governorate,
        storesCount: 1,
        categoryCounts: {
          supermarkets: category?.slug === 'supermarkets' ? 1 : 0,
          pharmacies: category?.slug === 'pharmacies' ? 1 : 0,
        },
      });
    }

    return Array.from(areasById.values());
  }

  private toPublicAreaRows(
    deliveryAreas: Awaited<
      ReturnType<StoresDirectoryService['findPublicDeliveryAreas']>
    >,
  ) {
    const storesCountByAreaId = new Map<number, number>();
    const areasById = new Map<number, (typeof deliveryAreas)[number]['area']>();

    for (const deliveryArea of deliveryAreas) {
      storesCountByAreaId.set(
        deliveryArea.area_id,
        (storesCountByAreaId.get(deliveryArea.area_id) ?? 0) + 1,
      );
      if (!areasById.has(deliveryArea.area_id)) {
        areasById.set(deliveryArea.area_id, deliveryArea.area);
      }
    }

    return Array.from(areasById.entries()).map(([areaId, area]) => ({
      ...area,
      storesCount: storesCountByAreaId.get(areaId) ?? 0,
    }));
  }

  private toStoreCards(
    tenants: StoreCardTenant[],
    fallbackAreaName?: string,
    fallbackAreaSlug?: string,
    rankingMeta?: Map<
      number,
      {
        readinessLevel: StoreReadinessLevel;
        productsCategoriesCount: number;
        badges: StoreBadge[];
      }
    >,
    deliveryFees?: Map<number, number>,
  ) {
    return tenants.map((tenant) => {
      const displayName = tenant.directory_profile?.display_name || tenant.name;
      const whatsappNumber = tenant.phone.replace(/[^\d]/g, '');
      const meta = rankingMeta?.get(tenant.id);

      return {
        id: tenant.id,
        name: displayName,
        slug: tenant.slug,
        category: tenant.category,
        logoUrl: tenant.directory_profile?.logo_url ?? null,
        address: tenant.directory_profile?.address ?? null,
        areaName:
          tenant.directory_profile?.area?.name_en ||
          tenant.directory_profile?.area?.name_ar ||
          fallbackAreaName ||
          null,
        areaSlug: fallbackAreaSlug || null,
        deliveryAvailable: tenant.delivery_available,
        deliveryFee: deliveryFees?.get(tenant.id) ?? 0,
        deliveryAvailableNow: this.isDeliveryAvailableNow(tenant),
        readinessLevel:
          meta?.readinessLevel ??
          this.getReadinessLevel(
            tenant.directory_profile?.profile_completion_score ?? 0,
          ),
        badges:
          meta?.badges ??
          this.buildStoreBadges(
            this.isDeliveryAvailableNow(tenant),
            tenant.delivery_available,
            this.getReadinessLevel(
              tenant.directory_profile?.profile_completion_score ?? 0,
            ),
          ),
        productsCategoriesCount: meta?.productsCategoriesCount,
        storefrontUrl: `/${tenant.slug}`,
        whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
      };
    });
  }

  private buildDeliveryFeeMap<
    T extends {
      delivery_fee: Prisma.Decimal;
      tenant: { id: number };
    },
  >(deliveryAreas: T[]) {
    const fees = new Map<number, number>();
    for (const deliveryArea of deliveryAreas) {
      const fee = Number(deliveryArea.delivery_fee);
      const current = fees.get(deliveryArea.tenant.id);
      if (current === undefined || fee < current) {
        fees.set(deliveryArea.tenant.id, fee);
      }
    }
    return fees;
  }

  private isDeliveryAvailableNow(
    tenant: Pick<
      StoreCardTenant,
      'delivery_available' | 'delivery_starts_at' | 'delivery_ends_at'
    >,
  ) {
    if (!tenant.delivery_available) {
      return false;
    }

    if (!tenant.delivery_starts_at || !tenant.delivery_ends_at) {
      return true;
    }

    return this.isWithinDeliveryWindow(
      tenant.delivery_starts_at,
      tenant.delivery_ends_at,
      new Date(),
    );
  }

  private isWithinDeliveryWindow(
    startsAt: string,
    endsAt: string,
    now: Date,
  ) {
    const cairoTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const currentMinutes = this.parseHHMM(cairoTime);
    const startMinutes = this.parseHHMM(startsAt);
    const endMinutes = this.parseHHMM(endsAt);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  private parseHHMM(value: string) {
    const [hours = '0', minutes = '0'] = value.split(':');
    return Number(hours) * 60 + Number(minutes);
  }

  private toAreaDto(area: {
    id: number;
    name_ar: string;
    name_en: string | null;
    slug: string;
    parent_area_id: number | null;
    city: string | null;
    governorate: string | null;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
    seo_title: string | null;
    seo_description: string | null;
  }) {
    return {
      id: area.id,
      nameAr: area.name_ar,
      nameEn: area.name_en,
      slug: area.slug,
      parentAreaId: area.parent_area_id,
      city: area.city,
      governorate: area.governorate,
      latitude: area.latitude == null ? null : Number(area.latitude),
      longitude: area.longitude == null ? null : Number(area.longitude),
      seoTitle: area.seo_title,
      seoDescription: area.seo_description,
    };
  }

  private toCreateAreaData(dto: CreateDirectoryAreaDto) {
    return {
      name_ar: dto.name_ar.trim(),
      name_en: this.normalizeOptionalText(dto.name_en, 120),
      slug: dto.slug.trim(),
      parent_area_id: dto.parent_area_id,
      city: this.normalizeOptionalText(dto.city, 120),
      governorate: this.normalizeOptionalText(dto.governorate, 120),
      is_active: dto.is_active ?? true,
      sort_order: dto.sort_order ?? 0,
      latitude: dto.latitude,
      longitude: dto.longitude,
      seo_title: this.normalizeOptionalText(dto.seo_title, 180),
      seo_description: this.normalizeOptionalText(dto.seo_description, 300),
    };
  }

  private toUpdateAreaData(dto: UpdateDirectoryAreaDto) {
    const data: Prisma.DirectoryAreaUncheckedUpdateInput = {};

    if (dto.name_ar !== undefined) data.name_ar = dto.name_ar.trim();
    if (dto.name_en !== undefined) {
      data.name_en = this.normalizeOptionalText(dto.name_en, 120);
    }
    if (dto.slug !== undefined) data.slug = dto.slug.trim();
    if (dto.parent_area_id !== undefined) {
      data.parent_area_id = dto.parent_area_id;
    }
    if (dto.city !== undefined) {
      data.city = this.normalizeOptionalText(dto.city, 120);
    }
    if (dto.governorate !== undefined) {
      data.governorate = this.normalizeOptionalText(dto.governorate, 120);
    }
    if (dto.is_active !== undefined) data.is_active = dto.is_active;
    if (dto.sort_order !== undefined) data.sort_order = dto.sort_order;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.seo_title !== undefined) {
      data.seo_title = this.normalizeOptionalText(dto.seo_title, 180);
    }
    if (dto.seo_description !== undefined) {
      data.seo_description = this.normalizeOptionalText(
        dto.seo_description,
        300,
      );
    }

    return data;
  }

  private toProfileData(dto: UpdateDirectoryProfileDto) {
    const data: Prisma.TenantDirectoryProfileUncheckedUpdateInput = {};

    if (dto.directory_status !== undefined) {
      data.directory_status = dto.directory_status;
    }
    if (dto.display_name !== undefined) {
      data.display_name = this.normalizeOptionalText(dto.display_name, 120);
    }
    if (dto.logo_url !== undefined) {
      data.logo_url = this.normalizeOptionalText(dto.logo_url);
    }
    if (dto.cover_url !== undefined) {
      data.cover_url = this.normalizeOptionalText(dto.cover_url);
    }
    if (dto.address !== undefined) {
      data.address = this.normalizeOptionalText(dto.address, 500);
    }
    if (dto.area_id !== undefined) data.area_id = dto.area_id;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.seo_title !== undefined) {
      data.seo_title = this.normalizeOptionalText(dto.seo_title, 180);
    }
    if (dto.seo_description !== undefined) {
      data.seo_description = this.normalizeOptionalText(
        dto.seo_description,
        300,
      );
    }

    return data;
  }

  private async calculateReadinessForTenantInput(
    tenantId: number,
    overrides: {
      logoUrl?: string | null;
      areaId?: number | null;
    },
  ) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        delivery_available: true,
        delivery_starts_at: true,
        delivery_ends_at: true,
      },
    });
    const stats = await this.getProductStatsForTenant(tenantId);
    const readiness = this.calculateReadinessScore({
      logoUrl: overrides.logoUrl,
      activeProductsCount: stats.activeProductsCount,
      availableProductsCount: stats.availableProductsCount,
      productsCategoriesCount: stats.productsCategoriesCount,
      deliveryAvailable: tenant.delivery_available,
      areaId: overrides.areaId,
      deliveryStartsAt: tenant.delivery_starts_at,
      deliveryEndsAt: tenant.delivery_ends_at,
    });

    return {
      profile_completion_score: readiness.score,
      missing_fields: readiness.missingFields as Prisma.InputJsonValue,
    };
  }

  private calculateReadinessScore(input: ReadinessInput) {
    const missingFields: string[] = [];
    let score = 0;

    if (input.logoUrl) {
      score += 10;
    } else {
      missingFields.push('missing_logo');
    }

    if (input.activeProductsCount >= MIN_ACTIVE_PRODUCTS_FOR_READINESS) {
      score += 25;
    } else {
      missingFields.push('less_than_25_products');
    }

    if (input.deliveryAvailable) {
      score += 20;
    } else {
      missingFields.push('delivery_disabled');
    }

    if (input.areaId) {
      score += 15;
    } else {
      missingFields.push('missing_area');
    }

    if (input.deliveryStartsAt && input.deliveryEndsAt) {
      score += 10;
    } else {
      missingFields.push('missing_delivery_hours');
    }

    if (
      input.productsCategoriesCount >= MIN_PRODUCT_CATEGORIES_FOR_READINESS
    ) {
      score += 20;
    } else {
      missingFields.push('less_than_5_product_categories');
    }

    return { score, missingFields };
  }

  private getReadinessLevel(score: number): StoreReadinessLevel {
    if (score >= COMPLETE_READINESS_SCORE) return 'complete';
    if (score >= PARTIAL_READINESS_SCORE) return 'partial';
    return 'poor';
  }

  private readinessRank(level: StoreReadinessLevel) {
    if (level === 'complete') return 3;
    if (level === 'partial') return 2;
    return 1;
  }

  private getBucketPriority(input: {
    isDirectoryVisible: boolean;
    status: TenantStatus;
    availableProductsCount: number;
    readinessScore: number;
    isOpenNow: boolean;
    deliveryAvailable: boolean;
  }) {
    if (!input.isDirectoryVisible) return 99;
    if (input.status !== TenantStatus.active) return 99;
    if (input.availableProductsCount <= 0) return 40;

    const isComplete = input.readinessScore >= COMPLETE_READINESS_SCORE;
    if (input.isOpenNow && input.deliveryAvailable && isComplete) return 10;
    if (!input.isOpenNow && input.deliveryAvailable && isComplete) return 20;
    if (input.readinessScore >= PARTIAL_READINESS_SCORE) return 30;

    return 40;
  }

  private getDailyRotationScore(input: {
    tenantId: number;
    areaSlug: string;
    categorySlug: string;
    date: string;
  }) {
    const raw = `${input.areaSlug}:${input.categorySlug}:${input.date}:${input.tenantId}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return parseInt(hash.slice(0, 8), 16);
  }

  private buildStoreBadges(
    isOpenNow: boolean,
    deliveryAvailable: boolean,
    readinessLevel: StoreReadinessLevel,
  ): StoreBadge[] {
    const badges: StoreBadge[] = [];
    if (isOpenNow) badges.push('open_now');
    if (deliveryAvailable) badges.push('delivery_available');
    if (readinessLevel === 'complete') badges.push('complete_profile');
    return badges;
  }

  private formatRankingDate(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private async getProductStatsForTenant(
    tenantId: number,
  ): Promise<StoreProductStats> {
    const stats = await this.getProductStatsByTenantIds([tenantId]);
    return this.getStatsForTenant(stats, tenantId);
  }

  private async getProductStatsByTenantIds(tenantIds: number[]) {
    if (tenantIds.length === 0) {
      return new Map<number, StoreProductStats>();
    }

    const rows = await this.prisma.$queryRaw<
      {
        tenant_id: number;
        active_products_count: number;
        available_products_count: number;
        products_categories_count: number;
      }[]
    >`
      SELECT
        tenant_id,
        COUNT(*)::int AS active_products_count,
        COUNT(*) FILTER (WHERE is_available = true)::int AS available_products_count,
        COUNT(DISTINCT NULLIF(TRIM(category), ''))::int AS products_categories_count
      FROM products
      WHERE tenant_id IN (${Prisma.join(tenantIds)})
        AND status = ${ProductStatus.active}::products_status_enum
        AND deleted_at IS NULL
      GROUP BY tenant_id
    `;

    return new Map(
      rows.map((row) => [
        row.tenant_id,
        {
          activeProductsCount: row.active_products_count,
          availableProductsCount: row.available_products_count,
          productsCategoriesCount: row.products_categories_count,
        },
      ]),
    );
  }

  private getStatsForTenant(
    stats: Map<number, StoreProductStats>,
    tenantId: number,
  ): StoreProductStats {
    return (
      stats.get(tenantId) ?? {
        activeProductsCount: 0,
        availableProductsCount: 0,
        productsCategoriesCount: 0,
      }
    );
  }

  private normalizeOptionalText(value?: string | null, maxLength?: number) {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    return maxLength ? normalized.slice(0, maxLength) : normalized;
  }
}
