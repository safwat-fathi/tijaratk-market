# Research: Bulk Product Actions

## Decision: Reuse the shared product management UI

**Rationale**: `MyProductsSection` already contains selection controls, select-visible behavior, and a sticky bulk action bar. `ProductOnboardingClient` already wires bulk updates for admin mode only. Enabling merchant mode through a merchant-safe action minimizes UI duplication and keeps admin/merchant behavior consistent.

**Alternatives considered**: Building a new merchant-only bulk action component was rejected because it would duplicate row selection, filtering, and feedback behavior already present in the shared product UI.

## Decision: Add a merchant-owned bulk update path

**Rationale**: The existing admin path (`PATCH /admin/products/bulk`) can update products across tenants under admin authorization. Merchants need a separate path that derives tenant scope from the authenticated merchant context and rejects IDs outside that tenant.

**Alternatives considered**: Reusing the admin endpoint for merchants was rejected because it would mix authorization models. Looping over existing single-product update actions from the client was rejected because it is slower, harder to report consistently, and increases partial-update risk.

## Decision: Use explicit product IDs for visible-row selection

**Rationale**: The clarified scope limits selection to visible rows only. Explicit `ids` payloads match the current UI state and avoid accidental updates to hidden pages, filtered results, or all search matches.

**Alternatives considered**: Server-side filter-based bulk selection was rejected because it conflicts with the visible-row-only requirement and would require broader confirmation and query replay semantics.

## Decision: Add archived dashboard listing/filter support

**Rationale**: Activate is only usable if archived products are reachable from the products screen. Current product listing reads active products only, so dashboard product retrieval/search needs status filtering or an archived view.

**Alternatives considered**: Keeping activation admin/API-only was rejected by clarification. Showing archived products in the active list was rejected because it would blur storefront-active and archived lifecycle states.

## Decision: Confirm only bulk archive

**Rationale**: Archive removes products from the active storefront list, so it needs explicit confirmation. Availability, category, and activate actions are routine management changes and can use immediate execution with clear feedback.

**Alternatives considered**: Confirming every action was rejected because it slows common availability/category work. No confirmation was rejected because accidental bulk archive has higher operational impact.
