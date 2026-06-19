/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable sonarjs/no-nested-conditional */

jest.mock('src/customers/customers.service', () => ({
  CustomersService: class CustomersService {},
}));

import { Prisma } from '../../generated/prisma/client';
import { OrderSource } from '../../generated/prisma/client';
import { PricingMode } from 'src/common/enums/pricing-mode.enum';
import { OrderStatus } from 'src/common/enums/order-status.enum';
import { OrderType } from 'src/common/enums/order-type.enum';
import { OrdersService } from './orders.service';

const createOrderDto = (cardOnDeliveryRequested?: boolean) => ({
  customer: {
    name: 'Test Customer',
    phone: '01012345678',
    address: 'Test address',
  },
  order_type: OrderType.FREE_TEXT,
  free_text_payload: { text: 'Test order' },
  ...(cardOnDeliveryRequested === undefined
    ? {}
    : { card_on_delivery_requested: cardOnDeliveryRequested }),
});

const createOrderRecord = (data: any) => ({
  id: 10,
  tenant_id: data.tenant_id,
  customer_id: data.customer_id,
  public_token: data.public_token,
  order_type: data.order_type,
  status: data.status,
  pricing_mode: data.pricing_mode,
  subtotal: null,
  delivery_fee: new Prisma.Decimal(data.delivery_fee ?? 0),
  delivery_area_id: data.delivery_area_id ?? null,
  delivery_time_window_snapshot: data.delivery_time_window_snapshot ?? null,
  total: null,
  free_text_payload: data.free_text_payload ?? null,
  notes: data.notes ?? null,
  card_on_delivery_requested: data.card_on_delivery_requested,
  delivery_address: data.delivery_address ?? null,
  customer_phone: data.customer_phone ?? null,
  customer_name: data.customer_name ?? null,
  order_source: data.order_source,
  source_metadata: data.source_metadata ?? null,
  prescription_file_url: data.prescription_file_url ?? null,
  prescription_original_filename: data.prescription_original_filename ?? null,
  prescription_mime_type: data.prescription_mime_type ?? null,
  prescription_unavailability_action:
    data.prescription_unavailability_action ?? null,
  merchant_cancellation_reason: null,
  merchant_cancelled_at: null,
  customer_rejection_reason: null,
  customer_rejected_at: null,
  created_at: new Date('2026-06-19T06:00:00.000Z'),
  updated_at: new Date('2026-06-19T06:00:00.000Z'),
  deleted_at: null,
});

const createService = ({
  cardOnDeliveryAvailable = false,
}: { cardOnDeliveryAvailable?: boolean } = {}) => {
  let savedOrder: any;

  const manager = {
    $executeRaw: jest.fn(),
    tenantDirectoryProfile: {
      findUnique: jest.fn().mockResolvedValue({ area_id: null }),
    },
    tenantDeliveryArea: {
      findFirst: jest.fn(),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        delivery_fee: 0,
        delivery_starts_at: null,
        delivery_ends_at: null,
        card_on_delivery_available: cardOnDeliveryAvailable,
      }),
    },
    order: {
      create: jest.fn().mockImplementation(({ data }) => {
        savedOrder = createOrderRecord(data);
        return Promise.resolve(savedOrder);
      }),
      update: jest.fn().mockImplementation(({ data }) => {
        savedOrder = {
          ...savedOrder,
          pricing_mode: data.pricing_mode ?? savedOrder.pricing_mode,
          subtotal:
            data.subtotal === undefined
              ? savedOrder.subtotal
              : data.subtotal === null
                ? null
                : new Prisma.Decimal(data.subtotal),
          total:
            data.total === undefined
              ? savedOrder.total
              : data.total === null
                ? null
                : new Prisma.Decimal(data.total),
        };
        return Promise.resolve(savedOrder);
      }),
      findFirst: jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...savedOrder,
          customer: {
            id: 5,
            phone: savedOrder.customer_phone,
            name: savedOrder.customer_name,
            address: savedOrder.delivery_address,
          },
          order_items: [],
          tenant: {
            id: 1,
            name: 'Test Tenant',
            slug: 'test-tenant',
          },
          delivery_area: null,
        }),
      ),
    },
    orderItem: {
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    customer: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback) => callback(manager)),
    order: manager.order,
  };
  const customersService = {
    findOrCreate: jest.fn().mockResolvedValue({
      id: 5,
      phone: '01012345678',
      name: 'Test Customer',
      address: 'Test address',
      order_count: 1,
    }),
  };
  const tenantsService = {};
  const orderWhatsappService = {
    notifySellerNewOrder: jest.fn().mockResolvedValue(undefined),
    notifyCustomerConfirmed: jest.fn().mockResolvedValue(undefined),
    notifyWelcomeCustomer: jest.fn().mockResolvedValue(undefined),
  };
  const service = new OrdersService(
    prisma as any,
    customersService as any,
    tenantsService as any,
    orderWhatsappService as any,
  );

  return { service, manager };
};

describe('OrdersService card-on-delivery persistence', () => {
  it.each([
    [undefined, false, false],
    [undefined, true, false],
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ])(
    'persists customer request %s with tenant availability %s as %s',
    async (inputValue, tenantAvailability, expectedValue) => {
      const { service, manager } = createService({
        cardOnDeliveryAvailable: tenantAvailability,
      });

      const result = await service.createForTenantId(
        1,
        createOrderDto(inputValue) as any,
      );

      expect(manager.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            card_on_delivery_requested: expectedValue,
            order_source: OrderSource.storefront,
            pricing_mode: PricingMode.MANUAL,
            status: OrderStatus.DRAFT,
          }),
        }),
      );
      expect(result.card_on_delivery_requested).toBe(expectedValue);
    },
  );
});
