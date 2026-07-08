# Feature Specification: Delete Merchant Items From Admin

**Feature Branch**: `006-delete-merchant-items`  
**Created**: 2026-07-08  
**Status**: Draft  
**Input**: User description: "Add delete merchant items from admin"

## Clarifications

### Session 2026-07-08
- Q: How should the merchant item deletion be implemented at the database level to preserve historical order readability (FR-008)? → A: Soft delete: Add deletedAt and deletedBy fields to the item table, hiding them in active queries.
- Q: What defines an "active order" that would block the deletion of an item (FR-007)? → A: Any order that is not in a terminal state (e.g., DELIVERED, CANCELLED, REJECTED).
- Q: Since we are implementing soft deletion, should the admin UI include a way to view and/or restore these deleted items in this iteration? → A: No, deleted items should be completely hidden from the UI for now (restoration is out of scope).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Deletes A Merchant Item (Priority: P1)

An admin reviewing a merchant's items can remove an item that should no longer be managed or displayed for that merchant.

**Why this priority**: This is the core admin task requested and gives support/admin teams direct control over incorrect, duplicate, or unwanted merchant inventory.

**Independent Test**: Can be fully tested by signing in as an admin, opening a merchant item from the admin product management area, confirming deletion, and verifying the item no longer appears in active admin or merchant product views.

**Acceptance Scenarios**:

1. **Given** an admin is viewing an active merchant item, **When** the admin chooses delete and confirms, **Then** the item is removed from active merchant item lists and cannot be selected for normal storefront management.
2. **Given** an admin starts deleting a merchant item, **When** the admin cancels the confirmation, **Then** the item remains unchanged and visible in active item lists.
3. **Given** a merchant views their products after an admin deletes an item, **When** the merchant searches or filters products, **Then** the deleted item is not shown as an active product.

---

### User Story 2 - Admin Understands Deletion Impact Before Confirming (Priority: P1)

An admin receives clear confirmation details before deleting a merchant item so they do not accidentally remove the wrong product.

**Why this priority**: Deletion is a high-impact administrative action and must guard against accidental data loss or merchant disruption.

**Independent Test**: Can be fully tested by initiating deletion and verifying that the confirmation identifies the item, merchant, and consequence before the action can complete.

**Acceptance Scenarios**:

1. **Given** an admin selects delete for a merchant item, **When** the confirmation appears, **Then** it shows the item name and merchant identity.
2. **Given** an admin is viewing the confirmation, **When** they confirm deletion, **Then** the deletion completes only after the explicit confirmation action.
3. **Given** an admin has insufficient context to identify the item, **When** the confirmation is displayed, **Then** the admin can cancel without changing the item.

---

### User Story 3 - Admin Is Prevented From Invalid Deletions (Priority: P2)

An admin cannot delete merchant items when deletion would conflict with active operational records or access boundaries.

**Why this priority**: Preventing invalid deletion protects order integrity, tenant isolation, and auditability.

**Independent Test**: Can be fully tested by attempting to delete items that are outside admin scope, already deleted, or tied to active order processing, and verifying that each attempt is blocked with clear feedback.

**Acceptance Scenarios**:

1. **Given** a merchant item is already deleted, **When** an admin attempts to delete it again, **Then** the system indicates that no further deletion is needed.
2. **Given** a merchant item is tied to an active order or replacement workflow, **When** an admin attempts to delete it, **Then** the deletion is blocked and the admin is told why.
3. **Given** an admin attempts to delete an item outside their authorized admin scope, **When** the request is submitted, **Then** no item is deleted and access is denied.

### Edge Cases

- Deleting an item that was removed by another admin moments earlier should not create an error state or restore the item.
- Deletion must not affect ready-made catalog source rows or other merchants' copies of similar catalog items.
- Deleted items must not appear in active merchant storefront, merchant product management, or admin active item views.
- Any existing completed order history that references the deleted item must remain understandable to admins and merchants.
- Failed deletion attempts must leave the item unchanged and show actionable feedback.
- Search, filters, pagination, and cached views must not continue showing the item as active after successful deletion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The admin product management experience MUST provide a delete action for individual merchant-owned items.
- **FR-002**: The delete action MUST be available only to authenticated admins with permission to manage the relevant merchant item.
- **FR-003**: The system MUST require explicit confirmation before completing a merchant item deletion.
- **FR-004**: The confirmation step MUST identify the item and merchant before the admin confirms deletion.
- **FR-005**: After soft deletion, the item MUST be absent from all active merchant item lists, active admin item lists, and storefront-visible product results (restoration/trash views are out of scope).
- **FR-006**: Deleting one merchant item MUST NOT delete or alter ready-made catalog source rows, other merchants' items, or unrelated merchant inventory.
- **FR-007**: The system MUST block deletion when the item is needed for an active order, active replacement flow, or other in-progress operational process.
- **FR-008**: The system MUST preserve historical order readability for completed or past records that referenced the deleted item.
- **FR-009**: The system MUST provide clear success feedback after deletion and clear failure feedback when deletion is blocked or denied.
- **FR-010**: The system MUST handle repeated deletion attempts for the same item without creating duplicate side effects.
- **FR-011**: The system MUST record who deleted the merchant item and when the deletion occurred for administrative accountability.
- **FR-012**: Deleted items MUST remain excluded from active search and filter results after page refreshes or list reloads.

### Key Entities

- **Merchant Item**: A merchant-owned product entry that can appear in merchant management, admin management, and storefront experiences. Soft-deleted items will contain `deletedAt` and `deletedById` fields.
- **Admin User**: An authenticated administrative user authorized to manage merchant items.
- **Deletion Confirmation**: The explicit admin decision point that names the item and merchant before removal.
- **Deletion Record**: Accountability information captured directly on the Merchant Item using `deletedAt` and `deletedById` fields.
- **Operational Dependency**: An active order (any order not in a terminal state like DELIVERED, CANCELLED, REJECTED), replacement, or in-progress workflow that prevents safe deletion of a merchant item.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can delete an eligible merchant item from the admin product management experience in under 30 seconds.
- **SC-002**: 100% of successful deletions remove the item from active merchant, admin, and storefront-visible product results after refresh.
- **SC-003**: 100% of deletion attempts require explicit confirmation before the item is removed.
- **SC-004**: 100% of unauthorized or operationally blocked deletion attempts leave the item unchanged and show a clear reason.
- **SC-005**: 100% of successful deletions include accountability information identifying the admin and deletion time.

## Assumptions

- "Merchant items" means merchant-owned product entries, not shared ready-made catalog source records.
- Deletion should remove items from active use while preserving historical order readability and administrative accountability.
- Single-item deletion is in scope; bulk deletion is covered by separate bulk action work and is not required for this feature.
- Existing admin authentication and authorization rules define which admins can manage merchant items.
- Catalog isolation rules remain unchanged; this feature must not mix catalog sources or delete shared catalog imports.
