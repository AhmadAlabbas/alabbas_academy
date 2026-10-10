import {getTranslations} from 'next-intl/server';

export default async function Loading() {
  const t = await getTranslations('Common');
  return (
    <div className="container-shell py-12" role="status" aria-busy="true">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-4 h-3 w-32 rounded-full bg-line" />
        <div className="mb-6 h-12 w-3/4 max-w-xl rounded-xl bg-line" />
        <div className="mb-10 h-5 w-full max-w-2xl rounded-xl bg-line" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="card h-80 bg-white p-5"><div className="mb-6 h-40 rounded-xl bg-line" /><div className="mb-4 h-6 w-3/4 rounded-xl bg-line" /><div className="h-4 w-1/2 rounded-xl bg-line" /></div>)}</div>
      </div>
    </div>
  );
}
