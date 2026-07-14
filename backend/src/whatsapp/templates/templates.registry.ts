import { z } from 'zod';
import { newOrderSeller } from './new-order-seller';
import { orderStatusUpdate } from './order-status';
import { outForDelivery } from './out-for-delivery';
import { orderProductReplacement } from './order-product-replacement';
import { merchantReplacementAccepted } from './merchant-replacement-accepted';
import { merchantReplacementRejected } from './merchant-replacement-rejected';
import { merchantDayClosureSummary } from './merchant-day-closure-summary';
import { merchantPasswordResetOtp } from './merchant-password-reset-otp';

export const templatesRegistry = {
  new_order_merchant: {
    contentSidEnv: 'TWILIO_CONTENT_SID_NEW_ORDER_MERCHANT',
    variables: {
      orderNumber: 1,
      customerName: 2,
      area: 3,
      totalEgp: 4,
    },
    schema: z.object({
      customerName: z.string().trim().min(1),
      orderNumber: z.string().trim().min(1),
      area: z.string().trim().min(1),
      totalEgp: z.number().nonnegative(),
    }),
    fallbackText: (data: {
      customerName: string;
      orderNumber: string;
      area: string;
      totalEgp: number;
    }) =>
      newOrderSeller({
        orderId: data.orderNumber,
        customerName: data.customerName,
        area: data.area,
        total: data.totalEgp,
      }),
  },

  order_received_customer: {
    contentSidEnv: 'TWILIO_CONTENT_SID_ORDER_RECEIVED_CUSTOMER',
    variables: {
      customerName: 1,
      orderNumber: 2,
      totalEgp: 3,
    },
    schema: z.object({
      customerName: z.string().trim().min(1),
      orderNumber: z.string().trim().min(1),
      totalEgp: z.number().nonnegative(),
    }),
    fallbackText: (data: {
      customerName: string;
      orderNumber: string;
      totalEgp: number;
    }) =>
      orderStatusUpdate({
        customerName: data.customerName,
        orderId: data.orderNumber,
        status: `تم استلام طلبك بنجاح. إجمالي الطلب: ${data.totalEgp} جنيه`,
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
    fallbackText: (data: { customerName: string; orderNumber: string }) =>
      outForDelivery({
        customerName: data.customerName,
        orderId: data.orderNumber,
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
    fallbackText: (data: {
      customerName: string;
      orderNumber: string;
      statusLabel: string;
    }) =>
      orderStatusUpdate({
        customerName: data.customerName,
        orderId: data.orderNumber,
        status: data.statusLabel,
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
    fallbackText: (data: {
      orderNumber: string;
      storeName: string;
      originalProductName: string;
      replacementProductName: string;
      orderTotal: number;
    }) => orderProductReplacement(data),
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
    fallbackText: (data: { orderNumber: string; customerName: string }) =>
      merchantReplacementAccepted(data),
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
    fallbackText: (data: {
      orderNumber: string;
      customerName: string;
      originalProductName: string;
      replacementProductName: string;
      reason: string;
    }) => merchantReplacementRejected(data),
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
    fallbackText: (data: {
      date: string;
      totalOrders: number;
      completedOrders: number;
      cancelledOrders: number;
      totalSalesEgp: number;
      totalCollectedEgp: number;
    }) => merchantDayClosureSummary(data),
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
    fallbackText: (data: { otp: string; expiresInMinutes: number }) =>
      merchantPasswordResetOtp(data),
  },

  zone_order_operations: {
    contentSidEnv: 'TWILIO_CONTENT_SID_ZONE_ORDER_OPERATIONS',
    variables: { orderNumber: 1, zoneName: 2, area: 3, totalEgp: 4 },
    schema: z.object({
      orderNumber: z.string().trim().min(1),
      zoneName: z.string().trim().min(1),
      area: z.string().trim().min(1),
      totalEgp: z.number().nonnegative(),
    }),
    fallbackText: (data: {
      orderNumber: string;
      zoneName: string;
      area: string;
      totalEgp: number;
    }) =>
      `طلب منطقة جديد #${data.orderNumber}\nالواجهة: ${data.zoneName}\nالمنطقة: ${data.area}\nالإجمالي المبدئي: ${data.totalEgp} جنيه`,
  },

  zone_order_assigned: {
    contentSidEnv: 'TWILIO_CONTENT_SID_ZONE_ORDER_ASSIGNED',
    variables: {
      merchantName: 1,
      orderNumber: 2,
      zoneName: 3,
      area: 4,
      assignmentUrl: 5,
    },
    schema: z.object({
      merchantName: z.string().trim().min(1),
      orderNumber: z.string().trim().min(1),
      zoneName: z.string().trim().min(1),
      area: z.string().trim().min(1),
      assignmentUrl: z.string().url(),
    }),
    fallbackText: (data: {
      merchantName: string;
      orderNumber: string;
      zoneName: string;
      area: string;
      assignmentUrl: string;
    }) =>
      `مرحباً ${data.merchantName}، تم إسناد الطلب #${data.orderNumber} من ${data.zoneName} (${data.area}). راجع الطلب: ${data.assignmentUrl}`,
  },

  zone_dispatch_rejected_operations: {
    contentSidEnv: 'TWILIO_CONTENT_SID_ZONE_DISPATCH_REJECTED_OPERATIONS',
    variables: { orderNumber: 1, merchantName: 2, reason: 3 },
    schema: z.object({
      orderNumber: z.string().trim().min(1),
      merchantName: z.string().trim().min(1),
      reason: z.string().trim().min(1),
    }),
    fallbackText: (data: {
      orderNumber: string;
      merchantName: string;
      reason: string;
    }) =>
      `رفض ${data.merchantName} الطلب #${data.orderNumber}. السبب: ${data.reason}. يحتاج الطلب إلى إعادة إسناد.`,
  },

  zone_dispatch_reassigned_operations: {
    contentSidEnv: 'TWILIO_CONTENT_SID_ZONE_DISPATCH_REASSIGNED_OPERATIONS',
    variables: { orderNumber: 1, previousMerchantName: 2, newMerchantName: 3 },
    schema: z.object({
      orderNumber: z.string().trim().min(1),
      previousMerchantName: z.string().trim().min(1),
      newMerchantName: z.string().trim().min(1),
    }),
    fallbackText: (data: {
      orderNumber: string;
      previousMerchantName: string;
      newMerchantName: string;
    }) =>
      `تمت إعادة إسناد الطلب #${data.orderNumber} من ${data.previousMerchantName} إلى ${data.newMerchantName}.`,
  },

  zone_order_accepted_customer: {
    contentSidEnv: 'TWILIO_CONTENT_SID_ZONE_ORDER_ACCEPTED_CUSTOMER',
    variables: {
      customerName: 1,
      orderNumber: 2,
      merchantName: 3,
      oldTotal: 4,
      newTotal: 5,
      trackingUrl: 6,
    },
    schema: z.object({
      customerName: z.string().trim().min(1),
      orderNumber: z.string().trim().min(1),
      merchantName: z.string().trim().min(1),
      oldTotal: z.number().nonnegative(),
      newTotal: z.number().nonnegative(),
      trackingUrl: z.string().url(),
    }),
    fallbackText: (data: {
      customerName: string;
      orderNumber: string;
      merchantName: string;
      oldTotal: number;
      newTotal: number;
      trackingUrl: string;
    }) =>
      `مرحباً ${data.customerName}، أكد ${data.merchantName} طلبك #${data.orderNumber}. الإجمالي من ${data.oldTotal} إلى ${data.newTotal} جنيه. التتبع: ${data.trackingUrl}`,
  },
} as const;

export type TemplateKey = keyof typeof templatesRegistry;

export type TemplatePayload<K extends TemplateKey> = z.infer<
  (typeof templatesRegistry)[K]['schema']
>;

export type TemplateVariables<K extends TemplateKey> =
  (typeof templatesRegistry)[K]['variables'];
