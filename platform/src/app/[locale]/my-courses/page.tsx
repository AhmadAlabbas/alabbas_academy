import {requireVerifiedUser} from '@/lib/auth/session';
import {getDatabase} from '@/lib/db';
import {redirect} from 'next/navigation';
import {BookOpen, GraduationCap, Play, Trophy, ArrowUpRight} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import Image from 'next/image';
import {contentText, contentLocale} from '@/lib/course-content';
import {learningProgress} from '@/lib/learning/progress';
import {CourseCover} from '@/components/ui/course-cover';
import {adminValueLabel} from '@/lib/admin/registry';
import {CertificateButton} from '@/components/platform/player';
export const metadata = {robots: {index: false, follow: false}};
export default async function Page({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const ar = locale === 'ar', text = (arabic: string, english: string) => ar ? arabic : english;
  let user;
  try {user = await requireVerifiedUser();} catch {redirect(`/${locale}/account`);}
  const [enrollments, orders] = await Promise.all([
    getDatabase().enrollment.findMany({where: {userId: user.id, status: {in: ['ACTIVE', 'COMPLETED']}, revokedAt: null}, include: {
      course: {include: {sections: {orderBy: {position: 'asc'}, include: {lessons: {where: {isPublished: true}, orderBy: {position: 'asc'}, select: {id: true, title_ar: true, title_en: true}}}}}},
      progress: true, certificate: true,
    }, orderBy: {enrolledAt: 'desc'}}),
    getDatabase().order.findMany({where: {userId: user.id}, orderBy: {createdAt: 'desc'}, take: 20}),
  ]);
  const cards = enrollments.map(enrollment => ({enrollment, summary: learningProgress(enrollment.course.sections.flatMap(section => section.lessons), enrollment.progress)}));
  const latest = [...cards].filter(card => card.summary.next && card.enrollment.status !== 'COMPLETED').sort((a, b) => Math.max(0, ...b.enrollment.progress.map(progress => progress.updatedAt.getTime())) - Math.max(0, ...a.enrollment.progress.map(progress => progress.updatedAt.getTime())))[0];
  const certificates = enrollments.filter(enrollment => enrollment.certificate && !enrollment.certificate.revokedAt);
  return <div className="container-shell space-y-8 py-10 sm:py-14">
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow mb-3">{text('مساحتك للتعلم', 'Your learning space')}</p><h1 className="text-3xl font-semibold sm:text-4xl">{text('دوراتي', 'My Courses')}</h1><p className="mt-3 text-muted">{text('أكمل من حيث توقفت، وتابع إنجازاتك.', 'Pick up where you left off and track your achievements.')}</p></div><Link href="/courses" className="button-secondary gap-2">{text('اكتشف المزيد من الدورات', 'Explore more courses')}<ArrowUpRight className="size-4 logical-arrow"/></Link></header>
    <div className="grid gap-4 sm:grid-cols-3">{[[BookOpen, text('الدورات المسجل بها', 'Enrolled courses'), enrollments.length], [GraduationCap, text('الدورات المكتملة', 'Completed courses'), enrollments.filter(enrollment => enrollment.status === 'COMPLETED').length], [Trophy, text('الشهادات', 'Certificates'), certificates.length]].map(([Icon, label, count]) => {const Glyph = Icon as typeof BookOpen; return <div key={String(label)} className="card flex items-center gap-4 p-5"><Glyph className="size-7 shrink-0 text-accent"/><div><p className="text-2xl font-semibold">{String(count)}</p><p className="mt-1 text-sm text-muted">{String(label)}</p></div></div>;})}</div>
    {latest && <section className="card flex flex-wrap items-center justify-between gap-6 bg-skysoft p-6 sm:p-8" aria-labelledby="continue-title"><div className="min-w-0"><p className="mb-2 text-sm text-accent">{text('تابع رحلتك', 'Keep your momentum')}</p><h2 id="continue-title" className="break-words text-2xl font-semibold">{contentText(latest.enrollment.course, 'title', locale)}</h2><p className="mt-3 text-sm text-muted">{text('الدرس التالي:', 'Next lesson:')} {contentText(latest.summary.next!, 'title', contentLocale(latest.enrollment.course.languages, locale))}</p></div><Link className="button-primary min-h-12 gap-2" href={`/learn/${latest.enrollment.courseId}/${latest.summary.next!.id}`}><Play className="size-4"/>{text('متابعة التعلم', 'Continue learning')}</Link></section>}
    <section aria-labelledby="enrolled-title"><h2 id="enrolled-title" className="mb-5 text-2xl font-semibold">{text('جميع دوراتي', 'All my courses')}</h2><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{cards.map(({enrollment, summary}) => <article className="card min-w-0 overflow-hidden" key={enrollment.id}><div className="h-36 overflow-hidden">{enrollment.course.thumbnailUrl ? <Image src={enrollment.course.thumbnailUrl} alt="" width={600} height={350} className="h-full w-full object-cover"/> : <CourseCover cover={enrollment.course.coverStyle as 'design'}/>}</div><div className="p-6"><p className="mb-2 text-xs text-accent">{enrollment.status === 'COMPLETED' ? text('دورة مكتملة', 'Completed course') : text('تعلم على وتيرتك', 'Learn at your own pace')}</p><h3 className="break-words text-xl font-semibold">{contentText(enrollment.course, 'title', locale)}</h3><progress aria-label={contentText(enrollment.course, 'title', locale) + ' ' + text('التقدم', 'progress')} className="learning-progress mt-5 w-full" value={summary.percentage} max={100}/><p className="mt-2 text-sm text-muted">{summary.completed} / {summary.total} {text('دروس مكتملة', 'lessons completed')} · {summary.percentage}%</p>
      {summary.next ? <Link className="button-primary mt-5 inline-flex min-h-12" href={`/learn/${enrollment.courseId}/${summary.next.id}`}>{enrollment.status === 'COMPLETED' ? text('مراجعة الدورة', 'Review course') : text('متابعة التعلم', 'Continue learning')}</Link> : <p className="mt-5 text-sm text-muted">{text('يتم تجهيز دروس هذه الدورة.', 'Lessons for this course are being prepared.')}</p>}
      {summary.total > 0 && summary.completed === summary.total && !enrollment.certificate && <div className="mt-5 border-t border-line pt-5"><CertificateButton courseId={enrollment.courseId}/></div>}
      {enrollment.certificate && !enrollment.certificate.revokedAt && <a href={`/api/certificates/${enrollment.certificate.id}`} className="button-secondary mt-4 inline-flex gap-2"><Trophy className="size-4"/>{text('تنزيل الشهادة', 'Download certificate')}</a>}
    </div></article>)}</div>{!cards.length && <div className="card p-8 text-center"><BookOpen className="mx-auto mb-4 size-10 text-accent"/><p className="mb-5 text-muted">{text('ابدأ رحلتك باختيار دورة تناسبك.', 'Start your learning journey with a course that interests you.')}</p><Link className="button-primary inline-flex" href="/courses">{text('اكتشف الدورات', 'Explore courses')}</Link></div>}</section>
    {certificates.length > 0 && <section aria-labelledby="certificates-title"><h2 id="certificates-title" className="mb-5 text-2xl font-semibold">{text('شهاداتي', 'My certificates')}</h2><div className="grid gap-4 md:grid-cols-2">{certificates.map(enrollment => <article key={enrollment.id} className="card flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><h3 className="break-words font-semibold">{contentText(enrollment.course, 'title', locale)}</h3><p className="mt-2 break-all text-xs text-muted" dir="ltr">{enrollment.certificate!.serial}</p></div><a className="button-secondary" href={`/api/certificates/${enrollment.certificate!.id}`}>{text('تنزيل PDF', 'Download PDF')}</a></article>)}</div></section>}
    <section><h2 className="mb-5 text-2xl font-semibold">{text('طلباتي', 'My orders')}</h2><div className="space-y-3">{orders.map(order => <Link href={`/orders/${order.id}`} className="card flex flex-wrap justify-between gap-3 p-5" key={order.id}><span className="break-all">{order.number}</span><span className="text-sm text-muted">{adminValueLabel(order.status, ar)}</span></Link>)}</div>{!orders.length && <p className="text-sm text-muted">{text('لا توجد طلبات بعد.', 'No orders yet.')}</p>}</section>
    {user.roles.includes('administrator') && <Link className="button-secondary inline-flex" href="/admin">{text('لوحة الإدارة', 'Admin dashboard')}</Link>}
  </div>;
}
