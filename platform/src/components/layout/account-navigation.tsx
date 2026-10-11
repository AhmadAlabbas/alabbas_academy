'use client';

import {LogOut, UserRound} from 'lucide-react';
import {signOut} from 'next-auth/react';
import {useLocale, useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import {Link} from '@/i18n/navigation';
import {accountRequest, notifyAccountChanged} from '@/components/account/form-ui';

type UserSummary = {id: string; name: string | null; email: string};

export function AccountNavigation({mobile = false, onNavigate}: {mobile?: boolean; onNavigate?: () => void}) {
  const t = useTranslations('Header');
  const locale = useLocale();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    async function refresh() {
      const requestSequence = ++sequence;
      try {
        const response = await fetch('/api/account/me', {cache: 'no-store', credentials: 'same-origin', signal: controller.signal});
        if (response.ok) {
          const data = await response.json();
          if (requestSequence === sequence) setUser(data.user ?? null);
        } else if (requestSequence === sequence) {
          setUser(null);
        }
      } catch {
        if (!controller.signal.aborted && requestSequence === sequence) setUser(null);
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === 'alabbas.auth.changed') {
        setUser(null);
        void refresh();
      }
    }
    void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('academy:account-changed', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      ++sequence;
      controller.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('academy:account-changed', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  async function logout() {
    setLeaving(true);
    setFailed(false);
    const result = await accountRequest('logout', {});
    if (!result.ok) {
      setFailed(true);
      setLeaving(false);
      return;
    }
    setUser(null);
    try {await signOut({redirect: false});} catch { /* The durable session has already been revoked. */ }
    notifyAccountChanged();
    window.location.assign(new URL(`/${locale}`, window.location.origin).href);
  }

  const wrapper = mobile ? 'flex flex-col gap-3 border-t border-line pt-4' : 'hidden items-center gap-3 xl:flex';
  if (!user) {
    return <div className={wrapper}>
      <Link href="/login" onClick={onNavigate} className={mobile ? 'button-secondary w-full' : 'rounded-lg px-2 py-3 text-sm font-semibold hover:text-accent'}>{t('login')}</Link>
      <Link href="/signup" onClick={onNavigate} className={mobile ? 'button-primary w-full' : 'button-primary min-h-11 px-4'}>{t('signup')}</Link>
    </div>;
  }

  return <div className={wrapper}>
    <Link href="/account" onClick={onNavigate} className={mobile ? 'button-secondary w-full' : 'inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm font-semibold'}>
      <UserRound aria-hidden="true" className="size-4 shrink-0" />
      <span className="max-w-28 truncate">{t('myAccount')}</span>
    </Link>
    <button type="button" onClick={logout} disabled={leaving} className={mobile ? 'button-secondary w-full disabled:opacity-60' : 'inline-flex size-11 items-center justify-center rounded-full border border-line disabled:opacity-60'} aria-label={t(leaving ? 'signingOut' : 'signOut')}>
      <LogOut aria-hidden="true" className="size-4" />
      {mobile && <span>{t(leaving ? 'signingOut' : 'signOut')}</span>}
    </button>
    {failed && <p role="alert" className="max-w-44 text-xs text-danger">{t('signOutError')}</p>}
  </div>;
}
