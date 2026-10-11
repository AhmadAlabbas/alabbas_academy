import {ArrowUpRight, BookOpen} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('NotFound');
  return (
    <div className="container-shell flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span aria-hidden="true" className="mb-7 flex size-24 items-center justify-center rounded-3xl bg-skysoft"><BookOpen className="size-11 stroke-[1.3] text-accent" /></span>
      <p aria-hidden="true" className="mb-3 text-sm font-medium text-muted">404</p>
      <h1 className="section-title mb-4">{t('title')}</h1>
      <p className="section-copy max-w-lg">{t('description')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/" className="button-primary">{t('home')}</Link><Link href="/courses" className="button-secondary">{t('courses')}<ArrowUpRight aria-hidden="true" className="logical-arrow size-4" /></Link></div>
    </div>
  );
}
