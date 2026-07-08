# Technical Plan: Activity Log for Tijaratk MVP

## 1. Goal

Implement an activity log system that records important merchant/admin/system actions across:

- Orders
- Order items
- Products
- Customers
- Store settings
- Subscriptions
- Day closures later

The system should answer:

> Who changed what, from what value to what value, when, and from where?

Your existing schema already has the important entities: tenants, users, products, price history, customers, orders, order items, day closures, subscription plans, and tenant subscriptions . So the activity log should connect to those entities, not duplicate them.

---

# 2. MVP Scope

## Phase 1: Implement now

Log these actions first:

```ts
order.created;
order.status_changed;
order.cancelled;
order.completed;
order.delivery_fee_changed;
order.total_changed;
order.item_added;
order.item_removed;
order.item_quantity_changed;
order.item_price_changed;
order.replacement_proposed;
order.replacement_approved;
order.replacement_rejected;

product.created;
product.updated;
product.price_changed;
product.availability_changed;
product.archived;
product.bulk_created;
product.csv_import_completed;

customer.updated;
customer.address_added;
customer.note_updated;

tenant.settings_updated;
tenant.delivery_settings_updated;
tenant.status_changed;

subscription.created;
subscription.plan_changed;
subscription.renewed;
subscription.expired;
```

## Not MVP

Do **not** include these inside activity log:

```ts
customer.page_viewed;
product.clicked;
product.searched;
cart.abandoned;
storefront.visited;
api.request_failed;
button.clicked;
```

Those belong to analytics/PostHog/server logs, not activity log.

---

# 3. Database Design

## 3.1 Prisma model

Add this model:

```prisma
model ActivityLog {
  id              Int      @id @default(autoincrement())

  tenant_id       Int?
  actor_user_id   Int?
  actor_admin_id  Int?

  entity_type     ActivityEntityType
  entity_id       Int?

  action          String   @db.VarChar(96)
  title           String   @db.VarChar(160)
  description     String?

  old_values      Json?
  new_values      Json?
  metadata        Json?

  source          ActivitySource @default(dashboard)

  created_at      DateTime @default(now()) @db.Timestamptz(6)

  tenant          Tenant?     @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  actor_user      User?       @relation(fields: [actor_user_id], references: [id], onDelete: SetNull)
  actor_admin     AdminUser?  @relation(fields: [actor_admin_id], references: [id], onDelete: SetNull)

  @@index([tenant_id, created_at])
  @@index([tenant_id, entity_type, entity_id, created_at])
  @@index([actor_user_id, created_at])
  @@index([actor_admin_id, created_at])
  @@index([action, created_at])
}
```

Add enums:

```prisma
enum ActivityEntityType {
  order
  order_item
  product
  customer
  tenant
  user
  subscription
  day_closure
  csv_import
}

enum ActivitySource {
  dashboard
  storefront
  admin
  system
  whatsapp
  csv_import
}
```

## 3.2 Why `action` should be string, not enum

Use `String` for `action`.

Reason: you will keep adding actions. If you use Prisma enum for every action, every small log type needs a DB migration. That is annoying and unnecessary.

Use enum only for stable concepts:

```ts
entity_type;
source;
```

Use string for flexible event names:

```ts
product.price_changed;
order.status_changed;
```

---

# 4. Important DB Design Decisions

## 4.1 Append-only

Do not update activity logs after creation.

Do not delete logs from the merchant dashboard.

If needed later, only admin can hard-delete old logs through a maintenance script.

## 4.2 Tenant scoped

Every merchant-facing log must have `tenant_id`.

This prevents one merchant from seeing another merchant’s logs.

## 4.3 Actor can be nullable

Some actions will not have a dashboard user:

```ts
order.created; // customer created order from storefront
customer.created; // system created customer after checkout
subscription.expired; // cron/system action
```

So support:

```ts
actor_user_id: null;
actor_admin_id: null;
source: "storefront" | "system";
```

## 4.4 Avoid sensitive duplication

Do **not** store full phone numbers or addresses in `old_values`, `new_values`, or `metadata`.

Bad:

```json
{
  "old_values": {
    "phone": "01012345678",
    "address": "Villa 12, ..."
  }
}
```

Better:

```json
{
  "old_values": {
    "phone_changed": true,
    "address_changed": true
  }
}
```

The real phone/address already exists in `customers` or `orders`.

---

# 5. Backend Architecture

Assuming your backend is NestJS + Prisma.

Create a new module:

```txt
backend/src/activity-log/
├── activity-log.module.ts
├── activity-log.service.ts
├── activity-log.controller.ts
├── dto/
│   ├── create-activity-log.dto.ts
│   └── query-activity-log.dto.ts
├── constants/
│   ├── activity-actions.ts
│   └── activity-titles.ts
└── utils/
    ├── activity-diff.util.ts
    └── activity-format.util.ts
```

---

# 6. Activity Log Service

## 6.1 Create DTO

```ts
export type ActivityEntityType =
  | "order"
  | "order_item"
  | "product"
  | "customer"
  | "tenant"
  | "user"
  | "subscription"
  | "day_closure"
  | "csv_import";

export type ActivitySource =
  | "dashboard"
  | "storefront"
  | "admin"
  | "system"
  | "whatsapp"
  | "csv_import";

export interface CreateActivityLogInput {
  tenantId?: number | null;
  actorUserId?: number | null;
  actorAdminId?: number | null;

  entityType: ActivityEntityType;
  entityId?: number | null;

  action: string;
  title: string;
  description?: string | null;

  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;

  source: ActivitySource;
}
```

## 6.2 Service

```ts
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateActivityLogInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;

    return db.activityLog.create({
      data: {
        tenant_id: input.tenantId ?? null,
        actor_user_id: input.actorUserId ?? null,
        actor_admin_id: input.actorAdminId ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        action: input.action,
        title: input.title,
        description: input.description ?? null,
        old_values: input.oldValues ?? undefined,
        new_values: input.newValues ?? undefined,
        metadata: input.metadata ?? undefined,
        source: input.source,
      },
    });
  }
}
```

## 6.3 Query service

```ts
interface QueryActivityLogsInput {
  tenantId: number;
  entityType?: ActivityEntityType;
  entityId?: number;
  action?: string;
  cursor?: number;
  limit?: number;
}

async findTenantLogs(input: QueryActivityLogsInput) {
  const limit = Math.min(input.limit ?? 20, 50);

  return this.prisma.activityLog.findMany({
    where: {
      tenant_id: input.tenantId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      ...(input.cursor
        ? { id: { lt: input.cursor } }
        : {}),
    },
    include: {
      actor_user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      actor_admin: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      id: 'desc',
    },
    take: limit,
  });
}
```

Use cursor by `id`, not offset. It is cheaper and stable.

---

# 7. Where to Write Logs

Do **not** write logs from controllers.

Write them inside services where the real business change happens.

Example:

```txt
OrdersService
ProductsService
CustomersService
TenantsService
SubscriptionsService
```

Reason: the service has access to old value, new value, tenant, actor, and business meaning.

---

# 8. Request Actor Context

You need a consistent way to know:

```ts
tenantId;
userId;
adminId;
source;
```

Create a type:

```ts
export interface RequestActor {
  tenantId?: number;
  userId?: number;
  adminId?: number;
  source:
    | "dashboard"
    | "storefront"
    | "admin"
    | "system"
    | "whatsapp"
    | "csv_import";
}
```

In protected merchant endpoints:

```ts
actor = {
  tenantId: authUser.tenant_id,
  userId: authUser.id,
  source: "dashboard",
};
```

In admin endpoints:

```ts
actor = {
  adminId: adminUser.id,
  source: "admin",
};
```

In public storefront order creation:

```ts
actor = {
  tenantId,
  source: "storefront",
};
```

---

# 9. Transaction Pattern

For important operations, write the business change and activity log in the same DB transaction.

Example:

```ts
await this.prisma.$transaction(async (tx) => {
  const oldOrder = await tx.order.findFirstOrThrow({
    where: {
      id: orderId,
      tenant_id: actor.tenantId,
    },
  });

  const updatedOrder = await tx.order.update({
    where: { id: orderId },
    data: { status: newStatus },
  });

  await this.activityLogService.create(
    {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      entityType: "order",
      entityId: orderId,
      action: "order.status_changed",
      title: "تم تغيير حالة الطلب",
      description: `تم تغيير حالة الطلب من ${oldOrder.status} إلى ${newStatus}`,
      oldValues: {
        status: oldOrder.status,
      },
      newValues: {
        status: newStatus,
      },
      source: actor.source,
    },
    tx,
  );

  return updatedOrder;
});
```

For MVP, I recommend **same transaction**.

Why? Because if the order status changes but the log is missing, trust in the log dies quickly.

---

# 10. Activity Action Constants

Create:

```ts
export const ActivityActions = {
  OrderCreated: "order.created",
  OrderStatusChanged: "order.status_changed",
  OrderCancelled: "order.cancelled",
  OrderCompleted: "order.completed",
  OrderDeliveryFeeChanged: "order.delivery_fee_changed",
  OrderTotalChanged: "order.total_changed",

  OrderItemAdded: "order.item_added",
  OrderItemRemoved: "order.item_removed",
  OrderItemQuantityChanged: "order.item_quantity_changed",
  OrderItemPriceChanged: "order.item_price_changed",

  OrderReplacementProposed: "order.replacement_proposed",
  OrderReplacementApproved: "order.replacement_approved",
  OrderReplacementRejected: "order.replacement_rejected",

  ProductCreated: "product.created",
  ProductUpdated: "product.updated",
  ProductPriceChanged: "product.price_changed",
  ProductAvailabilityChanged: "product.availability_changed",
  ProductArchived: "product.archived",
  ProductBulkCreated: "product.bulk_created",
  ProductCsvImportCompleted: "product.csv_import_completed",

  CustomerUpdated: "customer.updated",
  CustomerAddressAdded: "customer.address_added",
  CustomerNoteUpdated: "customer.note_updated",

  TenantSettingsUpdated: "tenant.settings_updated",
  TenantDeliverySettingsUpdated: "tenant.delivery_settings_updated",
  TenantStatusChanged: "tenant.status_changed",

  SubscriptionCreated: "subscription.created",
  SubscriptionPlanChanged: "subscription.plan_changed",
  SubscriptionRenewed: "subscription.renewed",
  SubscriptionExpired: "subscription.expired",
} as const;
```

Do not scatter raw strings everywhere.

---

# 11. Diff Utility

Create a helper for update operations.

```ts
export function pickChangedFields<T extends Record<string, any>>(
  oldData: T,
  newData: Partial<T>,
  fields: Array<keyof T>,
) {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const field of fields) {
    if (newData[field] !== undefined && oldData[field] !== newData[field]) {
      oldValues[String(field)] = oldData[field];
      newValues[String(field)] = newData[field];
    }
  }

  return {
    oldValues,
    newValues,
    hasChanges: Object.keys(oldValues).length > 0,
  };
}
```

Example use for product update:

```ts
const diff = pickChangedFields(oldProduct, updateDto, [
  "name",
  "category",
  "current_price",
  "is_available",
  "status",
]);

if (diff.hasChanges) {
  await this.activityLogService.create(
    {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      entityType: "product",
      entityId: productId,
      action: ActivityActions.ProductUpdated,
      title: "تم تعديل المنتج",
      description: `تم تعديل بيانات المنتج ${oldProduct.name}`,
      oldValues: diff.oldValues,
      newValues: diff.newValues,
      source: actor.source,
    },
    tx,
  );
}
```

---

# 12. Backend Endpoints

## Merchant endpoints

```http
GET /merchant/activity-logs
GET /merchant/activity-logs?entityType=order&entityId=123
GET /merchant/activity-logs?entityType=product&entityId=456
```

Query params:

```ts
entityType?: ActivityEntityType
entityId?: number
action?: string
cursor?: number
limit?: number
```

Response:

```ts
{
  "items": [
    {
      "id": 1022,
      "entityType": "order",
      "entityId": 123,
      "action": "order.status_changed",
      "title": "تم تغيير حالة الطلب",
      "description": "تم تغيير حالة الطلب من جديد إلى مؤكد",
      "oldValues": { "status": "draft" },
      "newValues": { "status": "confirmed" },
      "source": "dashboard",
      "actor": {
        "type": "user",
        "name": "أحمد"
      },
      "createdAt": "2026-07-09T10:20:00.000Z"
    }
  ],
  "nextCursor": 1001
}
```

## Admin endpoints

```http
GET /admin/merchants/:tenantId/activity-logs
GET /admin/activity-logs?tenantId=12
```

Admin can see logs across stores.

Merchant can only see own tenant logs.

---

# 13. Authorization Rules

## Merchant user

Can read only:

```ts
where: {
  tenant_id: currentUser.tenant_id;
}
```

## Staff user

Can read logs, but maybe not subscription/admin logs.

For MVP:

```ts
owner: can see all tenant logs
staff: can see order/product/customer logs only
```

## Admin user

Can read all logs.

## Customer

No access.

---

# 14. Frontend Plan

Your frontend already uses Next.js App Router, server actions, service classes, and Arabic RTL patterns . Follow the existing architecture.

## 14.1 Add service file

Create:

```txt
frontend/services/api/activity-logs.service.ts
```

```ts
import { HttpService } from "../base/http.service";

export interface ActivityLogDto {
  id: number;
  entityType: string;
  entityId: number | null;
  action: string;
  title: string;
  description: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  source: string;
  actor: {
    type: "user" | "admin" | "system" | "customer";
    name: string;
  };
  createdAt: string;
}

export interface GetActivityLogsParams {
  entityType?: string;
  entityId?: number;
  action?: string;
  cursor?: number;
  limit?: number;
}

export class ActivityLogsService {
  constructor(private readonly http: HttpService) {}

  getMerchantLogs(params: GetActivityLogsParams = {}) {
    return this.http.get<{
      items: ActivityLogDto[];
      nextCursor: number | null;
    }>("/merchant/activity-logs", { params });
  }
}
```

## 14.2 Add server action

Create:

```txt
frontend/actions/activity-log-actions.ts
```

```ts
"use server";

import { revalidatePath } from "next/cache";
import { activityLogsService } from "@/services/api/activity-logs.service";

export async function getActivityLogsAction(params: {
  entityType?: string;
  entityId?: number;
  cursor?: number;
  limit?: number;
}) {
  return activityLogsService.getMerchantLogs(params);
}
```

Since your pattern is server actions + service classes + revalidate where needed, this fits your current frontend structure .

---

# 15. Frontend Routes

## MVP routes

Add global activity page later:

```txt
frontend/app/(dashboard)/merchant/(features)/activity/page.tsx
```

But first add scoped logs inside:

```txt
frontend/app/(dashboard)/merchant/(features)/orders/[id]/page.tsx
frontend/app/(dashboard)/merchant/(features)/products/[id]/page.tsx
frontend/app/(dashboard)/merchant/(features)/customers/[id]/page.tsx
```

Recommended order:

1. Add activity section to order details page.
2. Add activity section to product details page.
3. Add `/merchant/activity` global page.
4. Add admin merchant activity page.

---

# 16. Frontend Components

Create:

```txt
frontend/components/activity/
├── ActivityTimeline.tsx
├── ActivityTimelineItem.tsx
├── ActivityFilters.tsx
└── ActivityActorLabel.tsx
```

## `ActivityTimeline.tsx`

```tsx
import { ActivityLogDto } from "@/types/models/activity-log";
import { ActivityTimelineItem } from "./ActivityTimelineItem";

interface Props {
  items: ActivityLogDto[];
}

export function ActivityTimeline({ items }: Props) {
  if (!items.length) {
    return (
      <div className="rounded-xl border p-4 text-sm text-gray-500">
        لا يوجد نشاط مسجل حتى الآن
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ActivityTimelineItem key={item.id} item={item} />
      ))}
    </div>
  );
}
```

## `ActivityTimelineItem.tsx`

```tsx
import { formatDateTimeArabic } from "@/lib/utils/date";

interface Props {
  item: {
    title: string;
    description: string | null;
    actor: {
      name: string;
      type: string;
    };
    createdAt: string;
  };
}

export function ActivityTimelineItem({ item }: Props) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="font-medium text-gray-900">{item.title}</div>

      {item.description && (
        <div className="mt-1 text-sm text-gray-600">{item.description}</div>
      )}

      <div className="mt-2 text-xs text-gray-400">
        بواسطة {item.actor.name} · {formatDateTimeArabic(item.createdAt)}
      </div>
    </div>
  );
}
```

---

# 17. Order Details Integration

In order details page:

```tsx
const [order, logs] = await Promise.all([
  ordersService.getOrder(orderId),
  activityLogsService.getMerchantLogs({
    entityType: "order",
    entityId: orderId,
    limit: 20,
  }),
]);
```

Render:

```tsx
<section className="mt-6">
  <h2 className="mb-3 text-lg font-semibold">سجل الطلب</h2>
  <ActivityTimeline items={logs.items} />
</section>
```

For order item actions, you have two choices:

## Option A — log item actions under entity type `order`

This is easier for MVP.

Example:

```ts
entityType: "order";
entityId: orderId;
action: "order.item_price_changed";
```

## Option B — log item actions under `order_item`

More technically accurate, but annoying in UI.

My recommendation: **Option A for MVP**.

The merchant wants to see everything in the order timeline.

---

# 18. Product Details Integration

In product details page:

```tsx
const logs = await activityLogsService.getMerchantLogs({
  entityType: "product",
  entityId: productId,
  limit: 20,
});
```

Render:

```tsx
<section className="mt-6">
  <h2 className="mb-3 text-lg font-semibold">سجل المنتج</h2>
  <ActivityTimeline items={logs.items} />
</section>
```

---

# 19. Global Activity Page

Route:

```txt
/merchant/activity
```

Page filters:

```txt
كل الأنشطة
الطلبات
المنتجات
العملاء
الإعدادات
الاشتراك
```

Query example:

```txt
/merchant/activity?type=order
/merchant/activity?type=product
```

UI copy:

```txt
سجل النشاط
تابع آخر التغييرات التي تمت في الطلبات، المنتجات، العملاء، وإعدادات المتجر.
```

Activity item example:

```txt
تم تعديل سعر المنتج
سكر الضحى 1 كيلو: 35 → 39 جنيه
بواسطة أحمد · اليوم 3:45 م
```

---

# 20. Logging Implementation Examples

## 20.1 Order created from storefront

When customer submits checkout:

```ts
await this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: {
      tenant_id: tenantId,
      customer_id: customer.id,
      status: "draft",
      order_type: "catalog",
      subtotal,
      delivery_fee,
      total,
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_address,
    },
  });

  await this.activityLogService.create(
    {
      tenantId,
      entityType: "order",
      entityId: order.id,
      action: ActivityActions.OrderCreated,
      title: "تم إنشاء طلب جديد",
      description: `تم إنشاء طلب جديد بقيمة ${total} جنيه`,
      newValues: {
        status: order.status,
        subtotal,
        delivery_fee,
        total,
      },
      source: "storefront",
    },
    tx,
  );

  return order;
});
```

## 20.2 Order status changed

```ts
async updateOrderStatus(orderId: number, newStatus: OrderStatus, actor: RequestActor) {
  return this.prisma.$transaction(async (tx) => {
    const oldOrder = await tx.order.findFirstOrThrow({
      where: {
        id: orderId,
        tenant_id: actor.tenantId,
      },
    });

    if (oldOrder.status === newStatus) {
      return oldOrder;
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    await this.activityLogService.create(
      {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        entityType: 'order',
        entityId: orderId,
        action: ActivityActions.OrderStatusChanged,
        title: 'تم تغيير حالة الطلب',
        description: `تم تغيير حالة الطلب من ${oldOrder.status} إلى ${newStatus}`,
        oldValues: {
          status: oldOrder.status,
        },
        newValues: {
          status: newStatus,
        },
        source: actor.source,
      },
      tx,
    );

    return updatedOrder;
  });
}
```

## 20.3 Product price changed

```ts
async updateProduct(productId: number, dto: UpdateProductDto, actor: RequestActor) {
  return this.prisma.$transaction(async (tx) => {
    const oldProduct = await tx.product.findFirstOrThrow({
      where: {
        id: productId,
        tenant_id: actor.tenantId,
      },
    });

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: dto,
    });

    if (
      dto.current_price !== undefined &&
      oldProduct.current_price?.toString() !== dto.current_price?.toString()
    ) {
      await this.activityLogService.create(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          entityType: 'product',
          entityId: productId,
          action: ActivityActions.ProductPriceChanged,
          title: 'تم تعديل سعر المنتج',
          description: `تم تعديل سعر ${oldProduct.name} من ${oldProduct.current_price} إلى ${dto.current_price} جنيه`,
          oldValues: {
            current_price: oldProduct.current_price,
          },
          newValues: {
            current_price: dto.current_price,
          },
          source: actor.source,
        },
        tx,
      );
    }

    return updatedProduct;
  });
}
```

## 20.4 Product availability changed

```ts
if (
  dto.is_available !== undefined &&
  oldProduct.is_available !== dto.is_available
) {
  await this.activityLogService.create(
    {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      entityType: "product",
      entityId: productId,
      action: ActivityActions.ProductAvailabilityChanged,
      title: dto.is_available ? "تم إتاحة المنتج" : "تم إخفاء المنتج من الطلب",
      description: dto.is_available
        ? `تم جعل ${oldProduct.name} متاحًا للطلب`
        : `تم جعل ${oldProduct.name} غير متاح للطلب`,
      oldValues: {
        is_available: oldProduct.is_available,
      },
      newValues: {
        is_available: dto.is_available,
      },
      source: actor.source,
    },
    tx,
  );
}
```

## 20.5 Tenant delivery settings changed

```ts
const watchedFields = [
  "delivery_fee",
  "delivery_available",
  "delivery_starts_at",
  "delivery_ends_at",
] as const;

const diff = pickChangedFields(oldTenant, dto, watchedFields);

if (diff.hasChanges) {
  await this.activityLogService.create(
    {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      entityType: "tenant",
      entityId: actor.tenantId,
      action: ActivityActions.TenantDeliverySettingsUpdated,
      title: "تم تعديل إعدادات التوصيل",
      description: "تم تعديل رسوم أو مواعيد التوصيل",
      oldValues: diff.oldValues,
      newValues: diff.newValues,
      source: actor.source,
    },
    tx,
  );
}
```

---

# 21. Arabic Labels for Technical Values

Do not show raw enum values like:

```txt
draft → confirmed
```

Create mapping:

```ts
export const ORDER_STATUS_LABELS_AR = {
  draft: "جديد",
  confirmed: "مؤكد",
  out_for_delivery: "خرج للتوصيل",
  completed: "مكتمل",
  cancelled: "ملغي",
  rejected_by_customer: "مرفوض من العميل",
};
```

Then format:

```ts
description: `تم تغيير حالة الطلب من ${ORDER_STATUS_LABELS_AR[oldStatus]} إلى ${ORDER_STATUS_LABELS_AR[newStatus]}`;
```

Same for:

```ts
ProductStatus;
TenantStatus;
ReplacementDecisionStatus;
UserRole;
ActivitySource;
```

Your frontend is Arabic-first and RTL, so this should be handled as a first-class requirement, not a later translation task .

---

# 22. Backfilling Existing Data

For MVP, do not backfill every historical action.

Just create one system log per existing tenant:

```ts
tenant.created_existing;
```

Example:

```txt
تم إنشاء سجل النشاط لهذا المتجر
```

Optional one-time script:

```ts
for each tenant:
  create ActivityLog {
    tenant_id: tenant.id,
    entity_type: 'tenant',
    entity_id: tenant.id,
    action: 'tenant.activity_log_initialized',
    title: 'تم تفعيل سجل النشاط',
    source: 'system'
  }
```

Do not try to reconstruct old product price changes/orders. You cannot accurately know who did what.

---

# 23. CSV Import Logging

For CSV/bulk update, do not create 500 activity logs for 500 rows in MVP.

Create one summary log:

```ts
product.csv_import_completed;
```

Metadata:

```json
{
  "total_rows": 500,
  "created_count": 120,
  "updated_count": 350,
  "failed_count": 30,
  "file_name": "products-july.csv"
}
```

If you need row-level details, store them in a separate `csv_import_jobs` table later.

---

# 24. Performance Considerations

## Indexes

These are enough for MVP:

```prisma
@@index([tenant_id, created_at])
@@index([tenant_id, entity_type, entity_id, created_at])
@@index([actor_user_id, created_at])
@@index([action, created_at])
```

## Pagination

Use cursor pagination.

Do not use offset for logs after the first version.

## Retention

For MVP:

```txt
Keep logs forever.
```

Later:

```txt
Keep detailed logs for 12 months.
Archive old logs.
```

But don’t build archival now.

---

# 25. Testing Plan

## 25.1 Unit tests

Test `pickChangedFields`.

Cases:

```ts
no changes
single field changed
multiple fields changed
undefined does not count as change
null change is detected
decimal/string comparison issue
```

## 25.2 Service tests

Test:

```txt
Order status update creates one log.
Product price update creates one log.
Product update with no real change creates no log.
Merchant cannot read another tenant’s logs.
Admin can read tenant logs.
Storefront order creation creates log with no actor user.
```

## 25.3 Integration tests

Critical flows:

```txt
Customer creates order → order.created log exists.
Merchant confirms order → order.status_changed log exists.
Merchant changes product price → product.price_changed log exists.
Merchant disables product → product.availability_changed log exists.
Admin suspends tenant → tenant.status_changed log exists.
```

## 25.4 UI tests

Check:

```txt
Order details page shows order logs.
Product details page shows product logs.
Empty state appears when no logs.
Actor name appears correctly.
Arabic labels appear instead of raw enum values.
```

---

# 26. Implementation Order

## Step 1: Prisma migration

Add:

```txt
ActivityLog model
ActivityEntityType enum
ActivitySource enum
Relations to Tenant, User, AdminUser
Indexes
```

Run:

```bash
npx prisma migrate dev --name add_activity_logs
npx prisma generate
```

## Step 2: Backend module

Create:

```txt
ActivityLogModule
ActivityLogService
ActivityLogController
DTOs
Action constants
Arabic label helpers
```

## Step 3: Query endpoint

Implement:

```http
GET /merchant/activity-logs
```

Before logging anything, make sure reading works.

## Step 4: Log order actions

Start with:

```txt
order.created
order.status_changed
order.delivery_fee_changed
order.total_changed
```

## Step 5: Add order details UI

Render logs inside order details page.

This gives immediate value.

## Step 6: Log product actions

Add:

```txt
product.created
product.price_changed
product.availability_changed
product.archived
product.bulk_created
product.csv_import_completed
```

## Step 7: Add product details UI

Render logs inside product details page.

## Step 8: Add settings/subscription logs

Add:

```txt
tenant.delivery_settings_updated
tenant.settings_updated
tenant.status_changed
subscription.plan_changed
subscription.renewed
```

## Step 9: Add global merchant activity page

Only after scoped logs are working.

Route:

```txt
/merchant/activity
```

## Step 10: Add admin activity view

Route:

```txt
/admin/merchants/[id]/activity
```

---

# 27. Suggested PR Breakdown

Do not implement this in one giant PR.

## PR 1: DB + backend read API

```txt
- Add ActivityLog model
- Add enums
- Add ActivityLogModule
- Add GET /merchant/activity-logs
- Add tests for tenant scoping
```

## PR 2: Order logging

```txt
- Log order.created
- Log order.status_changed
- Log order.delivery_fee_changed
- Log order.total_changed
- Add tests
```

## PR 3: Order activity UI

```txt
- Add ActivityTimeline components
- Add activity service frontend
- Show logs in order details page
```

## PR 4: Product logging

```txt
- Log product.created
- Log product.price_changed
- Log product.availability_changed
- Log product.archived
- Add tests
```

## PR 5: Product activity UI

```txt
- Show logs in product details page
```

## PR 6: Global activity page

```txt
- Add /merchant/activity
- Add filters
- Add pagination
```

---

# 28. Mistakes to Avoid

## Mistake 1: DB triggers

Don’t use DB triggers for this MVP.

They can capture changed values, but they don’t know business context like:

```txt
"تم اقتراح منتج بديل"
"تم تعديل رسوم التوصيل من صفحة الطلب"
"تم استيراد 500 منتج من ملف CSV"
```

Use service-layer logging.

## Mistake 2: Logging every frontend action

Do not log clicks, views, filters, searches, or cart actions here.

Use PostHog later.

## Mistake 3: Showing raw JSON to merchants

Activity log is not a developer audit panel.

Never show:

```json
{ "status": "confirmed" }
```

Show:

```txt
تم تغيير حالة الطلب من جديد إلى مؤكد
```

## Mistake 4: Over-logging bulk imports

One CSV import should create one summary log, not hundreds.

## Mistake 5: Forgetting tenant isolation

Every merchant query must filter by `tenant_id`.

This is non-negotiable.

---

# 29. Final MVP Definition of Done

The activity log MVP is done when:

```txt
1. Important order actions are logged.
2. Important product actions are logged.
3. Merchant can see logs inside order details.
4. Merchant can see logs inside product details.
5. Logs show Arabic human-readable descriptions.
6. Logs include actor name when available.
7. Tenant isolation is tested.
8. Admin/system actions are distinguishable.
9. Logs are append-only.
10. No sensitive customer data is duplicated unnecessarily.
```

My honest recommendation: **start with order activity only**. Once order logs are stable and useful, add product logs. A global activity page can wait; scoped logs inside order/product pages will give merchants more value immediately.
