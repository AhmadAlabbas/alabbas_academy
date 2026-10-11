'use client';

import {AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import type {InputHTMLAttributes, ReactNode} from 'react';
import type {UseFormRegisterReturn} from 'react-hook-form';

export type PublicAccountUser = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: string | null;
  image: string | null;
  preferredLocale: 'ar' | 'en';
  roles: string[];
};

export type AccountResponse = {
  ok?: boolean;
  code?: string;
  user?: PublicAccountUser | null;
  configured?: boolean;
  emailConfigured?: boolean;
  googleEnabled?: boolean;
  fieldErrors?: Record<string, string[]>;
};

export async function accountRequest(path: string, body?: unknown, method = 'POST'): Promise<AccountResponse> {
  try {
    const response = await fetch(`/api/account/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : {'Content-Type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    const data: AccountResponse = await response.json();
    if (!response.ok) return {...data, ok: false, code: data.code ?? 'SERVICE_UNAVAILABLE'};
    return {...data, ok: true};
  } catch {
    return {ok: false, code: 'SERVICE_UNAVAILABLE'};
  }
}

export function notifyAccountChanged() {
  window.dispatchEvent(new Event('academy:account-changed'));
  window.dispatchEvent(new Event('alabbas:auth-changed'));
  try {window.localStorage.setItem('alabbas.auth.changed', String(Date.now()));} catch { /* Cross-tab refresh is optional when storage is unavailable. */ }
}

export function useAccountAvailability() {
  const [availability, setAvailability] = useState<{configured: boolean | null; emailConfigured: boolean | null; googleEnabled: boolean}>({configured: null, emailConfigured: null, googleEnabled: false});
  useEffect(() => {
    let active = true;
    void accountRequest('me', undefined, 'GET').then((result) => {
      if (active) setAvailability({configured: result.ok === true && result.configured === true, emailConfigured: result.ok === true && result.emailConfigured === true, googleEnabled: result.ok === true && result.googleEnabled === true});
    });
    return () => {active = false;};
  }, []);
  return availability;
}

const knownErrors = new Set(['INVALID_INPUT', 'INVALID_CREDENTIALS', 'INVALID_TOKEN', 'RATE_LIMITED', 'UNAUTHORIZED', 'FORBIDDEN', 'SERVICE_UNAVAILABLE', 'OAuthAccountNotLinked']);

export function AccountNotice({code, success = false}: {code: string | null; success?: boolean}) {
  const t = useTranslations('Account');
  if (!code) return null;
  const translation = success ? `success.${code}` : `errors.${knownErrors.has(code) ? code : 'INVALID_CREDENTIALS'}`;
  return <div role={success ? 'status' : 'alert'} className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm leading-7 ${success ? 'border-[#c2e6d9] bg-[#edf8f2] text-[#235840]' : 'border-[#efd6ce] bg-[#fff5f1] text-[#813c2b]'}`}><span className="mt-1 shrink-0">{success ? <CheckCircle2 aria-hidden="true" className="size-5" /> : <AlertCircle aria-hidden="true" className="size-5" />}</span><p>{t(translation)}</p></div>;
}

type AccountFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  registration?: UseFormRegisterReturn;
};

export function AccountField({id, label, error, hint, registration, className = '', ...props}: AccountFieldProps) {
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-semibold">{label}</label><input id={id} {...registration} {...props} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={`min-h-12 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-offset-2 transition placeholder:text-muted/60 ${error ? 'border-[#b7624c]' : 'border-line focus:border-[#247b9b]'} ${className}`} />{hint && !error && <p id={`${id}-hint`} className="text-xs leading-6 text-muted">{hint}</p>}{error && <p id={`${id}-error`} role="alert" className="text-xs leading-6 text-[#913f2a]">{error}</p>}</div>;
}

export function PasswordField({id, label, error, hint, registration, ...props}: AccountFieldProps) {
  const t = useTranslations('Account');
  const [visible, setVisible] = useState(false);
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-semibold">{label}</label><div className="relative"><input id={id} {...registration} {...props} type={visible ? 'text' : 'password'} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={`min-h-12 w-full rounded-xl border bg-white py-3 pe-14 ps-4 text-sm outline-offset-2 transition ${error ? 'border-[#b7624c]' : 'border-line focus:border-[#247b9b]'}`} /><button type="button" aria-label={t(visible ? 'hidePassword' : 'showPassword')} aria-controls={id} aria-pressed={visible} onClick={() => setVisible((value) => !value)} className="absolute end-1 top-1 flex size-10 items-center justify-center rounded-lg text-muted hover:bg-skysoft">{visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}</button></div>{hint && !error && <p id={`${id}-hint`} className="text-xs leading-6 text-muted">{hint}</p>}{error && <p id={`${id}-error`} role="alert" className="text-xs leading-6 text-[#913f2a]">{error}</p>}</div>;
}

export function SubmitButton({pending, disabled, children}: {pending: boolean; disabled?: boolean; children: ReactNode}) {
  const t = useTranslations('Account');
  return <button type="submit" disabled={pending || disabled} aria-busy={pending} className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">{pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}{pending ? t('working') : children}</button>;
}
