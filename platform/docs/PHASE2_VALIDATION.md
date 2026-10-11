# Accounts and carts: validation

Validation date: 11 October 2026, Asia/Riyadh. These results cover the implemented account and cart release. They do not establish a live Vercel database connection, external email delivery, Google consent configuration, or payment processing.

## Automated checks

- TypeScript and ESLint passed.
- `npm test`: 130 tests passed across six files. The 21 database tests intentionally skipped when their explicit local database variables were absent.
- `npm run test:database`: all 21 PostgreSQL tests executed and passed across three files: seven account, four cart, and ten email worker tests.
- Applied migrations are up to date; repeating the demonstration seed created no additional courses and preserved existing content. No default administrator was created.
- The one-shot email worker executed successfully with redacted counts. Development outbox mode writes private ignored files and is rejected in production.

The account tests check single-use and expired verification/reset tokens, password hashing, duplicate registration, revoked sessions, password-reset/login races, recent verified ownership for Google linking, stale profile writes, persisted concurrent rate limits, bounded JSON, forged origins, mass assignment, and durable logout failure handling.

Cart tests exercise simultaneous first merges, duplicate suppression, ownership and publication checks, edited database prices, user isolation, blocked browser storage, and guest/account transitions. Email tests exercise atomic enqueueing, encryption, deduplication, concurrent claims, expired and consumed links, crashed leases, retry/backoff, provider idempotency, exhausted jobs, tamper rejection, and payload cleanup. Provider HTTP calls in automated tests are controlled test doubles.

The database runner refuses remote databases. Fixtures use unique identifiers and are removed afterward; email worker integration tests use a temporary schema and private temporary outbox. Existing application records are retained.

## Browser checks

Ten full-flow checks passed against the running application:

1. Guest course addition and cart persistence after reload.
2. Registration creates an unverified learner and queues a private verification message without automatically logging in.
3. Credentials login merges the guest cart into PostgreSQL and shows the unverified purchase gate.
4. Session cookies use HttpOnly and SameSite=Lax.
5. Opening a verification page does not consume the token; explicit POST succeeds once and replay fails.
6. Profile name and preset avatar edits persist.
7. Password reset invalidates two browser sessions and rejects token replay.
8. The new password logs in and retrieves the persistent account cart.
9. Foreign-origin profile requests and client-supplied privilege fields are rejected.
10. Logout persists revocation, rejects old-cookie replay, and hides the account cart from guests.

No browser page errors occurred. Forty Arabic/English route-and-width checks passed for signup, login, cart and catalog at 320, 390, 768, 1024 and 1440 pixels, with correct language/direction and no horizontal document overflow. Separate cart browser checks passed multi-tab add/remove, unavailable local storage, and queued/delayed mutations belonging to a previous user.

Five additional account browser checks passed keyboard avatar/profile controls at 320 pixels, cross-tab verification refresh, hiding the previous user's private fields during an account switch, cross-tab logout with old-cookie rejection, and password change revoking all sessions before redirecting to the sign-in confirmation. Pre-authentication checks also covered validation, password visibility, safe cart return paths, explicit verification submission, provider ownership messaging, missing configuration and noindex metadata.

Private test passwords and account links were not logged or committed. Only development messages were generated; these are not live Resend delivery results.

## Production build and runtime

`npm run build` passed, generating the Next.js standalone server and all public pages. The production server passed the five private-account checks again against PostgreSQL, the forty responsive route checks, and the existing public-site smoke checks for Arabic default routing, localized course slugs, language switching, curriculum, search/recovery, assets, headers, sitemap, robots and genuine localized 404 responses. No browser page errors occurred.

The final Docker image `2f5afc8097aa` built with a frozen lockfile and verified registry artifacts, then ran healthy as non-root UID 1001. With database/auth/email secrets absent, localized public pages, signup readiness messaging, assets and the guest cart remained usable; signup was disabled with a clear service notice. Native Argon2 hash/verification worked. Tracing includes the PostgreSQL driver, Prisma client runtime and bundled adapter/generated models, while excluding Prisma CLI/config, MySQL, deepmerge-ts, ESLint, braces and micromatch. Private environment/outbox files and build proxy/CA secrets were absent from the runtime artifact. These artifact checks do not erase the unresolved tooling dependency audit.

## Dependencies and remaining activation

Auth.js is pinned to `5.0.0-beta.32`. The v5 API supports the asynchronous request APIs used by Next.js 16; the stable v4 line is not a compatible substitute without changing that integration. Keep the pin and repeat account tests when upgrading.

The dependency audit remains at nine high affected-package findings in the inherited Next ESLint and Prisma CLI/config chains, with no critical findings. This is not a clean dependency-graph audit. See [the Phase 1 tooling audit](VALIDATION.md#deployment-and-dependency-audit); no forced downgrade or unvalidated dependency override was applied.

Live accounts require a PostgreSQL database, applied migrations, a stable HTTPS origin, private Auth.js secrets, and verified email sender configuration. Google login is optional and its external provider flow remains untested without credentials. The manual database release workflow has been syntax-checked but has not run against a hosted database. Follow [the Vercel activation guide](VERCEL_SETUP.md).

Moyasar checkout, protected lessons, exams/certificates, full administration, data migration, domain cutover, and measured Lighthouse targets remain in [the delivery phases](PHASES.md). The existing PHP site and Hostinger branch are preserved.
