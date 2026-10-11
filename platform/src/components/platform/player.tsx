"use client";
import { useRef, useState } from "react";
import { useLocale } from "next-intl";
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
export function LessonControls({
  courseId,
  lessonId,
  note,
  completed,
  position,
  fileId,
  url,
  title,
}: {
  courseId: string;
  lessonId: string;
  note: string;
  completed: boolean;
  position: number;
  fileId: string | null;
  url: string | null;
  title: string;
}) {
  const ar = useLocale() === "ar",
    [text, setText] = useState(note),
    [done, setDone] = useState(completed),
    [message, setMessage] = useState(""),
    video = useRef<HTMLVideoElement>(null);
  async function save(complete = false) {
    const r = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "progress",
        courseId,
        lessonId,
        note: text,
        completed: complete,
        position: Math.floor(video.current?.currentTime ?? position),
      }),
    });
    setMessage(
      r.ok
        ? ar
          ? "تم حفظ تقدمك"
          : "Your progress was saved"
        : ar
          ? "تعذر الحفظ"
          : "Unable to save",
    );
    if (r.ok && complete) setDone(true);
  }
  return (
    <div className="space-y-5">
      {fileId ? (
        <video
          ref={video}
          className="aspect-video w-full rounded-2xl bg-navy"
          controls
          preload="metadata"
          src={`/api/media/${fileId}`}
          onLoadedMetadata={() => {
            if (video.current) video.current.currentTime = position;
          }}
          onPause={() => void save()}
        />
      ) : (
        <Video url={url} title={title} />
      )}
      <button
        className="button-primary"
        disabled={done}
        onClick={() => void save(true)}
      >
        {done
          ? ar
            ? "مكتمل"
            : "Completed"
          : ar
            ? "تحديد كمكتمل"
            : "Mark complete"}
      </button>
      <label className="block">
        {ar ? "ملاحظاتك الخاصة" : "Your private notes"}
        <textarea
          className="field min-h-32"
          maxLength={10000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button className="button-secondary" onClick={() => void save()}>
        {ar ? "حفظ الملاحظات" : "Save notes"}
      </button>
      <p role="status">{message}</p>
    </div>
  );
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
}: {
  courseId: string;
  examId: string;
  title: string;
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
    const r = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "start-exam"
          ? { action, courseId, examId, locale }
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
    else if (action === "start-exam") setAttempt(b);
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
    setBusy(false);
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
            <fieldset key={q.id} className="rounded-xl bg-skysoft p-4">
              <legend className="font-semibold">
                {ar ? q.prompt_ar : q.prompt_en}
              </legend>
              {q.options.map((o) => (
                <label className="mt-3 flex items-center gap-3" key={o.id}>
                  <input
                    type="radio"
                    name={q.id}
                    value={o.id}
                    onChange={() => setAnswers({ ...answers, [q.id]: o.id })}
                  />
                  {ar ? o.label_ar : o.label_en}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            disabled={busy}
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
    [message, setMessage] = useState("");
  return (
    <>
      <button
        className="button-primary"
        onClick={async () => {
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
        }}
      >
        {ar ? "تنزيل شهادة الإتمام" : "Download completion certificate"}
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
    [message, setMessage] = useState("");
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
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
      <button className="button-secondary">{ar ? "إرسال" : "Submit"}</button>
      <p role="status">{message}</p>
    </form>
  );
}
