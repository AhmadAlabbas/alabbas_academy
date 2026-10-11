# Activate accounts on Vercel

These steps use browser dashboards. No repository download is required. They activate signup, login, verification, recovery and saved carts; payment and the full dashboard remain future work.

Keep the current Hostinger PHP website and its `hostinger` deployment branch. Use Vercel's generated `*.vercel.app` address for testing; do not change the academy domain's DNS yet.

## 1. Select the Vercel application

Open the academy project in Vercel:

1. In **Settings → Git**, set **Production Branch** to `platform`.
2. In **Settings → Build and Deployment**, set **Root Directory** to `platform`, **Framework Preset** to **Next.js**, and **Node.js Version** to **24.x**. Keep framework build/output defaults.
3. Open the latest production deployment and copy the stable project address from **Domains**, such as your `https://…vercel.app` address. Use that HTTPS origin below with no path or query string.

A project using `hostinger` and framework **Other** will not run this application correctly. Selecting Vercel's production branch does not change Hostinger's deployment branch.

## 2. Create PostgreSQL

In Vercel, open **Storage → Create Database** and select a PostgreSQL provider such as **Neon** from the marketplace. Connect it to the project. Alternatively create a Neon project directly and copy its connection settings privately. Hostinger MySQL cannot be used for this platform.

In the database dashboard, open **Connect**. Use the provider's supported SSL connection and retain:

- The runtime PostgreSQL connection string for Vercel's `DATABASE_URL`; a provider-supported pooled connection suits serverless requests.
- A direct/unpooled connection string to the same database for migrations. The optional GitHub release workflow stores this as its private repository secret `DATABASE_URL`.

Keep full connection strings out of source files, public variables, issues and chat. If the Vercel integration creates other variable names, still add `DATABASE_URL`; the application reads that exact name.

## 3. Configure verification email

In your [Resend dashboard](https://resend.com/domains):

1. Add a sending domain you control, such as a mail subdomain of the academy domain.
2. Add the verification DNS records Resend displays in the provider currently managing your DNS, then wait for the domain to show **Verified**. Preserve existing website/mail records.
3. Create a sending API key in **API Keys** and store it privately as `RESEND_API_KEY` in Vercel.
4. Choose a sender on the verified domain and store it as `EMAIL_FROM`, for example `Alabbas Academy <accounts@your-verified-domain>`.

Resend's test sender is restricted and cannot replace a verified sender for arbitrary learners. A mailbox is not required merely to send through Resend; domain verification is required.

## 4. Add Vercel environment variables

Open **Settings → Environment Variables** and add these for **Production**. Use **Sensitive** where available for secrets. Give preview deployments separate test services and a matching origin.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Full PostgreSQL runtime connection string |
| `AUTH_SECRET` | Private random secret of at least 32 characters |
| `AUTH_URL` | Stable HTTPS project origin from step 1 |
| `NEXT_PUBLIC_APP_URL` | The same origin as `AUTH_URL`; this value is public |
| `EMAIL_TRANSPORT` | `resend` |
| `RESEND_API_KEY` | Resend sending API key |
| `EMAIL_FROM` | Sender on the verified domain |
| `JOB_WORKER_SECRET` | A different private random secret of at least 32 characters |

Use a password manager's random generator for the two secrets and retain them securely. Keep `AUTH_SECRET` stable: rotation signs users out and prevents delivery of older encrypted email jobs. Leave admin seed, payment, video and storage placeholders unset for this release.

Google is optional. Create a Google OAuth web client with authorized redirect URI `https://YOUR-PROJECT-ORIGIN/api/auth/callback/google`, configure its consent screen for the intended users, and add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` privately. Linking an existing password account requires a recent verified password login for that same email.

Environment edits affect new deployments. After migrations are ready, open **Deployments**, choose the latest `platform` deployment and select **Redeploy**.

## 5. Apply migrations once

The account tables must exist before signup works. The optional browser-operated [Platform database release workflow](../../.github/workflows/platform-database.yml) applies migrations and optionally seeds demonstration courses. It never runs automatically on pushes.

To use it:

1. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**. Name it `DATABASE_URL` and privately paste the direct/unpooled connection string.
2. Open **Actions → Platform database release → Run workflow** and select branch `platform`. For a new empty database, enable **Add demonstration courses** once so account carts resolve the samples; otherwise leave it disabled unless demo data is wanted.
3. Wait for successful completion, then redeploy Vercel. A skipped run means the selected branch was not `platform`. Investigate any failed step before retrying. Back up an existing database before releasing migrations.

GitHub only lists manual workflows present on its default branch. If this workflow is absent from **Actions** because the default is still `hostinger`, a release maintainer can make the workflow available on the default branch, or you can change GitHub's default branch to `platform` in repository **Settings**. Preserve Hostinger's explicit `hostinger` deployment selection; changing GitHub's default alone does not select a Hostinger deployment branch. No repository setting is changed by adding this workflow.

A maintainer can instead run `npm ci`, `npm run db:generate`, `npm run db:deploy`, and optionally `npm run db:seed` from `platform/` against the target database. Migrations are a separate release step, not part of a Vercel build or server startup. Demo seeding preserves existing course edits and does not create a default administrator.

## 6. Schedule email retries and account cleanup

Account requests attempt delivery after responding. For interrupted/failed deliveries, configure a scheduler supporting authenticated POST:

- URL: the stable project origin followed by `/api/jobs/email`.
- Method: `POST`.
- Private header: `Authorization: Bearer ` followed by `JOB_WORKER_SECRET`.
- Interval: approximately once per minute, within hosting/scheduler limits.

Keep the header private; never put the worker key in a URL. Each request delivers a bounded batch with persisted retries. Vercel native cron sends GET and does not invoke this endpoint. A trusted Node host can instead run `npm run email:work` with the same private configuration.

Add a second authenticated **POST** schedule for `/api/jobs/account-maintenance`, using the same private header, approximately once per hour. This endpoint removes at most 500 records from each account table per run. It retains rate-limit windows until one day after expiry, verification/recovery tokens and session anchors until seven days after expiry, and completed account-email receipts for thirty days. Active credentials, pending/running email jobs and other kinds of jobs are retained. Revoked sessions and consumed tokens are removed after their expiry and retention period, so cleanup does not weaken revocation or token reuse checks.

Responses contain deletion counts only. If a table repeatedly reports 500 removals, increase the schedule frequency to catch up within provider limits. An unavailable response requires investigation rather than assuming cleanup completed. A trusted Node host can instead run `npm run auth:cleanup`. Neither scheduled job runs automatically merely because the code was deployed.

## 7. Verify live behavior

Open the stable Vercel address:

1. Visit `/en/signup` or `/ar/signup`, use an email you control and a password of at least 12 characters, and create a test learner.
2. Open the verification email and press the verification button. Login and account settings should show verification.
3. Add a course while logged out, log in and open the cart. Sign out and back in to check that the saved account cart returns.
4. Use **Forgot password**, follow its email and change the password. Confirm the previous password no longer works.
5. Check Arabic/English navigation on a phone-sized screen.

For an unavailable-service message, check exact variable names, Resend sender verification, successful migrations and redeployment after editing settings. A successful build alone does not prove signup or delivery works.

With the Git integration connected, future pushes to Vercel's configured `platform` branch trigger deployment. Schema changes still need migrations. The Hostinger site continues through its separate PHP deployment until the planned data migration and domain cutover.
