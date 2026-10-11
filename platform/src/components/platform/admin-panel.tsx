"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import {
  entities,
  adminValueLabel,
  adminStatusChoices,
} from "@/lib/admin/registry";
import { Link } from "@/i18n/navigation";
type Row = Record<string, unknown>;
export function AdminPanel({
  entity,
  initial,
  lookups = {},
  initialQuery = "",
}: {
  entity: string;
  lookups?: Record<
    string,
    { id: string; title_ar: string; title_en: string }[]
  >;
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
    [current, setCurrent] = useState<Row | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function reload(p = page) {
    const r = await fetch(
      `/api/admin/${entity}?page=${p}&q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`,
    );
    if (!r.ok) {
      setMessage(label("تعذر تحميل البيانات", "Unable to load data"));
      return;
    }
    const b = await r.json();
    setRows(b.rows);
    setTotal(b.total);
    setPage(p);
  }
  async function action(data: Row) {
    setBusy(true);
    const r = await fetch("/api/admin/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setMessage(
      r.ok
        ? label("تم تنفيذ الإجراء", "Action completed")
        : label(
            "تعذر تنفيذ الإجراء. تحقق من البيانات والصلاحيات.",
            "Action failed. Check the data and permissions.",
          ),
    );
    setBusy(false);
    if (r.ok) await reload();
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    setBusy(true);
    const form = new FormData(event.currentTarget),
      data: Row = {};
    try {
      for (const field of config.fields) {
        const v = String(form.get(field.key) || "");
        data[field.key] =
          field.type === "boolean"
            ? form.has(field.key)
            : field.type === "number"
              ? v === ""
                ? null
                : Number(v)
              : field.type === "json"
                ? JSON.parse(v)
                : field.type === "date"
                  ? v
                    ? new Date(v).toISOString()
                    : null
                  : v || (!field.required ? null : "");
      }
      const r = await fetch(`/api/admin/${entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current[config.identity || "id"] ?? null,
          data,
        }),
      });
      if (!r.ok) throw Error();
      setCurrent(null);
      setMessage(label("تم الحفظ", "Saved"));
      await reload();
    } catch {
      setMessage(
        label(
          "تعذر الحفظ. تحقق من الحقول والمعرّفات الفريدة والعلاقات.",
          "Unable to save. Check fields, unique IDs and related records.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    setBusy(true);
    const r = await fetch("/api/admin/upload", { method: "POST", body: data });
    const b = await r.json();
    setMessage(
      r.ok
        ? label("معرّف الملف: ", "File ID: ") + b.id + " | " + b.url
        : label(
            "تعذر رفع الملف: صورة 5MB أو PDF/TXT 10MB أو MP4 25MB",
            "Upload failed: image 5MB, PDF/TXT 10MB or MP4 25MB",
          ),
    );
    setBusy(false);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">{ar ? config.ar : config.en}</h1>
        {!config.readonly && (
          <button className="button-primary" onClick={() => setCurrent({})}>
            {label("إضافة جديد", "Add new")}
          </button>
        )}
      </div>
      <div className="card flex flex-wrap gap-3 p-4">
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
        <button
          className="button-secondary self-end"
          onClick={() => void action({ action: "retry-email" })}
        >
          {label("إعادة تسليم البريد", "Retry email delivery")}
        </button>
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
      {current && (
        <form onSubmit={save} className="card grid gap-4 p-6 md:grid-cols-2">
          {config.fields.map((field) => (
            <label key={field.key} className="text-sm">
              {ar ? field.ar : field.en}
              {field.type === "boolean" ? (
                <input
                  className="ms-3 size-5"
                  name={field.key}
                  type="checkbox"
                  defaultChecked={Boolean(current[field.key])}
                />
              ) : field.type === "select" ? (
                <select
                  className="field"
                  name={field.key}
                  defaultValue={String(
                    current[field.key] ?? field.options?.[0] ?? "",
                  )}
                >
                  {field.options?.map((v) => (
                    <option key={v} value={v}>
                      {adminValueLabel(v, ar)}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" || field.type === "json" ? (
                <textarea
                  className="field min-h-28"
                  name={field.key}
                  required={field.required}
                  defaultValue={
                    field.type === "json"
                      ? JSON.stringify(current[field.key] ?? {})
                      : String(current[field.key] ?? "")
                  }
                />
              ) : (
                <input
                  className="field"
                  name={field.key}
                  list={lookups[field.key] ? `lookup-${field.key}` : undefined}
                  type={
                    field.type === "number"
                      ? "number"
                      : field.type === "date"
                        ? "datetime-local"
                        : "text"
                  }
                  min={field.type === "number" ? 0 : undefined}
                  required={field.required}
                  defaultValue={
                    field.type === "date"
                      ? String(current[field.key] ?? "").slice(0, 16)
                      : String(current[field.key] ?? "")
                  }
                />
              )}
              {lookups[field.key] && (
                <datalist id={`lookup-${field.key}`}>
                  {lookups[field.key].map((item) => (
                    <option key={item.id} value={item.id}>
                      {ar ? item.title_ar : item.title_en}
                    </option>
                  ))}
                </datalist>
              )}
            </label>
          ))}
          <div className="flex gap-3">
            <button disabled={busy} className="button-primary">
              {label("حفظ", "Save")}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setCurrent(null)}
            >
              {label("إلغاء", "Cancel")}
            </button>
          </div>
        </form>
      )}
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
                  <b>
                    {String(
                      row.title_ar ??
                        row.name ??
                        row.number ??
                        row.key ??
                        row.id,
                    )}
                  </b>
                  <p className="mt-2 font-mono text-xs" dir="ltr">
                    {String(row.id ?? row.key)}
                  </p>
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
                            const role = window.prompt(
                              label(
                                "الدور: administrator / support / learner",
                                "Role: administrator / support / learner",
                              ),
                              "learner",
                            );
                            if (role)
                              void action({
                                action: "role",
                                id: row.id,
                                value: role,
                              });
                          }}
                        >
                          {label("الدور", "Role")}
                        </button>
                        <button
                          className="button-secondary"
                          onClick={() => {
                            const course = window.prompt(
                              label("معرّف الدورة", "Course ID"),
                            );
                            if (course)
                              void action({
                                action: "enroll",
                                userId: row.id,
                                courseId: course,
                              });
                          }}
                        >
                          {label("تسجيل مجاني", "Free enrollment")}
                        </button>
                        <button
                          className="button-secondary"
                          onClick={() => {
                            const course = window.prompt(
                              label(
                                "معرّف الدورة لإلغاء الوصول",
                                "Course ID to revoke access",
                              ),
                            );
                            if (course)
                              void action({
                                action: "revoke",
                                userId: row.id,
                                courseId: course,
                              });
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
                        href={`/admin/sections?q=${row.id}`}
                      >
                        {label("أقسام الدورة", "Course sections")}
                      </Link>
                    )}
                    {entity === "sections" && (
                      <Link
                        className="button-secondary"
                        href={`/admin/lessons?q=${row.id}`}
                      >
                        {label("دروس القسم", "Section lessons")}
                      </Link>
                    )}
                    {entity === "exams" && (
                      <Link
                        className="button-secondary"
                        href={`/admin/questions?q=${row.id}`}
                      >
                        {label("الأسئلة", "Questions")}
                      </Link>
                    )}
                    {entity === "questions" && (
                      <Link
                        className="button-secondary"
                        href={`/admin/options?q=${row.id}`}
                      >
                        {label("الإجابات", "Answers")}
                      </Link>
                    )}
                    {entity === "courses" && (
                      <button
                        className="button-secondary"
                        onClick={() => {
                          const value = window.prompt(
                            label("معرّف الوسم", "Tag ID"),
                          );
                          if (value)
                            void action({
                              action: "tag",
                              courseId: row.id,
                              value,
                            });
                        }}
                      >
                        {label("إضافة وسم", "Add tag")}
                      </button>
                    )}
                    {entity === "courses" && (
                      <button
                        className="button-secondary"
                        onClick={() => {
                          const value = window.prompt(
                            label("معرّف المدرب", "Instructor ID"),
                          );
                          if (value)
                            void action({
                              action: "instructor",
                              courseId: row.id,
                              value,
                            });
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
            "رفع صورة / ملف PDF أو TXT / فيديو MP4. انسخ معرّف الملف إلى الحقل المناسب.",
            "Upload an image / PDF or TXT / MP4. Copy the returned file ID into the relevant field.",
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
