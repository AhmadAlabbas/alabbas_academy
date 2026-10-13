'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import type {Course} from '@/content/catalog';
import { reconcileCart, sanitizeGuestIds, type CartItem, type CartRejection, type CartSummary } from '@/lib/cart/domain';
import { GUEST_CART_KEY, readGuestCart, writeGuestCart } from '@/lib/cart/storage';

type CartUser = { id: string; emailVerified: boolean };
type ApiCart = { authenticated: boolean; user: CartUser | null; cart: CartSummary | null; rejected: CartRejection[] };
type CartContextValue = {
  items: CartItem[]; ids: string[]; count: number; subtotalHalalas: number; user: CartUser | null;
  loading: boolean; error: string | null; notice: CartRejection['reason'] | null;
  add: (courseId: string) => Promise<void>; remove: (courseId: string) => Promise<void>; refresh: () => Promise<void>;
};
const emptyCart: CartSummary = { items: [], count: 0, subtotalHalalas: 0, currency: 'SAR' };
const CartContext = createContext<CartContextValue | null>(null);

async function cartRequest(method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<ApiCart> {
  const response = await fetch('/api/cart', {
    method, credentials: 'same-origin', cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.code === 'string' ? result.code : 'SERVICE_UNAVAILABLE');
  return result as ApiCart;
}

export function CartProvider({ children,catalog }: { children: ReactNode;catalog:Course[] }) {
const knownIds = useMemo(()=>new Set(catalog.map(course => course.id)),[catalog]);
const guestCandidates = useMemo(()=>catalog.map(course => ({
  item: { courseId: course.id, title: course.title, slug: course.slug, cover: course.cover, priceHalalas: course.priceHalalas, compareAtHalalas: course.compareAtHalalas },
  published: true, owned: false, currency: 'SAR',
})),[catalog]);

  const [cart, setCart] = useState(emptyCart);
  const [user, setUser] = useState<CartUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<CartRejection['reason'] | null>(null);
  const userRef = useRef<CartUser | null>(null);
  const guestRef = useRef<string[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(false);
  const accountGeneration = useRef(0);
  const invalidateAccount = useCallback(() => { accountGeneration.current++; mounted.current = false; }, []);

  const readBrowserGuest = useCallback(() => {
    // Some browser privacy modes throw when accessing the storage property itself.
    try { return readGuestCart(window.localStorage, knownIds, guestRef.current); }
    catch { return [...guestRef.current]; }
  }, [knownIds]);

  const notifyAccountCart = useCallback(() => {
    try { window.localStorage.setItem('alabbas.cart.changed', String(Date.now())); }
    catch { /* Cross-tab sync remains available on focus when storage is restricted. */ }
  }, []);

  const applyGuest = useCallback((ids: string[]) => {
    guestRef.current = sanitizeGuestIds(ids, knownIds);
    userRef.current = null;
    setUser(null);
    setCart(reconcileCart(guestRef.current, guestCandidates).cart);
  }, [knownIds,guestCandidates]);

  const saveGuest = useCallback((ids: string[]) => {
    const safeIds = sanitizeGuestIds(ids, knownIds);
    applyGuest(safeIds);
    try { writeGuestCart(window.localStorage, safeIds); }
    catch { setError('STORAGE_UNAVAILABLE'); }
  }, [applyGuest,knownIds]);

  const applyAccount = useCallback((result: ApiCart) => {
    userRef.current = result.user;
    setUser(result.user);
    setCart(result.cart ?? emptyCart);
    setNotice(result.rejected[0]?.reason ?? null);
  }, []);

  const enqueue = useCallback((operation: () => Promise<void>) => {
    const work = queue.current.catch(() => undefined).then(operation);
    queue.current = work;
    return work;
  }, []);

  const refresh = useCallback(() => enqueue(async () => {
    const generation = accountGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const result = await cartRequest('GET');
      if (!mounted.current || generation !== accountGeneration.current) return;
      if (!result.authenticated) {
        // An old account's items are deliberately never copied into a guest cart.
        applyGuest(readBrowserGuest());
      } else {
        const pending = readBrowserGuest();
        if (pending.length) {
          const merged = await cartRequest('POST', { action: 'merge', courseIds: pending });
          if (!mounted.current || generation !== accountGeneration.current) return;
          applyAccount(merged);
          guestRef.current = [];
          try { writeGuestCart(window.localStorage, []); }
          catch { setError('STORAGE_UNAVAILABLE'); }
          notifyAccountCart();
        } else applyAccount(result);
      }
    } catch (failure) {
      if (!mounted.current || generation !== accountGeneration.current) return;
      // A failed refresh must not retain a previous account's course list.
      applyGuest(readBrowserGuest());
      setError(failure instanceof Error ? failure.message : 'SERVICE_UNAVAILABLE');
    } finally { if (mounted.current) setLoading(false); }
  }), [applyAccount, applyGuest, enqueue, notifyAccountCart, readBrowserGuest]);

  useEffect(() => {
    mounted.current = true;
    // Guest browsing works even when database/email services are not connected yet.
    const initialGeneration = accountGeneration.current;
    queueMicrotask(() => {
      if (!mounted.current || initialGeneration !== accountGeneration.current) return;
      applyGuest(readBrowserGuest());
      void refresh();
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === GUEST_CART_KEY && !userRef.current) applyGuest(readBrowserGuest());
      if (event.key === 'alabbas.cart.changed' && userRef.current) void refresh();
      if (event.key === 'alabbas.auth.changed') { accountGeneration.current++; applyGuest(readBrowserGuest()); void refresh(); }
    };
    const onAccountChanged = () => { accountGeneration.current++; applyGuest(readBrowserGuest()); void refresh(); };
    const onFocus = () => { void refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('alabbas:auth-changed', onAccountChanged);
    window.addEventListener('focus', onFocus);
    return () => {
      invalidateAccount();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('alabbas:auth-changed', onAccountChanged);
      window.removeEventListener('focus', onFocus);
    };
  }, [applyGuest, refresh, readBrowserGuest, invalidateAccount]);

  const add = useCallback((courseId: string) => {
    const generation = accountGeneration.current;
    const initiatingUserId = userRef.current?.id ?? null;
    return enqueue(async () => {
    if (!mounted.current || generation !== accountGeneration.current || initiatingUserId !== (userRef.current?.id ?? null)) return;
    setError(null); setNotice(null);
    if (!userRef.current) {
      if (!knownIds.has(courseId)) { setNotice('UNAVAILABLE'); return; }
      saveGuest([...readBrowserGuest(), courseId]);
      return;
    }
    setLoading(true);
    try {
      const result = await cartRequest('POST', { action: 'add', courseId });
      if (!mounted.current || generation !== accountGeneration.current) return;
      applyAccount(result); notifyAccountCart();
    }
    catch (failure) {
      if (!mounted.current || generation !== accountGeneration.current) return;
      setError(failure instanceof Error ? failure.message : 'SERVICE_UNAVAILABLE');
      if (failure instanceof Error && failure.message === 'UNAUTHORIZED') applyGuest(readBrowserGuest());
    } finally { setLoading(false); }
    });
  }, [applyAccount, applyGuest, enqueue, saveGuest, notifyAccountCart, readBrowserGuest, knownIds]);

  const remove = useCallback((courseId: string) => {
    const generation = accountGeneration.current;
    const initiatingUserId = userRef.current?.id ?? null;
    return enqueue(async () => {
    if (!mounted.current || generation !== accountGeneration.current || initiatingUserId !== (userRef.current?.id ?? null)) return;
    setError(null); setNotice(null);
    if (!userRef.current) { saveGuest(readBrowserGuest().filter(id => id !== courseId)); return; }
    setLoading(true);
    try {
      const result = await cartRequest('DELETE', { courseId });
      if (!mounted.current || generation !== accountGeneration.current) return;
      applyAccount(result); notifyAccountCart();
    }
    catch (failure) {
      if (!mounted.current || generation !== accountGeneration.current) return;
      setError(failure instanceof Error ? failure.message : 'SERVICE_UNAVAILABLE');
      if (failure instanceof Error && failure.message === 'UNAUTHORIZED') applyGuest(readBrowserGuest());
    } finally { setLoading(false); }
    });
  }, [applyAccount, applyGuest, enqueue, saveGuest, notifyAccountCart, readBrowserGuest]);

  return <CartContext.Provider value={{ items: cart.items, ids: cart.items.map(item => item.courseId), count: cart.count,
    subtotalHalalas: cart.subtotalHalalas, user, loading, error, notice, add, remove, refresh }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used within CartProvider.');
  return value;
}
