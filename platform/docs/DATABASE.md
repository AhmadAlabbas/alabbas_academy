# PostgreSQL foundation

The application uses Prisma 7.10 with PostgreSQL and the official `@prisma/adapter-pg` driver. The generated client lives in `src/generated/prisma` and is excluded from Git. `prisma.config.ts` reads `DATABASE_URL` from the runtime environment or an ignored `.env`; client generation and static-page builds do not need a database connection.

The schema establishes the approved platform architecture. Phase 1 provides the database and demonstration content, not working payment, authentication, protected playback, or administration flows. Those features require their later implementation phases and server-side authorization.

## Local setup

From `platform/`:

```bash
cp .env.example .env
npm ci
npm run db:start
npm run db:generate
npm run db:migrate
npm run db:seed
```

Use the database connection matching the local Docker service in `.env`. On a remote PostgreSQL service, use its verified TLS configuration and a dedicated application user. Never disable TLS or certificate verification to resolve a connection failure. Connection URLs are secrets and must not be committed or pasted into issue reports.

`npm run db:migrate` applies committed migrations and is appropriate for deployment. Create new migrations during development with `npx prisma migrate dev --name descriptive_name`. Review generated SQL before committing it. Do not use `db push`, migration resets, or development migrations against a production database. Back up and test recovery before deploying schema changes to production.

If the environment cannot download Prisma's native schema engine from `binaries.prisma.sh`, run `npm run db:migrate:wasm` from `platform/`. This fallback uses the version-pinned official `@prisma/schema-engine-wasm` package from the npm registry with npm integrity verification, Prisma's official pg adapter, and the engine's `diagnoseMigrationHistory` and `applyMigrations` APIs. It retains Prisma's history table, migration checksums, locking, and failed-migration semantics. It refuses altered applied migrations, failed history, or a checkout missing applied migrations. It never substitutes raw SQL execution or manually stamps migration records. Node's WASM import flag is currently experimental. The native CLI remains the standard workflow when its verified binary is available; `prisma generate` works without that binary for the configured `prisma-client` generator.

Each cloud task already runs in an isolated environment. Use its existing checkout; do not create a Git worktree unless explicitly requested.

## Optional administrator creation

Seed data does not create a default account. To create a new administrator, inject both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` through your local secret configuration or the hosting environment, and optionally `SEED_ADMIN_NAME`, then run `npm run db:seed`. Passwords must contain 12–128 characters and are stored with Argon2id using a random salt, 19 MiB memory, two iterations, and one lane. Use a generated password.

The administrator remains unverified until the account verification flow is implemented and completed. Re-running the seed never changes an existing password or grants administrator access to an existing email address. Account promotion, password recovery, and ownership checks belong in the authorized administration and authentication flows. Remove administrator seed credentials from the runtime after initialization.

## Demonstration content

The seed creates four clearly fictional instructor personas, four bilingual courses, eight curriculum sections, 32 article lessons, eight exams, and 24 bilingual questions with explanations. No fake customer reviews, testimonials, sales, or enrollment statistics are created. No paid video rights or working video integrations are claimed.

`src/content/catalog.ts` contains client-safe course descriptions, prices, lesson summaries, and exam counts for the Phase 1 design. `prisma/demo-answer-keys.ts` holds sample exam questions, explanations, and correct answers exclusively for seeding. Do not import that file into application client components. Actual exam APIs must fetch question data on the server and omit correct answers and explanations until the learner submits an authorized attempt.

Seeding is serialized with a PostgreSQL advisory transaction lock and is atomic. Existing roles, categories, instructors, courses, settings, and accounts are preserved. A course and its complete curriculum are inserted only if its stable key is absent, so re-running setup preserves editorial changes. Missing new demonstration courses can be added by a later seed; deleted demonstration courses will be recreated if their seed key is absent. Prefer archiving courses to deleting them. Seed data is development content and must be reviewed before publishing a real catalog.

## Records and invariants

| Area | Records | Persistence rules |
| --- | --- | --- |
| Identity | Users, roles, assignments, OAuth accounts, sessions, verification/reset tokens | Email normalized to lowercase; provider identity unique; revocable, hashed session tokens and one-use hashed email/reset tokens |
| Catalog | Categories, tags, instructors, courses, sections, lessons and their translations | One translation per locale per record; course/category/page slug unique within locale; ordered sections and lessons |
| Media | Media assets, video-provider records, lesson attachments | Stable storage key, checksum and access visibility; provider/video ID unique; private files never returned as public URLs |
| Commerce | Carts, orders/items, payment attempts, webhook events, refunds/items | Integer halalas; immutable purchase snapshots; idempotency keys and provider event IDs unique; financial relations restrict deletion |
| Discounts | Coupons, course restrictions, reservations, redemptions | Reservation expiration and per-user/total limits enforced transactionally; one redemption per order |
| Learning | Enrollments, progress, exams/questions/options, attempts, certificates, reviews | One enrollment per user/course, one progress row per enrollment/lesson, one review per user/course, immutable attempt snapshot |
| Content | Pages/blocks, navigation, FAQs, testimonials, settings, redirects | Bilingual records; testimonials require recorded consent; settings contain public configuration only |
| Operations | Audit logs, background jobs | Audit history survives actor deletion; queue deduplication keys unique, bounded retries, lease timestamps |

All SAR amounts are integer halalas: `34900` represents SAR 349.00. Course and order prices use database integer columns, never floats. Percentages use integer basis points: `7000` means 70%; a coupon percentage of `1250` means 12.5%. Timestamps are stored in UTC and displayed using `Asia/Riyadh`.

The initial migration includes reviewed PostgreSQL CHECK constraints for nonnegative SAR prices, arithmetic-consistent totals, coupon parameters, exam scores, ratings, and exactly one cart owner. An expression index prevents duplicate emails regardless of case, and a partial index permits at most one successful payment attempt per order. Prisma cannot model these custom constraints directly; retain them when reviewing future generated migrations. They were added after generating the base migration with Prisma's official 7.10 WASM schema engine.

Database foreign keys and unique indexes enforce structural invariants. Cross-row business rules require authorized application transactions:

- Authentication must normalize emails, verify password hashes, rate-limit attempts, and compare session versions and revocation/expiration on every protected operation. The standard Auth.js Prisma session adapter cannot be used unchanged: the adapter must hash the browser's session token into `Session.tokenHash`. No raw verification/reset/session bearer token is stored.
- OAuth account linking requires proof of ownership. A Google email matching an existing password account must not silently merge identities. The optional provider token fields follow Auth.js's contract; request only required scopes and protect retained provider tokens using the deployment's secret-handling policy. Do not log them.
- Checkout recomputes prices and discounts on the server. Commit the order/item snapshots before creating a provider payment. Treat the pending order and coupon reservation as a transaction with bounded expiration.
- Payment fulfillment requires verified provider status, matching currency/amount/order metadata, and an atomic order state transition. Insert the enrollment and receipt job in that transaction. A browser redirect is never proof of payment. Store only the minimum redacted webhook payload; never card data or secrets.
- Refunds require verified provider confirmation. Validate that total confirmed refunds do not exceed the captured amount; map item amounts to access revocation and retain all financial history.
- Coupon capacity requires locking the coupon while counting active reservations/redemptions and enforcing total/per-user limits. Expired reservations must be released by the worker.
- Enrollment access checks include course membership and enrollment status. Verify that a lesson/exam belongs to the enrollment's course; independent foreign keys alone do not enforce that association.
- The server snapshots the exact exam version, questions, options, and grading criteria when starting an attempt. Do not expose private grading criteria. Editing an exam bumps its version; grading uses the snapshot and server time rather than client-provided answers or deadlines.
- Queue workers claim jobs with `FOR UPDATE SKIP LOCKED`, mark leases and retry failures with bounded backoff. Jobs must contain opaque record identifiers rather than plaintext credentials or reset tokens. Deduplication does not replace idempotent job handlers.

Application mutations must generate redacted audit entries. Do not place passwords, access tokens, full payment-provider payloads, or database connection strings in `AuditLog.changes` or `Setting.value`.

## Connection lifecycle

`src/lib/db.ts` is server-only and creates the connection pool lazily. A global singleton keeps hot reload from creating additional pools; each runtime process has at most ten connections by default. The seed uses a separate pool limited to two connections and closes it on completion. Production pool size and worker concurrency must be tuned to the PostgreSQL service's connection limit. Static demo pages do not invoke the database helper until the server-backed catalog phase is enabled.
