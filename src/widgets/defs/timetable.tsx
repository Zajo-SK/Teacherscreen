import { Table2 } from 'lucide-react';
import { z } from 'zod';
import { getLocale, t } from '@/i18n';
import { NumberField, Segmented, TextField } from '@/components/forms';
import { useNow } from '@/lib/useNow';
import { int, strList } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

/** Pevný krok riadku v poli `cells` (max. počet dní) – zmena počtu dní/hodín tak nikdy nepremiestni existujúce bunky. */
export const STRIDE = 6;
export const MAX_LESSONS = 10;
export const CELL_MAX = 40;

const schema = z.object({
  lessons: int(6, 1, MAX_LESSONS),
  days: int(5, 5, 6),
  /** Ploché pole [hodina * STRIDE + deň]; konce bez obsahu sa orezávajú. */
  cells: strList(MAX_LESSONS * STRIDE, CELL_MAX),
  times: strList(MAX_LESSONS, 20),
});
type Config = z.output<typeof schema>;

export const cellAt = (cells: string[], lesson: number, dayIdx: number) => cells[lesson * STRIDE + dayIdx] ?? '';

export function setCell(cells: string[], lesson: number, dayIdx: number, value: string): string[] {
  const next = cells.slice();
  const idx = lesson * STRIDE + dayIdx;
  while (next.length <= idx) next.push('');
  next[idx] = value.slice(0, CELL_MAX);
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  return next;
}

/** „8:00–8:45“ (aj s pomlčkou, bodkou namiesto dvojbodky) → minúty od polnoci; inak null. */
export function parseRange(s: string): { start: number; end: number } | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*[–—−-]\s*(\d{1,2})[:.](\d{2})\s*$/.exec(s);
  if (!m) return null;
  const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (h1 > 23 || h2 > 24 || m1 > 59 || m2 > 59) return null;
  const start = h1 * 60 + m1;
  const end = h2 * 60 + m2;
  return end > start ? { start, end } : null;
}

/** Index práve prebiehajúcej hodiny (podľa platných časov) alebo -1. */
export function currentLesson(times: string[], lessons: number, minutes: number): number {
  for (let i = 0; i < Math.min(lessons, times.length); i++) {
    const r = parseRange(times[i] ?? '');
    if (r && minutes >= r.start && minutes < r.end) return i;
  }
  return -1;
}

/** Index dnes v týždni (po = 0) alebo -1, ak dnes nie je v rozvrhu. */
export function todayColumn(date: Date, days: number): number {
  const i = (date.getDay() + 6) % 7;
  return i < days ? i : -1;
}

const HILITE = 'color-mix(in srgb, var(--primary) 20%, transparent)';

function TimetableWidget({ config, update, mode }: WidgetProps<Config>) {
  const now = useNow(true, 30_000);
  const d = new Date(now);
  const locale = getLocale();
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const fmtLong = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const dayNames = Array.from({ length: config.days }, (_, i) => new Date(2024, 0, 1 + i, 12)).map((x) => ({ short: fmt.format(x), long: fmtLong.format(x) }));
  const today = todayColumn(d, config.days);
  const cur = currentLesson(config.times, config.lessons, d.getHours() * 60 + d.getMinutes());
  const hasTimes = config.times.some((x) => x.trim() !== '');
  const edit = mode === 'edit';
  const border = '1px solid color-mix(in srgb, currentColor 22%, transparent)';
  const fs = `min(${(26 / (config.days + 2)).toFixed(2)}cqw, ${(62 / (config.lessons + 1)).toFixed(2)}cqh)`;

  return (
    <div className="widget-body" style={{ padding: '1.5cqh 1.5cqw', boxSizing: 'border-box' }}>
      <div
        data-testid="timetable-grid"
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: `${hasTimes ? '1.3fr' : '0.6fr'} repeat(${config.days}, 1fr)`,
          gridTemplateRows: `auto repeat(${config.lessons}, 1fr)`,
          gap: 'min(0.4cqw, 0.7cqh)',
          fontSize: fs,
        }}
      >
        <div aria-hidden style={{ ...head, opacity: 0.5 }} />
        {dayNames.map((n, i) => (
          <div key={i} aria-label={n.long} data-today={i === today ? 'true' : undefined} style={{ ...head, background: i === today ? HILITE : undefined, color: i === today ? 'var(--primary)' : undefined, textTransform: 'capitalize' }}>
            {n.short}
          </div>
        ))}
        {Array.from({ length: config.lessons }, (_, l) => [
          <div key={`h${l}`} aria-label={t('w.timetable.lessonAria', { n: l + 1 })} data-current={l === cur ? 'true' : undefined} style={{ ...head, flexDirection: 'column', lineHeight: 1.1, background: l === cur ? HILITE : undefined }}>
            <span>{t('w.timetable.lessonNo', { n: l + 1 })}</span>
            {(config.times[l] ?? '').trim() !== '' && <span style={{ fontSize: '0.6em', fontWeight: 600, opacity: 0.75, whiteSpace: 'nowrap' }}>{config.times[l]}</span>}
          </div>,
          ...dayNames.map((n, di) => {
            const v = cellAt(config.cells, l, di);
            const on = l === cur || di === today;
            return (
              <div
                key={`c${l}-${di}`}
                data-current={l === cur ? 'true' : undefined}
                style={{ ...cell, border, background: l === cur && di === today ? 'color-mix(in srgb, var(--primary) 38%, transparent)' : on ? HILITE : 'color-mix(in srgb, currentColor 4%, transparent)' }}
              >
                {edit ? (
                  <input
                    data-no-drag
                    value={v}
                    maxLength={CELL_MAX}
                    aria-label={t('w.timetable.cellAria', { day: n.long, n: l + 1 })}
                    onChange={(e) => update({ cells: setCell(config.cells, l, di, e.target.value) })}
                    style={{ width: '100%', height: '100%', minWidth: 0, boxSizing: 'border-box', background: 'transparent', border: 0, color: 'inherit', font: 'inherit', fontWeight: 600, textAlign: 'center', padding: 0 }}
                  />
                ) : (
                  <span style={{ overflowWrap: 'anywhere', lineHeight: 1.1, fontWeight: 700 }}>{v}</span>
                )}
              </div>
            );
          }),
        ])}
      </div>
    </div>
  );
}

const head = { display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, borderRadius: 8, minWidth: 0, minHeight: 0, overflow: 'hidden' } as const;
const cell = { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderRadius: 8, minWidth: 0, minHeight: 0, overflow: 'hidden', padding: '0 2px' } as const;

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <NumberField label={t('w.timetable.lessons')} value={config.lessons} min={1} max={MAX_LESSONS} onChange={(lessons) => update({ lessons })} />
      <Segmented
        label={t('w.timetable.days')}
        value={config.days}
        onChange={(days) => update({ days })}
        options={[
          { value: 5, label: t('w.timetable.days5') },
          { value: 6, label: t('w.timetable.days6') },
        ]}
      />
      <TextField
        label={t('w.timetable.times')}
        value={config.times.join('\n')}
        multiline
        rows={Math.min(10, Math.max(4, config.lessons))}
        max={MAX_LESSONS * 21}
        placeholder={t('w.timetable.timesPlaceholder')}
        onChange={(v) => update({ times: v.split('\n').slice(0, MAX_LESSONS).map((x) => x.slice(0, 20)) })}
      />
      <p className="mb-3 -mt-2 text-xs text-muted">{t('w.timetable.timesHint')}</p>
    </>
  );
}

export const timetableWidget: WidgetDefinition<Config> = {
  type: 'timetable',
  label: 'w.timetable.label',
  description: 'w.timetable.desc',
  icon: Table2,
  category: 'class',
  defaultSize: { w: 900, h: 560 },
  minSize: { w: 360, h: 260 },
  schema,
  Component: TimetableWidget,
  Settings,
};
