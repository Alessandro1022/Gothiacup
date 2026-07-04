'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { t, type Lang, type TKey } from '@/lib/i18n';

type Ctx = { lang: Lang; setLang: (l: Lang) => void; tr: (k: TKey) => string };
const LangContext = createContext<Ctx>({ lang: 'sv', setLang: () => {}, tr: (k) => t('sv', k) });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('sv');

  useEffect(() => {
    const saved = localStorage.getItem('tops_lang') as Lang | null;
    if (saved) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('tops_lang', l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, tr: (k) => t(lang, k) }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
