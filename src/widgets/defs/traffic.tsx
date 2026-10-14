import { TrafficCone } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { TextField } from '@/components/forms';
import { oneOf, str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  active: oneOf(['red', 'yellow', 'green'] as const, 'red'),
  redLabel: str(() => t('w.traffic.def.red'), 60),
  yellowLabel: str(() => t('w.traffic.def.yellow'), 60),
  greenLabel: str(() => t('w.traffic.def.green'), 60),
});
type Config = z.output<typeof schema>;
type Light = Config['active'];

const LIGHTS: { id: Light; color: string; name: 'w.traffic.red' | 'w.traffic.yellow' | 'w.traffic.green'; label: 'redLabel' | 'yellowLabel' | 'greenLabel' }[] = [
  { id: 'red', color: '#dc2626', name: 'w.traffic.red', label: 'redLabel' },
  { id: 'yellow', color: '#f59e0b', name: 'w.traffic.yellow', label: 'yellowLabel' },
  { id: 'green', color: '#16a34a', name: 'w.traffic.green', label: 'greenLabel' },
];

function TrafficWidget({ widget, config, update }: WidgetProps<Config>) {
  const horizontal = widget.w > widget.h * 1.3;
  const current = LIGHTS.find((l) => l.id === config.active)!;
  const lampSize = horizontal ? 'min(28cqw, 70cqh)' : 'min(60cqw, 24cqh)';
  return (
    <div
      className="widget-body"
      style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: '3cqmin', padding: '3cqmin', boxSizing: 'border-box' }}
    >
      <div
        role="radiogroup"
        aria-label={t('w.traffic.label')}
        data-no-drag
        style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', gap: '2cqmin', background: '#111827', padding: '2cqmin', borderRadius: 40 }}
      >
        {LIGHTS.map((l) => {
          const on = l.id === config.active;
          return (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${t(l.name)} – ${config[l.label]}`}
              onClick={() => update({ active: l.id })}
              style={{
                width: lampSize,
                height: lampSize,
                borderRadius: '50%',
                border: on ? '6px solid #fff' : '6px solid transparent',
                background: l.color,
                opacity: on ? 1 : 0.22,
                boxShadow: on ? `0 0 60px 10px ${l.color}` : 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          );
        })}
      </div>
      <div style={{ textAlign: 'center', flex: horizontal ? 1 : undefined, minWidth: 0 }}>
        <div style={{ fontSize: 'min(6cqw, 8cqh)', fontWeight: 800, letterSpacing: '0.08em', color: current.color === '#f59e0b' ? '#b45309' : current.color }}>
          {t(current.name).toUpperCase()}
        </div>
        <div style={{ fontSize: horizontal ? 'min(5.5cqw, 14cqh)' : 'min(9cqw, 6cqh)', fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{config[current.label]}</div>
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <TextField label={t('w.traffic.redLabel')} value={config.redLabel} max={60} onChange={(redLabel) => update({ redLabel })} />
      <TextField label={t('w.traffic.yellowLabel')} value={config.yellowLabel} max={60} onChange={(yellowLabel) => update({ yellowLabel })} />
      <TextField label={t('w.traffic.greenLabel')} value={config.greenLabel} max={60} onChange={(greenLabel) => update({ greenLabel })} />
    </>
  );
}

export const trafficWidget: WidgetDefinition<Config> = {
  type: 'traffic',
  label: 'w.traffic.label',
  description: 'w.traffic.desc',
  icon: TrafficCone,
  category: 'class',
  defaultSize: { w: 720, h: 400 },
  minSize: { w: 260, h: 260 },
  schema,
  Component: TrafficWidget,
  Settings,
};
