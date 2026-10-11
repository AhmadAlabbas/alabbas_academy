import {afterEach, describe, expect, it, vi} from 'vitest';
import robots from '@/app/robots';
import configuration from '../next.config';

afterEach(() => vi.unstubAllEnvs());

describe('Staging search isolation', () => {
  it('blocks all crawling and removes the sitemap on staging', () => {
    vi.stubEnv('ACADEMY_ENVIRONMENT', 'staging');
    expect(robots()).toEqual({rules: {userAgent: '*', disallow: '/'}});
  });

  it('adds a noindex response header covering every staging route', async () => {
    vi.stubEnv('ACADEMY_ENVIRONMENT', 'staging');
    const headers = await configuration.headers!();
    expect(headers.find(rule => rule.source === '/(.*)')?.headers).toContainEqual({
      key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive',
    });
  });

  it.each(['production', undefined])('preserves public SEO and private crawl exclusions in %s', async environment => {
    vi.stubEnv('ACADEMY_ENVIRONMENT', environment);
    const result = robots();
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
    expect(result.rules).toMatchObject({allow: '/', disallow: expect.arrayContaining(['/api/', '/ar/admin', '/en/account'])});
    const headers = await configuration.headers!();
    expect(headers.flatMap(rule => rule.headers).find(header => header.key === 'X-Robots-Tag')).toBeUndefined();
  });
});
