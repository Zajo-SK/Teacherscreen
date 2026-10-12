import { Hourglass, Pause, Play, RotateCcw } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { NumberField, Segmented, Toggle } from '@/components/forms';
import { formatCountdown, type CountdownState } from '@/lib/countdown';
import { bool, nullableStr, oneOf } from '../fields';
import { countdownShape } from '../countdownSchema';
import { useCountdownControl, type CountdownPatch } from '../useCountdownControl';
import { useRuntime } from '../runtime';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  ...countdownShape,
  linkedTimerId: nullableStr,
  look: oneOf(['ring', 'bar'] as const, 'ring'),
  alarmSound: bool(true),
});
type Config = z.output<typeof schema>;

/** Farba podľa podielu zostávajúceho času: zelená → oranžová → červená. */
export function urgencyColor(fraction: number): string {
  if (fraction > 0.4) return '#16a34a';
  if (fraction > 0.15) return '#f59e0b';
  return '#dc2626';
}

function VisualTimerWidget({ widget, config, update, mode }: WidgetProps<Config>) {
  const rt = useRuntime();
  const linked = config.linkedTimerId ? rt.widgets.find((w) => w.id === config.linkedTimerId && w.type === 'timer') : undefined;
  const source: CountdownState = linked ? (linked.config as CountdownState) : config;
  const apply = (p: CountdownPatch) => (linked ? rt.patchConfig(linked.id, { ...p }) : update(p));
  const c = useCountdownControl(source, apply, rt.sound && config.alarmSound && !linked /* prepojený časovač spúšťa zvuk sám */);
  const fraction = source.durationMs > 0 ? Math.min(1, c.remaining / source.durationMs) : 0;
  const color = c.done ? '#dc2626' : urgencyColor(fraction);
  const R = 90;
  const CIRC = 2 * Math.PI * R;
  const size = Math.min(widget.w, widget.h - 110);
  void mode;
  return (
    <div className={'widget-body' + (c.done ? ' ts-alarm' : '')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 12, boxSizing: 'border-box' }} role="timer">
      {config.look === 'ring' ? (
        <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
          <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={t('w.vtimer.aria', { time: formatCountdown(c.remaining) })}>
            <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="18" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - fraction)}
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: size * 0.2, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }} data-testid="vtimer-display">
            {formatCountdown(c.remaining)}
          </div>
        </div>
      ) : (
        <div style={{ width: '90%', flex: 'none' }}>
          <div style={{ fontSize: Math.min(widget.w * 0.2, widget.h * 0.35), fontWeight: 800, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} data-testid="vtimer-display">
            {formatCountdown(c.remaining)}
          </div>
          <div style={{ height: Math.max(30, widget.h * 0.12), borderRadius: 999, background: 'color-mix(in srgb, currentColor 15%, transparent)', overflow: 'hidden' }}>
            <div style={{ width: `${fraction * 100}%`, height: '100%', background: color, transition: 'width .2s linear' }} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 14 }} data-no-drag>
        {c.running ? (
          <button type="button" className="wbtn" onClick={c.pause}>
            <Pause size={28} aria-hidden /> {t('w.timer.pause')}
          </button>
        ) : (
          <button type="button" className="wbtn wbtn-primary" onClick={c.done ? c.reset : c.start}>
            <Play size={28} aria-hidden /> {c.done ? t('w.timer.again') : t('w.timer.start')}
          </button>
        )}
        <button type="button" className="wbtn" onClick={c.reset} disabled={source.status === 'idle'}>
          <RotateCcw size={26} aria-hidden /> {t('common.reset')}
        </button>
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const rt = useRuntime();
  const timers = rt.widgets.filter((w) => w.type === 'timer');
  const total = Math.round(config.durationMs / 1000);
  const set = (m: number, s: number) => {
    const ms = Math.max(1, m * 60 + s) * 1000;
    update({ durationMs: ms, remainingMs: ms, status: 'idle', endsAt: null });
  };
  return (
    <>
      <div className="mb-3">
        <label className="label" htmlFor="vt-link">
          {t('w.vtimer.link')}
        </label>
        <select id="vt-link" className="input" value={config.linkedTimerId ?? ''} onChange={(e) => update({ linkedTimerId: e.target.value || null })}>
          <option value="">{t('w.vtimer.linkNone')}</option>
          {timers.map((tm, i) => (
            <option key={tm.id} value={tm.id}>
              {t('w.vtimer.linkN', { n: i + 1 })}
            </option>
          ))}
        </select>
      </div>
      {!config.linkedTimerId && (
        <>
          <NumberField label={t('w.timer.minutes')} value={Math.floor(total / 60)} min={0} max={999} onChange={(m) => set(m, total % 60)} />
          <NumberField label={t('w.timer.seconds')} value={total % 60} min={0} max={59} onChange={(s) => set(Math.floor(total / 60), s)} />
          <Toggle label={t('w.timer.sound')} checked={config.alarmSound} onChange={(alarmSound) => update({ alarmSound })} />
        </>
      )}
      <Segmented
        label={t('w.vtimer.look')}
        value={config.look}
        onChange={(look) => update({ look })}
        options={[
          { value: 'ring', label: t('w.vtimer.ring') },
          { value: 'bar', label: t('w.vtimer.bar') },
        ]}
      />
      <p className="text-sm text-muted">{t('w.vtimer.note')}</p>
    </>
  );
}

export const visualTimerWidget: WidgetDefinition<Config> = {
  type: 'visual-timer',
  label: 'w.vtimer.label',
  description: 'w.vtimer.desc',
  icon: Hourglass,
  category: 'time',
  defaultSize: { w: 500, h: 540 },
  minSize: { w: 260, h: 300 },
  schema,
  Component: VisualTimerWidget,
  Settings,
};
