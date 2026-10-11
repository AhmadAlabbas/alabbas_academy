'use client';

import Image from 'next/image';
import {useEffect, useRef, useState} from 'react';
import {BookOpen, Check, LoaderCircle, LogOut, Mail, Settings2, ShieldCheck} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {signIn, signOut} from 'next-auth/react';
import {useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import type {z} from 'zod';
import {Link, useRouter} from '@/i18n/navigation';
import {changePasswordSchema, profileSchema} from '@/lib/auth/schemas';
import {AccountField, AccountNotice, PasswordField, SubmitButton, accountRequest, notifyAccountChanged, useAccountAvailability} from './form-ui';
import type {PublicAccountUser} from './form-ui';

const avatars = [
  {path: '/avatars/sky.svg', label: 'skyAvatar'},
  {path: '/avatars/gold.svg', label: 'goldAvatar'},
  {path: '/avatars/navy.svg', label: 'navyAvatar'},
] as const;

export function AccountDashboard({initialUser}: {initialUser: PublicAccountUser}) {
  const t = useTranslations('Account');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const {configured, emailConfigured, googleEnabled} = useAccountAvailability();
  const [user, setUser] = useState(initialUser);
  const [profileCode, setProfileCode] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordCode, setPasswordCode] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(false);
  const [sessionFailure, setSessionFailure] = useState<string | null>(null);
  const leavingAccount = useRef(false);
  const avatar = avatars.find((item) => item.path === user.image)?.path ?? '/avatars/sky.svg';
  const profile = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({resolver: zodResolver(profileSchema), mode: 'onSubmit', defaultValues: {name: user.name ?? '', preferredLocale: user.preferredLocale, image: avatar}});
  const password = useForm<z.input<typeof changePasswordSchema>, unknown, z.output<typeof changePasswordSchema>>({resolver: zodResolver(changePasswordSchema), mode: 'onSubmit', defaultValues: {currentPassword: '', newPassword: ''}});
  const selectedAvatar = useWatch({control: profile.control, name: 'image'});
  // Subscribe to dirty state so a background refresh can preserve in-progress edits.
  const {dirtyFields} = profile.formState;
  const resetProfile = profile.reset;
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function checkSession() {
      if (leavingAccount.current) return;
      const requestGeneration = ++generation;
      setSessionChecking(true);
      const result = await accountRequest('me', undefined, 'GET');
      if (!active || leavingAccount.current || generation !== requestGeneration) return;
      if (!result.ok || !result.configured) {
        setSessionFailure('SERVICE_UNAVAILABLE');
        setSessionChecking(false);
        return;
      }
      if (!result.user || result.user.id !== initialUser.id) {
        window.location.assign(new URL(`/${locale}/${result.user ? 'account' : 'login'}`, window.location.origin));
        return;
      }
      setUser(result.user);
      resetProfile({name: result.user.name ?? '', preferredLocale: result.user.preferredLocale, image: avatars.find((item) => item.path === result.user?.image)?.path ?? '/avatars/sky.svg'}, {keepDirtyValues: Object.keys(dirtyFields).length > 0});
      setSessionFailure(null);
      setSessionChecking(false);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === 'alabbas.auth.changed') void checkSession();
    }
    function onFocus() {void checkSession();}
    window.addEventListener('alabbas:auth-changed', onFocus);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      generation++;
      window.removeEventListener('alabbas:auth-changed', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [initialUser.id, locale, resetProfile, dirtyFields]);

  async function signOutAccount() {
    setSigningOut(true);
    const result = await accountRequest('logout', {});
    if (!result.ok) {
      setSigningOut(false);
      setProfileCode(result.code ?? 'SERVICE_UNAVAILABLE');
      setProfileSuccess(false);
      return;
    }
    leavingAccount.current = true;
    setSessionChecking(true);
    try {await signOut({redirect: false});} catch { /* The durable session has already been revoked. */ }
    notifyAccountChanged();
    window.location.assign(new URL(`/${locale}/login`, window.location.origin));
  }

  async function changeAccountPassword(values: z.output<typeof changePasswordSchema>) {
    setPasswordCode(null);
    const result = await accountRequest('change-password', values);
    setPasswordSuccess(result.ok === true);
    setPasswordCode(result.ok ? 'PASSWORD_CHANGED' : result.code ?? 'SERVICE_UNAVAILABLE');
    if (!result.ok) return;
    password.reset();
    leavingAccount.current = true;
    setSessionChecking(true);
    try {await signOut({redirect: false});} catch { /* All sessions are already revoked by the password endpoint. */ }
    notifyAccountChanged();
    const destination = new URL(`/${locale}/login`, window.location.origin);
    destination.searchParams.set('passwordChanged', '1');
    window.location.assign(destination);
  }

  if (sessionChecking) return <div className="container-shell py-16"><div role="status" className="card flex items-center justify-center gap-3 p-8 text-sm text-muted"><LoaderCircle aria-hidden="true" className="size-5 animate-spin" />{t('checkingAccount')}</div></div>;
  if (sessionFailure) return <div className="container-shell max-w-xl py-16"><AccountNotice code={sessionFailure} /><button type="button" className="button-secondary mt-5 w-full" onClick={() => window.location.reload()}>{t('reloadAccount')}</button></div>;
  return <div className="container-shell py-10 sm:py-14">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
      <div><p className="eyebrow mb-2">{t('eyebrow')}</p><h1 className="section-title">{t('accountTitle')}</h1><p className="mt-2 text-sm leading-7 text-muted">{t('accountDescription')}</p></div>
      <button type="button" disabled={signingOut} onClick={signOutAccount} className="button-secondary disabled:opacity-60"><LogOut aria-hidden="true" className="size-4" />{signingOut ? t('working') : t('signOut')}</button>
    </header>
    {configured === false && <div className="mb-6"><AccountNotice code="SERVICE_UNAVAILABLE" /></div>}
    <div className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <aside className="space-y-6">
        <section className="card overflow-hidden" aria-labelledby="identity-heading">
          <div aria-hidden="true" className="cover-grid h-24 bg-skysoft" />
          <div className="px-6 pb-7"><Image src={avatar} alt="" width={80} height={80} className="relative -mt-10 mb-4 size-20 rounded-3xl border-4 border-white bg-white" /><h2 id="identity-heading" className="text-xl font-semibold leading-relaxed">{user.name || t('learner')}</h2><p dir="ltr" className="mt-1 break-all text-start text-sm text-muted">{user.email}</p><span className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${user.emailVerified ? 'bg-[#edf8f2] text-[#235840]' : 'bg-goldsoft text-[#76552e]'}`}><ShieldCheck aria-hidden="true" className="size-4" />{t(user.emailVerified ? 'emailVerified' : 'emailUnverified')}</span></div>
        </section>
        {!user.emailVerified && <section className="card space-y-4 p-6" aria-labelledby="verify-heading"><span className="flex size-11 items-center justify-center rounded-2xl bg-goldsoft"><Mail aria-hidden="true" className="size-5" /></span><h2 id="verify-heading" className="text-lg font-semibold">{t('verificationTitle')}</h2><p className="text-sm leading-7 text-muted">{t('verificationDescription')}</p><AccountNotice code={verificationCode} success={verificationSuccess} /><button type="button" disabled={verificationPending || configured !== true || emailConfigured !== true} className="button-secondary w-full disabled:cursor-not-allowed disabled:opacity-60" onClick={async () => {setVerificationCode(null); setVerificationPending(true); const result = await accountRequest('resend-verification', {locale}); setVerificationPending(false); setVerificationSuccess(result.ok === true); setVerificationCode(result.ok ? 'CHECK_EMAIL' : result.code ?? 'SERVICE_UNAVAILABLE');}}>{verificationPending ? t('working') : t('resendVerification')}</button></section>}
        <section className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white" aria-labelledby="learning-heading"><BookOpen aria-hidden="true" className="mb-5 size-7 text-gold" /><h2 id="learning-heading" className="text-xl font-semibold">{t('learningTitle')}</h2><p className="mt-3 text-sm leading-7 text-white/70">{t('learningDescription')}</p><Link href="/my-courses" className="button-secondary mt-6 w-full">{locale==='ar'?'دوراتي':'My Courses'}</Link>{user.roles.includes('administrator')&&<Link href="/admin" className="button-secondary mt-3 w-full">{locale==='ar'?'لوحة الإدارة':'Admin dashboard'}</Link>}</section>
      </aside>
      <div className="space-y-6">
        <section className="card p-6 sm:p-8" aria-labelledby="profile-heading">
          <div className="mb-6 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-skysoft"><Settings2 aria-hidden="true" className="size-5" /></span><h2 id="profile-heading" className="text-xl font-semibold">{t('profileTitle')}</h2></div>
          <form noValidate className="space-y-6" onSubmit={profile.handleSubmit(async (values) => {
            setProfileCode(null);
            const result = await accountRequest('profile', values, 'PATCH');
            setProfileSuccess(result.ok === true);
            setProfileCode(result.ok ? 'PROFILE_UPDATED' : result.code ?? 'SERVICE_UNAVAILABLE');
            if (!result.ok) return;
            setUser((previous) => ({...previous, ...values}));
            profile.reset(values);
            notifyAccountChanged();
            if (values.preferredLocale !== locale) router.replace('/account', {locale: values.preferredLocale});
            else router.refresh();
          })}>
            <AccountNotice code={profileCode} success={profileSuccess} />
            <AccountField id="profile-name" autoComplete="name" maxLength={80} label={t('name')} registration={profile.register('name')} error={profile.formState.errors.name ? t('validation.name') : undefined} />
            <div className="space-y-2"><label htmlFor="profile-language" className="block text-sm font-semibold">{t('preferredLanguage')}</label><select id="profile-language" {...profile.register('preferredLocale')} className="min-h-12 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm"><option value="ar">{t('arabic')}</option><option value="en">{t('english')}</option></select></div>
            <fieldset><legend className="mb-3 text-sm font-semibold">{t('avatarLabel')}</legend><div className="flex flex-wrap gap-3">{avatars.map((item) => <label key={item.path} className="relative cursor-pointer rounded-2xl"><input type="radio" value={item.path} {...profile.register('image')} className="peer sr-only" /><span className={`flex size-20 items-center justify-center rounded-2xl border-2 p-1 transition peer-focus-visible:outline-3 peer-focus-visible:outline-[#247b9b] peer-focus-visible:outline-offset-4 ${selectedAvatar === item.path ? 'border-[#247b9b] bg-skysoft' : 'border-line bg-white'}`}><Image src={item.path} alt={t(item.label)} width={68} height={68} className="size-full rounded-xl" /></span>{selectedAvatar === item.path && <span aria-hidden="true" className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#247b9b] text-white"><Check className="size-3" /></span>}</label>)}</div></fieldset>
            <SubmitButton pending={profile.formState.isSubmitting} disabled={configured !== true}>{t('saveProfile')}</SubmitButton>
          </form>
        </section>
        <section className="card p-6 sm:p-8" aria-labelledby="security-heading">
          <h2 id="security-heading" className="text-xl font-semibold">{t('securityTitle')}</h2><p className="mb-6 mt-2 text-sm leading-7 text-muted">{t('securityDescription')}</p>
          <form noValidate className="space-y-5" onSubmit={(event) => {void password.handleSubmit(changeAccountPassword)(event);}}>
            <AccountNotice code={passwordCode} success={passwordSuccess} />
            <PasswordField id="current-password" autoComplete="current-password" label={t('currentPassword')} registration={password.register('currentPassword')} error={password.formState.errors.currentPassword ? t('validation.passwordRequired') : undefined} />
            <PasswordField id="new-password" autoComplete="new-password" label={t('newPassword')} hint={t('passwordHint')} registration={password.register('newPassword')} error={password.formState.errors.newPassword ? t(password.getValues('currentPassword') === password.getValues('newPassword') ? 'validation.passwordDifferent' : 'validation.password') : undefined} />
            <SubmitButton pending={password.formState.isSubmitting} disabled={configured !== true}>{t('changePassword')}</SubmitButton>
          </form>
        </section>
        {googleEnabled && <section className="card p-6 sm:p-8" aria-labelledby="google-heading"><h2 id="google-heading" className="text-xl font-semibold">{t('googleTitle')}</h2><p className="mt-2 text-sm leading-7 text-muted">{t('googleDescription')}</p><button type="button" disabled={googlePending || !user.emailVerified} onClick={async () => {setGooglePending(true); try {await signIn('google', {callbackUrl: `/${locale}/account`});} catch {setGooglePending(false); setProfileCode('SERVICE_UNAVAILABLE'); setProfileSuccess(false);}}} className="button-secondary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"><span aria-hidden="true" className="text-lg font-bold text-[#4285f4]">G</span>{googlePending ? t('working') : t('connectGoogle')}</button><p className="mt-3 text-xs leading-6 text-muted">{t('googleLinkHint')}</p></section>}
      </div>
    </div>
  </div>;
}
