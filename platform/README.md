# Alabbas Academy platform

This directory contains Phase 1 of the new Alabbas Academy application: an Arabic-first, bilingual Next.js foundation, the logo-inspired design system, sample course pages, a PostgreSQL schema and seed, and development/deployment tooling. English pages use `/en`; Arabic pages use `/ar` and right-to-left layout. Prices use Saudi riyals (SAR).

The existing PHP/MySQL site remains in `deploy/hostinger/`. This application requires a Node.js runtime and PostgreSQL; a PHP-only Hostinger plan cannot run it. Hostinger VPS or another Node.js service can host the new application. Phase 1 does not replace the live domain or migrate existing accounts. Authentication, payments, protected learning, and a functional administration dashboard are scheduled for later phases; do not treat sample catalog pages as a functioning checkout or account system.

## Local development

Use the existing repository checkout. Cloud tasks are already isolated; do not create a Git worktree unless the user explicitly requests one. Run the commands below from `platform/`.

Required tools: Node.js 24 LTS (Node.js 22.18+ is also supported), npm, and PostgreSQL 17. Docker Compose is the convenient local database option. Use the committed npm lockfile for repeatable installs.

```sh
cd /workspace/alabbas_academy/platform
npm ci
cp .env.example .env
npm run db:start
```

On another machine, replace the absolute `cd` path with the location of this checkout. Preserve an existing `.env` file instead of overwriting it. `compose.yaml` binds the development database to `127.0.0.1:5560`; its sample credentials are for local development only. Confirm that the database is healthy before applying migrations:

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

The development server listens on port **3001**. Sample catalog rendering does not require a live database, but migrations and the seed verify the persistence workflow. Seeding is optional when using an existing database. The seed is repeatable and populates demonstration records; it does not turn on payment processing or create a production administrator with a fixed password.

If Docker is unavailable, use an existing local PostgreSQL server and set `DATABASE_URL` privately in `.env`; then run the same generation, migration, seed, and server commands. Do not use the development database credentials in production. Keep `.env` out of Git and do not place database passwords in `NEXT_PUBLIC_` variables.

## Validation

Required checks for Phase 1:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

After starting the application, check both localized pages and a course detail route. A successful build alone does not verify running pages or database connectivity. `npm run start` copies the public and static assets into the generated standalone directory and runs its supported Next.js server on loopback port 3001. Set `ACADEMY_HOST=0.0.0.0` when the host requires an externally reachable listener. Browser accessibility, responsive behavior, and the catalog/detail navigation are part of the Phase 1 acceptance checks; production Lighthouse scores are assessed during the launch phase.

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

## Environment variables and later phases

`.env.example` describes the local database and public origin plus empty placeholders for Auth.js, Google OAuth, Resend, Moyasar, Bunny Stream, private storage, and jobs. Empty integration placeholders are intentional in Phase 1 and do not establish that those integrations work. Authentication, payment, email, and video secrets will be required and validated when their phases are implemented. Generate separate random secrets in secure environment settings; never reuse keys from chat or commit real credentials.

Read [the architecture](docs/ARCHITECTURE.md) for implementation boundaries and [the delivery phases](docs/PHASES.md) for the current scope and remaining work.
