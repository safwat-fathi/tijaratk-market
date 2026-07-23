# Storefront Checkout Success Redirect Race

## Problem

The checkout API creates the order successfully, but the checkout server action
deletes the storefront cart cookie before the client component performs its
success-page navigation.

That cookie mutation causes Next.js to refresh the current checkout route. The
checkout server page then sees no cart token and redirects to the cart page,
racing with and winning over the client-side redirect to the success page.

## Changes

1. Keep the storefront cart cookie during the successful checkout action
   response so the current checkout route remains valid long enough for the
   client navigation effect to run.
2. Add a focused server action that clears the route-scoped storefront cart
   cookie after navigation.
3. Let the tenant order success view invoke that cleanup action once on mount.
4. Do not apply tenant-cart cleanup to the separate zone-storefront success
   flow.
5. Preserve the existing order tracking cookie, customer code, Meta Purchase
   event, idempotent draft completion, and success-page order verification.

## Verification

- Submit a merchant storefront cart and confirm navigation to
  `/:slug/success?token=...`.
- Confirm the success screen renders the created order.
- Return to the merchant storefront and confirm the completed cart is empty.
- Retry or refresh the success URL and confirm it remains valid.
- Run the frontend lint and typecheck command manually because repository
  policy prohibits AI agents from running verification commands.
