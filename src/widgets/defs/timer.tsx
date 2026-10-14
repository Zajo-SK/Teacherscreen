import { Timer as TimerIcon, Play, Pause, RotateCcw } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { NumberField, Toggle } from '@/components/forms';
import { formatCountdown } from '@/lib/countdown';
import { bool } from '../fields';
import { countdownShape } from '../countdownSchema';
import { useCountdownControl } from '../useCountdownControl';
import { useRuntime } from '../runtime';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({ ...countdownShape, alarmSound: bool(true) });
type Config = z.output<typeof schema>;

function TimerWidget({ config, update }: WidgetProps<Config>) {
  const rt = useRuntime();
  const c = useCountdownControl(config, update, rt.sound && config.alarmSound);
  const idle = config.status === 'idle';
  const mins = Math.round(config.durationMs / 60000);
  return (
    <div
      className={'widget-body' + (c.done ? ' ts-alarm' : '')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3cqh',
        background: c.done ? '#b91c1c' : undefined,
        color: c.done ? '#fff' : undefined,
      }}
      role="timer"
    >
      <div
        aria-live="off"
        style={{ fontSize: 'min(26cqw, 48cqh)', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
        data-testid="timer-display"
      >
        {formatCountdown(c.remaining)}
      </div>
      {c.done && <div style={{ fontSize: 'min(6cqw, 9cqh)', fontWeight: 700 }}>{t('w.timer.done')}</div>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }} data-no-drag>
        {idle && (
          <>
            <button type="button" className="wbtn" aria-label={t('w.timer.minus')} onClick={() => c.setDuration(config.durationMs - 60000)} disabled={mins <= 1 && config.durationMs <= 60000}>
              {t('w.timer.minusShort')}
            </button>
            <button type="button" className="wbtn" aria-label={t('w.timer.plus')} onClick={() => c.setDuration(config.durationMs + 60000)}>
              {t('w.timer.plusShort')}
            </button>
          </>
        )}
        {c.running ? (
          <button type="button" className="wbtn" onClick={c.pause}>
            <Pause size={30} aria-hidden /> {t('w.timer.pause')}
          </button>
        ) : (
          <button type="button" className={'wbtn' + (c.done ? '' : ' wbtn-primary')} onClick={c.done ? c.reset : c.start}>
            <Play size={30} aria-hidden /> {c.done ? t('w.timer.again') : config.status === 'paused' ? t('w.timer.resume') : t('w.timer.start')}
          </button>
        )}
        <button type="button" className="wbtn" onClick={c.reset} disabled={idle}>
          <RotateCcw size={28} aria-hidden /> {t('common.reset')}
        </button>
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const total = Math.round(config.durationMs / 1000);
  const set = (m: number, s: number) => {
    const ms = Math.max(1, m * 60 + s) * 1000;
    update({ durationMs: ms, remainingMs: ms, status: 'idle', endsAt: null });
  };
  return (
    <>
      <NumberField label={t('w.timer.minutes')} value={Math.floor(total / 60)} min={0} max={999} onChange={(m) => set(m, total % 60)} />
      <NumberField label={t('w.timer.seconds')} value={total % 60} min={0} max={59} onChange={(s) => set(Math.floor(total / 60), s)} />
      <Toggle label={t('w.timer.sound')} checked={config.alarmSound} onChange={(alarmSound) => update({ alarmSound })} />
      <p className="text-sm text-muted">{t('w.timer.note')}</p>
    </>
  );
}

export const timerWidget: WidgetDefinition<Config> = {
  type: 'timer',
  label: 'w.timer.label',
  description: 'w.timer.desc',
  icon: TimerIcon,
  category: 'time',
  defaultSize: { w: 600, h: 380 },
  minSize: { w: 300, h: 220 },
  schema,
  Component: TimerWidget,
  Settings,
};
