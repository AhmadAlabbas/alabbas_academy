import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";
const applicationRoot = fileURLToPath(new URL(".", import.meta.url));
const config: NextConfig = {
  outputFileTracingRoot: applicationRoot,
  turbopack: { root: applicationRoot },
  output: "standalone",
  // PDFKit resolves its standard fonts relative to its own package at runtime.
  // Bundling its ESM entry bakes in the build machine's import.meta.url, which
  // is unavailable after moving standalone output to Hostinger.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingExcludes: {
    "*": [".env*", ".local/**", "docs/archive/**", "tests/**"],
  },
  outputFileTracingIncludes: {
    "/api/og": [
      "./node_modules/@fontsource/ibm-plex-sans-arabic/files/*600-normal.woff",
    ],
    "/api/certificates/*": [
      "./node_modules/@fontsource/ibm-plex-sans-arabic/files/*400-normal.woff",
      "./node_modules/pdfkit/js/data/**",
      "./node_modules/pdfkit/js/standard-fonts/*.cjs",
      "./node_modules/@fontsource/ibm-plex-sans-arabic/files/*600-normal.woff",
    ],
  },
  agentRules: false,
  poweredByHeader: false,
  // Resolve metadata before streaming, including missing-page status codes.
  htmlLimitedBots: /.*/,
  images: { formats: ["image/avif", "image/webp"] },
  logging: {
    incomingRequests: {
      ignore: [/^\/(ar|en)\/(verify-email|reset-password)([/?]|$)/],
    },
  },
  experimental: { cpus: 4, globalNotFound: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self' https://api.moyasar.com; frame-src https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https:",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/:locale(ar|en)/:action(verify-email|reset-password)",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};
export default createNextIntlPlugin("./src/i18n/request.ts")(config);
