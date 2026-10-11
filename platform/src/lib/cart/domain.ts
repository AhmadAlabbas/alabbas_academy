import { MAX_HALALAS } from '@/lib/money';

export const MAX_CART_ITEMS = 50;

export type CartItem = {
  courseId: string;
  title: { ar: string; en: string };
  slug: { ar: string; en: string };
  cover: 'design' | 'code' | 'business' | 'photo';
  priceHalalas: number;
};
export type CartSummary = {
  items: CartItem[];
  count: number;
  subtotalHalalas: number;
  currency: 'SAR';
};
export type CartRejection = { courseId: string; reason: 'OWNED' | 'UNAVAILABLE' | 'LIMIT' };
export type CartCandidate = { item: CartItem; published: boolean; owned: boolean; currency: string };

/** Reconcile stored and requested course keys against current, public database facts. */
export function reconcileCart(keys: readonly string[], candidates: readonly CartCandidate[]) {
  const byKey = new Map(candidates.map(candidate => [candidate.item.courseId, candidate]));
  const items: CartItem[] = [];
  const rejected: CartRejection[] = [];
  let subtotalHalalas = 0;
  for (const courseId of new Set(keys)) {
    const candidate = byKey.get(courseId);
    if (!candidate || !candidate.published || candidate.currency !== 'SAR' ||
      !Number.isSafeInteger(candidate.item.priceHalalas) || candidate.item.priceHalalas < 0 ||
      candidate.item.priceHalalas > MAX_HALALAS ||
      !candidate.item.title.ar || !candidate.item.title.en || !candidate.item.slug.ar || !candidate.item.slug.en) {
      rejected.push({ courseId, reason: 'UNAVAILABLE' });
      continue;
    }
    if (candidate.owned) {
      rejected.push({ courseId, reason: 'OWNED' });
      continue;
    }
    if (items.length >= MAX_CART_ITEMS || subtotalHalalas + candidate.item.priceHalalas > MAX_HALALAS) {
      rejected.push({ courseId, reason: 'LIMIT' });
      continue;
    }
    items.push(candidate.item);
    subtotalHalalas += candidate.item.priceHalalas;
  }
  return { cart: { items, count: items.length, subtotalHalalas, currency: 'SAR' as const }, rejected };
}

export function sanitizeGuestIds(value: unknown, knownIds: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && knownIds.has(entry)))].slice(0, MAX_CART_ITEMS);
}
