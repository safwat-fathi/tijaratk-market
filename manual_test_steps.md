# Manual Test Steps: Admin Operations & Zone Dispatch

This document outlines the step-by-step manual UI tests to verify the newly implemented features for Admin Managed Merchant Operations, Zone Storefronts & Dispatch, and Admin Audit Logging.

## Prerequisites
1. **Database Setup**: Ensure all migrations have been applied and the seeders have run:
   - `admin.seeder.ts` to create the initial platform admin.
   - `zone-storefront.seeder.ts` to create test zones and configure test merchants for dispatch eligibility.

---

## 1. Admin Managed Merchant Operations

**Objective**: Verify that an administrator can securely manage a merchant's store via a management session, and that access is strictly controlled and audited.

### A. Start Management Session
1. Navigate to the Admin Dashboard (e.g., `/admin`) and log in with your admin credentials.
2. Go to **Merchants** (`/admin/merchants`).
3. Select an active merchant from the list to view their details (`/admin/merchants/[tenantId]`).
4. Click on the **Manage Store** button.
5. A dialog should appear prompting you for a reason to start the session. Enter a valid reason (e.g., "Customer support request #123") and submit.
6. You should be redirected into the **Managed Merchant Context** (`/admin/merchants/[tenantId]/manage`).

### B. Perform Managed Actions
1. While in the managed session, navigate to **Products** (`.../manage/products`).
2. Make an edit to a product (e.g., update stock or price) and save. Verify the update is successful.
3. Navigate to **Orders** (`.../manage/orders`).
4. Select an order and update its status (e.g., mark as "Processing"). Verify the update is successful.

### C. Verify Managed Activity Logging
1. Navigate to **Activity** within the managed session (`.../manage/activity`).
2. Verify that the product and order changes you just made are logged, and that the actor is correctly attributed to your Admin account (not the merchant).

### D. End / Revoke Session
1. Click the option to **End Session** or **Exit Management Mode** from the admin shell or dialog.
2. Verify you are redirected back to the standard admin panel.
3. Attempt to manually navigate back to a managed URL (`/admin/merchants/[tenantId]/manage/products`). It should deny access or redirect you, as the session has ended.

---

## 2. Zone Storefronts & Order Dispatching

**Objective**: Verify that customers can place orders on a geographic zone storefront, and that the system correctly dispatches the order to eligible merchants for fulfillment.

### A. Customer Order Placement
1. Open a new incognito window (to act as a customer).
2. Navigate to a Public Zone Market URL (e.g., `/market/[zoneSlug]`).
3. Browse products, add items to the cart, and proceed to checkout.
4. Fill in delivery details and place the order.
5. Note the Order ID or copy the tracking link.

### B. Admin Zone Management & Dispatch Monitoring
1. In your Admin window, navigate to **Zones** (`/admin/zones`).
2. Select the zone where the order was just placed (`/admin/zones/[zoneId]`).
3. Go to the **Dispatches** tab/page (`/admin/zones/[zoneId]/dispatches`).
4. You should see a new Dispatch entry for the order with a status of `pending` or `awaiting_merchant`.

### C. Merchant Order Acceptance (Assigned Orders)
1. Open another browser session and log in to the Merchant Dashboard for a merchant that is *eligible* in that zone.
2. Navigate to **Assigned Orders** (`/merchant/assigned-orders`).
3. You should see the incoming dispatch request waiting for your response.
4. Click into the assigned order (`/merchant/assigned-orders/[dispatchId]`).
5. Choose **Accept Order**.
6. Verify the dispatch disappears from "Assigned" and moves into your standard **Orders** tab for fulfillment.

### D. Dispatch Resolution
1. Go back to the Admin window and refresh the Dispatches list.
2. Verify the Dispatch status is now `accepted` and shows which merchant fulfilled it.

---

## 3. Admin Audit Logging

**Objective**: Verify that high-level administrative actions are globally recorded and can be audited by platform administrators.

1. While logged in as an Admin, navigate to **Audit Logs** or **Activity** (`/admin/activity`).
2. Verify the following actions are present:
   - "Started management session for Tenant X"
   - "Revoked management session"
   - The product edits and order updates you performed during the management session.
3. Check the details of an audit log entry to ensure it captures:
   - Your Admin ID / Role
   - IP Address (if available in environment)
   - The outcome (`success`)
   - The exact action and metadata
