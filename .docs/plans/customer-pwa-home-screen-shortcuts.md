# Customer PWA And Home Screen Shortcut Support

## Summary

Add a visible customer-facing "save to home screen" action on storefront pages and stores directory pages. Use native PWA install where supported, and provide browser-specific fallback instructions where install APIs are unavailable.

## Key Changes

- Add a shared client component, `InstallPwaAction`, for the existing public headers.
- Use `beforeinstallprompt` on supported Chromium browsers.
- Hide the action in standalone installed mode.
- Fall back to Arabic instructions for iOS Safari, Android browsers without an install prompt, desktop browsers without install support, and unknown browsers.
- Extend `AppHeader` to accept optional header actions without removing the existing "تتبع طلباتي" link.
- Add the shortcut action to the stores directory landing page, stores category pages, and storefront pages.

## PWA Metadata

- Add a directory manifest endpoint with Tijaratk directory app metadata.
- Add a dynamic storefront manifest endpoint with store-specific metadata.
- Wire route-level manifest metadata so directory pages and storefront pages point at the correct manifest.
- Keep PWA scope broad enough for order flows to continue working from installed shortcuts.

## Test Plan

- Run `pnpm lint` in `frontend`.
- Verify generated metadata links the expected manifest for `/`, `/stores/[area]/[category]`, and `/[slug]`.
- Manually test native install, iOS/manual fallback, unsupported-browser fallback, and standalone hiding.

## Assumptions

- No push notifications or offline caching in this change.
- Unsupported browsers get graceful shortcut/bookmark guidance because browsers that lack PWA install APIs cannot be forced to install a web app.
- Multiple install identities are best-effort because browser support differs; manifest `id` and route-specific manifest links are the intended mechanism.
