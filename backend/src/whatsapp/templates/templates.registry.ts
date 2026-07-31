import { z } from 'zod';

export const templatesRegistry = {
  new_order_merchant: {
    contentSidEnv: 'TWILIO_CONTENT_SID_NEW_ORDER_MERCHANT',
    variables: {
      orderNumber: 1,
      customerName: 2,
      customerPhone: 3,
      deliveryAddress: 4,
      orderDetails: 5,
      initialTotalEgp: 6,
    },
    schema: z.object({
      customerName: z.string().trim().min(1),
      orderNumber: z.string().trim().min(1),
      customerPhone: z.string().trim().min(1),
      deliveryAddress: z.string().trim().min(1),
      orderDetails: z.string().trim().min(1).max(1000),
      initialTotalEgp: z.number().nonnegative(),
    }),
  },

  order_out_for_delivery: {
    contentSidEnv: 'TWILIO_CONTENT_SID_ORDER_OUT_FOR_DELIVERY',
    variables: {
      customerName: 1,
      orderNumber: 2,
    },
    schema: z.object({
      customerName: z.string().trim().min(1),
      orderNumber: z.string().trim().min(1),
    }),
  },

  order_status_update_customer: {
    contentSidEnv: 'TWILIO_CONTENT_SID_ORDER_STATUS_UPDATE_CUSTOMER',
    variables: {
      customerName: 1,
      orderNumber: 2,
      statusLabel: 3,
    },
    schema: z.object({
      customerName: z.string().trim().min(1),
      orderNumber: z.string().trim().min(1),
      statusLabel: z.string().trim().min(1),
    }),
  },

  order_product_replacement: {
    contentSidEnv: 'TWILIO_CONTENT_SID_ORDER_PRODUCT_REPLACEMENT',
    variables: {
      orderNumber: 1,
      storeName: 2,
      originalProductName: 3,
      replacementProductName: 4,
      orderTotal: 5,
    },
    schema: z.object({
      orderNumber: z.string().trim().min(1),
      storeName: z.string().trim().min(1),
      originalProductName: z.string().trim().min(1),
      replacementProductName: z.string().trim().min(1),
      orderTotal: z.number().nonnegative(),
    }),
  },

  merchant_replacement_accepted: {
    contentSidEnv: 'TWILIO_CONTENT_SID_MERCHANT_REPLACEMENT_ACCEPTED',
    variables: {
      orderNumber: 1,
      customerName: 2,
    },
    schema: z.object({
      orderNumber: z.string().trim().min(1),
      customerName: z.string().trim().min(1),
    }),
  },

  merchant_replacement_rejected: {
    contentSidEnv: 'TWILIO_CONTENT_SID_MERCHANT_REPLACEMENT_REJECTED',
    variables: {
      orderNumber: 1,
      customerName: 2,
      originalProductName: 3,
      replacementProductName: 4,
      reason: 5,
    },
    schema: z.object({
      orderNumber: z.string().trim().min(1),
      customerName: z.string().trim().min(1),
      originalProductName: z.string().trim().min(1),
      replacementProductName: z.string().trim().min(1),
      reason: z.string().trim().min(1),
    }),
  },

  merchant_day_closure_summary: {
    contentSidEnv: 'TWILIO_CONTENT_SID_MERCHANT_DAY_CLOSURE_SUMMARY',
    variables: {
      date: 1,
      totalOrders: 2,
      completedOrders: 3,
      cancelledOrders: 4,
      totalSalesEgp: 5,
      totalCollectedEgp: 6,
    },
    schema: z.object({
      date: z.string().trim().min(1),
      totalOrders: z.number().nonnegative(),
      completedOrders: z.number().nonnegative(),
      cancelledOrders: z.number().nonnegative(),
      totalSalesEgp: z.number().nonnegative(),
      totalCollectedEgp: z.number().nonnegative(),
    }),
  },

  merchant_password_reset_otp: {
    contentSidEnv: 'TWILIO_CONTENT_SID_MERCHANT_PASSWORD_RESET_OTP',
    variables: {
      otp: 1,
      expiresInMinutes: 2,
    },
    schema: z.object({
      otp: z
        .string()
        .trim()
        .regex(/^\d{6}$/),
      expiresInMinutes: z.number().int().positive(),
    }),
  },
} as const;

export type TemplateKey = keyof typeof templatesRegistry;

export type TemplatePayload<K extends TemplateKey> = z.infer<
  (typeof templatesRegistry)[K]['schema']
>;

export type TemplateVariables<K extends TemplateKey> =
  (typeof templatesRegistry)[K]['variables'];
