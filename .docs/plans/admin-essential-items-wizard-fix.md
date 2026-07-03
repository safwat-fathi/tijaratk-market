# Admin Essential Items Wizard Fix

## Summary

Reuse the merchant staged essential-items wizard for admin merchant actions so admin submissions send selected catalog item IDs instead of legacy raw category labels.

## Implementation

- Add an admin-only stages endpoint for a target tenant.
- Add admin frontend service/action methods for loading stages and adding one selected stage.
- Refactor the shared merchant wizard to accept optional callbacks while preserving merchant defaults.
- Replace the admin one-click category submission with the shared staged wizard.

## Verification

Do not run repository verification commands as an AI agent. Ask the user to run the relevant lint/typecheck/test commands after implementation.

## Follow-up: Essential Wizard Coverage And Images

- Show all active allowed grocery catalog categories and items in the shared admin/merchant essential-items wizard.
- Keep curated `is_essential` rows as default selected recommendations only.
- Allow selected non-essential active catalog rows to be imported through the staged item-ID flow.
- Resolve wizard image URLs before rendering so local catalog image paths display correctly.

## Follow-up: Essential Wizard Scroll Reset

- Reset only the internal product-list scroll to the top after successful category submit.
- Reset the same product-list scroll when moving between wizard stages with next/previous navigation.
- Keep selected counts, submit behavior, and bottom-sheet/page scroll behavior unchanged.
