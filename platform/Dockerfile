# Build from platform/: docker build -t alabbas-platform .
FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
# Optional corporate/cloud proxy CA is supplied with BuildKit --secret; it is
# available only to this build step and is never baked into the runtime image.
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    NODE_USE_ENV_PROXY=1 npm ci --foreground-scripts

FROM base AS builder
ARG NEXT_PUBLIC_APP_URL=https://alabbasacademy.com
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Prisma reads a URL while generating its client. These compile-only credentials
# do not connect to a database and are not retained in the runtime image.
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    NODE_USE_ENV_PROXY=1 DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" npm run db:generate
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    NODE_USE_ENV_PROXY=1 DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3001
# This checks the web process; database connectivity is validated separately.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/ar').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1));"
CMD ["node", "server.js"]
