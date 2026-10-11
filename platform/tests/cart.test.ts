import { describe, expect, it } from 'vitest';
import { MAX_CART_ITEMS, reconcileCart, sanitizeGuestIds, type CartCandidate } from '@/lib/cart/domain';
import { cartMutationSchema, cartRemovalSchema } from '@/lib/cart/schemas';
import { GUEST_CART_KEY, readGuestCart, writeGuestCart } from '@/lib/cart/storage';
import { MAX_HALALAS } from '@/lib/money';

function course(courseId: string, priceHalalas = 12_345, extras: Partial<CartCandidate> = {}): CartCandidate {
  return {
    item: { courseId, priceHalalas, title: { ar: 'دورة', en: 'Course' }, slug: { ar: 'دورة', en: 'course' }, cover: 'design' },
    published: true, owned: false, currency: 'SAR', ...extras,
  };
}

describe('cart input boundaries', () => {
  it('allows public course keys and bounded guest merges', () => {
    expect(cartMutationSchema.parse({ action: 'merge', courseIds: ['course-one', 'course-one', 'another_course'] })).toEqual({
      action: 'merge', courseIds: ['course-one', 'course-one', 'another_course'],
    });
    expect(cartRemovalSchema.parse({ courseId: 'course-one' })).toEqual({ courseId: 'course-one' });
  });
  it.each([
    { action: 'add', courseId: 'one', priceHalalas: 1 },
    { action: 'add', courseId: 'one', userId: 'someone-else' },
    { action: 'merge', courseIds: ['one'], subtotalHalalas: 0 },
    { action: 'merge', courseIds: Array(MAX_CART_ITEMS + 1).fill('one') },
    { action: 'merge', courseIds: ['../secret'] },
    { action: 'add', courseId: '<script>' },
    { action: 'add', courseId: '' },
    { action: 'add', courseId: 'a'.repeat(101) },
    { action: 'replace', courseIds: [] },
  ])('rejects tampered or malformed mutation %#', input => {
    expect(cartMutationSchema.safeParse(input).success).toBe(false);
  });
  it('rejects cross-account deletion hints', () => {
    expect(cartRemovalSchema.safeParse({ courseId: 'one', cartId: 'victim' }).success).toBe(false);
  });
});

describe('authoritative cart reconciliation', () => {
  it('deduplicates repeated merges and totals integer halalas exactly', () => {
    const result = reconcileCart(['two', 'one', 'two', 'one'], [course('one', 101), course('two', 2399)]);
    expect(result.cart.items.map(item => item.courseId)).toEqual(['two', 'one']);
    expect(result.cart.count).toBe(2);
    expect(result.cart.subtotalHalalas).toBe(2500);
    expect(result.cart.currency).toBe('SAR');
    expect(result.rejected).toEqual([]);
  });
  it('removes owned, unavailable and unpublished courses', () => {
    const result = reconcileCart(['gone', 'draft', 'owned', 'available'], [course('draft', 100, { published: false }),
      course('owned', 100, { owned: true }), course('available', 100)]);
    expect(result.cart.items.map(item => item.courseId)).toEqual(['available']);
    expect(result.rejected).toEqual([{ courseId: 'gone', reason: 'UNAVAILABLE' }, { courseId: 'draft', reason: 'UNAVAILABLE' }, { courseId: 'owned', reason: 'OWNED' }]);
  });
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_HALALAS + 1])('rejects invalid catalog price %s', price => {
    expect(reconcileCart(['one'], [course('one', price)]).cart.count).toBe(0);
  });
  it('does not mix currencies or display incomplete bilingual catalog items', () => {
    const missingTranslation = course('missing'); missingTranslation.item.title.ar = '';
    expect(reconcileCart(['foreign', 'missing'], [course('foreign', 100, { currency: 'USD' }), missingTranslation]).cart.items).toEqual([]);
  });
  it('enforces course count and supported monetary bounds without overflow', () => {
    const candidates = Array.from({ length: 51 }, (_, index) => course(`course-${index}`, 1));
    expect(reconcileCart(candidates.map(item => item.item.courseId), candidates).cart.count).toBe(50);
    const result = reconcileCart(['big', 'extra'], [course('big', MAX_HALALAS), course('extra', 1)]);
    expect(result.cart.subtotalHalalas).toBe(MAX_HALALAS);
    expect(result.rejected).toEqual([{ courseId: 'extra', reason: 'LIMIT' }]);
  });
});

describe('guest cart persistence', () => {
  const knownIds = new Set(['one', 'two']);
  it('retains only known public identifiers and removes duplicates', () => {
    expect(sanitizeGuestIds(['one', { courseId: 'two', priceHalalas: 1 }, 'private', 'one', 'two', null], knownIds)).toEqual(['one', 'two']);
    expect(sanitizeGuestIds({ items: ['one'] }, knownIds)).toEqual([]);
  });
  it('stores neither account identifiers nor prices', () => {
    let saved: [string, string] | undefined;
    writeGuestCart({ setItem: (key, value) => { saved = [key, value]; } }, ['one', 'two']);
    expect(saved).toEqual([GUEST_CART_KEY, '["one","two"]']);
  });
  it('recovers from tampered JSON and restrictive browser storage', () => {
    expect(readGuestCart({ getItem: () => '<script>' }, knownIds)).toEqual([]);
    expect(readGuestCart({ getItem: () => { throw new Error('SecurityError'); } }, knownIds, ['one'])).toEqual(['one']);
    expect(readGuestCart({ getItem: () => '["one","private","one"]' }, knownIds)).toEqual(['one']);
  });
});
