import type {Metadata} from 'next';
import {ArrowUpRight, BookOpen, Globe2, Heart, Sparkles} from 'lucide-react';
import Image from 'next/image';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {Link} from '@/i18n/navigation';
import {routing} from '@/i18n/routing';
import {pageMetadata} from '@/lib/seo';

type AboutPageProps = {params: Promise<{locale: string}>};

export async function generateMetadata({params}: AboutPageProps): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({locale, namespace: 'About'});
  return pageMetadata(locale, '/about', t('title'), t('description'));
}

export default async function AboutPage({params}: AboutPageProps) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('About');
  const values = [
    {title: 'practicalTitle', description: 'practicalDescription', icon: BookOpen, tone: 'bg-skysoft'},
    {title: 'accessibleTitle', description: 'accessibleDescription', icon: Heart, tone: 'bg-goldsoft'},
    {title: 'localTitle', description: 'localDescription', icon: Globe2, tone: 'bg-[#e8edef]'},
  ];

  return (
    <div className="container-shell pb-20 pt-12 sm:pb-24 sm:pt-16">
      <header className="grid items-center gap-10 py-2 sm:py-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div><p className="eyebrow mb-4">{t('eyebrow')}</p><h1 className="hero-title mb-6">{t('title')}</h1><p className="section-copy max-w-2xl">{t('description')}</p><Link href="/courses" className="button-primary mt-8">{t('cta')}<ArrowUpRight aria-hidden="true" className="logical-arrow size-4" /></Link></div>
        <div aria-hidden="true" className="cover-grid relative flex aspect-[1.15] items-center justify-center overflow-hidden rounded-[2rem] border border-line bg-skysoft">
          <div className="absolute -start-10 -top-12 size-52 rounded-full bg-gold/80" />
          <div className="absolute -bottom-10 -end-12 size-60 rounded-full border-[40px] border-blue/35" />
          <div className="relative flex size-48 rotate-[-7deg] items-center justify-center rounded-[2rem] bg-white p-8 shadow-[16px_16px_0_0_#19243c0b] sm:size-60"><Image src="/logo.svg" alt="" width={170} height={170} className="size-full object-contain" /></div>
          <Sparkles className="absolute end-10 top-12 size-9 stroke-[1.2] text-[#22677f]" />
        </div>
      </header>

      <section aria-labelledby="mission-heading" className="mt-14 rounded-3xl bg-navy px-7 py-10 text-white sm:mt-20 sm:px-12 sm:py-14">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-14"><h2 id="mission-heading" className="section-title max-w-xl">{t('missionTitle')}</h2><p className="self-center text-sm leading-8 text-white/75 sm:text-base">{t('missionDescription')}</p></div>
      </section>

      <section aria-labelledby="values-heading" className="py-14 sm:py-20">
        <h2 id="values-heading" className="section-title mb-8">{t('valuesTitle')}</h2>
        <div className="grid gap-6 md:grid-cols-3">{values.map(({title, description, icon: Icon, tone}) => <article key={title} className="card p-7 sm:p-8"><span className={`mb-6 flex size-12 items-center justify-center rounded-2xl ${tone}`}><Icon aria-hidden="true" className="size-6 stroke-[1.5]" /></span><h3 className="mb-3 text-xl font-semibold leading-relaxed">{t(title)}</h3><p className="text-sm leading-8 text-muted">{t(description)}</p></article>)}</div>
      </section>

      <section aria-labelledby="about-cta" className="relative overflow-hidden rounded-3xl border border-[#eddfc1] bg-goldsoft px-6 py-12 text-center sm:px-10 sm:py-16">
        <div aria-hidden="true" className="absolute -end-12 -top-20 size-48 rounded-full border-[28px] border-gold/40" />
        <div className="relative mx-auto max-w-2xl"><h2 id="about-cta" className="section-title mb-4">{t('ctaTitle')}</h2><p className="section-copy">{t('ctaDescription')}</p><Link href="/courses" className="button-primary mt-7">{t('cta')}<ArrowUpRight aria-hidden="true" className="logical-arrow size-4" /></Link></div>
      </section>
    </div>
  );
}
