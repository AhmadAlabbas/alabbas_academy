'use client';

import {useId, useRef, useState, useEffect, useSyncExternalStore} from 'react';
import {useLocale} from 'next-intl';
import Image from 'next/image';
import {Upload, X, Save, ChevronDown} from 'lucide-react';
import {entities, adminValueLabel, type Field} from '@/lib/admin/registry';
import {initialDraft, serializeDraft, slugFromTitle, uploadFields, parentFields, type AdminLookups, type AdminRow} from '@/lib/admin/forms';
import {sarToHalalas} from '@/lib/money';
import {CoursePrice, Price} from '@/components/ui/price';
const subscribeToReady = () => () => {};
const editorReady = () => true;
const serverEditorReady = () => false;

export function AdminEditor({entity, row, lookups, parentValue, onCancel, onSaved, onRefreshLookups}: {
  entity: string; row: AdminRow; lookups: AdminLookups; parentValue: string;
  onCancel: () => void; onSaved: (row: AdminRow) => Promise<void>;
  onRefreshLookups: () => Promise<void>;
}) {
  const ar = useLocale() === 'ar';
  const text = (arabic: string, english: string) => ar ? arabic : english;
  const config = entities[entity];
  const creating = !row[config.identity || 'id'];
  const ready = useSyncExternalStore(subscribeToReady, editorReady, serverEditorReady);
  const [draft, setDraft] = useState(() => initialDraft(entity, row, parentValue));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const section = useRef<HTMLElement>(null);
  const id = useId();
  useEffect(() => {
    if (!ready) return;
    section.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
    section.current?.querySelector<HTMLInputElement>('input:not([type="checkbox"]), select, textarea')?.focus({preventScroll: true});
  }, [ready]);

  function change(key: string, value: string | boolean) {
    setDraft(previous => {
      const next = {...previous, [key]: value};
      if (creating && entity === 'courses' && ['title_ar', 'title_en'].includes(key)) {
        const slug = key.replace('title_', 'slug_');
        if (!previous[slug] || previous[slug] === previous.key || previous[slug] === slugFromTitle(String(previous[key] || ''))) {
          next[slug] = slugFromTitle(String(value)) || String(previous.key);
        }
      }
      if (key === 'videoUrl' && value) next.videoFileId = '';
      if (key === 'videoFileId' && value) next.videoUrl = '';
      return next;
    });
    setFieldErrors(previous => ({...previous, [key]: []}));
  }

  async function upload(field: Field, file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const body = new FormData(); body.set('file', file);
      const response = await fetch('/api/admin/upload', {method: 'POST', body});
      const result = await response.json();
      if (!response.ok) throw new Error();
      change(field.key, uploadFields[field.key].asUrl ? result.url : result.id);
      await onRefreshLookups();
      setNotice(text('تم رفع الملف واختياره: ', 'Uploaded and selected: ') + file.name);
    } catch {
      setError(text('تعذر رفع الملف. الصور حتى 5MB، ملفات PDF/TXT حتى 10MB، والفيديو حتى 25MB.', 'Upload failed. Images up to 5MB, PDF/TXT up to 10MB, and MP4 up to 25MB.'));
    } finally {setBusy(false);}
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setFieldErrors({});
    try {
      const data = serializeDraft(entity, draft);
      const response = await fetch(`/api/admin/${entity}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: row[config.identity || 'id'] ?? null, data}),
      });
      const result = await response.json();
      if (!response.ok) {
        setFieldErrors(result.fieldErrors || {});
        setError(result.code === 'DUPLICATE_VALUE'
          ? text('هذا الرابط أو المعرّف مستخدم بالفعل. غيّره من التفاصيل الإضافية.', 'This link or reference is already in use. Change it under More details.')
          : result.code === 'INVALID_RELATION'
            ? text('السجل المختار لم يعد متاحًا. اختر سجلًا آخر.', 'A selected item is no longer available. Choose another item.')
            : text('تعذر الحفظ. راجع الحقول المطلوبة والقيم المدخلة.', 'Unable to save. Check the required fields and their values.'));
        return;
      }
      await onSaved(result);
    } catch {
      setError(text('راجع الأرقام والمبالغ والقيم المدخلة ثم حاول مجددًا.', 'Check numbers, amounts and entered values, then try again.'));
    } finally {setBusy(false);}
  }

  const advanced = new Set([
    'position', 'slug_ar', 'slug_en', 'seo_ar', 'seo_en',
    ...(['courses', 'categories', 'instructors', 'tags', 'faqs'].includes(entity) ? ['key'] : []),
  ]);
  const visible = config.fields.filter(field => !advanced.has(field.key) && !(entity === 'coupons' && (draft.kind === 'PERCENTAGE' ? field.key === 'amountHalalas' : ['percentageBasisPoints', 'maximumDiscountHalalas'].includes(field.key))));
  const extra = config.fields.filter(field => advanced.has(field.key));
  let pricePreview: {amount: number; original: number | null} | null = null;
  try {if (entity === 'courses') pricePreview = {amount: sarToHalalas(String(draft.priceHalalas || '0')), original: draft.compareAtHalalas ? sarToHalalas(String(draft.compareAtHalalas)) : null};} catch {}
  let couponAmount = 0;
  try {if (entity === 'coupons' && draft.kind === 'FIXED_AMOUNT') couponAmount = sarToHalalas(String(draft.amountHalalas || '0'));} catch {}
  const fieldView = (field: Field) => {
    const required = field.required || (entity === 'coupons' && field.key === (draft.kind === 'PERCENTAGE' ? 'percentageBasisPoints' : 'amountHalalas'));
    const options = lookups[field.key];
    const value = draft[field.key];
    const fieldId = id + '-' + field.key;
    const errors = fieldErrors[field.key];
    const isNumber = ['number', 'money', 'percentage'].includes(field.type || '');
    return <div key={field.key} className={`min-w-0 ${field.type === 'textarea' || field.type === 'json' ? 'md:col-span-2' : ''}`}>
      <label htmlFor={fieldId} className="mb-2 block text-sm font-medium">
        {ar ? field.ar : field.en}{required && <span aria-hidden="true" className="ms-1 text-danger">*</span>}
      </label>
      {field.type === 'boolean' ? <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-canvas px-3">
        <input id={fieldId} name={field.key} className="size-5 accent-[var(--blue)]" type="checkbox" checked={value === true} onChange={event => change(field.key, event.target.checked)} />
        <span className="text-sm text-muted">{text('تفعيل', 'Enabled')}</span>
      </label> : options ? <select id={fieldId} name={field.key} className="field" required={required} value={String(value || '')} onChange={event => change(field.key, event.target.value)} aria-invalid={errors?.length ? true : undefined}>
        <option value="">{required ? text('اختر…', 'Choose…') : text('بدون', 'None')}</option>
        {value && !options.some(item => item.id === value) && <option value={String(value)}>{text('الاختيار المحفوظ', 'Saved selection')}</option>}
        {options.map(item => <option value={item.id} key={item.id}>{ar ? item.title_ar || item.title_en : item.title_en || item.title_ar}</option>)}
      </select> : field.type === 'select' ? <select id={fieldId} name={field.key} className="field" required={required} value={String(value || '')} onChange={event => change(field.key, event.target.value)}>
        {field.options?.map(option => <option key={option} value={option}>{adminValueLabel(option, ar)}</option>)}
      </select> : field.type === 'textarea' || field.type === 'json' ? <textarea id={fieldId} name={field.key} className="field min-h-28" required={required} value={String(value || '')} onChange={event => change(field.key, event.target.value)} dir={field.key.endsWith('_en') || field.type === 'json' ? 'ltr' : undefined} aria-invalid={errors?.length ? true : undefined} /> : <input
        id={fieldId} name={field.key} className="field" required={required}
        value={String(value ?? '')} onChange={event => change(field.key, event.target.value)}
        type={isNumber ? 'number' : field.type === 'date' ? 'datetime-local' : 'text'}
        min={isNumber ? (['points', 'perUserLimit', 'usageLimit', 'timeLimitMinutes', 'maximumAttempts'].includes(field.key) ? 1 : entity === 'coupons' && ['amountHalalas', 'percentageBasisPoints', 'maximumDiscountHalalas'].includes(field.key) ? 0.01 : 0) : undefined}
        max={field.type === 'percentage' ? 100 : undefined}
        step={field.type === 'money' || field.type === 'percentage' ? '0.01' : isNumber ? '1' : undefined}
        inputMode={field.type === 'money' || field.type === 'percentage' ? 'decimal' : isNumber ? 'numeric' : undefined}
        placeholder={field.key === 'position' ? parentFields[entity] ? text('تلقائي', 'Automatic') : '0' : undefined}
        dir={field.key.endsWith('_en') || ['key', 'videoUrl', 'previewUrl', 'slug_en', 'languages'].includes(field.key) ? 'ltr' : undefined}
        aria-invalid={errors?.length ? true : undefined}
      />}
      {errors?.length ? <p role="alert" className="mt-2 text-sm text-danger">{ar ? 'راجع هذا الحقل.' : errors.join(' ')}</p> : null}
      {field.key === 'compareAtHalalas' && <p className="mt-2 text-sm text-muted">{text('اختياري: أدخل السعر الأصلي الحقيقي، ويجب أن يكون أعلى من السعر الحالي. اتركه فارغًا دون عرض.', 'Optional: enter the real original price, higher than the current price. Leave blank when there is no sale.')}</p>}
      {field.key === 'code' && entity === 'coupons' && <p className="mt-2 text-sm text-muted">{text('حتى 40 حرفًا أو رقمًا دون مسافات. يُحفظ الرمز بأحرف كبيرة.', 'Up to 40 letters or numbers without spaces. Codes are saved in uppercase.')}</p>}
      {entity === 'coupons' && ['usageLimit', 'maximumDiscountHalalas'].includes(field.key) && <p className="mt-2 text-sm text-muted">{text('اتركه فارغًا دون حد.', 'Leave blank for no limit.')}</p>}
      {field.key === 'isCorrect' && <p className="mt-2 text-sm text-muted">{text('اختيار هذه الإجابة يجعلها الإجابة الصحيحة الوحيدة للسؤال.', 'Selecting this answer makes it the question’s only correct answer.')}</p>}
      {options?.length === 0 && required && <p className="mt-2 text-sm text-muted">{text('لا توجد خيارات بعد. أنشئ السجل المرتبط أولًا.', 'No choices yet. Create the related item first.')}</p>}
      {uploadFields[field.key] && <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="button-secondary relative cursor-pointer gap-2">
          <Upload className="size-4" aria-hidden="true" />{text('رفع واختيار ملف', 'Upload and select a file')}
          <input type="file" aria-label={text('رفع ملف: ', 'Upload file: ') + (ar ? field.ar : field.en)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" accept={uploadFields[field.key].accept} disabled={busy} onChange={event => {void upload(field, event.target.files?.[0]); event.target.value = '';}} />
        </label>
        {value && uploadFields[field.key].asUrl && <Image src={String(value)} alt={text('الصورة المختارة', 'Selected image')} width={96} height={64} unoptimized className="h-16 w-24 rounded-lg border border-line object-cover" />}
      </div>}
    </div>;
  };

  return <section ref={section} className="card scroll-mt-28 overflow-hidden" aria-labelledby={id + '-heading'}>
    <div className="flex items-start justify-between gap-4 border-b border-line bg-skysoft px-5 py-5 sm:px-7">
      <div><h2 id={id + '-heading'} className="text-xl font-semibold">{creating ? text('إضافة: ', 'Create: ') : text('تعديل: ', 'Edit: ')}{ar ? config.ar : config.en}</h2>
        <p className="mt-2 text-sm text-muted">{text('اختر السجلات بأسمائها. الحقول بعلامة * مطلوبة.', 'Choose related items by name. Fields marked * are required.')}</p></div>
      <button className="button-secondary shrink-0 p-3" type="button" aria-label={text('إغلاق المحرر', 'Close editor')} onClick={onCancel} disabled={busy}><X className="size-4" /></button>
    </div>
    <form onSubmit={save} className="p-5 sm:p-7" aria-labelledby={id + '-heading'}>
      <fieldset disabled={busy || !ready} className="grid min-w-0 gap-5 md:grid-cols-2">{visible.map(fieldView)}</fieldset>
      {pricePreview && <div className="mt-5 rounded-xl border border-line bg-canvas p-4"><p className="mb-3 text-sm text-muted">{text('معاينة السعر', 'Price preview')}</p><CoursePrice amount={pricePreview.amount} original={pricePreview.original} locale={ar ? 'ar' : 'en'} className="text-xl" /></div>}
      {entity === 'coupons' && <div className="mt-5 rounded-xl border border-line bg-canvas p-4 text-sm"><p>{text('معاينة الخصم', 'Discount preview')}: <bdi>{String(draft.code || '').trim().toUpperCase() || text('رمزك', 'YOURCODE')}</bdi></p><p className="mt-2 font-semibold">{draft.kind === 'PERCENTAGE' ? `${String(draft.percentageBasisPoints || '0')}% ${text('خصم', 'off')}` : <Price amount={couponAmount} locale={ar ? 'ar' : 'en'} />}</p><p className="mt-2 text-muted">{text('يُطبق الرمز على الأسعار الحالية في السلة، بما فيها أسعار العروض. يظل التحقق من الحدود والتواريخ مطلوبًا عند الطلب.', 'The code discounts current cart prices, including sale prices. Usage limits and dates are checked at checkout.')}</p></div>}
      {extra.length > 0 && <details className="mt-6 rounded-xl border border-line p-4"><summary className="flex cursor-pointer items-center justify-between gap-3 font-medium">{text('تفاصيل إضافية', 'More details')}<ChevronDown className="size-4" /></summary>
        <fieldset disabled={busy || !ready} className="mt-5 grid min-w-0 gap-5 md:grid-cols-2">{extra.map(fieldView)}</fieldset>
      </details>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-successsoft p-3 text-sm text-success">{notice}</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-dangersoft p-3 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5"><button className="button-primary gap-2" disabled={busy || !ready}><Save className="size-4" aria-hidden="true" />{!ready ? text('جارٍ تحميل المحرر…', 'Loading editor…') : busy ? text('جارٍ الحفظ…', 'Saving…') : text('حفظ', 'Save')}</button>
        <button className="button-secondary" type="button" onClick={onCancel} disabled={busy}>{text('إلغاء', 'Cancel')}</button></div>
    </form>
  </section>;
}
