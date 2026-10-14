import { describe, it, expect, afterEach } from 'vitest';
import { LANGUAGES, LANG_CODES, setLanguage, t, getLanguage } from '@/i18n';
import { sk } from '@/i18n/sk';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('i18n', () => {
  afterEach(async () => {
    await setLanguage('sk', false);
  });

  for (const code of LANG_CODES.filter((c) => c !== 'sk')) {
    it(`${code}: obsahuje všetky kľúče, zachováva {premenné}, nie sú prázdne`, async () => {
      const d = await LANGUAGES[code].load();
      const missing = Object.keys(sk).filter((k) => !(k in d) || typeof (d as Record<string, string>)[k] !== 'string' || (d as Record<string, string>)[k].trim() === '');
      expect(missing).toEqual([]);
      const extra = Object.keys(d).filter((k) => !(k in sk));
      expect(extra).toEqual([]);
      const bad = Object.entries(sk).filter(([k, v]) => placeholders(v) !== placeholders((d as Record<string, string>)[k]!)).map(([k]) => k);
      expect(bad).toEqual([]);
    });
  }

  it('prepína jazyk a interpoluje', async () => {
    await setLanguage('en', false);
    expect(getLanguage()).toBe('en');
    expect(t('common.cancel')).not.toBe('Zrušiť');
    expect(t('settings.language')).not.toBe('Jazyk');
  });
});
