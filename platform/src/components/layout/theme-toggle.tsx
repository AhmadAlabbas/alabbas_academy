'use client';
import {Moon, Sun} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useSyncExternalStore} from 'react';
import {currentTheme, setTheme, subscribeToTheme} from '@/lib/theme';

export function ThemeToggle() {
  const t = useTranslations('Header');
  const theme = useSyncExternalStore(subscribeToTheme, currentTheme, () => 'light');
  const label = t(theme === 'dark' ? 'lightTheme' : 'darkTheme');
  const Icon = theme === 'dark' ? Sun : Moon;
  return <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    aria-label={label} aria-pressed={theme === 'dark'} title={label}
    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:bg-skysoft">
    <Icon className="size-5" aria-hidden="true" />
  </button>;
}
