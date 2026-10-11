# Delivery phases

This document records implemented scope and remaining work. Repository implementation and live activation are separate: Vercel accounts require PostgreSQL, email settings and committed migrations. A phase is validated only when its relevant checks pass; outcomes belong in the validation reports.

## Phase 1 — Foundation and design (implemented)

- Application in `platform/`, with the existing PHP/MySQL application retained.
- Arabic-default bilingual routes, RTL Arabic layout, translated messages and metadata.
- Logo-inspired design tokens, responsive navigation and original course-card layouts.
- Sample catalog and course detail pages with SAR display.
- PostgreSQL schema, committed migrations, generated Prisma client and repeatable demonstration seed.
- Locked dependency installation, local database Compose service, development instructions, non-root standalone Docker runtime.
- Acceptance: type checking, linting, useful automated tests, production build, database migration/seed validation, and representative Arabic and English runtime/browser checks.

The foundation does not replace the Hostinger domain. Checkout, private lessons/exams and full administration remain pending; verification outcomes and blocked checks belong in delivery reports.

## Phase 2 — Accounts (implemented; live services require setup)

- Registration, email/password login, verified email and password recovery.
- Auth.js integration, safe Google linking, revocable sessions, account settings.
- Account name, language, preset avatar and password settings.
- Centralized account/verified-user authorization, persistent rate limits and bounded same-origin mutations.
- Encrypted persisted account email jobs, Resend delivery, local development outbox and authenticated retry worker.
- Tests for authorization, reset/verification expiry and reuse, session revocation, and OAuth ownership checks.

This delivery also implements the guest/account cart portion of Phase 4. Database prices, publication/enrollment checks and a confirmed guest merge govern saved carts. Session changes, cross-tab behavior and concurrent mutations require validation.

A code push does not create Vercel's database/email services. Follow [Vercel setup](VERCEL_SETUP.md) to activate accounts. Checkout, payment, protected lesson/exam access and the full dashboard are still pending.

## Phase 3 — Catalog and content (planned)

- Database-backed bilingual pages, localized course slugs, categories and instructors.
- Search, filters, sorting, course previews, policies and catalog/content administration.
- Media metadata and supported public preview providers.
- Tests for locale resolution, publication visibility, filtering and administrative permissions.

## Phase 4 — Commerce (carts implemented; checkout planned)

- Remaining: coupons, server-authoritative order totals and immutable purchase snapshots.
- Moyasar checkout, authenticated webhooks, payment verification and duplicate-safe fulfillment.
- Receipts, refund verification, order and coupon administration.
- Tests covering tampered prices, failed/pending payment, replayed callbacks, concurrent fulfillment, coupon limits and refunds.

Cart membership alone never grants learning access or represents a completed purchase.

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

Each phase ends with reviewed changes, appropriate validation and a commit. Production cutover requires a concrete release and hosting configuration. Preserve the `hostinger` deployment branch and PHP `public_html` until migration is complete.
