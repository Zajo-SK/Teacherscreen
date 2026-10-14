import { Flag } from 'lucide-react';
import { z } from 'zod';
import { getLocale, t, type TKey } from '@/i18n';
import { Field, TextField, Toggle } from '@/components/forms';
import { useNow } from '@/lib/useNow';
import { bool, str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

/** Dátum YYYY-MM-DD, ktorý naozaj existuje; inak prázdny reťazec. */
export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!mt) return null;
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  const d = Number(mt[3]);
  const chk = new Date(Date.UTC(y, m - 1, d));
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== m - 1 || chk.getUTCDate() !== d) return null;
  return { y, m, d };
}

const schema = z.object({
  title: str(() => t('w.countdown.def.title'), 80),
  date: z
    .string()
    .catch('')
    .transform((s) => (parseYmd(s) ? s : '')),
  showHours: bool(false),
});
type Config = z.output<typeof schema>;

/**
 * Rozdiel v kalendárnych dňoch (lokálny čas) medzi dnešným dňom a `ymd`. Kladné = v budúcnosti, 0 = dnes,
 * záporné = už prebehlo. Počíta sa z UTC zložiek dátumu, takže prechod na letný/zimný čas nič nemení.
 * Neplatný dátum → null.
 */
export function daysBetween(todayLocal: Date, ymd: string): number | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const a = Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate());
  const b = Date.UTC(p.y, p.m - 1, p.d);
  return Math.round((b - a) / 86_400_000);
}

/** Celé hodiny od `now` do lokálnej polnoci začiatku dňa `ymd` (nezáporné). */
export function hoursUntil(now: Date, ymd: string): number | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  return Math.max(0, Math.floor((new Date(p.y, p.m - 1, p.d).getTime() - now.getTime()) / 3_600_000));
}

type Plural = 'one' | 'few' | 'many' | 'other';
/** Kategória množného čísla podľa aktuálneho jazyka; neznáma kategória (zero/two) → other. */
export function pluralCategory(n: number, locale = getLocale()): Plural {
  let c: string;
  try {
    c = new Intl.PluralRules(locale).select(n);
  } catch {
    c = 'other';
  }
  return c === 'one' || c === 'few' || c === 'many' ? c : 'other';
}

const DAYS: Record<Plural, TKey> = { one: 'w.countdown.days.one', few: 'w.countdown.days.few', many: 'w.countdown.days.many', other: 'w.countdown.days.other' };
const AGO: Record<Plural, TKey> = { one: 'w.countdown.ago.one', few: 'w.countdown.ago.few', many: 'w.countdown.ago.many', other: 'w.countdown.ago.other' };
export const daysLabel = (n: number) => t(DAYS[pluralCategory(n)]);
export const agoLabel = (n: number) => t(AGO[pluralCategory(n)], { n });

function CountdownWidget({ config }: WidgetProps<Config>) {
  const now = useNow(true, 30_000);
  const nowD = new Date(now);
  const diff = daysBetween(nowD, config.date);
  const box = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3cqh 3cqw', boxSizing: 'border-box', gap: '2cqh', textAlign: 'center' } as const;
  const titleStyle = { fontSize: 'min(5.5cqw, 11cqh)', fontWeight: 800, lineHeight: 1.15, maxWidth: '100%', overflowWrap: 'anywhere' } as const;

  if (diff === null) {
    return (
      <div className="widget-body" style={box}>
        <div style={titleStyle}>{t('w.countdown.empty')}</div>
        <div className="wmuted" style={{ fontSize: 'min(3.4cqw, 7cqh)', fontWeight: 600 }}>{t('w.countdown.emptyHint')}</div>
      </div>
    );
  }
  const dateText = new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(+config.date.slice(0, 4), +config.date.slice(5, 7) - 1, +config.date.slice(8, 10), 12));
  const hours = config.showHours && diff > 0 ? hoursUntil(nowD, config.date) : null;
  const big = { fontSize: 'min(28cqw, 48cqh)', fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--primary)' } as const;
  return (
    <div className="widget-body" style={box}>
      <div style={titleStyle}>{config.title}</div>
      {diff > 0 && (
        <>
          <div data-testid="countdown-value" role="img" aria-label={t('w.countdown.aria', { title: config.title, n: diff, unit: daysLabel(diff) })} style={big}>
            {diff}
          </div>
          <div data-testid="countdown-unit" style={{ fontSize: 'min(7cqw, 13cqh)', fontWeight: 800 }}>{daysLabel(diff)}</div>
          {hours !== null && <div className="wmuted" style={{ fontSize: 'min(3.4cqw, 7cqh)', fontWeight: 600 }}>{t('w.countdown.hours', { n: hours })}</div>}
        </>
      )}
      {diff === 0 && (
        <div data-testid="countdown-value" style={{ ...big, fontSize: 'min(20cqw, 36cqh)' }}>
          {t('w.countdown.todayBig')}
        </div>
      )}
      {diff < 0 && (
        <>
          <div data-testid="countdown-value" style={{ ...big, fontSize: 'min(13cqw, 26cqh)', color: 'inherit', opacity: 0.85 }}>{t('w.countdown.passed')}</div>
          <div data-testid="countdown-unit" style={{ fontSize: 'min(6cqw, 11cqh)', fontWeight: 800 }}>{agoLabel(-diff)}</div>
        </>
      )}
      <div className="wmuted" style={{ fontSize: 'min(3cqw, 6cqh)', fontWeight: 600 }}>{dateText}</div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <TextField label={t('w.countdown.title')} value={config.title} max={80} onChange={(title) => update({ title })} />
      <Field label={t('w.countdown.date')}>
        <input
          type="date"
          className="input"
          aria-label={t('w.countdown.date')}
          value={config.date}
          onChange={(e) => update({ date: parseYmd(e.target.value) ? e.target.value : '' })}
        />
      </Field>
      <Toggle label={t('w.countdown.showHours')} checked={config.showHours} onChange={(showHours) => update({ showHours })} />
    </>
  );
}

export const countdownWidget: WidgetDefinition<Config> = {
  type: 'countdown',
  label: 'w.countdown.label',
  description: 'w.countdown.desc',
  icon: Flag,
  category: 'time',
  defaultSize: { w: 560, h: 420 },
  minSize: { w: 220, h: 180 },
  schema,
  Component: CountdownWidget,
  Settings,
};
