export const themeStorageKey = 'alabbas.theme';
export const themeChangedEvent = 'academy:theme-changed';
export type Theme = 'light' | 'dark';

// Apply the saved preference before paint, even when storage is unavailable.
export const themeInitializationScript = `(()=>{let t;try{t=localStorage.getItem('${themeStorageKey}')}catch{}if(t!=='light'&&t!=='dark')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})()`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function initializeTheme() {
  const root = document.documentElement;
  if (root.dataset.theme === 'dark' || root.dataset.theme === 'light') return;
  let saved: string | null = null;
  try { saved = localStorage.getItem(themeStorageKey); } catch { /* Use the system preference. */ }
  root.dataset.theme = saved === 'dark' || saved === 'light' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  window.dispatchEvent(new Event(themeChangedEvent));
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(themeStorageKey, theme); } catch { /* This tab still works without storage. */ }
  window.dispatchEvent(new Event(themeChangedEvent));
}

export function subscribeToTheme(notify: () => void) {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  function fallbackTheme(): Theme { return system.matches ? 'dark' : 'light'; }
  function onStorage(event: StorageEvent) {
    if (event.key !== themeStorageKey && event.key !== null) return;
    document.documentElement.dataset.theme = event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : fallbackTheme();
    notify();
  }
  function onSystemChange() {
    try {
      const saved = localStorage.getItem(themeStorageKey);
      if (saved === 'light' || saved === 'dark') return;
    } catch { return; }
    document.documentElement.dataset.theme = fallbackTheme();
    notify();
  }
  window.addEventListener(themeChangedEvent, notify);
  window.addEventListener('storage', onStorage);
  system.addEventListener('change', onSystemChange);
  return () => {
    window.removeEventListener(themeChangedEvent, notify);
    window.removeEventListener('storage', onStorage);
    system.removeEventListener('change', onSystemChange);
  };
}
