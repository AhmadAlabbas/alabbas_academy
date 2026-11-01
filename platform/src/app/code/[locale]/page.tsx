import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {CodeExperience} from '@/code/code-experience';
import {siteOrigin} from '@/lib/seo';

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{lesson?: string}>;
};
export async function generateMetadata({params}: Pick<Props, 'params'>): Promise<Metadata> {
  const {locale} = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const ar = locale === 'ar';
  return {
    title: ar ? 'ALABBAS Code — تعلم البرمجة بالتطبيق' : 'ALABBAS Code — Learn by building',
    description: ar ? 'دروس برمجة تفاعلية بالعربية والإنجليزية مع محرر كود ومعاينة حية.'
      : 'Interactive HTML, CSS and JavaScript lessons with a real coding workspace.',
    alternates: {canonical: `${siteOrigin}/code/${locale}`,
      languages: {ar: `${siteOrigin}/code/ar`, en: `${siteOrigin}/code/en`, 'x-default': `${siteOrigin}/code/ar`}},
    robots: {index: true, follow: true},
  };
}

export default async function CodeHome({params, searchParams}: Props) {
  const {locale} = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const {lesson} = await searchParams;
  return <CodeExperience locale={locale} initialLesson={lesson || null}/>;
}
