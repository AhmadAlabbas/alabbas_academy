import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {
  output: 'standalone',
  agentRules: false,
  poweredByHeader: false,
  // Resolve metadata before streaming, including missing-page status codes.
  htmlLimitedBots: /.*/,
  images: {formats: ['image/avif', 'image/webp']},
  logging: {incomingRequests: {ignore: [/^\/(ar|en)\/(verify-email|reset-password)([/?]|$)/]}},
  experimental: {cpus: 4, globalNotFound: true},
  async headers() {
    return [{source: '/(.*)', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'X-Frame-Options', value: 'SAMEORIGIN'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
    ]}, {source: '/:locale(ar|en)/:action(verify-email|reset-password)', headers: [
      {key: 'Referrer-Policy', value: 'no-referrer'},
      {key: 'Cache-Control', value: 'private, no-store'},
    ]}];
  },
};
export default createNextIntlPlugin('./src/i18n/request.ts')(config);
