'use client';

import {useEffect, useRef, useState, useId} from 'react';
import {useLocale} from 'next-intl';
import {type AdminLookups, type AdminRow, recordTitle} from '@/lib/admin/forms';

export type ChoiceAction = {kind: 'instructor' | 'tag' | 'enroll' | 'revoke' | 'role'; row: AdminRow};
export function AdminActionPicker({selection, lookups, onClose, onSubmit}: {
  selection: ChoiceAction; lookups: AdminLookups; onClose: () => void;
  onSubmit: (data: AdminRow) => Promise<boolean>;
}) {
  const ar = useLocale() === 'ar';
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const names = {
    instructor: ['إضافة مدرب', 'Add instructor'], tag: ['إضافة وسم', 'Add tag'],
    enroll: ['تسجيل مجاني', 'Free enrollment'], revoke: ['إلغاء الوصول', 'Revoke access'],
    role: ['تغيير الدور', 'Change role'],
  };
  const title = names[selection.kind][ar ? 0 : 1];
  const options = selection.kind === 'role'
    ? [{id: 'learner', title_ar: 'متعلم', title_en: 'Learner'}, {id: 'support', title_ar: 'دعم', title_en: 'Support'}, {id: 'administrator', title_ar: 'مسؤول', title_en: 'Administrator'}]
    : lookups[selection.kind === 'instructor' ? 'instructorId' : selection.kind === 'tag' ? 'tagId' : 'courseId'] || [];
  useEffect(() => {dialog.current?.showModal();}, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFailed(false);
    try {
      const data = selection.kind === 'enroll' || selection.kind === 'revoke'
        ? {action: selection.kind, userId: selection.row.id, courseId: value}
        : selection.kind === 'role'
          ? {action: 'role', id: selection.row.id, value}
          : {action: selection.kind, courseId: selection.row.id, value};
      if (await onSubmit(data)) dialog.current?.close(); else setFailed(true);
    } catch {setFailed(true);} finally {setBusy(false);}
  }
  return <dialog ref={dialog} onClose={onClose} aria-labelledby={id + '-title'} className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-black/50">
    <h2 id={id + '-title'} className="text-xl font-semibold">{title}</h2>
    <p className="mt-2 break-words text-sm text-muted">{recordTitle(selection.row, ar)}</p>
    <form onSubmit={submit} className="mt-6 space-y-5">
      <label className="block text-sm font-medium" htmlFor={id + '-choice'}>{ar ? 'اختر بالاسم' : 'Choose by name'}</label>
      <select id={id + '-choice'} className="field" required value={value} onChange={event => setValue(event.target.value)} disabled={busy}>
        <option value="">{ar ? 'اختر…' : 'Choose…'}</option>
        {options.map(option => <option key={option.id} value={option.id}>{ar ? option.title_ar : option.title_en}</option>)}
      </select>
      {!options.length && <p className="text-sm text-muted">{ar ? 'أنشئ السجل المرتبط أولًا.' : 'Create the related item first.'}</p>}
      {failed && <p role="alert" className="text-sm text-danger">{ar ? 'تعذر تنفيذ الإجراء. راجع الاختيار وحاول مجددًا.' : 'Unable to complete the action. Check the selection and try again.'}</p>}
      <div className="flex gap-3"><button className="button-primary" disabled={busy || !options.length}>{busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ' : 'Save')}</button>
        <button type="button" className="button-secondary" disabled={busy} onClick={() => dialog.current?.close()}>{ar ? 'إلغاء' : 'Cancel'}</button></div>
    </form>
  </dialog>;
}
