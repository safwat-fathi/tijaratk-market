'use server';

import { ordersService } from '@/services/api/orders.service';
import { zoneStorefrontsService } from '@/services/api/zone-storefronts.service';
import {
  OrderSource,
  OrderStatus,
  OrderType,
  UnavailableItemAction,
} from '@/types/enums';
import { CloseDayResponse, CreateOrderRequest } from '@/types/services/orders';
import { revalidatePath } from 'next/cache';
import { createOrderSchema } from '@/lib/validations/order';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import {
  persistCreatedOrderCustomerTracking,
} from '@/lib/tracking/customer-tracking-cookie';

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatus,
  cancellationReason?: string,
) {
  try {
    const response = await ordersService.updateOrder(orderId, {
      status,
      cancellation_reason: cancellationReason?.trim() || undefined,
    });

    revalidatePath('/merchant/orders');
    revalidatePath(`/merchant/orders/${orderId}`);
    revalidatePath('/merchant', 'layout');

    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to update order status:', error);
    return { success: false, error: 'Failed to update order status' };
  }
}

export async function replaceOrderItemAction(
  orderId: number,
  itemId: number,
  replacedByProductId: number | null,
) {
  try {
    const response = await ordersService.replaceOrderItem(itemId, {
      replaced_by_product_id: replacedByProductId,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.message || 'Failed to replace order item',
      };
    }

    revalidatePath(`/merchant/orders/${orderId}`);
    revalidatePath('/merchant/orders');

    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to replace order item:', error);
    return { success: false, error: 'Failed to replace order item' };
  }
}

export async function resetOrderItemReplacementAction(
  orderId: number,
  itemId: number,
) {
  try {
    const response = await ordersService.resetOrderItemReplacement(itemId);

    if (!response.success) {
      return {
        success: false,
        error: response.message || 'Failed to reset order item replacement',
      };
    }

    revalidatePath(`/merchant/orders/${orderId}`);
    revalidatePath('/merchant/orders');

    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to reset order item replacement:', error);
    return { success: false, error: 'Failed to reset order item replacement' };
  }
}

export async function updateOrderItemPriceAction(
  orderId: number,
  itemId: number,
  totalPrice: number,
) {
  try {
    const response = await ordersService.updateOrderItemPrice(itemId, {
      total_price: totalPrice,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.message || 'Failed to update order item price',
      };
    }

    revalidatePath(`/merchant/orders/${orderId}`);
    revalidatePath('/merchant/orders');

    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to update order item price:', error);
    return { success: false, error: 'Failed to update order item price' };
  }
}

export async function markOrderItemOutOfStockAction(
  orderId: number,
  itemId: number,
) {
  try {
    const response = await ordersService.markOrderItemOutOfStock(itemId);

    if (!response.success) {
      return {
        success: false,
        error: response.message || 'Failed to mark order item out of stock',
      };
    }

    revalidatePath(`/merchant/orders/${orderId}`);
    revalidatePath('/merchant/orders');
    revalidatePath('/merchant', 'layout');

    return { success: true, data: response.data };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to mark order item out of stock:', error);
    return { success: false, error: 'Failed to mark order item out of stock' };
  }
}

export async function closeDayAction(): Promise<{
  success: boolean;
  message?: string;
  data?: CloseDayResponse;
}> {
  try {
    const response = await ordersService.closeDay();

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'Failed to close day',
      };
    }

    revalidatePath('/merchant');

    return {
      success: true,
      message: response.message,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error('Failed to close day:', error);
    return {
      success: false,
      message: 'Failed to close day',
    };
  }
}

export type CreateOrderState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: unknown;
};

type CreateOrderCartItem = {
  product_id: number;
  quantity: string;
  name?: string;
  notes?: string;
  total_price?: number;
  selection_mode?: 'quantity' | 'weight' | 'price';
  selection_quantity?: number;
  selection_grams?: number;
  selection_amount_egp?: number;
  unit_option_id?: string;
};

type CreateOrderCustomerData = {
  customer_name: string;
  customer_phone: string;
  delivery_address?: string;
  delivery_area_slug?: string;
  order_source?: OrderSource;
  source_metadata?: string;
  notes?: string;
  card_on_delivery_requested?: boolean;
  unavailable_item_action?: UnavailableItemAction;
};

type CreatedOrderMeta = {
  public_token?: unknown;
  customer_access_code?: unknown;
  created_at?: unknown;
};

const parseCartItems = (cart?: string): CreateOrderCartItem[] => {
  if (!cart) {
    return [];
  }

  try {
    const parsed = JSON.parse(cart) as CreateOrderCartItem[];
    return parsed.filter(
      (item) => item.product_id && String(item.quantity || '').trim().length > 0,
    );
  } catch (error) {
    console.error('Failed to parse cart items:', error);
    return [];
  }
};

const parseSourceMetadata = (
  sourceMetadata?: string,
): Record<string, unknown> | undefined => {
  if (!sourceMetadata) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(sourceMetadata) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to parse order source metadata:', error);
    return undefined;
  }
};

const buildCreateOrderPayload = ({
  customerData,
  items,
  orderRequest,
}: {
  customerData: CreateOrderCustomerData;
  items: CreateOrderCartItem[];
  orderRequest?: string;
}): CreateOrderRequest => ({
  customer: {
    name: customerData.customer_name,
    phone: customerData.customer_phone,
    address: customerData.delivery_address,
  },
  items,
  notes: customerData.notes,
  card_on_delivery_requested: customerData.card_on_delivery_requested,
  unavailable_item_action: customerData.unavailable_item_action,
  free_text_payload: orderRequest ? { text: orderRequest } : undefined,
  order_type: items.length > 0 ? OrderType.CATALOG : OrderType.FREE_TEXT,
  delivery_area_slug: customerData.delivery_area_slug || undefined,
  order_source: customerData.order_source,
  source_metadata: parseSourceMetadata(customerData.source_metadata),
});

const appendCardOnDeliveryRequest = (
  formDataPayload: FormData,
  payload: CreateOrderRequest,
) => {
  if (payload.card_on_delivery_requested === true) {
    formDataPayload.append('card_on_delivery_requested', 'true');
  }
};

const appendUnavailableItemAction = (
  formDataPayload: FormData,
  payload: CreateOrderRequest,
) => {
  if (!payload.unavailable_item_action) {
    return;
  }

  formDataPayload.append(
    'unavailable_item_action',
    payload.unavailable_item_action,
  );
};

const buildCreateOrderFormData = (
  payload: CreateOrderRequest,
  sourceFormData: FormData,
) => {
  const formDataPayload = new FormData();
  formDataPayload.append('customer', JSON.stringify(payload.customer));

  if (payload.order_type) formDataPayload.append('order_type', payload.order_type);
  if (payload.items && payload.items.length > 0) {
    formDataPayload.append('items', JSON.stringify(payload.items));
  }
  if (payload.free_text_payload) {
    formDataPayload.append(
      'free_text_payload',
      JSON.stringify(payload.free_text_payload),
    );
  }
  if (payload.total !== undefined) {
    formDataPayload.append('total', payload.total.toString());
  }
  if (payload.notes) formDataPayload.append('notes', payload.notes);
  if (payload.delivery_fee !== undefined) {
    formDataPayload.append('delivery_fee', payload.delivery_fee.toString());
  }
  if (payload.order_source) {
    formDataPayload.append('order_source', payload.order_source);
  }
  if (payload.source_metadata) {
    formDataPayload.append(
      'source_metadata',
      JSON.stringify(payload.source_metadata),
    );
  }
  if (payload.delivery_area_id !== undefined) {
    formDataPayload.append(
      'delivery_area_id',
      payload.delivery_area_id.toString(),
    );
  }
  if (payload.delivery_area_slug) {
    formDataPayload.append('delivery_area_slug', payload.delivery_area_slug);
  }
  appendUnavailableItemAction(formDataPayload, payload);
  appendCardOnDeliveryRequest(formDataPayload, payload);

  const unavailabilityOption = sourceFormData.get('unavailabilityOption');
  if (typeof unavailabilityOption === 'string' && unavailabilityOption) {
    formDataPayload.append('prescription_unavailability_action', unavailabilityOption);
  }

  const prescriptionFile = sourceFormData.get('prescription_file');
  if (prescriptionFile instanceof File && prescriptionFile.size > 0) {
    formDataPayload.append('prescription_file', prescriptionFile);
  }

  return formDataPayload;
};

const persistCreatedOrderTrackingArtifacts = async ({
  tenantSlug,
  responseData,
  customerData,
}: {
  tenantSlug: string;
  responseData: unknown;
  customerData: CreateOrderCustomerData;
}) => {
  const createdOrder = responseData as CreatedOrderMeta | undefined;
  const publicToken =
    typeof createdOrder?.public_token === 'string'
      ? createdOrder.public_token.trim()
      : '';

  if (publicToken) {
    try {
      await persistCreatedOrderCustomerTracking({
        trackedOrder: {
          token: publicToken,
          slug: tenantSlug,
          created_at:
            typeof createdOrder?.created_at === 'string'
              ? createdOrder.created_at
              : new Date().toISOString(),
        },
        slug: tenantSlug,
        profile: {
          name: customerData.customer_name,
          phone: customerData.customer_phone,
          address: customerData.delivery_address,
          notes: customerData.notes,
        },
      });
    } catch (cookieError) {
      console.error('Failed to persist order tracking cookie:', cookieError);
    }
    return;
  }

  try {
    await persistCreatedOrderCustomerTracking({
      slug: tenantSlug,
      profile: {
        name: customerData.customer_name,
        phone: customerData.customer_phone,
        address: customerData.delivery_address,
        notes: customerData.notes,
      },
    });
  } catch (cookieError) {
    console.error('Failed to persist customer profile tracking cookie:', cookieError);
  }
};

function extractOrderMeta(data: unknown): { publicToken: string; customerAccessCode: string } {
  const meta = data as CreatedOrderMeta | undefined;
  return {
    publicToken: typeof meta?.public_token === 'string' ? meta.public_token.trim() : '',
    customerAccessCode: typeof meta?.customer_access_code === 'string' ? meta.customer_access_code.trim() : '',
  };
}

export async function createOrderAction(
  tenantSlug: string,
  _prevState: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const rawData = Object.fromEntries(formData.entries());

  const validatedFields = createOrderSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Validation failed, please check inputs.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { cart, order_request, ...customerData } = validatedFields.data;
  const items = parseCartItems(cart);
  const payload = buildCreateOrderPayload({
    customerData,
    items,
    orderRequest: order_request,
  });
  const formDataPayload = buildCreateOrderFormData(payload, formData);

  try {
    const response = await ordersService.createPublicOrder(tenantSlug, formDataPayload);

    if (response.success) {
      await persistCreatedOrderTrackingArtifacts({
        tenantSlug,
        responseData: response.data,
        customerData,
      });

      const { publicToken, customerAccessCode } = extractOrderMeta(response.data);

      return {
        success: true,
        message: 'Order created successfully',
        data: publicToken
          ? {
              public_token: publicToken,
              ...(customerAccessCode
                ? { customer_access_code: customerAccessCode }
                : {}),
            }
          : response.data,
      };
    }

    return {
      success: false,
      message: response.message || 'Failed to create order',
      errors: response.errors as Record<string, string[]> | undefined,
    };
  } catch (error: unknown) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    
    console.error('Failed to create order:', error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to create order. Please try again.',
    };
  }
}

export async function createZoneOrderAction(
  zoneSlug: string,
  _prevState: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const rawData = Object.fromEntries(formData.entries());
  const validatedFields = createOrderSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Validation failed, please check inputs.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { cart, order_request, ...customerData } = validatedFields.data;
  const items = parseCartItems(cart);
  const payload = buildCreateOrderPayload({
    customerData,
    items,
    orderRequest: order_request,
  });
  const formDataPayload = buildCreateOrderFormData(payload, formData);

  try {
    const response = await zoneStorefrontsService.createPublicOrder(
      zoneSlug,
      formDataPayload,
    );
    if (!response.success) {
      return {
        success: false,
        message: response.message || 'تعذر إنشاء الطلب',
        errors: response.errors as Record<string, string[]> | undefined,
      };
    }

    await persistCreatedOrderTrackingArtifacts({
      tenantSlug: `market:${zoneSlug}`,
      responseData: response.data,
      customerData,
    });
    const { publicToken, customerAccessCode } = extractOrderMeta(response.data);
    return {
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      data: publicToken
        ? {
            public_token: publicToken,
            ...(customerAccessCode
              ? { customer_access_code: customerAccessCode }
              : {}),
          }
        : response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('Failed to create zone order:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'تعذر إنشاء الطلب',
    };
  }
}
