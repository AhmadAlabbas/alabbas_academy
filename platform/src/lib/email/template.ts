import "server-only";
import {accountEmailOrigin} from "./config";
import type {AccountEmailPayload} from "./payload";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]!));
}

export function renderAccountEmail(payload: AccountEmailPayload): {subject: string; html: string; text: string} {
  const arabic = payload.locale === "ar";
  const verification = payload.kind === "VERIFY_EMAIL";
  const url = new URL(`/${payload.locale}/${verification ? "verify-email" : "reset-password"}`, accountEmailOrigin());
  url.searchParams.set("token", payload.token);
  const subject = arabic
    ? verification ? "تأكيد بريدك الإلكتروني — أكاديمية العباس" : "إعادة تعيين كلمة المرور — أكاديمية العباس"
    : verification ? "Verify your email — Alabbas Academy" : "Reset your password — Alabbas Academy";
  const heading = arabic
    ? verification ? "أهلًا بك في أكاديمية العباس" : "إعادة تعيين كلمة المرور"
    : verification ? "Welcome to Alabbas Academy" : "Reset your password";
  const name = payload.name?.trim().replace(/[\u0000-\u001f\u007f]/g, "") || "";
  const greeting = arabic ? name ? `مرحبًا ${name}،` : "مرحبًا،" : name ? `Hello ${name},` : "Hello,";
  const introduction = arabic
    ? verification ? "أكد بريدك الإلكتروني لإكمال إنشاء حسابك وبدء التعلم." : "وصلنا طلب لإعادة تعيين كلمة مرور حسابك. اختر كلمة مرور جديدة من خلال الرابط أدناه."
    : verification ? "Confirm your email address to finish creating your account and start learning." : "We received a request to reset your account password. Choose a new password using the link below.";
  const action = arabic ? verification ? "تأكيد البريد الإلكتروني" : "اختيار كلمة مرور جديدة" : verification ? "Verify email address" : "Choose a new password";
  const expiry = arabic
    ? verification ? "ينتهي هذا الرابط خلال 24 ساعة ويمكن استخدامه مرة واحدة." : "ينتهي هذا الرابط خلال 30 دقيقة ويمكن استخدامه مرة واحدة."
    : verification ? "This link expires in 24 hours and can be used once." : "This link expires in 30 minutes and can be used once.";
  const ignore = arabic
    ? "إذا لم تطلب هذا الإجراء، فتجاهل هذه الرسالة. لا تشارك الرابط مع أي شخص."
    : "If you did not request this, you can ignore this email. Do not share this link with anyone.";
  const fallback = arabic ? "إذا لم يعمل الزر، انسخ هذا الرابط إلى متصفحك:" : "If the button does not work, copy this link into your browser:";
  const brand = arabic ? "أكاديمية العباس" : "Alabbas Academy";
  const escapedUrl = escapeHtml(url.toString());
  const html = `<!doctype html><html lang="${payload.locale}" dir="${arabic ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f5f7fa;color:#19243c;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#ffffff;border:1px solid #e4e8ee;border-radius:20px;overflow:hidden"><tr><td style="padding:28px 32px;background:#19243c;color:#ffffff;border-top:6px solid #79cae7;font-weight:bold;font-size:20px">${brand}</td></tr><tr><td style="padding:32px;text-align:${arabic ? "right" : "left"}"><h1 style="margin:0 0 24px;font-size:26px;line-height:1.5">${heading}</h1><p style="font-size:16px;line-height:1.8">${escapeHtml(greeting)}</p><p style="font-size:16px;line-height:1.8">${introduction}</p><p style="margin:28px 0"><a href="${escapedUrl}" style="display:inline-block;padding:14px 22px;background:#f2cf8d;border-radius:10px;color:#19243c;font-weight:bold;text-decoration:none">${action}</a></p><p style="font-size:14px;line-height:1.8">${expiry}</p><p style="font-size:14px;line-height:1.8;color:#576278">${ignore}</p><hr style="border:0;border-top:1px solid #e4e8ee;margin:28px 0"><p style="font-size:12px;line-height:1.8;color:#576278">${fallback}<br><a href="${escapedUrl}" dir="ltr" style="word-break:break-all;color:#19243c">${escapedUrl}</a></p></td></tr></table></td></tr></table></body></html>`;
  const text = [brand, heading, greeting, introduction, `${action}: ${url.toString()}`, expiry, ignore].join("\n\n");
  return {subject, html, text};
}
