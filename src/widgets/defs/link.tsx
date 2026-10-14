import { ExternalLink, Link } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { Segmented, TextField } from '@/components/forms';
import { normalizeUrl, URL_MAX } from '@/lib/link';
import { oneOf, str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const ACCENTS = ['violet', 'coral', 'mint', 'sky', 'sun'] as const;
const ACCENT_VAR: Record<(typeof ACCENTS)[number], string> = {
  violet: 'var(--primary)',
  coral: 'var(--coral, #ff6b81)',
  mint: 'var(--mint, #2dd4a7)',
  sky: 'var(--sky, #38bdf8)',
  sun: 'var(--sun, #ffc53d)',
};

const schema = z.object({
  title: str(() => t('w.link.def.title'), 80),
  url: str('', URL_MAX),
  description: str('', 120),
  accent: oneOf(ACCENTS, 'violet'),
});
type Config = z.output<typeof schema>;

const ERR = { empty: 'w.link.err.empty', invalid: 'w.link.err.invalid', 'too-long': 'w.link.err.long' } as const;

function LinkWidget({ config }: WidgetProps<Config>) {
  const res = normalizeUrl(config.url);
  const accent = ACCENT_VAR[config.accent];
  const frame = { width: '100%', height: '100%', boxSizing: 'border-box', padding: '4cqmin' } as const;
  if (!res.ok) {
    return (
      <div className="widget-body" style={{ ...frame, display: 'grid', placeItems: 'center' }}>
        <div role="alert" style={{ fontSize: 'min(5cqw, 9cqh)', fontWeight: 700, textAlign: 'center' }}>
          {t(ERR[res.error])}
        </div>
      </div>
    );
  }
  return (
    <div className="widget-body" style={frame}>
      <a
        href={res.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('w.link.aria', { title: config.title, host: res.host })}
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: '4cqmin',
          padding: '4cqmin 5cqmin',
          borderRadius: '6cqmin',
          border: `1cqmin solid ${accent}`,
          background: `color-mix(in srgb, ${accent} 16%, transparent)`,
          color: 'inherit',
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5cqmin' }}>
          <span style={{ fontSize: 'min(9cqw, 22cqh)', fontWeight: 800, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{config.title}</span>
          <span style={{ fontSize: 'min(5cqw, 12cqh)', fontWeight: 600, opacity: 0.75, overflowWrap: 'anywhere' }}>{res.host}</span>
          {config.description && <span style={{ fontSize: 'min(4.5cqw, 10cqh)', opacity: 0.85, overflowWrap: 'anywhere' }}>{config.description}</span>}
        </span>
        <span aria-hidden style={{ flex: 'none', display: 'grid', placeItems: 'center', width: '16cqmin', height: '16cqmin', borderRadius: '50%', background: accent, color: '#1f1b2e' }}>
          <ExternalLink style={{ width: '60%', height: '60%' }} />
        </span>
      </a>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const res = normalizeUrl(config.url);
  return (
    <>
      <TextField label={t('w.link.title')} value={config.title} max={80} onChange={(title) => update({ title })} />
      <TextField label={t('w.link.url')} value={config.url} max={URL_MAX} placeholder="https://" onChange={(url) => update({ url })} />
      {!res.ok && config.url.trim() !== '' && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {t(ERR[res.error])}
        </p>
      )}
      {res.ok && res.url !== config.url.trim() && <p className="mb-3 text-sm text-muted">{t('w.link.normalized', { value: res.url })}</p>}
      <TextField label={t('w.link.description')} value={config.description} max={120} onChange={(description) => update({ description })} />
      <Segmented label={t('w.link.accent')} value={config.accent} onChange={(accent) => update({ accent })} options={ACCENTS.map((a) => ({ value: a, label: t(`w.link.accent.${a}` as const) }))} />
    </>
  );
}

export const linkWidget: WidgetDefinition<Config> = {
  type: 'link',
  label: 'w.link.label',
  description: 'w.link.desc',
  icon: Link,
  category: 'content',
  defaultSize: { w: 480, h: 220 },
  minSize: { w: 220, h: 120 },
  schema,
  Component: LinkWidget,
  Settings,
};
