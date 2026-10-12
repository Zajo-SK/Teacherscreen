import { useMemo } from 'react';
import { QrCode } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { Segmented, TextField } from '@/components/forms';
import { buildQr } from '@/lib/qr';
import { oneOf, str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  kind: oneOf(['url', 'text'] as const, 'url'),
  text: str('', 800),
  caption: str('', 200),
});
type Config = z.output<typeof schema>;

const ERR = { empty: 'w.qr.err.empty', 'invalid-url': 'w.qr.err.url', 'too-long': 'w.qr.err.long' } as const;

function QrWidget({ config }: WidgetProps<Config>) {
  const qr = useMemo(() => buildQr(config.text, config.kind), [config.text, config.kind]);
  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', gap: 12 }}>
      {qr.ok ? (
        <svg
          role="img"
          aria-label={t('w.qr.aria', { value: qr.value })}
          viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`}
          shapeRendering="crispEdges"
          style={{ flex: 1, minHeight: 0, width: '100%', background: '#fff', borderRadius: 12 }}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect width="100%" height="100%" fill="#fff" />
          {qr.dark.flatMap((row, r) => row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c + 4} y={r + 4} width="1.02" height="1.02" fill="#000" /> : null)))}
        </svg>
      ) : (
        <div role="alert" style={{ fontSize: 30, textAlign: 'center', padding: 20 }}>
          {t(ERR[qr.error])}
        </div>
      )}
      {config.caption && <div style={{ fontSize: 'min(5.5cqw, 7cqh)', fontWeight: 700, textAlign: 'center', overflowWrap: 'anywhere' }}>{config.caption}</div>}
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const qr = buildQr(config.text, config.kind);
  return (
    <>
      <Segmented
        label={t('w.qr.kind')}
        value={config.kind}
        onChange={(kind) => update({ kind })}
        options={[
          { value: 'url', label: t('w.qr.url') },
          { value: 'text', label: t('w.qr.text') },
        ]}
      />
      <TextField label={config.kind === 'url' ? t('w.qr.urlLabel') : t('w.qr.textLabel')} value={config.text} max={800} multiline rows={3} onChange={(text) => update({ text })} placeholder="https://" />
      {!qr.ok && config.text.trim() !== '' && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {t(ERR[qr.error])}
        </p>
      )}
      {qr.ok && qr.value !== config.text.trim() && <p className="mb-3 text-sm text-muted">{t('w.qr.normalized', { value: qr.value })}</p>}
      <TextField label={t('w.qr.caption')} value={config.caption} max={200} onChange={(caption) => update({ caption })} />
    </>
  );
}

export const qrWidget: WidgetDefinition<Config> = {
  type: 'qr',
  label: 'w.qr.label',
  description: 'w.qr.desc',
  icon: QrCode,
  category: 'content',
  defaultSize: { w: 440, h: 520 },
  minSize: { w: 280, h: 300 },
  schema,
  Component: QrWidget,
  Settings,
};
