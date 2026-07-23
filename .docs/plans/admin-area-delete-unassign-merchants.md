# Admin Area Deletion with Merchant Unassignment

## Summary

Allow platform admins to soft-delete a directory area after safely removing ordinary merchant delivery coverage and clearing direct merchant profile locations.

## Changes

- Archive tenant delivery-area rows, clear tenant directory-profile area assignments, and archive the area in the same transaction.
- Continue blocking areas with child areas, Zone Storefronts, or missing-delivery-area requests.
- Show Arabic errors for each blocker and present the merchant-unassignment warning in a destructive confirmation dialog.
- Revalidate the admin and public directory routes after deletion.

## Verification

- Confirm deletion removes delivery coverage and clears direct profile locations.
- Confirm child-area, Zone Storefront, and missing-request blockers preserve the area and show the correct message.
- Do not add unit tests; run repository verification manually after implementation.
