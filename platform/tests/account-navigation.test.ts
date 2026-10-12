import {describe, expect, it} from 'vitest';
import {languageDestination} from '@/components/layout/language-destination';
import {safeAccountReturnPath} from '@/components/account/return-path';

const courseSlugs = [{ar: 'أساسيات-التصميم', en: 'visual-design'}];
const destination = (pathname: string, search = '', hash = '') => languageDestination({pathname, search, hash, locale: 'ar', nextLocale: 'en', courseSlugs});

describe('Changing account language without losing the requested destination', () => {
  it.each(['login', 'signup'])('keeps a cart return after switching %s language', (route) => {
    const next = destination(`/${route}`, '?callbackUrl=%2Far%2Fcart');
    const query = new URL(next, 'https://academy.example').searchParams;
    expect(next.split('?')[0]).toBe(`/${route}`);
    expect(safeAccountReturnPath(query.get('callbackUrl'), 'en')).toBe('/en/cart');
  });

  it('maps course returns to the corresponding translated slug and preserves the section', () => {
    const query = new URLSearchParams({returnTo: '/ar/courses/أساسيات-التصميم#curriculum'});
    const next = destination('/login', query.toString());
    expect(new URL(next, 'https://academy.example').searchParams.get('returnTo')).toBe('/en/courses/visual-design#curriculum');
  });

  it('keeps a verification/reset token and the current hash while switching language', () => {
    for (const path of ['/verify-email', '/reset-password']) {
      const next = destination(path, '?token=synthetic-token', '#form');
      const parsed = new URL(next, 'https://academy.example');
      expect(parsed.pathname).toBe(path);
      expect(parsed.searchParams.get('token')).toBe('synthetic-token');
      expect(parsed.hash).toBe('#form');
    }
  });

  it.each(['https://attacker.example', '//attacker.example', '/ar/../api/account/me', '/ar/%2e%2e/private', '/ar/login', '/en/cart'])('replaces an unsafe or mismatched callback %s with the new account page', (callbackUrl) => {
    const next = destination('/login', new URLSearchParams({callbackUrl}).toString());
    expect(new URL(next, 'https://academy.example').searchParams.get('callbackUrl')).toBe('/en/account');
  });

  it('rejects ambiguous repeated callback values', () => {
    const next = destination('/login', '?callbackUrl=%2Far%2Fcart&callbackUrl=https%3A%2F%2Fattacker.example');
    expect(new URL(next, 'https://academy.example').searchParams.getAll('callbackUrl')).toEqual(['/en/account']);
  });

  it.each(['%', '%2', '%GG', '%E0%A4%A', 'unknown-course'])('falls back safely for an invalid course slug %s', (slug) => {
    expect(destination(`/courses/${slug}`)).toBe('/');
  });

  it('handles a once-encoded Arabic course slug and the reverse language change', () => {
    expect(destination(`/courses/${encodeURIComponent(courseSlugs[0].ar)}`)).toBe('/courses/visual-design');
    const reverse = languageDestination({pathname: '/login', search: '?callbackUrl=%2Fen%2Fcart', hash: '', locale: 'en', nextLocale: 'ar', courseSlugs});
    expect(new URL(reverse, 'https://academy.example').searchParams.get('callbackUrl')).toBe('/ar/cart');
  });
});

describe('Language switching inside learning and administration', () => {
  it.each(['/my-courses', '/learn/course/lesson', '/admin/courses', '/orders/order'])('keeps the current page %s', pathname => {
    expect(destination(pathname)).toBe(pathname);
  });
  it('returns to the catalog when the course has no translated version', () => {
    expect(languageDestination({pathname: '/courses/only-english', search: '', hash: '', locale: 'en', nextLocale: 'ar', courseSlugs: [{ar: '', en: 'only-english'}]})).toBe('/courses');
  });
});
