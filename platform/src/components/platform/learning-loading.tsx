import {getLocale} from 'next-intl/server';
export async function LearningLoading() {
  const ar = await getLocale() === 'ar';
  return <div className="container-shell py-12" role="status" aria-label={ar ? 'جارٍ تحميل مساحة التعلم' : 'Loading your learning space'}><p className="mb-6 text-sm text-muted">{ar ? 'جارٍ تحميل مساحة التعلم…' : 'Loading your learning space…'}</p><div aria-hidden="true" className="animate-pulse space-y-6 motion-reduce:animate-none"><div className="h-10 w-2/3 rounded-xl bg-line"/><div className="grid gap-5 sm:grid-cols-3">{[1,2,3].map(item => <div key={item} className="card h-32 bg-surface"/>)}</div><div className="card h-72 bg-surface"/></div></div>;
}
