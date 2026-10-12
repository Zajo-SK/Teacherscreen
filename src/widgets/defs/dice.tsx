import { useEffect, useRef, useState } from 'react';
import { Dices } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { Segmented } from '@/components/forms';
import { randomInt } from '@/lib/random';
import { int } from '../fields';
import { useRuntime } from '../runtime';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const SIDES = [4, 6, 8, 10, 12, 20] as const;
const schema = z.object({
  count: int(2, 1, 6),
  sides: int(6, 4, 20).refine((n) => (SIDES as readonly number[]).includes(n)).catch(6),
  values: z.array(int(1, 1, 20)).max(6).catch([]),
});
type Config = z.output<typeof schema>;

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, sides, size }: { value: number; sides: number; size: string }) {
  const style = { width: size, height: size, borderRadius: '16%', border: '5px solid currentColor', background: 'color-mix(in srgb, currentColor 6%, transparent)', boxSizing: 'border-box' as const };
  if (sides === 6) {
    return (
      <div role="img" aria-label={String(value)} style={{ ...style, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', padding: '12%' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ justifySelf: 'center', alignSelf: 'center', width: '70%', aspectRatio: '1', borderRadius: '50%', background: PIPS[value]?.includes(i) ? 'currentColor' : 'transparent' }} />
        ))}
      </div>
    );
  }
  return (
    <div role="img" aria-label={String(value)} style={{ ...style, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: `calc(${size} * 0.5)` }}>
      {value}
    </div>
  );
}

function DiceWidget({ widget, config, update }: WidgetProps<Config>) {
  const rt = useRuntime();
  const [rolling, setRolling] = useState<number[] | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const roll = () => {
    if (rolling) return;
    const final = Array.from({ length: config.count }, () => randomInt(config.sides) + 1);
    if (!rt.animations) return update({ values: final });
    for (let i = 1; i <= 8; i++) {
      timers.current.push(
        window.setTimeout(() => {
          if (i === 8) {
            setRolling(null);
            update({ values: final });
          } else setRolling(Array.from({ length: config.count }, () => randomInt(config.sides) + 1));
        }, i * 75),
      );
    }
    setRolling(final);
  };
  const values = rolling ?? (config.values.length === config.count ? config.values : Array.from({ length: config.count }, (_, i) => config.values[i] ?? 1));
  const cols = Math.min(config.count, widget.w > widget.h ? 3 : 2);
  const rows = Math.ceil(config.count / cols);
  const size = `min(${Math.floor(90 / cols)}cqw, ${Math.floor(62 / rows)}cqh)`;
  const sum = values.reduce((a, b) => a + b, 0);
  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', padding: 12, boxSizing: 'border-box' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, auto)`, gap: '3cqmin', justifyContent: 'center' }} data-testid="dice-values" aria-live="polite">
        {values.map((v, i) => (
          <Die key={i} value={v} sides={config.sides} size={size} />
        ))}
      </div>
      {config.count > 1 && (
        <div style={{ fontSize: 'min(5cqw, 8cqh)', fontWeight: 700 }} data-testid="dice-sum">
          {t('w.dice.sum')}: {sum}
        </div>
      )}
      <button type="button" data-no-drag className="wbtn wbtn-primary" onClick={roll} disabled={!!rolling}>
        <Dices size={30} aria-hidden /> {config.values.length ? t('w.dice.again') : t('w.dice.roll')}
      </button>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <Segmented label={t('w.dice.count')} value={config.count} onChange={(count) => update({ count, values: [] })} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
      <Segmented label={t('w.dice.sides')} value={config.sides} onChange={(sides) => update({ sides, values: [] })} options={SIDES.map((n) => ({ value: n, label: `d${n}` }))} />
    </>
  );
}

export const diceWidget: WidgetDefinition<Config> = {
  type: 'dice',
  label: 'w.dice.label',
  description: 'w.dice.desc',
  icon: Dices,
  category: 'tools',
  defaultSize: { w: 640, h: 440 },
  minSize: { w: 260, h: 220 },
  schema,
  Component: DiceWidget,
  Settings,
};
