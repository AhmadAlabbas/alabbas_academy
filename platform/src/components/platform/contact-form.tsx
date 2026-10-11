"use client";
import { useLocale } from "next-intl";
import { useState } from "react";
export function ContactForm() {
  const locale = useLocale(),
    ar = locale === "ar",
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="card mx-auto max-w-2xl space-y-5 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const form = e.currentTarget,
          data = new FormData(form);
        const r = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...Object.fromEntries(data), locale }),
        });
        setMessage(
          r.ok
            ? ar
              ? "تم استلام رسالتك. شكرًا لتواصلك."
              : "Your message was received. Thank you for getting in touch."
            : ar
              ? "تعذر الإرسال. حاول مرة أخرى لاحقًا."
              : "Unable to send. Try again later.",
        );
        if (r.ok) form.reset();
        setBusy(false);
      }}
    >
      {[
        ["name", ar ? "الاسم" : "Name", "text"],
        ["email", ar ? "البريد الإلكتروني" : "Email", "email"],
        ["subject", ar ? "الموضوع" : "Subject", "text"],
      ].map(([key, label, type]) => (
        <label className="block" key={key}>
          {label}
          <input
            className="field"
            name={key}
            type={type}
            required
            maxLength={key === "name" ? 80 : 191}
          />
        </label>
      ))}
      <label className="block">
        {ar ? "الرسالة" : "Message"}
        <textarea
          className="field min-h-36"
          name="body"
          required
          minLength={10}
          maxLength={5000}
        />
      </label>
      <input
        name="website"
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <button className="button-primary" disabled={busy}>
        {ar ? "إرسال الرسالة" : "Send message"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
