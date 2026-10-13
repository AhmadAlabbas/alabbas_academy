'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {useLocale} from 'next-intl';
import {cleanupUnavailableMessage, deletionErrorMessage, type CourseDeletionPreview} from '@/lib/admin/deletion';
import {recordTitle} from '@/lib/admin/forms';

export function CourseTestDelete({courseId, onClose, onDeleted}: {courseId: string; onClose: () => void; onDeleted: () => Promise<void>}) {
  const ar = useLocale() === 'ar', id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<CourseDeletionPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const label = (arabic: string, english: string) => ar ? arabic : english;
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    void fetch('/api/admin/courses?deletionPreview=' + encodeURIComponent(courseId), {signal: controller.signal, cache: 'no-store'})
      .then(async response => {
        const body = await response.json();
        if (!response.ok) {setError(deletionErrorMessage(body, ar)); return;}
        setPreview(body);
      }).catch(() => {if (!controller.signal.aborted) setError(ar ? 'تعذر تحميل المعاينة. أغلق النافذة وأعد المحاولة.' : 'Unable to load preview. Close the dialog and retry.');});
    return () => controller.abort();
  }, [courseId, ar]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview?.canDeleteTestData || !confirmed || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/courses', {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: courseId, testData: {confirmedTestData: true, previewToken: preview.previewToken}})});
      if (!response.ok) {
        setError(deletionErrorMessage(await response.json().catch(() => ({})), ar));
        setConfirmed(false); return;
      }
      await onDeleted();
    } catch {setError(label('تعذر الاتصال. تحقق من قائمة الدورات قبل إعادة المحاولة.', 'Unable to connect. Check the course list before retrying.'));}
    finally {setBusy(false);}
  }
  return <dialog ref={dialog} aria-labelledby={id + '-title'} onClose={onClose} onCancel={event => {if (busy) event.preventDefault();}} className="card fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto p-6 backdrop:bg-black/50">
    <form onSubmit={submit} className="space-y-5">
      <h2 id={id + '-title'} className="text-xl font-semibold">{label('حذف دورة الاختبار', 'Delete test course')}</h2>
      {!preview && !error && <p role="status">{label('جارٍ تحميل معاينة الحذف…', 'Loading deletion preview…')}</p>}
      {preview && <>
        <p className="break-words font-semibold">{recordTitle(preview, ar)}</p>
        <p className="text-sm text-muted">{label('سيُحذف محتوى الدورة والسجلات التالية نهائيًا. ستبقى حسابات الطلاب وملفات مكتبة الوسائط وبيانات الدورات الأخرى.', 'The course content and these records will be permanently deleted. Student accounts, shared media files and other courses will remain.')}</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          {[
            [label('تسجيلات الطلاب', 'Student enrollments'), preview.blockers.enrollments],
            [label('التقييمات', 'Reviews'), preview.blockers.reviews],
            [label('سجلات التقدم والملاحظات', 'Progress and notes'), preview.learning.progress],
            [label('محاولات الاختبار', 'Exam attempts'), preview.learning.attempts],
            [label('الشهادات', 'Certificates'), preview.learning.certificates],
          ].map(([name, count]) => <div className="contents" key={String(name)}><dt>{name}</dt><dd>{count}</dd></div>)}
        </dl>
        {!preview.canDeleteTestData && <p role="alert" className="text-sm text-danger">{cleanupUnavailableMessage(preview.reason, ar)}</p>}
        {preview.canDeleteTestData && <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" required checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{label('أؤكد أن جميع تسجيلات الطلاب والتقييمات وسجلات التعلم في هذه الدورة هي بيانات اختبار.', 'I confirm all enrollments, reviews and learning records for this course are test data.')}</label>}
      </>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="button-primary" disabled={busy || !confirmed || !preview?.canDeleteTestData}>{busy ? label('جارٍ الحذف…', 'Deleting…') : label('حذف الدورة وبيانات الاختبار نهائيًا', 'Permanently delete course and test data')}</button>
        <button type="button" className="button-secondary" disabled={busy} onClick={() => dialog.current?.close()}>{label('إلغاء', 'Cancel')}</button>
      </div>
    </form>
  </dialog>;
}
