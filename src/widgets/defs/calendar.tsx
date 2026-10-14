import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { z } from 'zod';
import { getLocale, t } from '@/i18n';
import { Toggle } from '@/components/forms';
import { useNow } from '@/lib/useNow';
import { bool } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  showWeekNumbers: bool(false),
  highlightWeekends: bool(true),
});
type Config = z.output<typeof schema>;

/* ---- čistá logika (exportovaná pre testy) ---- */

export interface WeekInfo {
  /** 1 = pondelok … 7 = nedeľa */
  firstDay: number;
  weekend: number[];
}

export function getWeekInfo(locale: string): WeekInfo {
  try {
    const loc = new Intl.Locale(locale) as unknown as { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo };
    const wi = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (wi && wi.firstDay >= 1 && wi.firstDay <= 7) return { firstDay: wi.firstDay, weekend: Array.isArray(wi.weekend) && wi.weekend.length ? wi.weekend : [6, 7] };
  } catch {
    /* nepodporované → pondelok */
  }
  return { firstDay: 1, weekend: [6, 7] };
}

/** ISO deň v týždni: 1 = pondelok … 7 = nedeľa. */
export const isoDay = (d: Date) => d.getDay() || 7;

const day = (y: number, m: number, d: number) => new Date(y, m, d, 12);

export interface GridDay {
  date: Date;
  inMonth: boolean;
}

/** 6 týždňov (42 dní) pre mesiac `month` (0–11); týždeň začína dňom `firstDay` (1 = po … 7 = ne). */
export function monthGrid(year: number, month: number, firstDay: number): GridDay[][] {
  const first = day(year, month, 1);
  const offset = (isoDay(first) - firstDay + 7) % 7;
  const weeks: GridDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = day(year, month, 1 - offset + w * 7 + i);
      row.push({ date, inMonth: date.getMonth() === month && date.getFullYear() === year });
    }
    weeks.push(row);
  }
  return weeks;
}

/** Číslo týždňa podľa ISO 8601. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/* ---- komponent ---- */

function CalendarWidget({ config }: WidgetProps<Config>) {
  const now = useNow(true, 30_000);
  const today = new Date(now);
  const [offset, setOffset] = useState(0);
  const locale = getLocale();
  const wi = getWeekInfo(locale);
  const base = day(today.getFullYear(), today.getMonth() + offset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const weeks = monthGrid(year, month, wi.firstDay);

  const title = (() => {
    const s = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(base);
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  })();
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const headers = weeks[0]!.map((c) => ({ short: weekdayFmt.format(c.date), long: weekdayLong.format(c.date), weekend: wi.weekend.includes(isoDay(c.date)) }));
  const thuIdx = (4 - wi.firstDay + 7) % 7;
  const cols = config.showWeekNumbers ? '0.7fr repeat(7, 1fr)' : 'repeat(7, 1fr)';

  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', padding: '2cqh 2cqw', boxSizing: 'border-box', gap: '1.5cqh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5cqw', flex: '0 0 auto' }} data-no-drag>
        <button type="button" className="wbtn" style={navBtn} aria-label={t('w.calendar.prev')} onClick={() => setOffset((o) => o - 1)}>
          <ChevronLeft style={{ width: '60%', height: '60%' }} aria-hidden />
        </button>
        <div data-testid="calendar-title" aria-live="polite" style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 'min(5cqw, 8cqh)', lineHeight: 1.1 }}>
          {title}
        </div>
        <button type="button" className="wbtn" style={{ ...navBtn, width: 'auto', padding: '0 1.6cqw', fontSize: 'min(2.6cqw, 4.5cqh)' }} aria-label={t('w.calendar.todayAria')} disabled={offset === 0} onClick={() => setOffset(0)}>
          {t('w.calendar.today')}
        </button>
        <button type="button" className="wbtn" style={navBtn} aria-label={t('w.calendar.next')} onClick={() => setOffset((o) => o + 1)}>
          <ChevronRight style={{ width: '60%', height: '60%' }} aria-hidden />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: cols, gridTemplateRows: 'auto repeat(6, 1fr)', gap: 'min(0.5cqw, 0.8cqh)' }}>
        {config.showWeekNumbers && <div aria-hidden style={{ ...headCell, opacity: 0.5 }}>{t('w.calendar.weekShort')}</div>}
        {headers.map((h, i) => (
          <div key={i} aria-label={h.long} style={{ ...headCell, opacity: config.highlightWeekends && h.weekend ? 1 : 0.75, color: config.highlightWeekends && h.weekend ? 'var(--coral)' : undefined }}>
            {h.short}
          </div>
        ))}
        {weeks.map((row, w) => [
          config.showWeekNumbers && (
            <div key={`wk${w}`} aria-label={t('w.calendar.weekAria', { n: isoWeek(row[thuIdx]!.date) })} style={{ ...cellBase, opacity: 0.5, fontSize: 'min(2.2cqw, 4.2cqh)' }}>
              {isoWeek(row[thuIdx]!.date)}
            </div>
          ),
          ...row.map((c) => {
            const isToday = sameDay(c.date, today);
            const weekend = config.highlightWeekends && wi.weekend.includes(isoDay(c.date));
            return (
              <div
                key={c.date.getTime()}
                aria-current={isToday ? 'date' : undefined}
                data-testid={isToday ? 'calendar-today' : undefined}
                data-weekend={weekend ? 'true' : undefined}
                style={{
                  ...cellBase,
                  opacity: c.inMonth ? 1 : 0.3,
                  fontWeight: isToday ? 900 : 600,
                  background: isToday ? 'var(--primary)' : weekend ? 'color-mix(in srgb, var(--coral) 16%, transparent)' : 'color-mix(in srgb, currentColor 5%, transparent)',
                  color: isToday ? 'var(--primary-fg)' : undefined,
                  boxShadow: isToday ? '0 0 0 0.3cqmin color-mix(in srgb, var(--primary) 50%, transparent)' : undefined,
                }}
              >
                {c.date.getDate()}
              </div>
            );
          }),
        ])}
      </div>
    </div>
  );
}

const navBtn = { minHeight: 0, minWidth: 0, width: 'min(7cqw, 11cqh)', height: 'min(7cqw, 11cqh)', padding: 0, borderRadius: 'min(1.6cqw, 2.4cqh)', borderWidth: 2 } as const;
const headCell = { display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 'min(2.4cqw, 4.6cqh)', textTransform: 'capitalize' } as const;
const cellBase = { display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'min(1cqw, 1.6cqh)', fontSize: 'min(3.4cqw, 6cqh)', fontVariantNumeric: 'tabular-nums', minWidth: 0, minHeight: 0, overflow: 'hidden' } as const;

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <Toggle label={t('w.calendar.showWeeks')} checked={config.showWeekNumbers} onChange={(showWeekNumbers) => update({ showWeekNumbers })} />
      <Toggle label={t('w.calendar.highlightWeekends')} checked={config.highlightWeekends} onChange={(highlightWeekends) => update({ highlightWeekends })} />
    </>
  );
}

export const calendarWidget: WidgetDefinition<Config> = {
  type: 'calendar',
  label: 'w.calendar.label',
  description: 'w.calendar.desc',
  icon: CalendarDays,
  category: 'time',
  defaultSize: { w: 640, h: 500 },
  minSize: { w: 280, h: 240 },
  schema,
  Component: CalendarWidget,
  Settings,
};
