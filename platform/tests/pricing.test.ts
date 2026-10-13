import {describe, it, expect, vi} from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/session', () => ({requireVerifiedUser: vi.fn()}));
import {formatSARNumber, saleDetails} from '@/lib/money';
import {validateAdminPricing} from '@/lib/commerce/admin-pricing';
import {entitySchema} from '@/lib/admin/service';
import {initialDraft, serializeDraft} from '@/lib/admin/forms';
import {quoteSchema} from '@/lib/commerce/totals';

describe('Course sale prices and coupon setup', () => {
  it('keeps exact halala savings and does not label a paid course 100 percent off', () => {
    expect(saleDetails(14900, 19900)).toEqual({savedHalalas: 5000, percentage: 25});
    expect(saleDetails(19995, 24900)).toEqual({savedHalalas: 4905, percentage: 19});
    expect(saleDetails(1, 10000)?.percentage).toBe(99);
    expect(saleDetails(0, 10000)?.percentage).toBe(100);
    expect(saleDetails(10000, 10000)).toBeNull();
    expect(saleDetails(10000, null)).toBeNull();
    expect(formatSARNumber(29995, 'en')).toBe('299.95');
    expect(formatSARNumber(29995, 'ar')).toBe('٢٩٩٫٩٥');
  });
  it('requires an original price above the current sale price', () => {
    expect(() => validateAdminPricing('courses', {priceHalalas: 19900, compareAtHalalas: 14900})).toThrow();
    expect(() => validateAdminPricing('courses', {priceHalalas: 19900, compareAtHalalas: null})).not.toThrow();
  });
  it('normalizes admin and checkout coupon codes consistently and defaults the minimum to zero', () => {
    expect(entitySchema('coupons', true).parse({code: ' welcome20 '}).code).toBe('WELCOME20');
    expect(quoteSchema.parse({coupon: ' welcome20 '}).coupon).toBe('WELCOME20');
    const draft = initialDraft('coupons', {});
    expect(serializeDraft('coupons', draft).minimumOrderHalalas).toBe(0);
    expect(entitySchema('coupons', true).safeParse({code: 'TWO WORDS'}).success).toBe(false);
  });
  it.each([
    {kind: 'PERCENTAGE', percentageBasisPoints: null},
    {kind: 'PERCENTAGE', percentageBasisPoints: 0},
    {kind: 'FIXED_AMOUNT', amountHalalas: 0},
    {kind: 'PERCENTAGE', percentageBasisPoints: 2000, usageLimit: 0},
    {kind: 'PERCENTAGE', percentageBasisPoints: 2000, startsAt: '2026-10-14T00:00:00Z', expiresAt: '2026-10-13T00:00:00Z'},
  ])('rejects incomplete or contradictory coupon settings %j', data => {
    expect(() => validateAdminPricing('coupons', {perUserLimit: 1, ...data})).toThrow();
  });
});
