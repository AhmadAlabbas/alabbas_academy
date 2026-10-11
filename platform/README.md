# Alabbas Academy platform

This directory contains the new Alabbas Academy application: an Arabic-first, bilingual Next.js site with logo-inspired course cards, email/password accounts, email verification and recovery, account settings, and persistent course carts. English pages use `/en`; Arabic pages use `/ar` and right-to-left layout. Prices use Saudi riyals (SAR).

The existing PHP/MySQL site remains in `deploy/hostinger/` and on the `hostinger` branch. This application requires Node.js and PostgreSQL; the existing MySQL database is not compatible. Vercel can deploy the `platform` branch with root directory `platform`. Accounts need a configured PostgreSQL database and email service. Checkout/payment, protected lessons and exams, and the full administration dashboard remain later phases. Existing accounts and the live Hostinger domain are not migrated automatically.

For a live Vercel project, follow [the browser setup steps](docs/VERCEL_SETUP.md). They cover the database, verification emails, environment variables, migrations and a signup check without downloading this repository.

## Local development

Use the existing repository checkout. Cloud tasks are already isolated; do not create a Git worktree unless the user explicitly requests one. Run the commands below from `platform/`.

Required tools: Node.js 24 LTS (Node.js 22.18+ is also supported), npm, and PostgreSQL 17. Docker Compose is the convenient local database option. Use the committed npm lockfile for repeatable installs.

```sh
cd /workspace/alabbas_academy/platform
npm ci
cp .env.example .env
npm run db:start
```

On another machine, replace the absolute `cd` path with the location of this checkout. Preserve an existing `.env` file instead of overwriting it. In that private file, set separate random `AUTH_SECRET` and `JOB_WORKER_SECRET` values of at least 32 characters, and set `EMAIL_TRANSPORT="outbox"` for local account testing. Resend and Google credentials are optional in this development mode. `compose.yaml` binds the development database to `127.0.0.1:5560`; its sample credentials are for local development only. Confirm that the database is healthy before applying migrations:

```sh
docker compose ps db
docker compose exec -T db pg_isready -U academy -d academy
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

On this cloud runner, Prisma's native migration engine download is blocked by the egress policy. Use `npm run db:migrate:wasm` in place of `npm run db:migrate`; it deploys the same committed migrations through the version-pinned official Prisma WASM engine, preserving migration history, checksums, and locking. Client generation and the application build work normally. See [database instructions](docs/DATABASE.md) for the fallback's validation and limitations.

The npm override pins the `next-intl` SWC dependency to compatible `1.16.0`. Newer `1.16` native carriers reject this runner's filesystem ancestry; the pinned official registry artifact loads without changing checksum or TLS verification. The lockfile records package integrity.

The development server listens on port **3001**. Public sample pages can render without the account services; missing configuration produces an unavailable-service message instead of a fake successful signup. Account mutations and saved account carts require the migrated database. Seeding a fresh database adds the demonstration courses used by account carts. The repeatable seed preserves existing course edits and does not turn on payments or create an administrator with a fixed password.

In outbox mode, account messages are written privately to the ignored `.local/mail/outbox/` directory. Only inspect links for your local test accounts; these files contain single-use credentials. Account requests attempt queued delivery after responding. Run `npm run email:work` to process pending mail manually. Production rejects outbox mode and requires a real Resend sender.

If Docker is unavailable, use an existing local PostgreSQL server and set `DATABASE_URL` privately in `.env`; then run the same generation, migration, seed, and server commands. Do not use the development database credentials in production. Keep `.env` out of Git and do not place database passwords in `NEXT_PUBLIC_` variables.

## Validation

Required checks for the implemented foundation, account and cart work:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

After startup, check both locales, registration, login, verification, recovery, account settings and guest-to-account cart persistence. Database suites require their explicit local test-database variables; skipped integration tests are not a database readiness check. See validation reports in `docs/` for recorded outcomes. `npm run start` copies public/static assets into the standalone directory and runs its supported Next.js server on loopback port 3001. Set `ACADEMY_HOST=0.0.0.0` when the host requires an externally reachable listener. Production Lighthouse scores are assessed during the launch phase.

The project enables Next.js's experimental `globalNotFound` option to render complete Arabic or English 404 documents for the dynamic locale root layout. The current static demonstration course route uses `dynamicParams=false`, so an unknown course slug also reaches the localized router-level 404. Verify HTTP status, raw `lang`/`dir`, translated content, and `noindex` when upgrading Next.js. Database-backed catalog implementation in Phase 3 will revisit this static routing choice.

## Container deployment

Build the standalone application from this directory. The only build argument shown here is a public origin, not a secret:

```sh
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://alabbasacademy.com \
  -t alabbas-platform .
```

`NEXT_PUBLIC_` values can be embedded in browser bundles. Rebuild when the public origin changes. `.dockerignore` excludes local environment files. The image runs as a non-root user on port 3001 and does not seed or migrate a database on startup. Its health check requests `/ar` to check the web process, independently of database readiness.

For this cloud runner, Docker builds need the existing injected proxy and trusted CA. BuildKit's DNS also needs the proxy hostname mapped to its host-resolved address. The following build uses those existing settings; it does not disable TLS verification or store the proxy/CA in the runtime image:

```sh
mkdir -p /tmp/alabbas-platform-docker-config
academy_proxy_host="$(node --input-type=module -e 'console.log(new URL(process.env.HTTPS_PROXY).hostname)')"
academy_proxy_ip="$(getent ahostsv4 "$academy_proxy_host" | awk 'NR==1{print $1}')"
test -n "$academy_proxy_ip"
DOCKER_CONFIG=/tmp/alabbas-platform-docker-config docker build \
  --build-arg HTTP_PROXY --build-arg HTTPS_PROXY --build-arg NO_PROXY \
  --add-host "${academy_proxy_host}:${academy_proxy_ip}" \
  --secret "id=build_ca,src=$NODE_EXTRA_CA_CERTS" \
  --build-arg NEXT_PUBLIC_APP_URL=https://alabbasacademy.com \
  -t alabbas-platform .
```

The CA secret is optional for builders that do not use an intercepting proxy. The Dockerfile enables Node's environment-proxy support only during build commands. Using the temporary `DOCKER_CONFIG` directory also avoids writing Docker's build cache settings under this runner's read-only home directory.

Before a release, back up the target database, set the real `DATABASE_URL` through the deployment environment, and apply committed migrations from a full checkout with the development toolchain installed:

```sh
npm ci
npm run db:generate
npm run db:deploy
```

Run this migration step as a separate release job, once per release, rather than in each replica. The standalone runtime image intentionally excludes the Prisma CLI. Provide secrets only at runtime through the host's secret manager or a protected environment file outside the repository:

```sh
docker run --detach \
  --name alabbas-platform \
  --env-file /secure/path/alabbas-runtime.env \
  --publish 127.0.0.1:3001:3001 \
  alabbas-platform
```

Put an HTTPS reverse proxy in front of the loopback port. Set `DATABASE_URL` to the production PostgreSQL connection; `localhost` inside the application container points to that container, not the database host. Use a private database network and the provider's supported TLS configuration. Do not substitute MySQL credentials: this platform's schema and Prisma adapter require PostgreSQL.

## Account configuration and remaining integrations

`.env.example` distinguishes implemented account/email settings from future Moyasar, Bunny Stream and private-storage settings. Accounts require `DATABASE_URL`, `AUTH_SECRET` and an allowed application origin. Production verification and recovery require `RESEND_API_KEY`, `EMAIL_FROM` and an HTTPS `AUTH_URL`. Use identical `AUTH_URL` and `NEXT_PUBLIC_APP_URL` values for the deployed project. Google sign-in is optional; its button appears only when both Google credentials are configured.

Auth.js is pinned to `5.0.0-beta.32` for the asynchronous Next.js 16 integration. Rerun account/session tests before upgrading. Credentials use Argon2id hashes and database-checked session revocation. Linking Google to an existing account requires a recent verified password session for that same email.

Queued email uses authenticated encryption with a key derived from `AUTH_SECRET`. Keep it stable between deploys; rotation invalidates sessions and prevents delivery of older queued messages. The authenticated `POST /api/jobs/email` endpoint retries pending mail with a scheduler supporting POST and an `Authorization` header. Vercel's native cron GET requests do not call this worker. See [Vercel setup](docs/VERCEL_SETUP.md).

Payment and private-video placeholders remain unused until those implementations. Generate separate random secrets in secure settings and keep real values outside Git and chat. Public `NEXT_PUBLIC_` variables must never contain credentials.

Read [the architecture](docs/ARCHITECTURE.md) for implementation boundaries and [the delivery phases](docs/PHASES.md) for the current scope and remaining work.
