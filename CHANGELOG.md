# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.1] - 2026-07-21

### Added
- **Android TWA Infrastructure**:
  - Implemented Android Trusted Web Activity (TWA) builds with separate flavors for Customer and Merchant mobile apps.
  - Added Digital Asset Links endpoint (`/.well-known/assetlinks.json`), PWA service worker registration, and store deep-linking redirection (`/open/store/[slug]`).
- **Missing Delivery Area Request System**:
  - Added a missing delivery area request flow for merchants during onboarding and delivery settings.
  - Built an Admin dashboard panel (`/admin/missing-delivery-area-requests`) to review and manage requested areas.
- **Admin Order Management & Analytics**:
  - Implemented RLS-aware Admin order management service with data masking and enhanced tracking cookie lookup.
  - Enhanced order filtering in the Admin panel to support an date-agnostic **All-time view**.
- **Catalog Taxonomy & Bulk Essential Imports**:
  - Enforced catalog category validation against active taxonomies in the Admin panel and backend services.
  - Added support for pharmacy bulk essential catalog imports (`chefaa_csv`).
- **Localization**:
  - Standardized display and search of localized Arabic names for store directory areas.

### Fixed
- Resolved order fetching and status display issues in the Admin orders management dashboard.

### Changed
- Workspace version updated to `0.8.1` in root, backend, and frontend packages.
