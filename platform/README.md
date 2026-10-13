# Alabbas Academy — Hostinger Node.js platform

## Sale prices and coupon codes

In the course editor, enter the current selling price and optionally a higher **Previous price**. The preview shows the original price, exact savings and discount badge. Leave the previous price blank when there is no sale. Prices across the site use the 2025 Saudi riyal symbol, with accessible Arabic/English currency names; database, gateway and structured-data currency codes remain `SAR`.

Under **Coupons**, choose Percentage or Fixed amount and enter the relevant positive value. Codes are trimmed and saved in uppercase (up to 40 letters/numbers, hyphens or underscores). Minimum order defaults to zero; blank usage limits/caps mean no overall limit. Set dates, activation and per-customer uses as needed. Codes discount the current cart prices, including sale prices. A course-scoped existing code requires every cart course to be eligible.

At checkout, **Apply coupon** displays the discount and final total before ordering; **Remove code** clears it. Invalid, expired, future, minimum-order and exhausted codes have specific feedback. Previewing does not create an order or reserve a use. Order creation rechecks prices and coupon availability and uses exact halala arithmetic. Payments remain controlled by the existing configuration. Zero-total orders use manual enrollment confirmation.

The locally bundled SVG is distributed by [abdulrysrr/new-saudi-riyal-symbol](https://github.com/abdulrysrr/new-saudi-riyal-symbol/tree/6248840d3be2d4b7aac4183ac3763f97e2470d77), with its MIT notice in `public/saudi-riyal-LICENSE.txt`. The artwork is unmodified; SHA-256: `dc035ad6d18c543a79d7e2f24458ab17b869c030875dc2f1d18f2fa9dda9e404`. It uses a scalable CSS mask so both themes work without relying on a device font containing the new currency glyph. This is a distribution mirror, not an official Central Bank repository.

Arabic-first `/ar`, English `/en`; navy, sky blue and gold cards. Next.js standalone, Auth.js, Prisma **MySQL/MariaDB**, SMTP, persistent private uploads. No Docker, Redis, worker service or cron is required. The historical PHP website stays on the `hostinger` branch. This platform belongs on a **Node.js Web App**, never in PHP `public_html`.

## Working features

- Editable bilingual catalog, 12 clearly marked sample courses, six categories, three fictional instructors, real YouTube sample embeds, sample lesson files and exams.
- Credentials and optional Google authentication, verified-email ownership linking, single-use verification/reset tokens, secure Argon2 hashing, account profile/language/avatar/password, session revocation and database rate limits.
- Guest cart merges after login; the server validates published courses, prices and ownership. Checkout snapshots prices, reserves coupons and creates pending orders idempotently.
- **Payments are OFF by default.** Manual orders unlock nothing until an administrator confirms receipt. Confirmation creates enrollments and a durable receipt email. Moyasar has a local hosted widget, server API verification, secret-protected webhook, idempotent fulfillment and full refunds.
- Protected learning pages/files, MP4 resume, private notes, lesson completion, server-graded timed exams with attempt limits, enrolled-only moderated reviews and completion-gated bilingual PDF certificates. Refunds revoke the purchased enrollment and certificate.
- Administrator dashboard with seven-day order chart, searchable paginated records, courses/categories/instructors/sections/lessons/files/exams/questions/answers/coupons/content/settings, user bans/roles/free enrollment/revocation/verification resend, order payment/refund/CSV, review moderation, contact messages, email retries and audit logs. Section/lesson Move up/down controls change actual curriculum order.
- SSR public pages, localized metadata/canonical/alternates, generated social images, JSON-LD, database sitemap, robots exclusions and private route noindex. Performance targets must be measured on the final host; no Lighthouse score is claimed without a report.

## Install and run

Use Node **22 LTS (22.18+)** or a compatible newer Hostinger version. Node 24 was used in the cloud validation. MySQL 8 or MariaDB 10.6+ is recommended; schema uses MariaDB-compatible JSON, bounded strings and string statuses instead of PostgreSQL arrays/enums.

```sh
cd platform
npm ci
cp .env.example .env
# Enter private values in .env or the host's environment settings.
npm run db:generate
npm run db:deploy
npm run db:seed
npm run build
npm run test:hostinger
npm start
```

For development use `npm run dev`; run a local MySQL instance yourself or use an existing development database. Never point the test runner at your hosted database. `.env`, uploads, development mail, generated clients and build output are ignored by Git. Do not paste credentials into chat or commit them.

`server.js` is the source deployment entry point. It copies only `public` and `.next/static` into the standalone output, honors Hostinger's `PORT` and binds `0.0.0.0`. Uploads use an absolute external `UPLOAD_DIR`, so starting the server never replaces them.

The production build explicitly uses Next.js's supported Webpack bundler (`next build --webpack`). The Hostinger build log for commit `857697c` showed Turbopack's PostCSS subprocess exiting before its connection was established while processing Moyasar CSS. Hostinger should keep its build command as `npm run build`; the package script selects Webpack. No database or payment credentials are needed to build the design preview.

Hostinger's LiteSpeed `lsnode.js` loader calls `require(server.js)`. The entry file dynamically imports the asynchronous startup helper so its synchronous module graph has no top-level `await`. Keep the entry file as `server.js`. After building, `npm run test:hostinger` checks both this loader path and direct Node startup, including public pages and CSS with the database unset.

## Exact Hostinger deployment sequence

1. Back up the existing customer website and its MySQL database in hPanel. Preserve the existing PHP `hostinger` deployment as the rollback target.
2. Open **Websites → Add website → Node.js Web App** (labels may differ by hPanel version). A PHP/HTML website cannot execute Next.js. Your Cloud Startup subscription does not by itself change the site's runtime. Confirm the Node.js Web App option is enabled for your account before attaching the customer domain.
3. Connect GitHub repository `AhmadAlabbas/alabbas_academy`, branch **platform**, root directory **platform**. Select the available Node 22+ runtime, build command **npm run build**, start command **npm start** (or entry point **server.js** where Hostinger asks for a file). Leave Hostinger's injected PORT in place.
4. In **Databases → Management/MySQL**, create a **new dedicated platform database** and a user. Copy the complete prefixed database/user names; do not reuse or overwrite the legacy PHP database. Use the hostname shown by Hostinger (usually `localhost`). Grant this user access only to its platform database.
5. In application environment settings set `DATABASE_URL=mysql://USER:PERCENT_ENCODED_PASSWORD@HOST:3306/DATABASE`. Password characters such as `+`, `@`, `#`, `/` and `:` must be URL-encoded. Enter the URL privately. Set `NEXT_PUBLIC_APP_URL` and `AUTH_URL` to **https://alabbasacademy.com**, one strong `AUTH_SECRET`, and a persistent absolute `UPLOAD_DIR` outside the redeployed application directory. Create this directory writable by the Node app's Unix user, with private permissions.
6. Configure SMTP and private seed-admin credentials as described below. Leave **PAYMENTS_ENABLED=false**. Hostinger must apply both build-time public variables and runtime private variables. Rebuild if any `NEXT_PUBLIC_*` variable changes.
7. In the app's SSH/terminal, `cd` to its `platform` directory and run `npm ci`, `npm run db:generate`, `npm run db:deploy`, then `npm run db:seed`. If hPanel offers a pre-deploy command rather than a terminal, run these there. Do not make a publicly callable installer or paste a database password into a repository build script. Normal later deploys run `npm run db:deploy`; the seed is optional and preserves existing edited records.
8. Build/start and verify the temporary/staging domain first: both languages, signup → email verification → login, cart, pending order, admin confirmation, learner video/file/exam/certificate, file upload and a second redeploy preserving that upload. Configure the temporary domain as the auth/public origin for its test build; rebuild with the customer origin before the final switch.
9. Attach **alabbasacademy.com** to the verified Node.js app in Hostinger's domain settings; use the DNS target shown by hPanel, enable HTTPS, and confirm the exact custom URL. Avoid guessing a DNS IP or deleting unrelated email/DNS records. The user has authorized publication; access to Hostinger is still required to execute these steps.
10. Replace sample content, review legal pages/contact information, and perform the customer-origin signup/email test before advertising the site. Use the preserved PHP application/database for rollback if the Node deployment fails.

Pushing a branch does not prove a live deployment: confirm the deployed branch, build commit, environment configuration, domain attachment and final HTTP/browser checks. This repository cannot configure your private hPanel account without a deployment connection.

## Environment variables

All variables are documented in `.env.example`; real values belong in private host settings.

| Variable | Purpose |
|---|---|
| DATABASE_URL | Private MySQL URL, percent-encoded password; required |
| NEXT_PUBLIC_APP_URL / AUTH_URL | Same canonical HTTPS origin, no path/query; public metadata and private account links |
| AUTH_SECRET | At least 32 random characters; cookie/token/queue cryptographic secret; required |
| UPLOAD_DIR | Absolute persistent private directory outside `.next`/`public`/deployment; required on hosting |
| PORT / ACADEMY_HOST | Host-injected port; bind address defaults to `0.0.0.0` |
| AUTH_TRUSTED_PROXY | `1` only if your trusted host proxy removes client-supplied forwarded headers |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Optional Google OAuth pair |
| EMAIL_TRANSPORT | `smtp` default, or `resend`; `outbox` is local development only and rejected in production |
| SMTP_HOST / SMTP_PORT / SMTP_SECURE | Hostinger normally `smtp.hostinger.com`, `465`, `true`; 587 with `false` requires STARTTLS |
| SMTP_USER / SMTP_PASSWORD | Private mailbox credentials, not database credentials |
| EMAIL_FROM / ADMIN_EMAIL | Verified sender and contact notification recipient |
| RESEND_API_KEY | Needed only for `EMAIL_TRANSPORT=resend` |
| SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME | Private admin seed configuration, 12–128 character password; no fixed default password |
| PAYMENTS_ENABLED | `false` today; `true` only after approval and test verification |
| NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY | Public publishable gateway key, compiled into browser bundle |
| MOYASAR_SECRET_KEY / MOYASAR_WEBHOOK_SECRET | Private API key and at least 32-character random webhook secret |
| JOB_WORKER_SECRET | Optional ≥32-character bearer secret for bounded maintenance endpoints; unused when using admin retry |

Generate secrets privately with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. **The admin credentials are the values you set in SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD. They are intentionally not printed in this README, logs or the repository.** Seed preserves existing users/passwords; use password recovery to change an existing administrator's password. Keep the seed variables only as long as required for initialization.

## Google OAuth

In Google Cloud create a Web OAuth client, set authorized origin to `https://alabbasacademy.com`, and authorized redirect URI to `https://alabbasacademy.com/api/auth/callback/google`. Set both private client variables in Hostinger and restart. Add explicit staging origins/callbacks for staging. Google must assert a verified email; existing unverified email accounts cannot be silently claimed. If neither key is configured, the Google button is hidden.

## SMTP and delivery

Create a Hostinger mailbox such as `hello@alabbasacademy.com`, verify the hPanel SMTP settings, and enter its actual mailbox username/password privately. Set `EMAIL_FROM` to that mailbox. Configure SPF/DKIM and test delivery to a real inbox. Signup and recovery fail closed if the delivery configuration is absent; the application does not claim a verification email was sent when no valid transport exists.

Queues are encrypted database rows. Account requests deliver a bounded batch after response; order/contact requests deliver bounded notifications. **There is no worker process or required scheduled job.** Admin → Email delivery → Retry email delivery retries failed queued messages and cleans up old account records. SMTP delivery can be repeated after an ambiguous network failure (SMTP cannot guarantee exactly-once delivery); tokens and order fulfillment remain idempotent. If choosing Resend, configure its verified sender and key, then switch `EMAIL_TRANSPORT=resend`.

## Payments today and later

Keep `PAYMENTS_ENABLED=false`: customers see “Payments will be available soon” and can create pending orders. In Admin → Orders, confirm receipt of the amount externally before **Mark paid**; do not mark it merely to dismiss a pending order. Pending manual orders/coupon reservations expire after 24 hours. Free enrollment is available from Admin → Users for verified active accounts.

To enable Moyasar after approval: configure its publishable/secret keys and webhook secret, set the webhook URL to `https://alabbasacademy.com/api/payments/webhook` with the matching secret token, set `PAYMENTS_ENABLED=true`, ensure the site setting `payments_enabled` is `true`, and rebuild/restart. The seeded site toggle is `true` but the mandatory environment gate is **false**; either can turn payments off. No code change is needed.

Run a real **Moyasar test-mode payment and refund** before adding live keys. The server retrieves payment status/amount/SAR/order metadata from the API; redirect or webhook bodies alone cannot enroll a customer. Widget metadata includes `order_id`. Webhooks are secret-checked and deduplicated; the return URL also verifies the payment. Full refunds revoke access and certificates. For manual refunds, return the funds externally first, then record the refund in the dashboard. Ambiguous online refund requests remain pending and require reconciliation instead of blindly charging another refund. Real gateway acceptance/refund behavior cannot be certified without the gateway's credentials and approval.

## Replace sample content without editing code

The public course catalog has **All courses / Arabic courses / English courses** filters. These filter the course's content language, independently of the interface language, and combine with search, category, level and price. Set **Course content language** in the course editor to Arabic, English, or both if the actual course supports both. The admin course list has the same language filter; choose a language and press **Apply**. Public links can include `?language=ar` or `?language=en`; clearing filters resets the language selection too.

1. Sign in as the seeded administrator and open `/ar/admin` or `/en/admin` (also linked from My Courses).
2. Categories and instructors: create/edit Arabic and English fields. Related records are selected by name throughout the editor.
3. Courses: choose **Add new**, choose the content language and enter its title/description, select a category and enter the price in **SAR** (for example, `199.95`). References and links for the selected language are generated automatically; **More details** lets you change them and SEO descriptions. Arabic-only and English-only courses do not require a second version. Related lesson, section, question, answer and file-label forms follow the course language. Existing bilingual courses remain supported. Add optional outcomes, requirements, comparison price and featured flag. Disable `isSample` only when content is real. Assign instructors with **Add instructor** and select a name.
4. Open a course's **Manage content** screen. **Add section**, then **Add lesson**, preselect the related course/section. New items are appended automatically; **Manage and reorder** provides Move up/down controls. Add a supported YouTube/Vimeo/Bunny HTTPS video link or select/upload an MP4. Publish each finished lesson. Public preview is a separate course field; private lesson URLs/bodies are not sent in the public curriculum.
5. **Upload and select a file** inside an editor uploads and selects its image/video/document in one step. Images accept JPEG/PNG/WebP ≤5 MB, documents PDF/TXT ≤10 MB and videos MP4 ≤25 MB. Add documents through **Lesson files** from the course-content screen. Existing uploads are chosen by filename. Uploaded images are public; videos and course attachments require active enrollment. For larger videos use a supported external provider.
6. Use **Add exam**, then **Manage questions** → **Add new** → **Answers**. Enter the pass mark as a percentage (`70` = 70%), optional minutes and attempt limit, and whether the exam is required for the certificate. Selecting a correct answer clears the previous correct answer for that question. The content screen reports when every question has at least two choices and one correct answer. Empty/invalid exams cannot start. Every published lesson and required exam must be completed/passed before certificate issuance.
7. Content: Pages edits About/Privacy/Terms/Refund Policy; Homepage blocks edits the hero and renders BANNER blocks; FAQ/Testimonial screens edit those cards. Settings `home_content_ar` / `home_content_en` contain all remaining homepage labels and descriptions as a flat JSON object. Settings also edit site name, uploaded logo, contact information, social links, default SEO and the gateway toggle. Settings text values use JSON quotes, booleans do not.
8. Reviews require enrollment and start pending; publish approved reviews only. Demo testimonials/instructors are fictional and must not be presented as real customer endorsements.

YouTube/Vimeo sample videos are public at the original provider. Enrollment protects academy pages/files; it cannot make somebody else's public YouTube upload private. Use private Bunny hosting or uploaded MP4 for paid original videos. Certificates document academy course completion, not external accreditation. New legal pages are editable starting text and should reflect your actual Saudi business/contact/refund practices before customer launch.

The **Publishing checklist** in Manage content reports required titles/descriptions, at least one published lesson, complete video/article content and valid required/published exams. A missing thumbnail is a recommendation. New publication and changing the language of a published course require the mandatory checks to pass; save as Draft while preparing content. Hidden translations are preserved when editing existing courses, but unavailable language versions are excluded from public links and sitemap entries.

**My Courses** shows enrollment/completion/certificate totals, resumes an unfinished published lesson, and exposes certificate downloads. On phones, **Lesson list** expands/collapses the curriculum; desktop keeps it visible. Notes save automatically after a short pause and are flushed when leaving the lesson. **Save notes** retries a failed save; failures keep the text in the editor and display feedback. Notes are hidden for lessons with notes disabled. Progress continues to use the existing server eligibility rules.

The sun/moon button in the header switches the whole site between light and dark themes. It starts with the browser's system preference and remembers an explicit choice on that device. Footer social icons support Settings keys `instagram`, `x`, `youtube`, and `linkedin`; enter each HTTPS profile URL as a JSON string (for example, `"https://www.youtube.com/@youracademy"`). Missing links display accessible muted icons without fake destinations. New social keys can be created in Site settings without rerunning the seed or changing environment variables.

## Verification and packaging

```sh
npm run lint
npm run typecheck
npm test
npm run test:database
npm run build
npm start
npm run prepare:hostinger
```

Database tests refuse non-loopback servers, create a random `academy_test_*` database, apply official Prisma migrations and drop only that database in `finally`. Your local development database user must have CREATE/DROP privileges for this test prefix. They cover auth ownership/tokens/session revocation, concurrent cart/order creation, manual confirmation/refund, encrypted mail retries/rate limits and exam/certificate gates. Normal unit tests explicitly skip database-only suites; run the database command to exercise them.

After building, run `npm run test:certificates` with `ACADEMY_TEST_DATABASE_URL` privately set to a migrated and seeded loopback MySQL database. This check copies standalone output into a temporary directory, simulates an unavailable build-machine path, and downloads actual PDFs with Arabic and Latin learner names through authenticated production requests. It also checks anonymous, other-learner, incomplete and revoked access. It refuses hosted databases and removes only its own temporary records/output. PDFKit must remain in `serverExternalPackages`, with its standard-font modules and the Arabic/Latin WOFF fonts traced into standalone output; bundling its ESM entry can leave an unusable build-machine font path after deployment.

Optional `npm run test:theme-navigation` uses Playwright from the development environment against a local preview. Set `ACADEMY_TEST_BASE_URL` to its loopback URL, `ACADEMY_PLAYWRIGHT_MODULE` to an installed Playwright module path when it is outside this package, and `ACADEMY_BROWSER_PATH` to an installed Chromium executable when needed. `ACADEMY_UI_ARTIFACT_DIR` optionally saves screenshots. The script checks touch menu destinations/focus behavior, short screens, theme persistence/system preference/blocked storage, placeholders, and bilingual layouts at eight widths. Browser tools are development-only and are not added to customer runtime dependencies.

The package command writes `.local/hostinger-package` with standalone runtime, static/public assets, migration files and deployment documentation, excluding `.env`, local data and uploads. Prefer **GitHub source deployment**: it installs platform-compatible native dependencies and includes Prisma CLI/seed tooling. If using the runtime package, migrate/seed from a source checkout first and start its generated `server.js` directly. Keep environment variables in hPanel. Do not upload private `.env` or overwrite persistent uploads. A locally prepared build is not proof of publication on Hostinger.


## Release checks and dependency decisions

See [RELEASE_WORKFLOW.md](docs/RELEASE_WORKFLOW.md) for automated GitHub checks, separate staging setup, release promotion, customer acceptance tests, backups and rollback. `npm run check:deployment -- --url https://alabbasacademy.com --environment production --require-email` performs read-only public release checks. Hostinger branch protection, staging deployment and monitoring are account settings; committing the workflow does not configure them.

See [HOSTINGER_VALIDATION.md](docs/HOSTINGER_VALIDATION.md) for the full requirement checklist, actual test counts, runtime package checks and external launch prerequisites. Production audit reports zero findings. Patched Nodemailer/MariaDB/MySQL2/deepmerge versions are pinned with targeted overrides; Auth.js's optional email peer range still names older Nodemailer versions, while this application uses its own tested SMTP delivery rather than Auth.js email-provider delivery. Credentials/Google ownership and database tests pass with the patched dependency set. Five remaining development-only audit findings are the unpatched ESLint braces chain; they are excluded from the standalone runtime. Do not run `npm audit fix --force` to downgrade the framework.

Local mobile Lighthouse measured 92 performance, 100 accessibility and 100 best practices. The final customer host still needs its own performance/SEO report; 95+ performance is a target, not a verified claim.


## Hostinger repository-import warning

GitHub's repository default branch was still `hostinger`, whose PHP files have no `package.json`. If the import screen reports a missing package file, open GitHub repository Settings → General → Default branch and change the default to **platform**, then refresh/reselect the repository in Hostinger. Keep the existing PHP deployment's explicit `hostinger` branch unchanged. Do not choose **Deploy as static**: the accounts, database, checkout, protected learning and administrator features require Node.

Recommended application root remains **platform**, branch **platform**. The repository root now also contains a tested Node bootstrap: root `npm ci` installs the locked platform dependencies, root `npm run build` builds Next, and root `npm start` / `server.js` starts the full platform. Thus root `.` is also supported if the importer cannot select a subdirectory. There is no need to move the app into `public_html`. The old local demonstration is kept as `legacy-server.cjs` with `start:legacy` / `test:legacy`; it is never the default production entry point.
