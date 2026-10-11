'use client';

import { ArrowLeft, ArrowRight, RefreshCw, ShieldCheck, ShoppingBag, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatSAR } from '@/lib/money';
import { CourseCover } from '@/components/ui/course-cover';
import { useCart } from './cart-provider';

export function CartPage() {
  const t = useTranslations('Cart');
  const locale = useLocale() as 'ar' | 'en';
  const { items, count, subtotalHalalas, user, loading, error, notice, remove, refresh } = useCart();
  const BackArrow = locale === 'ar' ? ArrowRight : ArrowLeft;
  return <div className="container-shell py-10 sm:py-16">
    <Link href="/courses" className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent"><BackArrow className="size-4" aria-hidden="true" />{t('continueBrowsing')}</Link>
    <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow mb-3">{t('eyebrow')}</p><h1 className="text-3xl font-semibold text-ink sm:text-4xl">{t('title')}</h1><p className="mt-3 text-sm leading-7 text-muted">{t('subtitle')}</p></div>
      <p className="text-sm text-muted" aria-live="polite">{t('courseCount', { count })}</p>
    </div>
    {error && <div role="alert" className="mb-6 rounded-2xl border border-[#dfb997] bg-goldsoft p-4 text-sm leading-7 text-ink">
      <p>{t(error === 'STORAGE_UNAVAILABLE' ? 'storageError' : 'syncError')}</p>
      <button type="button" disabled={loading} onClick={() => { void refresh(); }} className="mt-2 inline-flex min-h-10 items-center gap-2 font-medium underline underline-offset-4"><RefreshCw className="size-4" aria-hidden="true" />{t('retry')}</button>
    </div>}
    {notice && <p role="status" className="mb-6 rounded-2xl bg-goldsoft p-4 text-sm leading-7 text-ink">{t(notice === 'OWNED' ? 'ownedNotice' : notice === 'LIMIT' ? 'limitNotice' : 'unavailableNotice')}</p>}
    {loading && !count ? <div className="card p-10 text-center text-sm text-muted" role="status">{t('loading')}</div> : !count ?
      <div className="card mx-auto max-w-2xl px-6 py-16 text-center">
        <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-skysoft"><ShoppingBag className="size-7 text-accent" aria-hidden="true" /></span>
        <h2 className="text-2xl font-semibold">{t('emptyTitle')}</h2><p className="mx-auto mb-7 mt-4 max-w-md text-sm leading-7 text-muted">{t('emptyDescription')}</p>
        <Link href="/courses" className="button-primary inline-flex min-h-12 items-center justify-center">{t('browseCourses')}</Link>
      </div> : <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <ul className="space-y-4" aria-label={t('itemsLabel')}>
        {items.map(item => <li className="card flex flex-col gap-5 p-5 sm:flex-row" key={item.courseId}>
          <div className="w-full shrink-0 overflow-hidden rounded-xl sm:w-36"><CourseCover cover={item.cover} /></div>
          <div className="min-w-0 flex-1"><p className="mb-2 text-xs font-medium text-accent">{t('courseLabel')}</p>
            <Link href={`/courses/${item.slug[locale]}`} className="block text-lg font-semibold leading-8 text-ink hover:underline">{item.title[locale]}</Link>
            <p className="mt-2 text-lg font-semibold tabular-nums">{formatSAR(item.priceHalalas, locale)}</p>
            <button type="button" disabled={loading} onClick={() => { void remove(item.courseId); }} aria-label={t('removeLabel', { title: item.title[locale] })}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted hover:bg-dangersoft hover:text-danger disabled:opacity-50"><Trash2 className="size-4" aria-hidden="true" />{t('remove')}</button>
          </div>
        </li>)}
      </ul>
      <aside className="card p-6 lg:sticky lg:top-28" aria-label={t('summary')}>
        <h2 className="mb-6 text-xl font-semibold">{t('summary')}</h2>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-muted">{t('subtotal')}</span><span className="text-xl font-semibold tabular-nums">{formatSAR(subtotalHalalas, locale)}</span></div>
        <p className="border-t border-line pt-4 text-xs leading-6 text-muted">{user ? t('authoritativePrices') : t('guestPrices')}</p>
        {!user ? <div className="mt-6"><p className="mb-4 text-sm leading-7 text-muted">{t('guestNotice')}</p><Link href={`/login?callbackUrl=${encodeURIComponent(`/${locale}/cart`)}`} className="button-primary flex min-h-12 items-center justify-center">{t('loginToSave')}</Link><Link href={`/signup?callbackUrl=${encodeURIComponent(`/${locale}/cart`)}`} className="mt-3 flex min-h-11 items-center justify-center text-sm font-medium text-accent underline underline-offset-4">{t('createAccount')}</Link></div> : !user.emailVerified ? <div className="mt-6 rounded-xl bg-goldsoft p-4"><p className="mb-3 text-sm leading-7">{t('verificationNotice')}</p><Link href="/account" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium underline underline-offset-4"><ShieldCheck className="size-4" aria-hidden="true" />{t('verifyAccount')}</Link></div> : <Link href="/checkout" className="button-primary mt-6 flex min-h-12 items-center justify-center">{locale === "ar" ? "إتمام الطلب" : "Checkout"}</Link>}
        <p className="mt-5 text-xs leading-6 text-muted">{t('noEnrollment')}</p>
      </aside>
    </div>}
  </div>;
}
