import {formatSARNumber, saleDetails} from '@/lib/money';
type Locale = 'ar' | 'en';

export function Price({amount, locale, className = ''}: {amount: number; locale: Locale; className?: string}) {
  const number = formatSARNumber(amount, locale);
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums ${className}`} dir="ltr">
    <span className="riyal-symbol" aria-hidden="true" />
    <bdi aria-hidden="true">{number}</bdi>
    <span className="sr-only">{locale === 'ar' ? `${number} ريال سعودي` : `${number} Saudi riyals`}</span>
  </span>;
}
export function CoursePrice({amount, original, locale, className = '', showSavings = true}: {amount: number; original?: number | null; locale: Locale; className?: string; showSavings?: boolean}) {
  const sale = saleDetails(amount, original);
  return <span className="inline-flex min-w-0 flex-col gap-1.5">
    <Price amount={amount} locale={locale} className={`font-semibold ${className}`} />
    {sale && <>
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <del className="text-muted"><Price amount={original!} locale={locale} /></del>
        <span className="rounded-full bg-goldsoft px-2 py-1 font-medium text-ink">{sale.percentage ? (locale === 'ar' ? `خصم ${new Intl.NumberFormat('ar-SA').format(sale.percentage)}٪` : `${sale.percentage}% off`) : locale === 'ar' ? 'عرض' : 'Sale'}</span>
      </span>
      {showSavings && <span className="inline-flex flex-wrap items-center gap-1 text-xs text-success">{locale === 'ar' ? 'وفّر' : 'Save'} <Price amount={sale.savedHalalas} locale={locale} /></span>}
    </>}
  </span>;
}
