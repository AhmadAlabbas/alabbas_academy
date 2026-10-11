import { sanitizeGuestIds } from './domain';

export const GUEST_CART_KEY = 'alabbas.cart.guest.v1';

export function readGuestCart(storage: Pick<Storage, 'getItem'>, knownIds: ReadonlySet<string>, fallback: readonly string[] = []) {
  try { return sanitizeGuestIds(JSON.parse(storage.getItem(GUEST_CART_KEY) ?? '[]'), knownIds); }
  catch { return sanitizeGuestIds([...fallback], knownIds); }
}
/** Store only public identifiers. Account carts and prices never enter browser storage. */
export function writeGuestCart(storage: Pick<Storage, 'setItem'>, ids: readonly string[]) {
  storage.setItem(GUEST_CART_KEY, JSON.stringify(ids));
}
