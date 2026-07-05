# Feature Specification: Arabic Fuzzy Product Search

**Feature Branch**: `004-arabic-fuzzy-search`  
**Created**: 2026-07-05  
**Status**: Draft  
**Input**: User description: "fuzzy-search.md"

## Clarifications

### Session 2026-07-05

- Q: Should normalized matching preserve current product-search cleanup beyond Arabic letter-form normalization? → A: Preserve current cleanup for package-size fragments, punctuation, whitespace, and leading `ال`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find Arabic Products Despite Spelling Variants (Priority: P1)

As a customer or merchant searching a store catalog, I want Arabic product searches to match common spelling variants so that I can find the intended product even when the query and catalog use different forms of alef, ya, ta marbuta, diacritics, or tatweel.

**Why this priority**: This directly addresses the false negatives that prevent users from finding products they know are present in a merchant catalog.

**Independent Test**: Can be tested by adding equivalent Arabic product names with variant spellings to one store catalog, searching with each variant, and confirming the same intended products are returned.

**Acceptance Scenarios**:

1. **Given** a store has products named with equivalent Arabic variants such as `آيه`, `ايه`, and `اية`, **When** a user searches for any one of those variants, **Then** all matching products from that store appear in the results.
2. **Given** a product name includes diacritics or tatweel, **When** a user searches for the same word without those marks, **Then** the product appears as a relevant result.
3. **Given** a query differs from a product name by common Arabic letter-form differences, **When** the user searches the catalog, **Then** the system treats those forms as equivalent for matching.

---

### User Story 2 - Keep Search Results Within One Merchant Catalog (Priority: P2)

As a shopper or merchant, I want search results to come only from the selected merchant's catalog so that products from other stores never appear in the current store experience.

**Why this priority**: The platform is multi-merchant, and search must preserve catalog isolation and user trust.

**Independent Test**: Can be tested by creating the same or similar product names in two stores, searching within one store, and confirming only that store's products are returned.

**Acceptance Scenarios**:

1. **Given** two stores have similarly named products, **When** a user searches in one store, **Then** only products belonging to that store are returned.
2. **Given** a matching product exists only in another store, **When** a user searches in the current store, **Then** the result list does not include that other store's product.

---

### User Story 3 - Rank Useful Matches First (Priority: P3)

As a user searching for a product, I want the most relevant matches to appear first so that I can quickly choose the product I meant.

**Why this priority**: Fuzzy matching can return multiple candidates, so ordering is necessary to make results useful instead of noisy.

**Independent Test**: Can be tested by searching for a product term with exact, near-exact, and weak matches present, then confirming exact or near-exact name matches rank above weaker matches.

**Acceptance Scenarios**:

1. **Given** a catalog contains an exact spelling match and several approximate matches, **When** a user searches the exact spelling, **Then** the exact match appears before approximate matches.
2. **Given** a catalog contains multi-word product names, **When** a user searches for a meaningful word from the product name, **Then** products containing that word can appear as relevant results.
3. **Given** more results exist than the user can comfortably review at once, **When** the user requests the next result set, **Then** the system returns the next stable page of results without duplicating earlier entries.

### Edge Cases

- Empty or whitespace-only search text is rejected before returning catalog results.
- Very short Arabic queries still return useful matches when relevant products exist, while avoiding excessive unrelated results.
- Searches with no relevant products return an empty result set rather than products from other stores.
- Products with missing optional descriptive content remain searchable by product name.
- Large merchant catalogs remain responsive enough for users to continue browsing without perceiving search as broken.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to search products within a specific merchant catalog using Arabic search text.
- **FR-002**: System MUST normalize common Arabic spelling variations for matching, including alef variants, alef maksura versus ya, ta marbuta versus ha, diacritics, and tatweel, while preserving current product-search cleanup for package-size fragments, punctuation, whitespace, and leading `ال`.
- **FR-003**: System MUST match product names even when the user's query and the stored product name use different normalized Arabic forms.
- **FR-004**: System MUST return only products that belong to the requested merchant catalog.
- **FR-005**: System MUST order search results by relevance, with closer product-name matches appearing before weaker matches.
- **FR-006**: System MUST support bounded result sets so users can request a limited number of results and continue through additional results predictably.
- **FR-007**: System MUST reject empty or whitespace-only search text with a clear validation outcome.
- **FR-008**: System MUST expose each returned product with enough information for a consuming experience to identify and display it, including product identity, product name, merchant catalog identity, and match relevance.
- **FR-009**: System MUST include representative Arabic spelling-variant data in non-production sample data so the behavior can be verified without production catalog access.
- **FR-010**: System MUST provide automated coverage for Arabic normalization, merchant catalog isolation, invalid query handling, pagination, and equivalent spelling-variant matching.
- **FR-011**: System MUST keep cross-language fuzzy matching, semantic search, and advanced multi-merchant ranking outside this feature's scope.

### Key Entities

- **Product**: A sellable catalog item that users search for; key attributes include identity, name, optional descriptive text, category, merchant catalog ownership, and a relevance value when returned as a search result.
- **Merchant Catalog**: The product collection owned by a single merchant store; search results are scoped to this catalog.
- **Search Query**: The user-provided text, requested merchant catalog, and result window controls used to retrieve matching products.
- **Search Result**: A product returned for a query, including displayable product details and a relevance ordering signal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of representative Arabic variant searches in the test catalog return the intended product within the first 5 results.
- **SC-002**: 100% of catalog-isolation tests return products only from the requested merchant catalog.
- **SC-003**: Users receive the first page of search results in under 1 second for merchant catalogs containing a few thousand products under normal operating conditions.
- **SC-004**: Empty or whitespace-only queries are rejected 100% of the time without returning product data.
- **SC-005**: Exact or near-exact product-name matches appear before weaker matches in at least 90% of representative search cases.
- **SC-006**: A merchant or tester can verify the feature end to end using non-production Arabic sample products without requiring production data access.

## Assumptions

- Product names are the first searchable field for this feature; category and description matching may be added later.
- The user experience already knows which merchant catalog is being searched.
- Product search is primarily Arabic for this pass; Latin transliteration and cross-language matching are intentionally excluded.
- Search operates within one merchant catalog at a time, not across all merchants.
- Existing product visibility rules continue to apply before search results are shown to users.
- If catalog size or relevance needs grow significantly, a dedicated search engine may become a future replacement behind the same user-facing behavior.
