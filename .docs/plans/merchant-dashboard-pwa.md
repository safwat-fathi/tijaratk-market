# Merchant Dashboard PWA

## Summary

Add installable PWA support for the merchant dashboard, branded with the logged-in merchant's store name. The dashboard exposes a visible install/save shortcut in both the mobile top bar and desktop sidebar.

## Key Changes

- Add a merchant manifest endpoint at `/pwa/merchant/manifest`.
- Use store-branded manifest metadata when a valid merchant session is available.
- Fall back to generic `تجارتك للتاجر` manifest metadata without redirecting when tenant lookup is unavailable.
- Add `manifest: "/pwa/merchant/manifest"` to the merchant dashboard layout metadata.
- Reuse and extend `InstallPwaAction` for dashboard chrome styling.
- Show the install action in the mobile merchant top bar and desktop sidebar.

## Test Plan

- Run targeted ESLint for touched files.
- Run `pnpm exec tsc --noEmit` in `frontend`.
- Smoke test `/pwa/merchant/manifest`.
- Manually verify the action appears in mobile and desktop dashboard chrome and hides in standalone mode.

## Assumptions

- No offline caching, push notifications, or service worker changes in this step.
- Merchant login remains reachable from the installed app because the manifest scope is `/`.
- Existing unrelated lint errors remain out of scope.
