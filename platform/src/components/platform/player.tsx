"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {contentText} from '@/lib/course-content';
import { useRouter } from '@/i18n/navigation';
import { safeEmbed } from "@/lib/media/video";
export function Video({
  url,
  fileId,
  title,
}: {
  url?: string | null;
  fileId?: string | null;
  title: string;
}) {
  const embed = url ? safeEmbed(url) : null;
  return fileId ? (
    <video
      className="aspect-video w-full rounded-2xl bg-navy"
      controls
      preload="metadata"
      src={`/api/media/${fileId}`}
    />
  ) : embed ? (
    <iframe
      className="aspect-video w-full rounded-2xl bg-navy"
      src={embed}
      title={title}
      loading="lazy"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  ) : null;
}
export function LessonControls({courseId, lessonId, note, completed, position, fileId, url, title, notesEnabled = true}: {
  courseId: string; lessonId: string; note: string; completed: boolean; position: number;
  fileId: string | null; url: string | null; title: string; notesEnabled?: boolean;
}) {
  const ar = useLocale() === 'ar';
  const router = useRouter();
  const notesId = useId();
  const [text, setText] = useState(note), [done, setDone] = useState(completed), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const video = useRef<HTMLVideoElement>(null), currentNote = useRef(note), savedNote = useRef(note), mounted = useRef(true), queue = useRef<Promise<unknown>>(Promise.resolve());
  const persist = useCallback((payload: {note?: string; completed?: boolean; position?: number}, quiet = false) => {
    const run = async () => {
      if (mounted.current && !quiet) {setBusy(true); setMessage(ar ? 'جارٍ الحفظ…' : 'Saving…');}
      try {
        const response = await fetch('/api/learning', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'progress', courseId, lessonId, ...payload}), keepalive: true, signal: AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error('Save failed');
        if (payload.note !== undefined) savedNote.current = payload.note;
        if (mounted.current && !quiet) {
          if (payload.completed) {setDone(true); router.refresh();}
          if (payload.note === undefined || payload.note === currentNote.current) setMessage(payload.completed ? (ar ? 'تم حفظ تقدمك' : 'Your progress was saved') : (ar ? 'تم حفظ الملاحظات' : 'Notes saved'));
        }
        return true;
      } catch {
        if (mounted.current && !quiet) setMessage(ar ? 'تعذر الحفظ. حاول مجددًا من زر حفظ الملاحظات.' : 'Unable to save. Use Save notes to try again.');
        return false;
      } finally {if (mounted.current && !quiet) setBusy(false);}
    };
    const next = queue.current.then(run, run); queue.current = next; return next;
  }, [courseId, lessonId, ar, router]);
  useEffect(() => {
    if (!notesEnabled || text === savedNote.current) return;
    const timer = setTimeout(() => {void persist({note: text});}, 900);
    return () => clearTimeout(timer);
  }, [text, notesEnabled, persist]);
  useEffect(() => {
    mounted.current = true;
    const flush = () => {if (notesEnabled && currentNote.current !== savedNote.current) void persist({note: currentNote.current}, true);};
    const visibility = () => {if (document.visibilityState === 'hidden') flush();};
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', flush);
    return () => {mounted.current = false; document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', flush); flush();};
  }, [notesEnabled, persist]);
  function progress(complete = false) {
    return persist({completed: complete, position: Math.floor(video.current?.currentTime ?? position), ...(notesEnabled ? {note: currentNote.current} : {})});
  }
  return <div className="space-y-5">
    {fileId ? <video ref={video} className="aspect-video w-full rounded-2xl bg-navy" controls preload="metadata" src={`/api/media/${fileId}`} onLoadedMetadata={() => {if (video.current) video.current.currentTime = position;}} onPause={() => {void progress();}}/> : <Video url={url} title={title}/>}
    {!fileId && !url && <p className="rounded-xl bg-canvas p-4 text-sm text-muted">{ar ? 'اقرأ محتوى الدرس أدناه.' : 'Read the lesson content below.'}</p>}
    <div className="card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{ar ? 'تقدم الدرس' : 'Lesson progress'}</h3><button className="button-primary min-h-12" disabled={done || busy} onClick={() => {void progress(true);}}>{done ? (ar ? 'مكتمل' : 'Completed') : (ar ? 'تحديد كمكتمل' : 'Mark complete')}</button></div>
      {notesEnabled && <div className="mt-6 border-t border-line pt-5"><label htmlFor={notesId} className="block font-medium">{ar ? 'ملاحظاتك الخاصة' : 'Your private notes'}</label><textarea id={notesId} className="field learning-note mt-3" dir="auto" maxLength={10000} value={text} onChange={event => {currentNote.current = event.target.value; setText(event.target.value); setMessage(ar ? 'ملاحظات غير محفوظة' : 'Unsaved notes');}}/><p className="mt-2 text-xs text-muted">{ar ? 'تُحفظ تلقائيًا بعد التوقف عن الكتابة.' : 'Notes save automatically when you pause typing.'}</p><button className="button-secondary mt-4 min-h-11" disabled={busy} onClick={() => {void persist({note: currentNote.current});}}>{ar ? 'حفظ الملاحظات' : 'Save notes'}</button></div>}
      <p role="status" aria-live="polite" className="mt-4 text-sm text-muted">{message}</p>
    </div>
  </div>;
}
type Question = {
  id: string;
  prompt_ar: string;
  prompt_en: string;
  options: { id: string; label_ar: string; label_en: string }[];
};
export function Exam({
  courseId,
  examId,
  title,
  contentLanguage,
}: {
  courseId: string;
  examId: string;
  title: string;
  contentLanguage?: "ar" | "en";
}) {
  const locale = useLocale(),
    ar = locale === "ar",
    [attempt, setAttempt] = useState<{
      id: string;
      expiresAt: string;
      questions: Question[];
    } | null>(null),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(action: "start-exam" | "submit-exam") {
    setBusy(true);
    try {
    const r = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify(
        action === "start-exam"
          ? { action, courseId, examId, locale: contentLanguage || locale }
          : { action, courseId, attemptId: attempt?.id, answers },
      ),
    });
    const b = await r.json();
    if (!r.ok)
      setMessage(
        ar
          ? "تعذر إجراء الاختبار. تحقق من الوقت وعدد المحاولات."
          : "Unable to continue. Check the time limit and attempt count.",
      );
    else if (action === "start-exam") {setAnswers({}); setMessage(""); setAttempt(b);}
    else {
      setAttempt(null);
      setMessage(
        (b.passed
          ? ar
            ? "ناجح"
            : "Passed"
          : ar
            ? "حاول مرة أخرى"
            : "Try again") + ` — ${b.score}/${b.total}`,
      );
    }
    } catch {setMessage(ar ? 'تعذر الاتصال. حاول مجددًا.' : 'Unable to connect. Try again.');} finally {setBusy(false);}
  }
  return (
    <section className="card space-y-4 p-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      {attempt ? (
        <>
          <p>
            {ar ? "ينتهي الاختبار في" : "Exam expires at"}{" "}
            {new Date(attempt.expiresAt).toLocaleTimeString(
              ar ? "ar-SA" : "en-GB",
              { timeZone: "Asia/Riyadh" },
            )}
          </p>
          {attempt.questions.map((q) => (
            <fieldset key={q.id} dir={contentLanguage || locale} className="rounded-xl bg-skysoft p-4">
              <legend className="font-semibold">
                {contentText(q, 'prompt', contentLanguage || locale)}
              </legend>
              {q.options.map((o) => (
                <label className="mt-3 flex items-center gap-3" key={o.id}>
                  <input
                    type="radio"
                    name={q.id}
                    value={o.id}
                    onChange={() => setAnswers({ ...answers, [q.id]: o.id })}
                  />
                  {contentText(o, 'label', contentLanguage || locale)}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            disabled={busy || attempt.questions.some(question => !answers[question.id])}
            className="button-primary"
            onClick={() => void run("submit-exam")}
          >
            {ar ? "إرسال الإجابات" : "Submit answers"}
          </button>
        </>
      ) : (
        <button
          disabled={busy}
          className="button-secondary"
          onClick={() => void run("start-exam")}
        >
          {ar ? "بدء الاختبار" : "Start exam"}
        </button>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
export function CertificateButton({ courseId }: { courseId: string }) {
  const ar = useLocale() === "ar",
    [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="button-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setMessage("");
          try {
          const r = await fetch("/api/learning", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "certificate", courseId }),
          });
          const b = await r.json();
          if (r.ok) window.location.assign(b.url);
          else
            setMessage(
              ar
                ? "أكمل جميع الدروس والاختبارات المطلوبة أولاً."
                : "Complete all lessons and required exams first.",
            );
          } catch {setMessage(ar ? "تعذر الاتصال. حاول مجددًا." : "Unable to connect. Try again.");} finally {setBusy(false);}
        }}
      >
        {busy ? (ar ? "جارٍ تجهيز الشهادة…" : "Preparing certificate…") : ar ? "تنزيل شهادة الإتمام" : "Download completion certificate"}
      </button>
      <p role="status" className="mt-3 text-sm">
        {message}
      </p>
    </>
  );
}
export function ReviewForm({ courseId }: { courseId: string }) {
  const locale = useLocale(),
    ar = locale === "ar",
    [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try {
        const data = new FormData(e.currentTarget);
        const r = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            locale,
            rating: Number(data.get("rating")),
            body: data.get("body"),
          }),
        });
        setMessage(
          r.ok
            ? ar
              ? "تم إرسال تقييمك للمراجعة"
              : "Your review was sent for moderation"
            : ar
              ? "تعذر إرسال التقييم"
              : "Unable to submit review",
        );
        } catch {setMessage(ar ? "تعذر الاتصال. حاول مجددًا." : "Unable to connect. Try again.");} finally {setBusy(false);}
      }}
    >
      <h3 className="text-xl font-semibold">
        {ar ? "تقييم الدورة" : "Review this course"}
      </h3>
      <label className="block">
        {ar ? "التقييم" : "Rating"}
        <select name="rating" className="field">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label className="block">
        {ar ? "رأيك" : "Your review"}
        <textarea
          name="body"
          className="field"
          minLength={5}
          maxLength={3000}
          required
        />
      </label>
      <button disabled={busy} className="button-secondary">{busy ? (ar ? "جارٍ الإرسال…" : "Submitting…") : ar ? "إرسال" : "Submit"}</button>
      <p role="status">{message}</p>
    </form>
  );
}
