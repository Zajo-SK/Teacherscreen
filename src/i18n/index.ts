import { useSyncExternalStore } from 'react';
import { sk } from './sk';

/**
 * Jednoduchá i18n vrstva. Slovenčina je zdrojový jazyk a určuje kľúče; ostatné jazyky (`./langs/*`)
 * musia mať všetky kľúče (kontroluje typ `Dictionary` aj test). Chýbajúci text sa pre istotu doplní zo slovenčiny.
 */
export type TKey = keyof typeof sk;
export type Dictionary = Record<TKey, string>;

export type LangCode = 'sk' | 'en' | 'de' | 'cs' | 'hu' | 'pl' | 'ru';

export const LANGUAGES: Record<LangCode, { label: string; locale: string; load: () => Promise<Dictionary> }> = {
  sk: { label: 'Slovenčina', locale: 'sk-SK', load: async () => sk },
  en: { label: 'English', locale: 'en-GB', load: async () => (await import('./langs/en')).en },
  de: { label: 'Deutsch', locale: 'de-DE', load: async () => (await import('./langs/de')).de },
  cs: { label: 'Čeština', locale: 'cs-CZ', load: async () => (await import('./langs/cs')).cs },
  hu: { label: 'Magyar', locale: 'hu-HU', load: async () => (await import('./langs/hu')).hu },
  pl: { label: 'Polski', locale: 'pl-PL', load: async () => (await import('./langs/pl')).pl },
  ru: { label: 'Русский', locale: 'ru-RU', load: async () => (await import('./langs/ru')).ru },
};
export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

const LANG_KEY = 'ts.lang';

function isLang(v: unknown): v is LangCode {
  return typeof v === 'string' && v in LANGUAGES;
}

function detect(): LangCode {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const l of nav) {
    const base = l?.slice(0, 2).toLowerCase();
    if (isLang(base)) return base;
  }
  return 'sk';
}

let current: LangCode = 'sk';
let dict: Dictionary = sk;
const listeners = new Set<() => void>();

function apply(lang: LangCode, d: Dictionary): void {
  current = lang;
  dict = d;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

/** Prepne jazyk (načíta slovník), uloží voľbu a upozorní odberateľov. */
export async function setLanguage(lang: string, persist = true): Promise<void> {
  if (!isLang(lang)) return;
  const d = await LANGUAGES[lang].load();
  if (persist) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
  }
  apply(lang, d);
}
/** Načíta uložený/rozpoznaný jazyk pri štarte. */
export async function initLanguage(): Promise<void> {
  const lang = detect();
  if (lang !== 'sk') await setLanguage(lang, false);
  else if (typeof document !== 'undefined') document.documentElement.lang = 'sk';
}

export function getLanguage(): LangCode {
  return current;
}
export function getLocale(): string {
  return LANGUAGES[current].locale;
}
export function subscribeLanguage(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useLanguage(): LangCode {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
}

export function t(key: TKey, vars?: Record<string, string | number>): string {
  const raw = dict[key] ?? sk[key];
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
