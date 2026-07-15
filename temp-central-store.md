# Recommended temporary architecture

## 1. Create an internal “zone operator” tenant

For example:

```text
Tenant:
  name: تجارتك - الشيخ زايد
  slug: zayed-market
  type: zone_operator
```

From the existing system’s perspective, this behaves like another tenant:

- It owns the zone catalog.
- Customers order from its storefront.
- Orders initially belong to it.
- Existing cart, checkout, tracking token and order-item logic can largely remain unchanged.

This is especially useful because your existing `order_items` already store product-name and price snapshots, and `product_id` can be nullable. Your existing `pricing_mode` also supports manual pricing.

Do **not** change `orders.tenant_id` to nullable and do not remove tenant ownership from products. That would spread the experiment across your entire codebase.

---

## 2. Add a separate zone storefront model

I would avoid putting too many temporary fields directly in `tenants`.

```prisma
model ZoneStorefront {
  id               Int      @id @default(autoincrement())
  name             String
  slug             String   @unique
  operatorTenantId Int
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  operatorTenant Tenant @relation(fields: [operatorTenantId], references: [id])
  merchants      ZoneStorefrontMerchant[]
  dispatches     OrderDispatch[]
}
```

And stores that can receive orders in that zone:

```prisma
model ZoneStorefrontMerchant {
  id             Int     @id @default(autoincrement())
  zoneStorefrontId Int
  tenantId       Int
  priority       Int     @default(0)
  isActive       Boolean @default(true)

  zoneStorefront ZoneStorefront @relation(...)
  tenant         Tenant         @relation(...)

  @@unique([zoneStorefrontId, tenantId])
}
```

This allows the same merchant to participate in Sheikh Zayed, حدائق الأهرام or another zone without changing the normal merchant account.

---

## 3. Add an isolated dispatch record

Keep the original order under the zone operator tenant. Do not move it from one tenant to another after checkout.

```prisma
model OrderDispatch {
  id               Int                 @id @default(autoincrement())
  orderId          Int                 @unique
  zoneStorefrontId Int
  targetTenantId   Int?
  assignedByAdminId Int?
  status           OrderDispatchStatus @default(pending)
  assignedAt       DateTime?
  acceptedAt       DateTime?
  rejectedAt       DateTime?
  completedAt      DateTime?
  rejectionReason  String?
  internalNotes    String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  order            Order          @relation(...)
  targetTenant     Tenant?        @relation(...)
  assignedByAdmin  AdminUser?     @relation(...)
  zoneStorefront   ZoneStorefront @relation(...)
}
```

Possible statuses:

```prisma
enum OrderDispatchStatus {
  pending
  assigned
  accepted
  rejected
  preparing
  out_for_delivery
  completed
  cancelled
}
```

The customer-facing order status can continue using the current `OrderStatus`. The dispatch status is internal operational state.

---

# Recommended order flow

```text
Customer opens /market/sheikh-zayed
        ↓
Selects products and checks out
        ↓
Order created under the zone operator tenant
        ↓
OrderDispatch created with status = pending
        ↓
Admin sees order in “Unassigned Orders”
        ↓
Admin selects an eligible merchant
        ↓
Merchant receives WhatsApp notification
        ↓
Merchant accepts or rejects
        ↓
Merchant prepares and delivers the order
        ↓
Customer follows the existing tracking link
```

Your existing `admin_users` and `/admin` portal give you a natural location for the dispatch screen, so there is no need to create another authentication system.

---

# Merchant dashboard integration

Do not mix dispatched orders into the merchant’s normal query using something like:

```sql
WHERE tenant_id = merchantTenantId
   OR assigned_tenant_id = merchantTenantId
```

That will eventually cause authorization mistakes and reporting confusion.

Instead, add a separate API and dashboard section:

```text
/merchant/orders
/merchant/assigned-orders
```

The backend authorization rule becomes:

```text
The merchant may access the dispatched order only when
OrderDispatch.targetTenantId === authenticatedUser.tenantId
```

The merchant can:

- View customer name, phone, address and order-item snapshots.
- Accept or reject the order.
- Update preparation and delivery status.
- Suggest replacements.
- Adjust the final price where allowed.

They should not receive general access to the zone tenant, its customers or all its orders.

---

# The biggest non-technical problem

Technically, this is manageable. **Operationally, it can become messy very quickly.**

Suppose the zone storefront shows:

```text
زيت عباد الشمس — 85 EGP
```

You dispatch the order to Store B, but Store B:

- Sells it for 92 EGP.
- Does not have the selected size.
- Has a different delivery fee.
- Cannot deliver to that exact compound.
- Has five other unavailable products.

Therefore, for the temporary pilot, use one of these two approaches.

### Approach A — Estimated prices

Show that prices are estimated and let the admin or merchant confirm the final total before preparation.

Your existing `pricing_mode = manual` supports this concept.

### Approach B — Dispatch only to catalog-compatible merchants

Each zone storefront has one primary store and possibly one fallback store. The central catalog is maintained according to the primary store’s prices.

This is less impressive technically, but far more likely to work operationally.

I strongly recommend **Approach B for the initial experiment**. A central storefront with ten theoretically eligible stores but no synchronized inventory will create cancellations and damage customer trust.

---

# How to make it reversible

You should not plan to “revert the database.” Build it as a disabled module that can be switched off.

## Use separate routes

Keep existing merchant storefronts:

```text
/[merchantSlug]
```

Add the experimental storefront separately:

```text
/market/[zoneSlug]
```

Do not add large conditional branches inside the existing `[slug]` page.

## Use a feature flag

For example:

```env
ZONE_STOREFRONTS_ENABLED=true
```

Or a database-level flag:

```text
platform_features.zone_storefronts = enabled
```

You can later disable the experiment without redeploying or deleting historical data.

## Use additive migrations only

Add:

- `zone_storefronts`
- `zone_storefront_merchants`
- `order_dispatches`

Avoid rewriting:

- `orders`
- `products`
- `customers`
- Existing merchant order APIs
- Existing storefront routing

You may add an optional field to orders for analytics:

```prisma
sourceChannel OrderSourceChannel @default(merchant_storefront)
```

With values such as:

```prisma
enum OrderSourceChannel {
  merchant_storefront
  zone_storefront
  admin_created
}
```

But even this is optional because the dispatch record can identify zone orders.

## When the experiment ends

You would:

1. Disable `ZONE_STOREFRONTS_ENABLED`.
2. Mark the zone storefront as inactive.
3. Remove its public links and advertising.
4. Hide the admin dispatch menu.
5. Keep old orders accessible for reporting and customer support.
6. Continue operating normal merchant storefronts unchanged.

No destructive rollback should be necessary.

---

# What should not be included in the temporary version

Do not build these now:

- Splitting one order between merchants.
- Merchant bidding for orders.
- Automatic selection based on stock.
- Merchant balances or payouts.
- Commission calculation.
- Multiple delivery trips per order.
- Shared live inventory.
- Complex geographic routing.
- Price comparison between stores.
- Copying the customer permanently into every dispatched merchant’s CRM.

For the temporary version, the merchant sees the customer information through the assigned order. You can decide later whether an accepted or completed order should create a customer record under that merchant.

---

# Refactor size estimate

Based on the documented structure rather than reviewing the actual implementation:

| Area                                                 |          Change size |
| ---------------------------------------------------- | -------------------: |
| Zone storefront using existing storefront components |         Small–medium |
| Zone and merchant database models                    |                Small |
| Dispatch backend service and authorization           |               Medium |
| Admin dispatch queue                                 |               Medium |
| Merchant assigned-order screen                       |               Medium |
| WhatsApp notifications                               |         Small–medium |
| Tracking and status synchronization                  |               Medium |
| Testing tenant isolation                             | Important and medium |

A safe pilot is probably around **10–20 focused development days for one developer**, depending on how reusable the current order components are. It is not a two-day frontend modification, but it also should not require rewriting تجارتك.

---

# Final recommendation

Build it as an **experimental “managed zone” module**, not as the new core architecture.

The central order remains owned by a hidden zone operator tenant, and `OrderDispatch` grants a merchant limited operational access. The original tenant storefront flow remains untouched.

This gives you three advantages:

1. You can test whether customers prefer one unified storefront.
2. You can manually control fulfillment before investing in automation.
3. You can disable the experiment and return to merchant-owned storefronts without undoing migrations or corrupting order history.

The hard truth is that the software is not the biggest risk. **Accurate prices, availability, merchant response time and delivery responsibility are the real risks.** Keep the first pilot limited to one zone, one primary store and one fallback store.
