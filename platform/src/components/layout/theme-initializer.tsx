'use client';
import {useLayoutEffect} from 'react';
import {initializeTheme} from '@/lib/theme';

// React can mount an error document after streaming begins. Its inserted head
// scripts do not execute, so restore the preference before that document paints.
export function ThemeInitializer() {
  useLayoutEffect(initializeTheme, []);
  return null;
}
