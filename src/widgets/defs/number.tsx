import { useEffect, useRef, useState } from 'react';
import { Hash, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { NumberField, Toggle } from '@/components/forms';
import { drawNumbers, MAX_RANGE, remainingCount } from '@/lib/numbers';
import { bool, int } from '../fields';
import { useRuntime } from '../runtime';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  min: int(1, -99_999, 99_999),
  max: int(30, -99_999, 99_999),
  count: int(1, 1, 20),
  unique: bool(true),
  animate: bool(true),
  results: z.array(int(0, -99_999, 99_999)).max(20).catch([]),
  drawn: z.array(int(0, -99_999, 99_999)).max(MAX_RANGE).catch([]),
});
type Config = z.output<typeof schema>;

function NumberWidget({ config, update }: WidgetProps<Config>) {
  const rt = useRuntime();
  const [shown, setShown] = useState<number[] | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const lo = Math.min(config.min, config.max);
  const hi = Math.max(config.min, config.max);
  const left = config.unique ? remainingCount(lo, hi, config.drawn) : Infinity;
  const exhausted = config.unique && left <= 0;

  const finish = (nums: number[]) => {
    setSpinning(false);
    setShown(null);
    update({ results: nums, drawn: config.unique ? [...config.drawn, ...nums].slice(-MAX_RANGE) : config.drawn });
  };
  const draw = () => {
    if (spinning || exhausted) return;
    const nums = drawNumbers(lo, hi, config.count, config.drawn, config.unique);
    if (nums.length === 0) return;
    if (!config.animate || !rt.animations) return finish(nums);
    setSpinning(true);
    let acc = 0;
    for (let i = 0; i < 14; i++) {
      acc += 45 + i * i * 1.4;
      const last = i === 13;
      timers.current.push(window.setTimeout(() => (last ? finish(nums) : setShown(drawNumbers(lo, hi, nums.length, [], false))), acc));
    }
  };

  const values = spinning ? (shown ?? []) : config.results;
  const many = values.length > 1;
  const digits = Math.max(1, ...values.map((v) => String(v).length), String(hi).length);
  const cols = values.length <= 1 ? 1 : values.length <= 4 ? values.length : values.length <= 6 ? 3 : values.length <= 12 ? 4 : 5;
  const size = many ? `min(${Math.floor(70 / cols / (digits * 0.6 + 0.6))}cqw, ${Math.floor(46 / Math.ceil(values.length / cols))}cqh)` : `min(${Math.floor(80 / (digits * 0.62))}cqw, 46cqh)`;

  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3cqh', padding: 16, boxSizing: 'border-box', textAlign: 'center' }}>
      <div
        data-testid="number-result"
        aria-live="polite"
        className={spinning ? '' : values.length ? 'ts-pop' : ''}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, auto)`, gap: '1.5cqh 4cqw', justifyContent: 'center', fontSize: size, fontWeight: 900, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', minHeight: '1.1em' }}
      >
        {values.length === 0 ? <span className="wmuted">?</span> : values.map((v, i) => <span key={i}>{v}</span>)}
      </div>
      <div className="wmuted" style={{ fontSize: 'min(3.4cqw, 6cqh)' }}>
        {t('w.number.range', { min: lo, max: hi })}
        {config.unique && Number.isFinite(left) && ` · ${t('w.number.left', { n: left })}`}
      </div>
      {exhausted && <div style={{ fontSize: 'min(4cqw, 7cqh)', fontWeight: 700 }}>{t('w.number.exhausted')}</div>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }} data-no-drag>
        <button type="button" className="wbtn wbtn-primary" onClick={draw} disabled={exhausted || spinning}>
          <Sparkles size={28} aria-hidden /> {config.results.length ? t('w.number.again') : t('w.number.draw')}
        </button>
        {config.drawn.length > 0 && (
          <button type="button" className="wbtn" onClick={() => update({ drawn: [], results: [] })}>
            {t('w.number.reset')}
          </button>
        )}
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const reset = { results: [], drawn: [] };
  return (
    <>
      <NumberField label={t('w.number.min')} value={config.min} min={-99_999} max={99_999} onChange={(min) => update({ min, ...reset })} />
      <NumberField label={t('w.number.max')} value={config.max} min={-99_999} max={99_999} onChange={(max) => update({ max, ...reset })} />
      <NumberField label={t('w.number.count')} value={config.count} min={1} max={20} onChange={(count) => update({ count, results: [] })} />
      <Toggle label={t('w.number.unique')} checked={config.unique} onChange={(unique) => update({ unique, ...reset })} />
      <Toggle label={t('w.number.animate')} checked={config.animate} onChange={(animate) => update({ animate })} />
      <p className="text-sm text-muted">{t('w.number.note')}</p>
    </>
  );
}

export const numberWidget: WidgetDefinition<Config> = {
  type: 'number',
  label: 'w.number.label',
  description: 'w.number.desc',
  icon: Hash,
  category: 'tools',
  defaultSize: { w: 560, h: 420 },
  minSize: { w: 280, h: 240 },
  schema,
  Component: NumberWidget,
  Settings,
};
