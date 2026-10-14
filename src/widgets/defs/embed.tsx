import { useEffect, useState } from 'react';
import { ExternalLink, Globe, MousePointer2 } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { TextField } from '@/components/forms';
import { normalizeUrl, URL_MAX } from '@/lib/link';
import { str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  url: str('', URL_MAX),
  title: str('', 80),
});
type Config = z.output<typeof schema>;

const ERR = { empty: 'w.embed.err.empty', invalid: 'w.embed.err.invalid', 'too-long': 'w.embed.err.long' } as const;

/** Vložená stránka musí byť HTTPS (HTTP by prehliadač zablokoval ako zmiešaný obsah). */
export function embedUrl(input: string): { ok: true; url: string; host: string } | { ok: false; error: keyof typeof ERR } {
  const r = normalizeUrl(input);
  if (!r.ok) return r;
  if (!r.url.startsWith('https://')) return { ok: false, error: 'invalid' };
  return r;
}

function EmbedWidget({ config, mode }: WidgetProps<Config>) {
  const res = embedUrl(config.url);
  const [loaded, setLoaded] = useState(false);
  const [control, setControl] = useState(false);
  useEffect(() => setLoaded(false), [config.url]);
  if (!res.ok) {
    return (
      <div className="widget-body" style={{ display: 'grid', placeItems: 'center', padding: '4cqmin', boxSizing: 'border-box' }}>
        <div role="alert" style={{ fontSize: 'min(4.5cqw, 9cqh)', fontWeight: 700, textAlign: 'center' }}>
          {t(ERR[res.error])}
        </div>
      </div>
    );
  }
  const title = config.title || res.host;
  if (!loaded) {
    return (
      <div className="widget-body" style={{ display: 'grid', placeItems: 'center', padding: '4cqmin', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2cqmin', textAlign: 'center' }}>
          <Globe aria-hidden style={{ width: '12cqmin', height: '12cqmin', opacity: 0.7 }} />
          <div style={{ fontSize: 'min(5cqw, 10cqh)', fontWeight: 800, overflowWrap: 'anywhere' }}>{title}</div>
          <div style={{ fontSize: 'min(3.2cqw, 6cqh)', opacity: 0.75 }}>{res.host}</div>
          <button type="button" data-no-drag data-testid="embed-load" className="btn btn-primary" onClick={() => setLoaded(true)}>
            {t('w.embed.load')}
          </button>
          <div style={{ fontSize: 'min(3cqw, 5.5cqh)', opacity: 0.7 }}>{t('w.embed.note')}</div>
        </div>
      </div>
    );
  }
  const shield = mode === 'edit' && !control;
  return (
    <div className="widget-body" style={{ position: 'relative', background: '#fff' }}>
      <iframe
        title={t('w.embed.aria', { title })}
        src={res.url}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        allow="fullscreen"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: shield ? 'none' : 'auto' }}
      />
      <div style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 6 }}>
        <a
          href={res.url}
          target="_blank"
          rel="noopener noreferrer"
          data-no-drag
          aria-label={t('w.embed.openTab')}
          title={t('w.embed.openTab')}
          style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 999, background: 'rgb(0 0 0 / 0.7)', color: '#fff' }}
        >
          <ExternalLink size={15} aria-hidden />
        </a>
        {mode === 'edit' && (
          <button
            type="button"
            data-no-drag
            data-testid="embed-control"
            aria-pressed={control}
            onClick={() => setControl(!control)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 30, borderRadius: 999, border: 0, background: 'rgb(0 0 0 / 0.7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            <MousePointer2 size={14} aria-hidden /> {control ? t('w.embed.moveMode') : t('w.embed.control')}
          </button>
        )}
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const res = embedUrl(config.url);
  return (
    <>
      <TextField label={t('w.embed.url')} value={config.url} max={URL_MAX} placeholder="https://" onChange={(url) => update({ url })} />
      {!res.ok && config.url.trim() !== '' && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {t(ERR[res.error])}
        </p>
      )}
      <p className="mb-3 text-sm text-muted">{t('w.embed.hint')}</p>
      <TextField label={t('w.embed.title')} value={config.title} max={80} onChange={(title) => update({ title })} />
    </>
  );
}

export const embedWidget: WidgetDefinition<Config> = {
  type: 'embed',
  label: 'w.embed.label',
  description: 'w.embed.desc',
  icon: Globe,
  category: 'content',
  defaultSize: { w: 900, h: 560 },
  minSize: { w: 320, h: 220 },
  schema,
  Component: EmbedWidget,
  Settings,
};
