# Delivery phases

The user approved this architecture for a phased implementation. This document separates the current foundation from features still to be built. A phase is complete only when its relevant checks finish successfully; sample UI and schema records are not evidence that an integration works.

## Phase 1 — Foundation and design (current)

- Application in `platform/`, with the existing PHP/MySQL application retained.
- Arabic-default bilingual routes, RTL Arabic layout, translated messages and metadata.
- Logo-inspired design tokens, responsive navigation and original course-card layouts.
- Sample catalog and course detail pages with SAR display.
- PostgreSQL schema, committed migrations, generated Prisma client and repeatable demonstration seed.
- Locked dependency installation, local database Compose service, development instructions, non-root standalone Docker runtime.
- Acceptance: type checking, linting, useful automated tests, production build, database migration/seed validation, and representative Arabic and English runtime/browser checks.

Phase 1 does not supply working signup/login, checkout, private lesson access, a complete administrative dashboard, or a live replacement for the existing domain. Verification outcomes belong in the delivery report; unfinished or blocked checks must be named explicitly.

## Phase 2 — Accounts (planned)

- Registration, email/password login, verified email and password recovery.
- Auth.js integration, safe Google linking, revocable sessions, account settings.
- Server-side role authorization, rate limits, privacy-conscious audit events.
- Tests for authorization, reset/verification expiry and reuse, session revocation, and OAuth ownership checks.

## Phase 3 — Catalog and content (planned)

- Database-backed bilingual pages, localized course slugs, categories and instructors.
- Search, filters, sorting, course previews, policies and catalog/content administration.
- Media metadata and supported public preview providers.
- Tests for locale resolution, publication visibility, filtering and administrative permissions.

## Phase 4 — Commerce (planned)

- Guest/account carts, coupons, server-authoritative SAR totals and order snapshots.
- Moyasar checkout, authenticated webhooks, payment verification and duplicate-safe fulfillment.
- Receipts, refund verification, order and coupon administration.
- Tests covering tampered prices, failed/pending payment, replayed callbacks, concurrent fulfillment, coupon limits and refunds.

## Phase 5 — Learning (planned)

- Enrollment-gated video playback and private downloads.
- Progress, resume, course exams and attempts, reviews and bilingual PDF certificates.
- Private Bunny Stream integration with short-lived authorization and protected file storage.
- Tests covering enrollment access, progress persistence, exam grading and certificate eligibility.

## Phase 6 — Full administration (planned)

- Users, roles, courses, curriculum ordering, media uploads and exams.
- Content/settings, reports, CSV exports, pagination, bulk actions and audit logs.
- Permission checks for every mutation, file restrictions and accessible administration workflows.

## Phase 7 — Launch preparation (planned)

- Tested PHP/MySQL data migration, password compatibility and enrollment mapping.
- Staging rollout, PostgreSQL backups, restoration test, monitoring and deployment documentation.
- SEO, accessibility and security review; Lighthouse 95+ is a measured target.
- Final integration and payment checks, domain cutover and documented rollback.

Each phase ends with reviewed changes, appropriate validation, and a commit. Production cutover follows a concrete reviewed release and hosting configuration. Do not deploy the Node.js source over the existing PHP site's `public_html`.
