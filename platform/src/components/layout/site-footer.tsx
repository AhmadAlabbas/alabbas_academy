import Image from 'next/image';
import {ArrowUpRight, MapPin} from 'lucide-react';
import {siteSettings} from '@/lib/public-data';
import {getLocale,getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

export async function SiteFooter() {
  const t = await getTranslations('Footer');const locale=await getLocale(),settings=await siteSettings(),ar=locale==='ar';

  return (
    <footer className="mt-20 border-t border-[var(--line)] bg-white">
      <div className="container-shell grid gap-10 py-12 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="max-w-md">
          <Link href="/" className="inline-flex items-center gap-3 font-bold text-[var(--navy)]">
            <Image unoptimized src={typeof settings.logo==='string'?settings.logo:'/logo.svg'} width={330} height={425} alt="" className="h-auto w-9 object-contain" />
            <span className="text-lg">{String(settings[`name_${locale}`]||t('academy'))}</span>
          </Link>
          <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{t('description')}</p>
        </div>

        <nav aria-label={t('navigation')}>
          <h2 className="font-bold text-[var(--navy)]">{t('explore')}</h2>
          <ul className="mt-5 space-y-3 text-sm text-[var(--muted)]">
            <li><Link href="/" className="hover:text-[var(--navy)]">{t('home')}</Link></li>
            <li><Link href="/courses" className="hover:text-[var(--navy)]">{t('courses')}</Link></li>
            <li><Link href="/instructors" className="hover:text-[var(--navy)]">{ar?'المدربون':'Instructors'}</Link></li><li><Link href="/contact" className="hover:text-[var(--navy)]">{ar?'تواصل معنا':'Contact us'}</Link></li><li><Link href="/about" className="hover:text-[var(--navy)]">{t('about')}</Link></li>
            <li><Link href="/login" className="hover:text-[var(--navy)]">{t('login')}</Link></li>
            <li><Link href="/signup" className="hover:text-[var(--navy)]">{t('signup')}</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="font-bold text-[var(--navy)]">{t('startLearning')}</h2>
          <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{t('invitation')}</p>
          <Link href="/courses" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--navy)]">
            {t('browseCourses')} <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        <div className="mt-4 flex gap-4">{['instagram','x'].map(key=>typeof settings[key]==='string'&&String(settings[key]).startsWith('https://')?<a key={key} className="underline" href={String(settings[key])} rel="noopener noreferrer">{key==='x'?'X':'Instagram'}</a>:null)}</div></div>
      </div>

      <div className="container-shell flex flex-col gap-3 border-t border-[var(--line)] py-6 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>{new Date().getFullYear()} © {String(settings[`name_${locale}`]||t('academy'))}</p><div className="flex flex-wrap gap-4"><Link href="/privacy">{ar?'الخصوصية':'Privacy'}</Link><Link href="/terms">{ar?'الشروط':'Terms'}</Link><Link href="/refund-policy">{ar?'الاسترداد':'Refund policy'}</Link></div>
        <p className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />{t('location')}</p>
      </div>
    </footer>
  );
}
