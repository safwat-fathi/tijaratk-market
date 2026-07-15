import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { formatPhoneNumber } from '@/common/utils/phone.util';
import { DbTenantContext } from '@/common/contexts/db-tenant.context';
import { PrismaService } from '@/prisma/prisma.service';
import {
  Customer,
  Order,
  Prisma,
  TenantStatus,
} from '../../generated/prisma/client';
import {
  resolveZoneStorefrontReorderUrl,
} from 'src/zone-storefronts/zone-storefront-feature';

type PublicCustomerProfile = Pick<Customer, 'name' | 'phone' | 'notes'> & {
  addresses: string[];
};

type PublicCustomerOrder = Pick<
  Order,
  | 'id'
  | 'public_token'
  | 'status'
  | 'created_at'
  | 'total'
  | 'delivery_address'
  | 'delivery_time_window_snapshot'
> & {
  tenant?: { id: number; name: string; slug: string };
  items?: unknown[];
  zone_storefront?: {
    id: number;
    name: string;
    slug: string;
    reorder_url: string | null;
  } | null;
};

@Injectable()
export class CustomersService {
  private static readonly ACCESS_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  private static readonly ACCESS_CODE_LENGTH = 8;
  private static readonly MAX_ACCESS_CODE_GENERATION_ATTEMPTS = 8;

  constructor(private readonly prisma: PrismaService) {}

  normalizeAccessCode(rawCode: string): string {
    return rawCode.trim().toUpperCase().replace(/[\s-]/g, '');
  }

  formatAccessCode(rawCode: string): string {
    const normalized = this.normalizeAccessCode(rawCode);
    return normalized.length > 4
      ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
      : normalized;
  }

  private generateAccessCode(): string {
    let code = '';
    for (let index = 0; index < CustomersService.ACCESS_CODE_LENGTH; index += 1) {
      code +=
        CustomersService.ACCESS_CODE_ALPHABET[
          randomInt(CustomersService.ACCESS_CODE_ALPHABET.length)
        ];
    }
    return code;
  }

  async ensureGlobalCustomerForTenantCustomer(
    manager: Prisma.TransactionClient,
    customer: Pick<Customer, 'id' | 'phone' | 'name' | 'global_customer_id'>,
    name?: string,
  ): Promise<{ id: number; access_code: string }> {
    const phone = formatPhoneNumber(customer.phone);
    const displayName = name?.trim() || customer.name?.trim() || undefined;

    const existingByCustomer = customer.global_customer_id
      ? await manager.globalCustomer.findUnique({
          where: { id: customer.global_customer_id },
          select: { id: true, access_code: true },
        })
      : null;

    if (existingByCustomer) {
      if (displayName) {
        await manager.globalCustomer.update({
          where: { id: existingByCustomer.id },
          data: { name: displayName },
        });
      }
      return existingByCustomer;
    }

    const existingByPhone = await manager.globalCustomer.findUnique({
      where: { phone },
      select: { id: true, access_code: true },
    });

    if (existingByPhone) {
      await manager.customer.update({
        where: { id: customer.id },
        data: { global_customer_id: existingByPhone.id },
      });
      if (displayName) {
        await manager.globalCustomer.update({
          where: { id: existingByPhone.id },
          data: { name: displayName },
        });
      }
      return existingByPhone;
    }

    for (
      let attempt = 0;
      attempt < CustomersService.MAX_ACCESS_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const globalCustomer = await manager.globalCustomer.create({
          data: {
            phone,
            name: displayName,
            access_code: this.generateAccessCode(),
          },
          select: { id: true, access_code: true },
        });

        await manager.customer.update({
          where: { id: customer.id },
          data: { global_customer_id: globalCustomer.id },
        });

        return globalCustomer;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to generate unique customer access code');
  }

  /**
   * Finds a public customer profile by tenant slug and phone number.
   */
  async findPublicProfileByPhone(
    tenantSlug: string,
    rawPhone: string,
  ): Promise<PublicCustomerProfile | null> {
    const normalizedSlug = tenantSlug.trim();
    const normalizedPhone = rawPhone.trim();

    if (!normalizedSlug || !normalizedPhone) {
      return null;
    }

    const phone = formatPhoneNumber(normalizedPhone);

    const customer = await this.getCustomersDb().findFirst({
      where: {
        phone,
        tenant: { slug: normalizedSlug, status: TenantStatus.active },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        notes: true,
        addresses: {
          where: { deleted_at: null },
          select: { address: true },
          orderBy: [{ last_used_at: 'desc' }, { created_at: 'desc' }],
          take: 10,
        },
      },
    });

    if (!customer) {
      return null;
    }

    const addresses = Array.from(
      new Set(
        customer.addresses
          .map((addressRow) => addressRow.address.trim())
          .filter((address): address is string => Boolean(address)),
      ),
    );

    return {
      name: customer.name,
      phone: customer.phone,
      notes: customer.notes,
      addresses,
    };
  }

  async findPublicProfileByAccessCode(
    rawCode: string,
    rawPhone: string,
  ): Promise<PublicCustomerProfile | null> {
    const accessCode = this.normalizeAccessCode(rawCode);
    const normalizedPhone = rawPhone.trim();

    if (!accessCode || !normalizedPhone) {
      return null;
    }

    const phone = formatPhoneNumber(normalizedPhone);
    const globalCustomer = await this.prisma.globalCustomer.findFirst({
      where: {
        access_code: accessCode,
        phone,
        deleted_at: null,
      },
      include: {
        customers: {
          where: { deleted_at: null },
          include: {
            addresses: {
              where: { deleted_at: null },
              select: { address: true },
              orderBy: [{ last_used_at: 'desc' }, { created_at: 'desc' }],
              take: 10,
            },
          },
          orderBy: [{ last_order_at: 'desc' }, { created_at: 'desc' }],
        },
      },
    });

    if (!globalCustomer) {
      return null;
    }

    const latestCustomer = globalCustomer.customers[0];
    const addresses = Array.from(
      new Set(
        globalCustomer.customers
          .flatMap((customer) => customer.addresses)
          .map((addressRow) => addressRow.address.trim())
          .filter((address): address is string => Boolean(address)),
      ),
    );

    return {
      name: globalCustomer.name || latestCustomer?.name || null,
      phone: globalCustomer.phone,
      notes: latestCustomer?.notes || null,
      addresses,
    };
  }

  async findPublicOrdersByAccessCode(
    rawCode: string,
    rawPhone: string,
  ): Promise<PublicCustomerOrder[]> {
    const accessCode = this.normalizeAccessCode(rawCode);
    const normalizedPhone = rawPhone.trim();

    if (!accessCode || !normalizedPhone) {
      return [];
    }

    const phone = formatPhoneNumber(normalizedPhone);
    const orders = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.customer_access_code', ${accessCode}, true)`;
      await tx.$executeRaw`SELECT set_config('app.customer_access_phone', ${phone}, true)`;

      const globalCustomer = await tx.globalCustomer.findFirst({
        where: {
          access_code: accessCode,
          phone,
          deleted_at: null,
        },
        select: { id: true },
      });

      if (!globalCustomer) {
        return [];
      }

      return tx.order.findMany({
        where: {
          deleted_at: null,
          customer: {
            global_customer_id: globalCustomer.id,
            deleted_at: null,
          },
        },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          order_dispatch: {
            select: {
              zone_storefront: {
                select: { id: true, name: true, slug: true, is_active: true },
              },
            },
          },
          order_items: {
            include: {
              replaced_by_product: true,
              pending_replacement_product: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    });

    return orders.map((order) => {
      const zoneStorefront = order.order_dispatch?.zone_storefront;
      return {
        id: order.id,
        public_token: order.public_token,
        status: order.status,
        created_at: order.created_at,
        total: order.total,
        delivery_address: order.delivery_address,
        delivery_time_window_snapshot: order.delivery_time_window_snapshot,
        tenant: zoneStorefront
          ? {
              id: zoneStorefront.id,
              name: zoneStorefront.name,
              slug: zoneStorefront.slug,
            }
          : order.tenant,
        items: order.order_items,
        zone_storefront: zoneStorefront
          ? {
              id: zoneStorefront.id,
              name: zoneStorefront.name,
              slug: zoneStorefront.slug,
              reorder_url: resolveZoneStorefrontReorderUrl({
                slug: zoneStorefront.slug,
                isActive: zoneStorefront.is_active,
              }),
            }
          : null,
      };
    }) as PublicCustomerOrder[];
  }

  async create(
    createCustomerDto: CreateCustomerDto,
    tenantId: number,
  ): Promise<Customer> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
      return this.createCustomerWithCode(
        tx,
        createCustomerDto.phone,
        tenantId,
        createCustomerDto.name,
        createCustomerDto.address,
        createCustomerDto.notes,
      );
    });
  }

  async findAll(
    tenantId: number,
    search?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Customer[]; meta: any }> {
    const where: Prisma.CustomerWhereInput = { tenant_id: tenantId };
    const normalizedSearch = search?.trim();

    if (normalizedSearch) {
      const isNumeric = !isNaN(Number(normalizedSearch));
      const nameFilters = this.buildWordPrefixSearchFilters(normalizedSearch, [
        'name',
        'merchant_label',
      ]);

      if (isNumeric) {
        where.OR = [
          { code: Number(normalizedSearch) },
          { phone: { contains: normalizedSearch, mode: 'insensitive' } },
          ...nameFilters,
        ];
      } else {
        where.OR = [
          { phone: { contains: normalizedSearch, mode: 'insensitive' } },
          ...nameFilters,
        ];
      }
    }

    const customersDb = this.getCustomersDb();
    const [data, total] = await Promise.all([
      customersDb.findMany({
        where,
        orderBy: { last_order_at: { sort: 'desc', nulls: 'last' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      customersDb.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Builds text filters that match only the beginning of a field or a later word.
   */
  private buildWordPrefixSearchFilters(
    search: string,
    fields: Array<'name' | 'merchant_label'>,
  ): Prisma.CustomerWhereInput[] {
    return fields.flatMap((field) => [
      { [field]: { startsWith: search, mode: 'insensitive' } },
      { [field]: { contains: ` ${search}`, mode: 'insensitive' } },
    ]);
  }

  async findOne(
    id: number,
    tenantId: number,
  ): Promise<(Customer & { orders?: Order[] }) | null> {
    const customer = await this.getCustomersDb().findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!customer) return null;

    const ordersDb = this.getOrdersDb();
    const [orders, totalOrders] = await Promise.all([
      ordersDb.findMany({
        where: { customer_id: id },
        orderBy: { created_at: 'desc' },
        take: 5,
      }),
      ordersDb.count({
        where: { customer_id: id },
      }),
    ]);

    // Self-healing: Update stats if mismatched
    if (customer.order_count !== totalOrders) {
      customer.order_count = totalOrders;
      if (orders.length > 0) {
        customer.last_order_at = orders[0].created_at;
      }
      await this.getCustomersDb().update({
        where: { id: customer.id },
        data: {
          order_count: customer.order_count,
          last_order_at: customer.last_order_at,
        },
      });
    }

    return { ...customer, orders };
  }

  async findOrCreate(
    rawPhone: string,
    tenantId: number,
    name?: string,
    address?: string,
    manager?: Prisma.TransactionClient,
    areaId?: number | null,
  ): Promise<Customer> {
    const phone = formatPhoneNumber(rawPhone);
    const scopedManager = manager ?? DbTenantContext.getManager();
    const db = scopedManager ? scopedManager.customer : this.getCustomersDb();

    const customer = await db.findFirst({
      where: { phone, tenant_id: tenantId },
    });

    if (!customer) {
      // New Customer Creation Logic
      if (!scopedManager) {
        // If no manager provided, we MUST start a transaction to ensure counter safety
        return this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${String(tenantId)}, true)`;
          return this.createCustomerWithCode(
            tx,
            phone,
            tenantId,
            name,
            address,
            undefined,
            areaId,
          );
        });
      } else {
        // Already in a transaction
        return this.createCustomerWithCode(
          scopedManager,
          phone,
          tenantId,
          name,
          address,
          undefined,
          areaId,
        );
      }
    }

    // Update existing customer details if provided
    let hasUpdates = false;
    const updateData: Prisma.CustomerUpdateInput = {};
    if (name && customer.name !== name) {
      updateData.name = name;
      hasUpdates = true;
    }

    if (address && customer.address !== address) {
      updateData.address = address;
      hasUpdates = true;
    }

    if (address) {
      await this.upsertCustomerAddress(customer.id, tenantId, address, areaId);
    }

    if (hasUpdates) {
      return db.update({
        where: { id: customer.id },
        data: updateData,
      }) as Promise<Customer>;
    }

    return customer;
  }

  private async createCustomerWithCode(
    manager: Prisma.TransactionClient,
    phone: string,
    tenantId: number,
    name?: string,
    address?: string,
    notes?: string,
    areaId?: number | null,
  ): Promise<Customer> {
    // Increment counter
    await manager.$executeRaw`UPDATE tenants SET customer_counter = customer_counter + 1 WHERE id = ${tenantId}`;

    // Fetch the new counter value
    const result = await manager.$queryRaw<
      Array<{ customer_counter: number }>
    >`SELECT customer_counter FROM tenants WHERE id = ${tenantId}`;
    const newCode = Number(result[0].customer_counter);

    const customer = await manager.customer.create({
      data: {
        phone,
        tenant_id: tenantId,
        name,
        address,
        notes,
        code: newCode,
      },
    });

    if (address) {
      await this.upsertCustomerAddress(customer.id, tenantId, address, areaId);
    }

    return customer;
  }

  /**
   * Stores a customer address if it does not already exist for the same tenant/customer.
   */
  private async upsertCustomerAddress(
    customerId: number,
    tenantId: number,
    rawAddress: string,
    areaId?: number | null,
  ): Promise<void> {
    const address = rawAddress.trim();
    if (!address) {
      return;
    }

    const manager = DbTenantContext.getManager();
    const addressDb = manager
      ? manager.customerAddress
      : this.prisma.customerAddress;
    const existing = await addressDb.findFirst({
      where: {
        tenant_id: tenantId,
        customer_id: customerId,
        address,
        area_id: areaId ?? null,
      },
    });

    if (existing) {
      await addressDb.update({
        where: { id: existing.id },
        data: {
          deleted_at: null,
          last_used_at: new Date(),
          area_id: areaId ?? null,
        },
      });
      return;
    }

    await addressDb.create({
      data: {
        tenant_id: tenantId,
        customer_id: customerId,
        area_id: areaId ?? null,
        address,
        last_used_at: new Date(),
      },
    });
  }

  async updateMerchantLabel(
    id: number,
    label: string,
    tenantId: number,
  ): Promise<Customer> {
    const customer = await this.findOne(id, tenantId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    await this.getCustomersDb().update({
      where: { id },
      data: { merchant_label: label },
    });

    const updated = await this.getCustomersDb().findUnique({ where: { id } });
    if (!updated) {
      throw new Error('Customer not found after update');
    }
    return updated;
  }

  private getCustomersDb() {
    const manager = DbTenantContext.getManager();
    return manager ? manager.customer : this.prisma.customer;
  }

  private getOrdersDb() {
    const manager = DbTenantContext.getManager();
    return manager ? manager.order : this.prisma.order;
  }
}
