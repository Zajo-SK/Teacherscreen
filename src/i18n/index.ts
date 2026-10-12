import { sk } from './sk';

/**
 * Jednoduchá i18n vrstva. Slovenčina je zdrojový jazyk a určuje typ kľúčov.
 * Ďalší jazyk pridáte vytvorením `Partial<Dictionary>` (napr. `en.ts`), pridaním do `LANGUAGES`
 * a prepnutím `setLanguage()`. Chýbajúce kľúče sa doplnia zo slovenčiny.
 */
export type Dictionary = typeof sk;
export type TKey = keyof Dictionary;

export const LANGUAGES: Record<string, { label: string; dict: Partial<Dictionary> }> = {
  sk: { label: 'Slovenčina', dict: sk },
};

let current: keyof typeof LANGUAGES = 'sk';
const listeners = new Set<() => void>();

export function setLanguage(lang: string): void {
  if (!(lang in LANGUAGES)) return;
  current = lang;
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}
export function getLanguage(): string {
  return current;
}
export function subscribeLanguage(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function t(key: TKey, vars?: Record<string, string | number>): string {
  const dict = LANGUAGES[current]?.dict ?? sk;
  const raw = (dict[key] ?? sk[key]) as string;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
