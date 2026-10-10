'use client';

import {useTranslations} from 'next-intl';
import {RotateCcw} from 'lucide-react';
import {Link} from '@/i18n/navigation';

export default function PageError({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  const t = useTranslations('Error');
  return <div className="container-shell py-20"><div className="card mx-auto max-w-xl p-8 text-center sm:p-12"><span aria-hidden="true" className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-goldsoft"><RotateCcw className="size-6"/></span><h1 className="mb-4 text-2xl font-semibold">{t('title')}</h1><p className="mb-7 text-sm leading-7 text-muted">{t('description')}</p><div className="flex flex-wrap justify-center gap-3"><button className="button-primary" onClick={reset}>{t('retry')}</button><Link href="/" className="button-secondary">{t('home')}</Link></div></div></div>;
}
