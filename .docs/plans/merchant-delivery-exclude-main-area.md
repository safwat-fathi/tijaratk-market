# Exclude the Main Area from Delivery Zones

## Summary

Treat the merchant's main area as profile/location metadata only. It must not be selectable as a delivery zone or qualify the merchant for a zone storefront.

## Implementation

- Show only direct children of the selected main area in the shared delivery editor and never auto-select the main area.
- Normalize onboarding, merchant settings, admin management, and availability-toggle payloads so `primary_area_id` is excluded from `delivery_areas`.
- Reject delivery configuration requests whose delivery areas contain the main area in both frontend validation and the backend service.
- Deactivate existing delivery-area rows that duplicate the merchant's main area while retaining their history and fees.
- Continue using the centralized exact active-delivery-area filter for zone-storefront eligibility.

## Acceptance Criteria

- Enabled delivery requires at least one explicit child delivery zone.
- A main-area-only merchant is excluded from zone readiness, assignment, and reactivation.
- Explicit non-main delivery coverage continues to qualify a merchant for the matching zone storefront.
- No database schema or API response-shape changes are introduced.

## Verification

Repository policy requires the user to run migrations, lint, type-check, build, and manual verification commands. No unit-test files are added or executed for this change.
