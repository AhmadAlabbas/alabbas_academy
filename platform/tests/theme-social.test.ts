import {runInNewContext} from 'node:vm';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {themeInitializationScript} from '@/lib/theme';
import {socialLink} from '@/lib/social';
import {SocialLinks} from '@/components/layout/social-links';

describe('Theme preference before the first paint', () => {
  it.each([
    ['dark', false, 'dark'],
    ['light', true, 'light'],
    [null, true, 'dark'],
    [null, false, 'light'],
    ['invalid', true, 'dark'],
  ])('uses saved %s with system dark=%s as %s', (saved, systemDark, expected) => {
    const dataset: Record<string, string> = {};
    runInNewContext(themeInitializationScript, {
      localStorage: {getItem: () => saved},
      document: {documentElement: {dataset}},
      window: {matchMedia: () => ({matches: systemDark})},
    });
    expect(dataset.theme).toBe(expected);
  });

  it('still renders the system theme when browser storage is blocked', () => {
    const dataset: Record<string, string> = {};
    runInNewContext(themeInitializationScript, {
      get localStorage() { throw new Error('Storage blocked'); },
      document: {documentElement: {dataset}},
      window: {matchMedia: () => ({matches: true})},
    });
    expect(dataset.theme).toBe('dark');
  });
});

describe('Social links supplied later', () => {
  it('shows four accessible icons without fake links when URLs are absent', () => {
    const html = renderToStaticMarkup(createElement(SocialLinks, {settings: {}, heading: 'Follow us', comingSoon: 'Link coming soon'}));
    expect(html.match(/role="img"/g)).toHaveLength(4);
    expect(html).not.toContain('href=');
    for (const platform of ['Instagram', 'X', 'YouTube', 'LinkedIn']) expect(html).toContain(platform + ' — Link coming soon');
  });
  it('activates configured profiles as safe external links', () => {
    const html = renderToStaticMarkup(createElement(SocialLinks, {settings: {youtube: 'https://youtube.com/@academy', x: 'javascript:alert(1)'}, heading: 'Follow us', comingSoon: 'Soon'}));
    expect(html).toContain('href="https://youtube.com/@academy"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).not.toContain('javascript:');
    expect(html.match(/role="img"/g)).toHaveLength(3);
  });
  it('accepts HTTPS profiles including paths and query parameters', () => {
    expect(socialLink('https://www.youtube.com/@academy?view=featured')).toBe('https://www.youtube.com/@academy?view=featured');
  });
  it.each(['', ' ', undefined, null, 42, 'javascript:alert(1)', 'data:text/html,test', 'http://example.com', '//example.com', 'https://user:password@example.com', 'invalid'])('renders %j as an unlinked placeholder', (value) => {
    expect(socialLink(value)).toBeUndefined();
  });
});
