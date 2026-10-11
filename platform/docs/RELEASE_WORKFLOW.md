# Testing and releasing Alabbas Academy

This is the operating guide for the Node.js academy. Production is `https://alabbasacademy.com`, GitHub branch `platform`, app root `platform`. The historical `hostinger` branch belongs to the separate PHP site. Do not deploy that branch to the Node app.

## What is automated

GitHub **Actions → Platform checks → Release validation** runs on changes to `platform` or `staging`, and pull requests targeting either branch. It uses Node 22.18.0, a disposable MariaDB service, randomly generated test secrets, and reserved `example.test` email addresses. It has no production database, SMTP or payment credentials.

The workflow intentionally has no file-path filter. When a check is required by branch protection, even a pull request editing only a root README must report its status; skipping the entire workflow would leave that pull request waiting for a check that cannot run.

The workflow checks lint, unit tests, all database integration suites in a temporary database, official migrations, demo seed, production dependency audit, a production build/type check, three Hostinger startup modes, relocated certificate PDFs, and bilingual desktop/mobile browser checks. Browser checks also author a real course through the administrator forms, upload files, build an exam, enroll a learner and complete it through certificate download. It then builds with the staging setting and checks staging search isolation. Browser screenshots are retained for seven days. Playwright is installed outside the application; customers do not receive browser test tooling.

These checks do not apply production migrations, send customer mail, charge a card or deploy Hostinger. The separate existing **Platform database release** workflow is not needed for this Hostinger database: GitHub's hosted runner cannot connect to Hostinger's `localhost` database. Apply migrations over the existing private SSH connection instead.

**A green check cannot stop an already enabled Hostinger auto-deployment.** To make testing a release gate, protect `platform` in GitHub and require the **Release validation** check before merge. If the repository/plan exposes rulesets or branch protection, also require a pull request and block force pushes; confirm these settings allow your intended maintainer to merge. These are account settings and are not enabled by committing this file. Until they are configured, use Hostinger's manual deployment after checks pass. During this transition, a direct push to the current production branch can still start auto-deployment.

For this public repository, open **Settings → Branches → Add classic branch protection rule** (or the equivalent branch ruleset). Use branch pattern `platform`, require a pull request, require status checks, select **Release validation**, and require the branch to be up to date before merging. Leave required reviewer approvals off if you are the only maintainer, since you cannot approve your own pull request. Disable force pushes/deletions, and apply the rule to administrators by enabling **Do not allow bypassing the above settings** where offered. Save the rule. Protect `staging` similarly when you are ready to require checks before deploying tests there. Confirm the selected required check belongs to **GitHub Actions**, if the interface asks for its source. These settings have to be saved in the authenticated GitHub account.

## One-time staging setup

Create a **separate** Hostinger Node.js Web App. Keep the existing customer app/domain in place. Use an available temporary HTTPS domain or a staging subdomain you attach through hPanel; do not change the customer domain's DNS to staging.

| Hostinger field | Staging value |
|---|---|
| Repository | `AhmadAlabbas/alabbas_academy` |
| Branch | `staging` |
| Root directory | `platform` |
| Framework | Other / Node.js, as offered by hPanel |
| Node | 22.18 or later supported 22.x |
| Build command | `npm run build` |
| Entry point | `server.js` |
| Port | Hostinger's injected port |

Create a dedicated MySQL database and user for staging. Do not point staging at `u260732541_academyapp`. Give it a separate private upload directory outside its deployment versions, such as `/home/YOUR_USER/academy-staging-uploads`, and a newly generated staging `AUTH_SECRET`. Never reuse production sessions, customer records, mailbox passwords or payment keys in tests.

Enter these variables in the staging app's private environment settings, before both its build and its startup:

| Variable | Value |
|---|---|
| `ACADEMY_ENVIRONMENT` | `staging` |
| `NEXT_PUBLIC_APP_URL` | The staging HTTPS origin, with no path |
| `AUTH_URL` | That same staging origin |
| `DATABASE_URL` | Its dedicated private MySQL URL |
| `AUTH_SECRET` | A new staging secret of at least 32 random characters |
| `UPLOAD_DIR` | The absolute staging upload path |
| `PAYMENTS_ENABLED` | `false` |

Production leaves `ACADEMY_ENVIRONMENT` absent or sets it to `production`. Staging serves `X-Robots-Tag: noindex, nofollow, noarchive` for every route and its robots file disallows all crawling without advertising a sitemap. Rebuild after changing this variable: Next stores configured response headers in the build. **Search exclusion is not password protection.** If your hosting setup offers access protection, enable it for staging; use fake content and test accounts either way.

From the staging app's source directory, with its private environment loaded, apply `npm run db:deploy` and seed it with staging-only `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Use the existing Node SSH PATH setup if necessary. Keep demo courses unpublished on the customer site until real content is ready. Staging needs its own SMTP/test mailbox to exercise actual signup/verification/recovery; otherwise these actions correctly report an unavailable service. Run delivery tests only to inboxes you control. For a later gateway acceptance test, use only provider-issued test keys and the staging webhook origin; this guide leaves the gateway off.

Account access is required to create this app, its database and environment bindings. A prepared branch/document is not a deployed staging website.

## Every release

1. Develop on a short-lived branch; open a pull request into `staging`. Let **Release validation** finish. Inspect failed checks and browser screenshots before merging.
2. Deploy that tested staging commit. Confirm the exact source commit in Hostinger, not just “Completed”. If a schema change is included, apply its committed migrations to staging over SSH. Run the read-only check below and the customer journey in the next section.
3. Review the staging changes and open a pull request from `staging` into `platform`. The release checks run again on the proposed merge. Avoid unrelated edits during promotion.
4. Before a production migration/release, take the backup described below. Confirm production URLs, persistent uploads, the existing `AUTH_SECRET`, and the intended payment gate. Preserve existing secrets. If new schema is required, apply it over SSH with `npm run db:deploy` in the matching source directory, then deploy/start the matching code. Prefer additive migrations compatible with the previous release; plan any incompatible maintenance window before executing it. Do not run a seed on each customer deployment.
5. Merge after green checks, or use the tested commit with manual Hostinger deployment. Confirm branch `platform`, root `platform`, deployed commit, and runtime status.
6. Run the read-only production check and a real account/email/customer journey. Record the commit and result; keep the prior working deployment available. A successful build alone does not verify startup or customer features.

Public read-only checks can run from a development machine with Node installed:

```sh
cd platform
npm run check:deployment -- --url https://alabbasacademy.com --environment production --require-email
# Substitute the actual staging origin; this URL is an example, not a published site.
npm run check:deployment -- --url https://staging.example.com --environment staging --require-email
```

The command checks both languages, home/catalog/about/login/signup/cart, production styles, favicons, robots settings, missing-page HTTP status, database health, and optional mail configuration. It refuses credential-bearing URLs and sends only GET requests. Mail configuration does not prove inbox delivery. It does not authenticate as an administrator, grant enrollments, or test a real payment. A failed check exits with a nonzero status.

## Customer journey before selling

- On a phone and desktop, switch language/theme; use every hamburger link. Run a final physical-phone test, since Chromium touch emulation does not prove Safari behavior.
- Create a test student, receive verification email, verify, log out/back in, and receive/use a password reset. Confirm the links point at the environment being tested.
- Add/remove a course in the cart, check prices in SAR and discounts, create an order. Pending/manual orders must not grant access. For manual fulfillment, only mark paid after actual receipt; use a free test enrollment for learning-only tests.
- Watch a lesson, download a protected attachment, complete lessons, submit/pass a required exam, and download the completion PDF. Check that another learner and a logged-out visitor cannot download private files/certificates.
- Upload a file through the admin dashboard, redeploy, and download the same file again. This proves the configured upload directory survives deployment.
- Review real course/instructor content, permissions, contact/terms/privacy/refund policies and social URLs. Remove fictional testimonials or label them as samples. Confirm private paid videos are hosted appropriately.
- Before enabling online payments, complete an approved provider test-mode payment, webhook/return verification, duplicate-notification check and refund. Only then configure live keys and enable payments. Current pending-order mode is not an online card sale.

## Backups and rollback

Before a release, in Hostinger **Backups** (or its equivalent for this app), create/export a fresh MySQL backup and a backup of the **persistent upload directory**. Confirm the upload path is included; app-version backups may not include files stored outside the deployed directory. Keep an encrypted copy of the private environment settings, including the current `AUTH_SECRET`, in your password manager/secure backup. Store backups outside `public`, GitHub, and the web-served directories. Record the backup time and the previous deployed commit. Check available retention and automatic-backup coverage in your actual hPanel account.

Test restoration into a **separate disposable database and upload directory** before taking customers. Verify a known course, account login, attachment and certificate against that restored data. A backup has not been verified until it has been restored successfully. Never restore a test over the customer database.

For a code-only regression, select the previous working deployment/commit in Hostinger's deployment tools and redeploy it, preserving environment variables and uploads. If those tools cannot select a prior version, revert the faulty change in GitHub through a reviewed commit and deploy that commit. Run the public checks and affected journey again. Do not delete the current version or reset the production branch forcibly.

Code rollback does not undo database migrations. Prisma does not automatically reverse a deployed migration. If old code is compatible with the schema, roll back code only. Otherwise prepare a forward repair, or restore a matching database/upload backup during a planned maintenance window after accounting for orders and activity since that backup. Do not run destructive database resets on production.

## Watch the running site

Use a private uptime monitor or your host's monitoring features to request `https://alabbasacademy.com/api/health` periodically, and alert you when it returns a non-200 response. That checks database availability; it does not certify email delivery, checkout, or page rendering. Also monitor the public homepage and keep the read-only release check for full deployments. Review Hostinger runtime errors/resource usage and Admin → Email delivery after releases. Avoid logging password-reset links, tokens, credentials or customer payloads. This guide does not create an external monitoring subscription or enable hosting alerts.

## Reproduce the automation locally

Use a dedicated loopback MySQL/MariaDB database, Node 22.18+, and a private ignored `.env`. The database test user needs CREATE/DROP permission for temporary `academy_test_*` databases. The certificate/browser checks require a migrated and seeded local database passed privately as `ACADEMY_TEST_DATABASE_URL`.

```sh
npm ci
npm run db:generate
npm run lint
npm test
npm run test:database
npm run db:deploy
npm run db:seed
npm audit --omit=dev
npm run build
npm run typecheck
npm run test:hostinger
npm run test:certificates
npm run test:browser
```

For browser checks install Playwright 1.62.1 separately and its Chromium, then set `ACADEMY_PLAYWRIGHT_MODULE` to its module path when outside this package. Optional `ACADEMY_BROWSER_PATH` selects an installed Chromium; `ACADEMY_UI_ARTIFACT_DIR` saves screenshots. `test:browser` starts its own ephemeral local production server, runs the public check and theme/navigation suite, then stops only its own server and removes its temporary upload directory. Hosted databases are refused. Run a second build/check with `ACADEMY_ENVIRONMENT=staging` to exercise staging response headers, and rebuild with production settings afterward.
