import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'vi' | 'en';

interface LanguageStore {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

const DEFAULT_LANGUAGE: Language = 'vi';

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: DEFAULT_LANGUAGE,
      setLanguage: (language) => {
        set({ language: normalizeLanguage(language) });
      },
      toggleLanguage: () => {
        const current = get().language;
        set({ language: current === 'vi' ? 'en' : 'vi' });
      },
    }),
    {
      name: 'language-storage',
    }
  )
);

function normalizeLanguage(language: unknown): Language {
  return language === 'en' ? 'en' : 'vi';
}

export function initializeLanguage() {
  const stored = localStorage.getItem('language-storage');

  if (!stored) {
    useLanguageStore.setState({ language: DEFAULT_LANGUAGE });
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    const storedLanguage = parsed?.state?.language;
    useLanguageStore.setState({ language: normalizeLanguage(storedLanguage) });
  } catch {
    useLanguageStore.setState({ language: DEFAULT_LANGUAGE });
  }
}

export function getCurrentLanguage(): Language {
  return normalizeLanguage(useLanguageStore.getState().language);
}