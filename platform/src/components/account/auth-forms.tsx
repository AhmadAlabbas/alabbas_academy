'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {signIn} from 'next-auth/react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {Link} from '@/i18n/navigation';
import {forgotPasswordSchema, loginSchema, registrationSchema, resetPasswordSchema} from '@/lib/auth/schemas';
import {AccountField, AccountNotice, PasswordField, SubmitButton, accountRequest, notifyAccountChanged, useAccountAvailability} from './form-ui';
import {safeAccountReturnPath} from './return-path';

const signupSchema = registrationSchema.extend({confirmPassword: z.string()}).refine((data) => data.password === data.confirmPassword, {path: ['confirmPassword'], message: 'PASSWORD_MISMATCH'});
const passwordResetSchema = resetPasswordSchema.extend({confirmPassword: z.string()}).refine((data) => data.password === data.confirmPassword, {path: ['confirmPassword'], message: 'PASSWORD_MISMATCH'});

function GoogleButton({returnPath}: {returnPath: string}) {
  const t = useTranslations('Account');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div className="space-y-5"><AccountNotice code={error} /><button type="button" disabled={pending} onClick={async () => {setPending(true); try {await signIn('google', {callbackUrl: returnPath});} catch {setError('SERVICE_UNAVAILABLE'); setPending(false);}}} className="button-secondary w-full disabled:opacity-60"><span aria-hidden="true" className="text-lg font-bold text-[#4285f4]">G</span>{pending ? t('working') : t('googleLogin')}</button><div className="flex items-center gap-4 text-xs text-muted"><span className="h-px flex-1 bg-line" /><span>{t('orEmail')}</span><span className="h-px flex-1 bg-line" /></div></div>;
}

export function LoginForm({callbackUrl, initialError, passwordChanged = false}: {callbackUrl?: string; initialError?: string; passwordChanged?: boolean}) {
  const t = useTranslations('Account');
  const locale = useLocale();
  const {configured, googleEnabled} = useAccountAvailability();
  const [error, setError] = useState<string | null>(initialError === 'OAuthAccountNotLinked' || initialError === 'AccessDenied' ? initialError : initialError ? 'INVALID_CREDENTIALS' : null);
  const form = useForm<z.input<typeof loginSchema>, unknown, z.output<typeof loginSchema>>({resolver: zodResolver(loginSchema), mode: 'onSubmit', defaultValues: {email: '', password: ''}});
  const returnPath = safeAccountReturnPath(callbackUrl, locale);
  return <div className="space-y-6">
    {configured === false && <AccountNotice code="SERVICE_UNAVAILABLE" />}
    {passwordChanged && <AccountNotice success code="PASSWORD_CHANGED" />}
    {googleEnabled && <GoogleButton returnPath={returnPath} />}
    <AccountNotice code={error} />
    <form noValidate className="space-y-5" onSubmit={form.handleSubmit(async (values) => {
      setError(null);
      try {
        const result = await signIn('credentials', {...values, redirect: false});
        if (result?.error || !result?.ok) {setError('INVALID_CREDENTIALS'); return;}
        notifyAccountChanged();
        window.location.assign(returnPath);
      } catch {setError('SERVICE_UNAVAILABLE');}
    })}>
      <AccountField id="login-email" type="email" dir="ltr" autoComplete="email" inputMode="email" label={t('email')} registration={form.register('email')} error={form.formState.errors.email ? t('validation.email') : undefined} />
      <PasswordField id="login-password" autoComplete="current-password" label={t('password')} registration={form.register('password')} error={form.formState.errors.password ? t('validation.passwordRequired') : undefined} />
      <div className="text-end"><Link href="/forgot-password" className="rounded text-xs font-semibold text-[#22677f] hover:underline">{t('forgotLink')}</Link></div>
      <SubmitButton pending={form.formState.isSubmitting} disabled={configured !== true}>{t('loginButton')}</SubmitButton>
    </form>
    <p className="text-center text-sm leading-7 text-muted">{t('newHere')} <Link href={{pathname: '/signup', query: {callbackUrl: returnPath}}} className="rounded font-semibold text-navy hover:underline">{t('signupLink')}</Link></p>
  </div>;
}

export function SignupForm({callbackUrl}: {callbackUrl?: string}) {
  const t = useTranslations('Account');
  const locale = useLocale() as 'ar' | 'en';
  const {configured, emailConfigured, googleEnabled} = useAccountAvailability();
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const returnPath = safeAccountReturnPath(callbackUrl, locale);
  const loginHref = {pathname: '/login', query: {callbackUrl: returnPath}};
  const form = useForm<z.input<typeof signupSchema>, unknown, z.output<typeof signupSchema>>({resolver: zodResolver(signupSchema), mode: 'onSubmit', defaultValues: {name: '', email: '', password: '', confirmPassword: '', locale}});
  if (complete) return <div className="space-y-6"><AccountNotice success code="CHECK_EMAIL" /><p className="text-sm leading-7 text-muted">{t('verificationHint')}</p><Link href={loginHref} className="button-primary w-full">{t('loginLink')}</Link></div>;
  return <div className="space-y-6">
    {(configured === false || emailConfigured === false) && <AccountNotice code="SERVICE_UNAVAILABLE" />}
    {googleEnabled && <GoogleButton returnPath={returnPath} />}
    <AccountNotice code={error} />
    <form noValidate className="space-y-5" onSubmit={form.handleSubmit(async (values) => {
      setError(null);
      const payload = {name: values.name, email: values.email, password: values.password, locale};
      const result = await accountRequest('register', payload);
      if (!result.ok) {setError(result.code ?? 'SERVICE_UNAVAILABLE'); return;}
      form.reset(); setComplete(true);
    })}>
      <AccountField id="signup-name" autoComplete="name" maxLength={80} label={t('name')} registration={form.register('name')} error={form.formState.errors.name ? t('validation.name') : undefined} />
      <AccountField id="signup-email" type="email" dir="ltr" autoComplete="email" inputMode="email" label={t('email')} registration={form.register('email')} error={form.formState.errors.email ? t('validation.email') : undefined} />
      <PasswordField id="signup-password" autoComplete="new-password" label={t('password')} hint={t('passwordHint')} registration={form.register('password')} error={form.formState.errors.password ? t('validation.password') : undefined} />
      <PasswordField id="signup-confirm-password" autoComplete="new-password" label={t('confirmPassword')} registration={form.register('confirmPassword')} error={form.formState.errors.confirmPassword ? t('validation.passwordMatch') : undefined} />
      <SubmitButton pending={form.formState.isSubmitting} disabled={configured !== true || emailConfigured !== true}>{t('signupButton')}</SubmitButton>
    </form>
    <p className="text-center text-sm leading-7 text-muted">{t('alreadyAccount')} <Link href={loginHref} className="rounded font-semibold text-navy hover:underline">{t('loginLink')}</Link></p>
  </div>;
}

export function ForgotPasswordForm() {
  const t = useTranslations('Account');
  const locale = useLocale() as 'ar' | 'en';
  const {configured, emailConfigured} = useAccountAvailability();
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const form = useForm<z.input<typeof forgotPasswordSchema>, unknown, z.output<typeof forgotPasswordSchema>>({resolver: zodResolver(forgotPasswordSchema), mode: 'onSubmit', defaultValues: {email: '', locale}});
  return <div className="space-y-6">
    {(configured === false || emailConfigured === false) && <AccountNotice code="SERVICE_UNAVAILABLE" />}
    <AccountNotice code={error} />
    {complete ? <AccountNotice success code="RESET_EMAIL_SENT" /> : <form noValidate className="space-y-5" onSubmit={form.handleSubmit(async (values) => {setError(null); const result = await accountRequest('forgot-password', {...values, locale}); if (!result.ok) {setError(result.code ?? 'SERVICE_UNAVAILABLE'); return;} setComplete(true); form.reset();})}>
      <AccountField id="forgot-email" type="email" dir="ltr" autoComplete="email" inputMode="email" label={t('email')} registration={form.register('email')} error={form.formState.errors.email ? t('validation.email') : undefined} />
      <SubmitButton pending={form.formState.isSubmitting} disabled={configured !== true || emailConfigured !== true}>{t('resetEmailButton')}</SubmitButton>
    </form>}
    <p className="text-center"><Link href="/login" className="rounded text-sm font-semibold text-[#22677f] hover:underline">{t('backToLogin')}</Link></p>
  </div>;
}

export function ResetPasswordForm({token}: {token: string}) {
  const t = useTranslations('Account');
  const locale = useLocale() as 'ar' | 'en';
  const {configured} = useAccountAvailability();
  const [error, setError] = useState<string | null>(/^[a-f0-9]{64}$/u.test(token) ? null : 'INVALID_TOKEN');
  const [complete, setComplete] = useState(false);
  const form = useForm<z.input<typeof passwordResetSchema>, unknown, z.output<typeof passwordResetSchema>>({resolver: zodResolver(passwordResetSchema), mode: 'onSubmit', defaultValues: {token, password: '', confirmPassword: '', locale}});
  const validToken = /^[a-f0-9]{64}$/u.test(token);
  return <div className="space-y-6">
    {configured === false && <AccountNotice code="SERVICE_UNAVAILABLE" />}
    <AccountNotice code={error} />
    {complete ? <><AccountNotice success code="PASSWORD_RESET" /><Link href="/login" className="button-primary w-full">{t('loginLink')}</Link></> : validToken && error !== 'INVALID_TOKEN' ? <form noValidate className="space-y-5" onSubmit={form.handleSubmit(async (values) => {setError(null); const payload = {token: values.token, password: values.password, locale}; const result = await accountRequest('reset-password', payload); if (!result.ok) {setError(result.code ?? 'SERVICE_UNAVAILABLE'); return;} setComplete(true); form.reset(); notifyAccountChanged();})}>
      <PasswordField id="reset-password" autoComplete="new-password" label={t('newPassword')} hint={t('passwordHint')} registration={form.register('password')} error={form.formState.errors.password ? t('validation.password') : undefined} />
      <PasswordField id="reset-confirm-password" autoComplete="new-password" label={t('confirmPassword')} registration={form.register('confirmPassword')} error={form.formState.errors.confirmPassword ? t('validation.passwordMatch') : undefined} />
      <SubmitButton pending={form.formState.isSubmitting} disabled={configured !== true}>{t('resetPasswordButton')}</SubmitButton>
    </form> : <Link href="/forgot-password" className="button-secondary w-full">{t('requestNewLink')}</Link>}
  </div>;
}

export function VerifyEmailForm({token}: {token: string}) {
  const t = useTranslations('Account');
  const {configured} = useAccountAvailability();
  const validToken = /^[a-f0-9]{64}$/u.test(token);
  const [error, setError] = useState<string | null>(validToken ? null : 'INVALID_TOKEN');
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  return <div className="space-y-6">
    {configured === false && <AccountNotice code="SERVICE_UNAVAILABLE" />}
    <AccountNotice code={error} />
    {complete ? <><AccountNotice success code="EMAIL_VERIFIED" /><Link href="/account" className="button-primary w-full">{t('goToAccount')}</Link></> : validToken && error !== 'INVALID_TOKEN' ? <form onSubmit={async (event) => {event.preventDefault(); setError(null); setPending(true); const result = await accountRequest('verify-email', {token}); setPending(false); if (!result.ok) {setError(result.code ?? 'SERVICE_UNAVAILABLE'); return;} setComplete(true); notifyAccountChanged();}} className="space-y-5">
      <p className="rounded-2xl bg-skysoft p-4 text-sm leading-7 text-[#22677f]">{t('confirmVerification')}</p>
      <SubmitButton pending={pending} disabled={configured !== true}>{t('verifyButton')}</SubmitButton>
    </form> : <><p className="text-sm leading-7 text-muted">{t('verificationRecoveryHint')}</p><Link href="/account" className="button-secondary w-full">{t('requestVerificationLink')}</Link></>}
  </div>;
}
