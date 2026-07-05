# Feature Specification: Bulk Product Actions

**Feature Branch**: `003-bulk-product-actions`  
**Created**: 2026-07-05  
**Status**: Draft  
**Input**: User description: "Add bulk actions for merchant selected products in merchant dashboard products screen; also add this in admin dashboard as well."

## Clarifications

### Session 2026-07-05

- Q: After selected products are archived, should merchants/admins be able to see and reactivate archived products from the products screen? -> A: Show archived filter.
- Q: Should bulk selection apply only to currently visible rows, or support selecting all products matching the current filters/search across pages/results? -> A: Visible rows only.
- Q: Should the bulk archive action require confirmation before applying? -> A: Confirm archive.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Merchant updates selected products in bulk (Priority: P1)

A merchant managing their store products selects visible products from the products screen and applies one bulk action instead of editing each product one by one.

**Why this priority**: This is the primary merchant value: faster day-to-day catalog maintenance.

**Independent Test**: Can be fully tested by signing in as a merchant, selecting visible products, applying availability and category changes, and confirming the products update without affecting unselected products.

**Acceptance Scenarios**:

1. **Given** a merchant is viewing their products, **When** they select visible products and mark them unavailable, **Then** only the selected products become unavailable.
2. **Given** a merchant has selected visible products, **When** they changes the selected products' category, **Then** the selected products show the new category and the selection clears after success.
3. **Given** a merchant has selected visible products, **When** they clears the selection, **Then** no bulk action controls remain active for those products.

---

### User Story 2 - Merchant archives and restores products (Priority: P1)

A merchant archives selected products from the active product list and can later review archived products and activate them again.

**Why this priority**: Archive is a destructive storefront-facing action; it must be reversible from the same management surface.

**Independent Test**: Can be fully tested by archiving selected products after confirmation, switching to the archived view, and activating those products again.

**Acceptance Scenarios**:

1. **Given** a merchant has selected active products, **When** they choose archive and confirm, **Then** the products are removed from the active view and appear in the archived view.
2. **Given** a merchant is viewing archived products, **When** they select products and activate them, **Then** the products return to the active product view.
3. **Given** a merchant starts a bulk archive action, **When** they cancel confirmation, **Then** no selected products are archived.

---

### User Story 3 - Admin manages selected products in bulk (Priority: P2)

An admin uses the admin products dashboard to perform the same bulk product actions while respecting admin authorization and product ownership rules.

**Why this priority**: Admin parity is required, but the merchant workflow is the primary feature request.

**Independent Test**: Can be fully tested by signing in as an admin, selecting visible products in the admin products dashboard, and applying availability, category, archive, and activate actions.

**Acceptance Scenarios**:

1. **Given** an admin is viewing products, **When** they select visible products and apply a bulk action, **Then** the selected products update successfully.
2. **Given** an admin archives selected products, **When** they view archived products, **Then** the archived products are available for review and activation.

### Edge Cases

- Empty selections cannot submit bulk actions.
- Bulk requests with no action are rejected with clear feedback.
- Invalid, duplicate, or unauthorized product IDs do not update products outside the user's allowed scope.
- Selection applies only to currently visible rows, not hidden pages or all matching search results.
- Archiving selected products requires confirmation; canceling confirmation leaves all products unchanged.
- Search, category, availability, and archived filters keep predictable selection behavior by clearing any selection that is no longer visible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product management screen MUST allow merchants and admins to select and deselect individual visible product rows.
- **FR-002**: The product management screen MUST allow users to select all currently visible product rows and clear the current selection.
- **FR-003**: Users MUST be able to mark selected visible products available in one action.
- **FR-004**: Users MUST be able to mark selected visible products unavailable in one action.
- **FR-005**: Users MUST be able to change the category of selected visible products in one action.
- **FR-006**: Users MUST be able to archive selected visible products in one action after confirming the action.
- **FR-007**: Users MUST be able to view archived products from the products screen.
- **FR-008**: Users MUST be able to activate selected archived products in one action.
- **FR-009**: The system MUST restrict merchant bulk updates to products owned by the authenticated merchant tenant.
- **FR-010**: The system MUST restrict admin bulk updates to admin-authorized requests.
- **FR-011**: The system MUST reject bulk requests with no selected products or no requested action.
- **FR-012**: The system MUST provide success and failure feedback for every bulk action and clear selection after successful updates.
- **FR-013**: Product filtering and search MUST not cause hidden or non-visible products to be selected implicitly.

### Key Entities

- **Product**: A merchant-owned catalog entry with name, category, availability, and lifecycle status.
- **Bulk Product Selection**: The set of currently visible product IDs selected by the user for one bulk action.
- **Bulk Product Action**: A requested update applied to selected products; supported actions are availability update, category update, archive, and activate.
- **Archived Product View**: A products screen state that lists archived products for review and activation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can update at least 10 selected visible products with one bulk action in under 30 seconds.
- **SC-002**: 100% of merchant bulk update attempts are constrained to the authenticated merchant tenant.
- **SC-003**: Users can archive products and reactivate them from the products screen without leaving the product management workflow.
- **SC-004**: Bulk archive actions cannot complete without an explicit confirmation.
- **SC-005**: Selection state remains accurate after search or filter changes by excluding products no longer visible.

## Assumptions

- Selection is intentionally limited to visible rows, not all matching products across hidden pages or results.
- Admin users need parity with merchant bulk action capabilities.
- Category changes are in scope for merchants.
- Existing authentication and product ownership rules will be reused.
- Catalog isolation rules are unaffected because this feature updates tenant products, not ready-made catalog source selection.
