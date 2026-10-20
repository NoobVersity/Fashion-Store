import { useState } from 'react';

const KEY = 'threads-theme';

/** Reads the theme applied by the pre-paint script in index.html. */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked — the in-page toggle still works */
  }
}

/** Tiny hook shared by the storefront header and the admin top bar. */
export function useTheme() {
  const [theme, set] = useState(getTheme);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    set(next);
  };
  return { theme, toggle };
}
