# Todo list

## Testing environment

## Map for stores

- Show nearby stores in homepage map
- Add settings page in dashboard for store coordinates (latitude, longitude)

- Add testing live environment for all features

## Pricing plans gatting for merchants

- Every merchant should be subscribed to a plan.
- There should be a plan page where users can see available plans.
- There should be a page for each merchant to subscribe to a plan.
- Plans should have a list of features that are included in the plan.

Note: **pricing plans features details is in `pricing-plans.md`**

## Database

## Merchant mobile app

- Add merchant mobile app for managing their store and products (React Native)

## Issues

## Client Feedback & Issues

- **Merchant Catalog Categorization**: In addmin implement/improve the merchant dashboard catalog interface so that each merchant's products are automatically categorized by store/product type. The UI should make it seamless to navigate different categories, inspect items, and quickly add any missing product classifications or missing items.
- **E2E WhatsApp Checkout Simulation**: Conduct a live purchase simulation to test the full customer-to-merchant WhatsApp checkout pipeline. Verify how the formatted checkout message is delivered to the merchant's WhatsApp, and document/refine how the merchant confirms, rejects, or updates the order details (e.g. status changes or quantity modifications).
- **Bug - Image Upload Failing for Catalog Items/Categories**: Resolve the issue where images are not being successfully attached or saved to products/categories. Verify the file upload handlers and ensure image assets are correctly bound to catalog records.
- **Bug - Database/Validation Error when Saving Product Updates**: Troubleshoot why updating product attributes (availability status, category, or price) in the merchant dashboard triggers an API error toast/popup upon clicking "Save".
- **UX Bug - Toast Notifications Render Off-Screen After Scroll**: Fix alert/toast notifications not being anchored to the viewport. Ensure they float dynamically (e.g., using `position: fixed` relative to viewport) rather than rendering at the document top relative container, causing them to go off-screen when the page is scrolled. See [Toast.tsx](<file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/frontend/app/(public)/[slug]/_components/Toast.tsx>) and [OrderForm.tsx](<file:///Users/safwat/Coding/Projects/side-projects/tijaratk-market/frontend/app/(public)/[slug]/_components/OrderForm.tsx>).

## New Features

- Code for every customer (search for orders history, order details, reorder)
- Make app ready for multiple store types (supermarket, restaurant, online store, pharmacy, etc.)
- Should we add PostHog for analytics?
- How we can make a one qr code for multiple store branches?
- How we can show avaliable items for a store that has this item in another branch but that branch is not near customer?
- Subscribitions plans should be handled in code by centeral system (not by merchants in dashboard) because it's a SaaS platform.
