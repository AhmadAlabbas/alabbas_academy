'use client';

import { Check, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCart } from './cart-provider';

export function CartLinkBadge({ className = '' }: { className?: string }) {
  const t = useTranslations('Cart');
  const { count } = useCart();
  return <Link href="/cart" className={`relative inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-navy hover:bg-skysoft ${className}`} aria-label={t('cartLabel', { count })}>
    <ShoppingBag className="size-5" aria-hidden="true" /><span className="hidden sm:inline">{t('title')}</span>
    <span className="flex min-w-5 items-center justify-center rounded-full bg-goldsoft px-1.5 text-xs tabular-nums">{count}</span>
  </Link>;
}

export function AddToCartButton({ courseId, className = '' }: { courseId: string; className?: string }) {
  const t = useTranslations('Cart');
  const { ids, loading, add } = useCart();
  const added = ids.includes(courseId);
  return <button type="button" disabled={loading || added} onClick={() => { void add(courseId); }}
    className={`button-primary inline-flex min-h-11 items-center justify-center gap-2 text-sm disabled:cursor-default disabled:opacity-70 ${className}`}>
    {added ? <Check className="size-4" aria-hidden="true" /> : <ShoppingCart className="size-4" aria-hidden="true" />}
    {added ? t('added') : t('add')}
  </button>;
}
