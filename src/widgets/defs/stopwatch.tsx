import { Play, Pause, RotateCcw, Watch } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { elapsedAt, formatElapsed, type StopwatchState } from '@/lib/countdown';
import { useNow } from '@/lib/useNow';
import { int, nullableNum, oneOf } from '../fields';
import type { WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  status: oneOf(['idle', 'running', 'paused'] as const, 'idle'),
  startedAt: nullableNum,
  accumulatedMs: int(0, 0, 10 * 86_400_000),
});
type Config = z.output<typeof schema>;

function StopwatchWidget({ config, update }: WidgetProps<Config>) {
  const state: StopwatchState = config;
  const running = state.status === 'running';
  const now = useNow(running, 100);
  const elapsed = elapsedAt(state, now);
  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4cqh' }}>
      <div style={{ fontSize: 'min(17cqw, 40cqh)', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }} data-testid="stopwatch-display">
        {formatElapsed(elapsed)}
      </div>
      <div style={{ display: 'flex', gap: 16 }} data-no-drag>
        {running ? (
          <button type="button" className="wbtn" onClick={() => update({ status: 'paused', startedAt: null, accumulatedMs: Math.round(elapsedAt(state, Date.now())) })}>
            <Pause size={30} aria-hidden /> {t('w.timer.pause')}
          </button>
        ) : (
          <button type="button" className="wbtn wbtn-primary" onClick={() => update({ status: 'running', startedAt: Date.now() })}>
            <Play size={30} aria-hidden /> {state.status === 'paused' ? t('w.timer.resume') : t('w.timer.start')}
          </button>
        )}
        <button type="button" className="wbtn" disabled={state.status === 'idle'} onClick={() => update({ status: 'idle', startedAt: null, accumulatedMs: 0 })}>
          <RotateCcw size={28} aria-hidden /> {t('common.reset')}
        </button>
      </div>
    </div>
  );
}

export const stopwatchWidget: WidgetDefinition<Config> = {
  type: 'stopwatch',
  label: 'w.stopwatch.label',
  description: 'w.stopwatch.desc',
  icon: Watch,
  category: 'time',
  defaultSize: { w: 600, h: 340 },
  minSize: { w: 300, h: 200 },
  schema,
  Component: StopwatchWidget,
};
