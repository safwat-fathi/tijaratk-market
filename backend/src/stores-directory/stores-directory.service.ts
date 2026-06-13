import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DirectoryEventType,
  DirectoryStatus,
  Prisma,
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

type DirectoryCategorySlug = (typeof CATEGORY_DEFINITIONS)[number]['slug'];

type StoreCardTenant = {
  id: number;
  name: string;
  slug: string;
  phone: string;
  category: TenantCategory;
  delivery_available: boolean;
  delivery_fee: Prisma.Decimal;
  delivery_starts_at: string | null;
  delivery_ends_at: string | null;
  directory_profile: {
    display_name: string | null;
    logo_url: string | null;
    address: string | null;
    area?: { name_ar: string; name_en: string | null } | null;
  } | null;
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
    const [areas, deliveryAreas] = await Promise.all([
      this.prisma.directoryArea.findMany({
        where: { is_active: true, deleted_at: null },
        orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
      }),
      this.findPublicDeliveryAreas(),
    ]);

    const uniqueTenants = this.getUniqueTenantsFromDeliveryAreas(deliveryAreas);
    const categoryCounts = this.buildCategoryCounts(uniqueTenants);
    const featuredTenants = uniqueTenants.slice(0, 8);
    const activeProducts = await this.countActiveProducts(
      featuredTenants.map((tenant) => tenant.id),
    );

    return {
      areas: areas.map((area) => ({
        id: area.id,
        nameAr: area.name_ar,
        nameEn: area.name_en,
        slug: area.slug,
        city: area.city,
        governorate: area.governorate,
        storesCount: deliveryAreas.filter((item) => item.area_id === area.id)
          .length,
      })),
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
        activeProducts,
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

    return this.prisma.directoryArea.findMany({
      where: {
        is_active: true,
        deleted_at: null,
        ...(normalizedSearch
          ? {
              OR: [
                {
                  name_ar: { contains: normalizedSearch, mode: 'insensitive' },
                },
                {
                  name_en: { contains: normalizedSearch, mode: 'insensitive' },
                },
                { slug: { contains: normalizedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sort_order: 'asc' }, { name_ar: 'asc' }],
      take: 20,
    });
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
    const activeProducts = await this.countActiveProducts(
      featuredTenants.map((tenant) => tenant.id),
    );

    return {
      area: this.toAreaDto(area),
      categories: this.buildAreaCategories(deliveryAreas),
      featuredStores: this.toStoreCards(
        featuredTenants,
        area.name_ar,
        area.slug,
        activeProducts,
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

    const [rows, total] = await Promise.all([
      this.prisma.tenantDeliveryArea.findMany({
        where: baseWhere,
        include: this.publicDeliveryAreaInclude(),
        orderBy: [{ tenant: { name: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tenantDeliveryArea.count({ where: baseWhere }),
    ]);

    const activeProducts = await this.countActiveProducts(
      rows.map((row) => row.tenant_id),
    );
    let stores = this.toStoreCards(
      rows.map((row) => row.tenant),
      area.name_ar,
      area.slug,
      activeProducts,
    );

    if (options.openNow) {
      stores = stores.filter((store) => store.deliveryAvailableNow);
    }

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
        total: options.openNow ? stores.length : total,
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
        ? this.prisma.tenant.findUnique({
            where: { slug: dto.tenant_slug.trim() },
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

  private async ensureDirectoryProfile(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenantDirectoryProfile.upsert({
      where: { tenant_id: tenantId },
      update: {},
      create: {
        tenant_id: tenantId,
        display_name: tenant.name,
        directory_status: DirectoryStatus.draft,
        ...this.calculateProfileCompletion({
          display_name: tenant.name,
          address: null,
          logo_url: null,
          area_id: null,
          latitude: null,
          longitude: null,
        }),
      },
      include: {
        area: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            phone: true,
            category: true,
            delivery_available: true,
            delivery_fee: true,
            delivery_starts_at: true,
            delivery_ends_at: true,
          },
        },
      },
    });
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

    const areaId = dto.area_id ?? null;
    if (areaId) {
      await this.ensureAreaExists(areaId);
    }

    if (dto.delivery_area_ids) {
      await this.ensureAreasExist(dto.delivery_area_ids);
    }

    const profileData = this.toProfileData(dto);
    const completion = this.calculateProfileCompletion({
      display_name: dto.display_name ?? tenant.name,
      address: dto.address,
      logo_url: dto.logo_url,
      area_id: areaId,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.tenantDirectoryProfile.upsert({
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
        include: { area: true },
      });

      if (dto.delivery_area_ids) {
        await tx.tenantDeliveryArea.updateMany({
          where: { tenant_id: tenantId },
          data: { is_active: false },
        });

        for (const deliveryAreaId of Array.from(
          new Set(dto.delivery_area_ids),
        )) {
          await tx.tenantDeliveryArea.upsert({
            where: {
              tenant_id_area_id: {
                tenant_id: tenantId,
                area_id: deliveryAreaId,
              },
            },
            update: { is_active: true, deleted_at: null },
            create: {
              tenant_id: tenantId,
              area_id: deliveryAreaId,
              is_active: true,
            },
          });
        }
      }

      return profile;
    });
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

  private async ensureAreasExist(ids: number[]) {
    const uniqueIds = Array.from(new Set(ids));
    const count = await this.prisma.directoryArea.count({
      where: { id: { in: uniqueIds }, deleted_at: null },
    });

    if (count !== uniqueIds.length) {
      throw new BadRequestException('One or more directory areas are invalid');
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
          delivery_available: true,
          delivery_fee: true,
          delivery_starts_at: true,
          delivery_ends_at: true,
          directory_profile: {
            select: {
              display_name: true,
              logo_url: true,
              address: true,
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

  private async countActiveProducts(tenantIds: number[]) {
    if (tenantIds.length === 0) {
      return new Map<number, number>();
    }

    const rows = await this.prisma.product.groupBy({
      by: ['tenant_id'],
      where: {
        tenant_id: { in: tenantIds },
        status: 'active',
        deleted_at: null,
      },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.tenant_id, row._count._all]));
  }

  private toStoreCards(
    tenants: StoreCardTenant[],
    fallbackAreaName?: string,
    fallbackAreaSlug?: string,
    activeProductCounts = new Map<number, number>(),
  ) {
    return tenants.map((tenant) => {
      const displayName = tenant.directory_profile?.display_name || tenant.name;
      const whatsappNumber = tenant.phone.replace(/[^\d]/g, '');

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
        deliveryFee: Number(tenant.delivery_fee || 0),
        deliveryAvailableNow: this.isDeliveryAvailableNow(tenant),
        activeProductsCount: activeProductCounts.get(tenant.id) ?? 0,
        storefrontUrl: `/${tenant.slug}`,
        whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
      };
    });
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

    const now = new Date();
    const cairoTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    return (
      cairoTime >= tenant.delivery_starts_at &&
      cairoTime <= tenant.delivery_ends_at
    );
  }

  private toAreaDto(area: {
    id: number;
    name_ar: string;
    name_en: string | null;
    slug: string;
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

  private calculateProfileCompletion(profile: {
    display_name?: string | null;
    logo_url?: string | null;
    address?: string | null;
    area_id?: number | null;
    latitude?: number | null;
    longitude?: number | null;
  }) {
    const missingFields: string[] = [];
    if (!profile.display_name) missingFields.push('display_name');
    if (!profile.logo_url) missingFields.push('logo_url');
    if (!profile.address) missingFields.push('address');
    if (!profile.area_id) missingFields.push('area_id');
    if (profile.latitude == null || profile.longitude == null) {
      missingFields.push('coordinates');
    }

    const totalFields = 5;
    const completedFields = totalFields - missingFields.length;

    return {
      profile_completion_score: Math.round(
        (completedFields / totalFields) * 100,
      ),
      missing_fields: missingFields as Prisma.InputJsonValue,
    };
  }

  private normalizeOptionalText(value?: string | null, maxLength?: number) {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    return maxLength ? normalized.slice(0, maxLength) : normalized;
  }
}
