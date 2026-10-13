'use client';
import {useLocale} from 'next-intl';
import {useRef, useState} from 'react';
import {useCart} from '@/components/cart/cart-provider';
import {useRouter} from '@/i18n/navigation';
import {Price, CoursePrice} from '@/components/ui/price';
import {checkoutErrorMessage} from '@/lib/commerce/checkout-errors';
import type {quoteCheckout} from '@/lib/commerce/checkout-quote';
type Quote = Awaited<ReturnType<typeof quoteCheckout>>;

export function Checkout({onlinePayments = false}: {onlinePayments?: boolean}) {
  const locale = useLocale() as 'ar' | 'en', ar = locale === 'ar';
  const cart = useCart(), router = useRouter();
  const [coupon, setCoupon] = useState(''), [error, setError] = useState('');
  const [minimum, setMinimum] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [applying, setApplying] = useState(false);
  const [quoted, setQuoted] = useState<{fingerprint: string; quote: Quote} | null>(null);
  const key = useRef<{fingerprint: string; value: string} | null>(null);
  const request = useRef(0);
  const fingerprint = JSON.stringify([cart.user?.id, cart.items.map(item => [item.courseId, item.priceHalalas])]);
  const code = coupon.trim().toUpperCase();
  const applied = quoted?.fingerprint === fingerprint && quoted.quote.coupon?.code.toUpperCase() === code ? quoted.quote : null;
  const unapplied = Boolean(code) && !applied;
  const label = (arabic: string, english: string) => ar ? arabic : english;
  function editCoupon(value: string) {
    request.current++; setCoupon(value.toUpperCase()); setQuoted(null); setError(''); setMinimum(null);
  }
  async function applyCoupon(event: React.FormEvent) {
    event.preventDefault(); if (!code || applying || busy || cart.loading || !cart.count) return;
    const sequence = ++request.current;
    setApplying(true); setError(''); setMinimum(null);
    try {
      const response = await fetch('/api/checkout/quote', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({coupon: code})});
      const body = await response.json();
      if (sequence !== request.current) return;
      if (!response.ok) {setQuoted(null); setError(checkoutErrorMessage(body.code, ar)); setMinimum(body.minimumOrderHalalas ?? null); return;}
      if (body.coupon?.code) setCoupon(body.coupon.code);
      setQuoted({fingerprint, quote: body});
    } catch {if (sequence === request.current) setError(label('تعذر الاتصال. حاول تطبيق الرمز مجددًا.', 'Unable to connect. Try applying the code again.'));}
    finally {setApplying(false);}
  }
  async function submit() {
    if (busy || applying || unapplied || cart.loading || !cart.count) return;
    setBusy(true); setError(''); setMinimum(null);
    const orderFingerprint = JSON.stringify([fingerprint, applied?.coupon?.code, applied?.totalHalalas]);
    if (key.current?.fingerprint !== orderFingerprint) key.current = {fingerprint: orderFingerprint, value: crypto.randomUUID()};
    try {
      const response = await fetch('/api/orders', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({locale, coupon: applied?.coupon?.code, key: key.current.value})});
      const body = await response.json();
      if (!response.ok) {
        setError(checkoutErrorMessage(body.code, ar)); setMinimum(body.minimumOrderHalalas ?? null);
        if (body.code?.startsWith('COUPON_') || body.code === 'INVALID_COUPON') setQuoted(null);
        return;
      }
      await cart.refresh(); router.push('/orders/' + body.id);
    } catch {setError(label('تعذر الاتصال. أعد المحاولة لإكمال طلبك.', 'Unable to connect. Retry to complete your order.'));}
    finally {setBusy(false);}
  }
  const total = applied?.totalHalalas ?? cart.subtotalHalalas;
  return <div className="container-shell max-w-3xl py-12">
    <h1 className="mb-8 text-3xl font-semibold">{label('إتمام الطلب', 'Checkout')}</h1>
    <div className="card space-y-5 p-6">
      {cart.items.map(item => {
        const current = applied?.items.find(line => line.courseId === item.courseId) || item;
        return <div className="flex flex-wrap justify-between gap-4" key={item.courseId}><span className="min-w-0 break-words">{item.title[locale]}</span><CoursePrice amount={current.priceHalalas} original={current.compareAtHalalas} locale={locale} /></div>;
      })}
      <form onSubmit={applyCoupon} className="space-y-3 border-t border-line pt-5">
        <label className="block">{label('رمز الخصم', 'Coupon code')}
          <input className="field" maxLength={40} value={coupon} disabled={busy || applying} onChange={event => editCoupon(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} dir="auto" />
        </label>
        <div className="flex flex-wrap gap-3">
          <button className="button-secondary" disabled={!code || busy || applying || cart.loading || !cart.count}>{applying ? label('جارٍ التطبيق…', 'Applying…') : label('تطبيق الرمز', 'Apply coupon')}</button>
          {code && <button type="button" className="button-secondary" disabled={busy || applying} onClick={() => editCoupon('')}>{label('إزالة الرمز', 'Remove code')}</button>}
        </div>
        {unapplied && !error && <p className="text-sm text-muted">{label('طبّق الرمز لعرض الخصم قبل إرسال الطلب، أو أزله للمتابعة.', 'Apply the code to see your discount before ordering, or remove it to continue.')}</p>}
        {applied?.coupon && <p role="status" className="rounded-xl bg-successsoft p-3 text-sm text-success">{label('تم تطبيق الرمز: ', 'Coupon applied: ')}<bdi>{applied.coupon.code}</bdi></p>}
      </form>
      <div className="space-y-3 border-t border-line pt-5">
        <p className="flex flex-wrap justify-between gap-2"><span>{label('المجموع قبل خصم الرمز', 'Subtotal before coupon')}</span><Price amount={applied?.subtotalHalalas ?? cart.subtotalHalalas} locale={locale} /></p>
        {applied && <p className="flex flex-wrap justify-between gap-2 text-success"><span>{label('خصم الرمز', 'Coupon discount')}</span><span>− <Price amount={applied.discountHalalas} locale={locale} /></span></p>}
        <p className="flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-xl font-semibold"><span>{label('الإجمالي', 'Total')}</span><Price amount={total} locale={locale} /></p>
      </div>
      <p className="rounded-xl bg-goldsoft p-4 text-sm leading-7">{total === 0 && cart.count ? label('لا يوجد مبلغ مستحق. أرسل الطلب لتأكيد التسجيل.', 'No payment is due. Submit your order for enrollment confirmation.') : onlinePayments ? label('راجع الإجمالي ثم تابع إلى الدفع. تتاح الدورات بعد تأكيد الدفع.', 'Review your total, then continue to payment. Courses unlock after payment confirmation.') : label('الدفع سيكون متاحًا قريبًا. يُرسل الطلب بحالة قيد الانتظار، وتتاح الدورات بعد تأكيد الدفع.', 'Payments will be available soon. Your order stays pending and courses unlock after payment confirmation.')}</p>
      <button className="button-primary w-full" disabled={busy || applying || unapplied || cart.loading || !cart.count} onClick={() => void submit()}>{busy ? label('جارٍ الإرسال…', 'Submitting…') : onlinePayments && total > 0 ? label('المتابعة إلى الدفع', 'Continue to payment') : label('إرسال الطلب', 'Submit order')}</button>
      {error && <div role="alert" className="text-sm text-danger"><p>{error}</p>{minimum !== null && <p className="mt-2 inline-flex flex-wrap items-center gap-2">{label('الحد الأدنى المطلوب:', 'Minimum required:')} <Price amount={minimum} locale={locale} /></p>}</div>}
    </div>
  </div>;
}
