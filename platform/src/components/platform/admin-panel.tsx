"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import {
  entities,
  adminValueLabel,
  adminStatusChoices,
} from "@/lib/admin/registry";
import { Link } from "@/i18n/navigation";
import {AdminEditor} from './admin-editor';
import {AdminActionPicker, type ChoiceAction} from './admin-action-picker';
import {parentFields, recordTitle, type AdminLookups} from '@/lib/admin/forms';
import {formatSAR} from '@/lib/money';
type Row = Record<string, unknown>;
export function AdminPanel({
  entity,
  initial,
  lookups = {},
  initialQuery = "",
  initialParent = "",
  openEditor = false,
  initialRecord,
}: {
  entity: string;
  lookups?: AdminLookups;
  initialParent?: string;
  openEditor?: boolean;
  initialRecord?: Row;
  initialQuery?: string;
  initial: { rows: unknown; total: number; page: number };
}) {
  const ar = useLocale() === "ar",
    config = entities[entity],
    label = (a: string, e: string) => (ar ? a : e);
  const [rows, setRows] = useState(initial.rows as Row[]),
    [total, setTotal] = useState(initial.total),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(initialQuery),
    [status, setStatus] = useState(""),
    [current, setCurrent] = useState<Row | null>(openEditor ? initialRecord || {} : null),
    [lookupChoices, setLookupChoices] = useState(lookups),
    [parentValue, setParentValue] = useState(initialParent),
    [picker, setPicker] = useState<ChoiceAction | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const parentField = parentFields[entity];
  const selectedParent = lookupChoices[parentField]?.find(item => item.id === parentValue);
  const courseId = parentField === 'courseId' ? parentValue : selectedParent?.courseId;
  async function refreshLookups() {
    try {
      const response = await fetch('/api/admin/lookups');
      if (response.ok) setLookupChoices(await response.json());
    } catch { /* Uploaded selections remain selected even if refresh is delayed. */ }
  }
  async function reload(p = page) {
    const r = await fetch(
      `/api/admin/${entity}?page=${p}&q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&includeLookups=1${parentField && parentValue ? '&' + parentField + '=' + encodeURIComponent(parentValue) : ''}`,
    );
    if (!r.ok) {
      setMessage(label("تعذر تحميل البيانات", "Unable to load data"));
      return;
    }
    const b = await r.json();
    setRows(b.rows);
    setTotal(b.total);
    setPage(p);
    if (b.lookups) setLookupChoices(b.lookups);
  }
  async function action(data: Row) {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/action', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data),
      });
      setMessage(response.ok ? label('تم تنفيذ الإجراء', 'Action completed') : label('تعذر تنفيذ الإجراء. راجع البيانات.', 'Action failed. Check the data.'));
      if (response.ok) await reload();
      return response.ok;
    } catch {
      setMessage(label('تعذر الاتصال. حاول مجددًا.', 'Unable to connect. Try again.'));
      return false;
    } finally {setBusy(false);}
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    setBusy(true);
    try {
    const r = await fetch("/api/admin/upload", { method: "POST", body: data });
    setMessage(
      r.ok
        ? label("تم رفع الملف: ", "Uploaded: ") + file.name
        : label(
            "تعذر رفع الملف: صورة 5MB أو PDF/TXT 10MB أو MP4 25MB",
            "Upload failed: image 5MB, PDF/TXT 10MB or MP4 25MB",
          ),
    );
    if (r.ok) await refreshLookups();
    } catch {
      setMessage(label('تعذر الاتصال. حاول رفع الملف مجددًا.', 'Unable to connect. Try uploading again.'));
    } finally {setBusy(false); event.target.value = '';}
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">{ar ? config.ar : config.en}</h1>
        {!config.readonly && (
          <button className="button-primary" onClick={() => setCurrent(['courses', 'categories', 'instructors', 'tags', 'faqs'].includes(entity) ? {key: `${entity}-${crypto.randomUUID().slice(0, 12)}`} : {})}>
            {label("إضافة جديد", "Add new")}
          </button>
        )}
      </div>
      {courseId && <Link href={`/admin/courses/${courseId}`} className="button-secondary inline-flex">{label('العودة إلى محتوى الدورة', 'Back to course content')}</Link>}
      {picker && <AdminActionPicker selection={picker} lookups={lookupChoices} onClose={() => setPicker(null)} onSubmit={action} />}
      <div className="card flex flex-wrap gap-3 p-4">
        {parentField && <label className="min-w-0 flex-1 sm:min-w-52">
          {ar ? config.fields.find(field => field.key === parentField)?.ar : config.fields.find(field => field.key === parentField)?.en}
          <select className="field" value={parentValue} onChange={event => setParentValue(event.target.value)}>
            <option value="">{label('كل السجلات', 'All items')}</option>
            {lookupChoices[parentField]?.map(item => <option key={item.id} value={item.id}>{ar ? item.title_ar : item.title_en}</option>)}
          </select>
        </label>}
        <label>
          {label("بحث", "Search")}
          <input
            className="field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          {label("الحالة", "Status")}
          <select
            className="field"
            value={status}
            disabled={!adminStatusChoices[entity]}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{label("كل الحالات", "All statuses")}</option>
            {adminStatusChoices[entity]?.map((value) => (
              <option value={value} key={value}>
                {adminValueLabel(value, ar)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button-primary self-end"
          onClick={() => void reload(1)}
        >
          {label("تطبيق", "Apply")}
        </button>
        {entity === 'jobs' && <button className="button-secondary self-end" onClick={() => void action({action: 'retry-email'})}>{label('إعادة تسليم البريد', 'Retry email delivery')}</button>}
      </div>
      {entity === "orders" && (
        <a
          href={`/api/admin/orders-csv?status=${encodeURIComponent(status)}`}
          className="button-secondary inline-block"
        >
          {label("تصدير CSV", "Export CSV")}
        </a>
      )}
      <p role="status" className="break-words text-sm">
        {message}
      </p>
      {current && <AdminEditor key={String(current[config.identity || 'id'] || current.key || 'new')} entity={entity} row={current} lookups={lookupChoices} parentValue={parentValue}
        onCancel={() => setCurrent(null)} onRefreshLookups={refreshLookups}
        onSaved={async () => {setCurrent(null); setMessage(label('تم الحفظ', 'Saved')); await reload();
          if (entity === 'courses') setMessage(label('تم حفظ الدورة. افتح «إدارة المحتوى» لإضافة الدروس والاختبارات.', 'Course saved. Open Manage content to add lessons and exams.'));
        }} />}
      <div className="card overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr>
              <th className="p-4 text-start">{label("السجل", "Record")}</th>
              <th className="p-4 text-start">{label("التفاصيل", "Details")}</th>
              <th className="p-4 text-start">{label("إجراءات", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className="border-t border-line"
                key={String(row.id ?? row.key)}
              >
                <td className="max-w-64 break-words p-4">
                  <b>{recordTitle(row, ar)}</b>
                  {Boolean(row[parentField]) && <p className="mt-2 text-xs text-muted">{(() => {const parent = lookupChoices[parentField]?.find(item => item.id === row[parentField]); return parent ? (ar ? parent.title_ar : parent.title_en) : '';})()}</p>}
                  {entity === 'courses' && <p className="mt-2 text-sm text-accent">{formatSAR(Number(row.priceHalalas || 0), ar ? 'ar' : 'en')}</p>}
                </td>
                <td className="max-w-lg p-4">
                  <details>
                    <summary>
                      {String(
                        (row.status
                          ? adminValueLabel(String(row.status), ar)
                          : null) ??
                          row.email ??
                          (ar ? row.title_ar : row.title_en) ??
                          label("عرض التفاصيل", "View details"),
                      )}
                    </summary>
                    <pre
                      className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs"
                      dir="ltr"
                    >
                      {JSON.stringify(row, null, 2)}
                    </pre>
                  </details>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {!config.readonly && (
                      <>
                        <button
                          className="button-secondary"
                          onClick={() => setCurrent(row)}
                        >
                          {label("تعديل", "Edit")}
                        </button>
                        {!["reviews", "contacts"].includes(entity) && (
                          <button
                            className="button-secondary"
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  label(
                                    "حذف هذا السجل؟",
                                    "Delete this record?",
                                  ),
                                )
                              )
                                return;
                              const r = await fetch(`/api/admin/${entity}`, {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: row[config.identity || "id"],
                                }),
                              });
                              setMessage(
                                r.ok
                                  ? label("تم الحذف", "Deleted")
                                  : label(
                                      "السجل مرتبط ببيانات أخرى، استخدم الأرشفة",
                                      "Record has related data; archive it instead",
                                    ),
                              );
                              if (r.ok) await reload();
                            }}
                          >
                            {label("حذف", "Delete")}
                          </button>
                        )}
                      </>
                    )}
                    {entity === "orders" &&
                      row.status === "PENDING" &&
                      row.provider === "manual" && (
                        <button
                          disabled={busy}
                          className="button-primary"
                          onClick={() => {
                            if (
                              window.confirm(
                                label(
                                  "هل تأكدت من استلام المبلغ؟",
                                  "Have you confirmed receipt of payment?",
                                ),
                              )
                            )
                              void action({ action: "mark-paid", id: row.id });
                          }}
                        >
                          {label("تأكيد الدفع", "Mark paid")}
                        </button>
                      )}
                    {entity === "orders" && row.status === "PAID" && (
                      <button
                        disabled={busy}
                        className="button-secondary"
                        onClick={() => {
                          const reason = window.prompt(
                            label(
                              "سبب الاسترداد. للطلب اليدوي أكد إعادة المبلغ للعميل أولاً.",
                              "Refund reason. For manual orders, return the funds to the customer first.",
                            ),
                          );
                          if (reason)
                            void action({
                              action: "refund",
                              id: row.id,
                              reason,
                            });
                        }}
                      >
                        {label("استرداد", "Refund")}
                      </button>
                    )}
                    {entity === "users" && (
                      <>
                        <button
                          className="button-secondary"
                          onClick={() =>
                            void action({
                              action: row.status === "ACTIVE" ? "ban" : "unban",
                              id: row.id,
                            })
                          }
                        >
                          {row.status === "ACTIVE"
                            ? label("حظر", "Ban")
                            : label("إلغاء الحظر", "Unban")}
                        </button>
                        <button
                          className="button-secondary"
                          onClick={() => {
                            setPicker({kind: 'role', row});
                          }}
                        >
                          {label("الدور", "Role")}
                        </button>
                        <button
                          className="button-secondary"
                          onClick={() => {
                            setPicker({kind: 'enroll', row});
                          }}
                        >
                          {label("تسجيل مجاني", "Free enrollment")}
                        </button>
                        <button
                          className="button-secondary"
                          onClick={() => {
                            setPicker({kind: 'revoke', row});
                          }}
                        >
                          {label("إلغاء الوصول", "Revoke access")}
                        </button>
                        <button
                          className="button-secondary"
                          onClick={() =>
                            void action({ action: "resend", id: row.id })
                          }
                        >
                          {label("إعادة التحقق", "Resend verification")}
                        </button>
                      </>
                    )}
                    {["sections", "lessons"].includes(entity) &&
                      ["up", "down"].map((value) => (
                        <button
                          className="button-secondary"
                          key={value}
                          disabled={busy}
                          onClick={() =>
                            void action({
                              action: "move",
                              id: row.id,
                              entity,
                              value,
                            })
                          }
                        >
                          {value === "up"
                            ? label("أعلى", "Move up")
                            : label("أسفل", "Move down")}
                        </button>
                      ))}
                    {entity === "courses" && (
                      <Link
                        className="button-secondary"
                        href={`/admin/courses/${row.id}`}
                      >
                        {label("إدارة المحتوى", "Manage content")}
                      </Link>
                    )}
                    {entity === "sections" && (
                      <Link
                        className="button-secondary"
                        href={`/admin/lessons?sectionId=${row.id}`}
                      >
                        {label("دروس القسم", "Section lessons")}
                      </Link>
                    )}
                    {entity === "exams" && (
                      <Link
                        className="button-secondary"
                        href={`/admin/questions?examId=${row.id}`}
                      >
                        {label("الأسئلة", "Questions")}
                      </Link>
                    )}
                    {entity === "questions" && (
                      <Link
                        className="button-secondary"
                        href={`/admin/options?questionId=${row.id}`}
                      >
                        {label("الإجابات", "Answers")}
                      </Link>
                    )}
                    {entity === "courses" && (
                      <button
                        className="button-secondary"
                        onClick={() => {
                          setPicker({kind: 'tag', row});
                        }}
                      >
                        {label("إضافة وسم", "Add tag")}
                      </button>
                    )}
                    {entity === "courses" && (
                      <button
                        className="button-secondary"
                        onClick={() => {
                          setPicker({kind: 'instructor', row});
                        }}
                      >
                        {label("إضافة مدرب", "Add instructor")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-8">{label("لا توجد سجلات", "No records found")}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button
          className="button-secondary"
          disabled={page === 1}
          onClick={() => void reload(page - 1)}
        >
          {label("السابق", "Previous")}
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / 25))}
        </span>
        <button
          className="button-secondary"
          disabled={page * 25 >= total}
          onClick={() => void reload(page + 1)}
        >
          {label("التالي", "Next")}
        </button>
      </div>
      <div className="card p-5">
        <label className="block text-sm">
          {label(
            "مكتبة الملفات: ارفع صورة أو PDF/TXT أو فيديو MP4، ثم اختره بالاسم داخل المحرر.",
            "File library: upload an image, PDF/TXT or MP4, then choose it by name in the editor.",
          )}
          <input
            type="file"
            onChange={upload}
            disabled={busy}
            accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,video/mp4"
            className="mt-3 block max-w-full"
          />
        </label>
      </div>
      <div className="card flex flex-wrap gap-3 p-4">
        {Object.entries(entities).map(([key, value]) => (
          <Link className="button-secondary" key={key} href={`/admin/${key}`}>
            {ar ? value.ar : value.en}
          </Link>
        ))}
      </div>
    </div>
  );
}
