import type {ReactNode} from 'react';
import Image from 'next/image';
import {BookOpen, Check, ShieldCheck, Sparkles} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

type AccountShellProps = {children: ReactNode; title: string; description: string; eyebrow?: string};

export async function AccountShell({children, title, description, eyebrow}: AccountShellProps) {
  const t = await getTranslations('Account');
  return (
    <div className="container-shell py-8 sm:py-14">
      <div className="grid overflow-hidden rounded-[2rem] border border-line bg-white shadow-[0_16px_60px_#19243c08] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden overflow-hidden bg-navy p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div aria-hidden="true" className="absolute -start-24 -top-28 size-80 rounded-full border-[50px] border-blue/20" />
          <div aria-hidden="true" className="absolute -bottom-32 -end-28 size-96 rounded-full border-[60px] border-gold/15" />
          <div className="relative">
            <div className="mb-12 flex size-20 items-center justify-center rounded-3xl bg-white/10 p-4"><Image src="/logo.svg" alt="" width={55} height={70} className="h-full w-auto" /></div>
            <p className="mb-4 text-xs font-medium text-blue">{t('storyEyebrow')}</p>
            <h2 className="text-3xl font-semibold leading-relaxed xl:text-4xl">{t('storyTitle')}</h2>
            <p className="mt-5 text-sm leading-8 text-white/70">{t('storyDescription')}</p>
            <div className="mt-10 space-y-5">
              {[['storyOne', BookOpen], ['storyTwo', ShieldCheck], ['storyThree', Sparkles]].map(([label, Icon]) => {
                const BenefitIcon = Icon as typeof BookOpen;
                return <div key={String(label)} className="flex items-center gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><BenefitIcon aria-hidden="true" className="size-5 text-gold" /></span><span className="text-sm text-white/85">{t(String(label))}</span></div>;
              })}
            </div>
          </div>
          <p className="relative mt-16 flex items-center gap-2 text-xs leading-6 text-white/60"><Check aria-hidden="true" className="size-4 text-blue" />{t('storyFooter')}</p>
        </aside>
        <section className="min-w-0 p-6 sm:p-10 lg:p-12 xl:p-14" aria-labelledby="account-form-heading">
          <Link href="/courses" className="mb-8 inline-flex rounded text-xs font-medium text-muted hover:text-navy">{t('backToCourses')}</Link>
          <p className="eyebrow mb-3">{eyebrow ?? t('eyebrow')}</p>
          <h1 id="account-form-heading" className="text-3xl font-semibold leading-relaxed tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
          <div className="mt-8">{children}</div>
        </section>
      </div>
    </div>
  );
}
