import { Clock } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { Segmented, Toggle } from '@/components/forms';
import { useNow } from '@/lib/useNow';
import { bool, oneOf } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  showSeconds: bool(false),
  showDate: bool(true),
  look: oneOf(['plain', 'led', 'card'] as const, 'plain'),
});
type Config = z.output<typeof schema>;

export function formatClock(d: Date, seconds: boolean): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}${seconds ? ':' + p(d.getSeconds()) : ''}`;
}

function ClockWidget({ config }: WidgetProps<Config>) {
  const now = new Date(useNow(true, 250));
  const time = formatClock(now, config.showSeconds);
  const rawDate = new Intl.DateTimeFormat('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const date = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const led = config.look === 'led';
  return (
    <div
      className="widget-body"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: led ? '#06130a' : undefined,
        color: led ? '#4ade80' : undefined,
        fontFamily: led ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
      }}
    >
      <time
        dateTime={now.toISOString()}
        aria-label={time}
        style={{
          fontSize: config.showDate ? `min(${config.showSeconds ? 19 : 28}cqw, 52cqh)` : `min(${config.showSeconds ? 19 : 28}cqw, 80cqh)`,
          fontWeight: config.look === 'card' ? 900 : 700,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          letterSpacing: led ? '0.04em' : undefined,
          textShadow: led ? '0 0 18px rgba(74,222,128,.55)' : undefined,
        }}
      >
        {time}
      </time>
      {config.showDate && (
        <div style={{ fontSize: 'min(4.5cqw, 14cqh)', marginTop: '3cqh', opacity: 0.85 }}>{date}</div>
      )}
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <Toggle label={t('w.clock.seconds')} checked={config.showSeconds} onChange={(showSeconds) => update({ showSeconds })} />
      <Toggle label={t('w.clock.date')} checked={config.showDate} onChange={(showDate) => update({ showDate })} />
      <Segmented
        label={t('w.clock.look')}
        value={config.look}
        onChange={(look) => update({ look })}
        options={[
          { value: 'plain', label: t('w.clock.look.plain') },
          { value: 'led', label: t('w.clock.look.led') },
          { value: 'card', label: t('w.clock.look.card') },
        ]}
      />
      <p className="text-sm text-muted">{t('w.clock.note')}</p>
    </>
  );
}

export const clockWidget: WidgetDefinition<Config> = {
  type: 'clock',
  label: 'w.clock.label',
  description: 'w.clock.desc',
  icon: Clock,
  category: 'time',
  defaultSize: { w: 560, h: 280 },
  minSize: { w: 220, h: 100 },
  schema,
  Component: ClockWidget,
  Settings,
};
