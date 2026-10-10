import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {
  output: 'standalone',
  agentRules: false,
  poweredByHeader: false,
  // Resolve metadata before streaming, including missing-page status codes.
  htmlLimitedBots: /.*/,
  images: {formats: ['image/avif', 'image/webp']},
  experimental: {cpus: 4, globalNotFound: true},
  async headers() {
    return [{source: '/(.*)', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'X-Frame-Options', value: 'SAMEORIGIN'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
    ]}];
  },
};
export default createNextIntlPlugin('./src/i18n/request.ts')(config);
