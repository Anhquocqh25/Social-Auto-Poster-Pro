import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleTheme: () => {
        const current = get().theme;
        const next = current === 'light' ? 'dark' : 'light';
        set({ theme: next });
        applyTheme(next);
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

// Initialize theme on app load
export function initializeTheme() {
  const stored = localStorage.getItem('theme-storage');
  if (stored) {
    const { state } = JSON.parse(stored);
    applyTheme(state.theme);
  } else {
    applyTheme('system');
  }
}