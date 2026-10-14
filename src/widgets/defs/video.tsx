import { useEffect, useState } from 'react';
import { MousePointer2, Play, Video } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { TextField } from '@/components/forms';
import { parseYouTube } from '@/lib/youtube';
import { str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  url: str('', 300),
  title: str('', 80),
});
type Config = z.output<typeof schema>;

const ERR = { empty: 'w.video.err.empty', invalid: 'w.video.err.invalid', 'too-long': 'w.video.err.long' } as const;

function useOnline() {
  const [on, setOn] = useState(() => navigator.onLine);
  useEffect(() => {
    const f = () => setOn(navigator.onLine);
    window.addEventListener('online', f);
    window.addEventListener('offline', f);
    return () => {
      window.removeEventListener('online', f);
      window.removeEventListener('offline', f);
    };
  }, []);
  return on;
}

function VideoWidget({ config, mode }: WidgetProps<Config>) {
  const res = parseYouTube(config.url);
  const online = useOnline();
  // Video sa z YouTube načíta až po kliknutí (súkromie, offline režim); stav sa neukladá.
  const [loaded, setLoaded] = useState(false);
  // V editore iframe zachytáva myš, takže presúvanie a výber widgetu fungujú, kým učiteľ nezapne ovládanie videa.
  const [control, setControl] = useState(false);
  useEffect(() => setLoaded(false), [config.url]);
  const msg = (key: Parameters<typeof t>[0], alert = true) => (
    <div className="widget-body" style={{ display: 'grid', placeItems: 'center', padding: '4cqmin', boxSizing: 'border-box' }}>
      <div role={alert ? 'alert' : 'status'} style={{ fontSize: 'min(4.5cqw, 9cqh)', fontWeight: 700, textAlign: 'center' }}>
        {t(key)}
      </div>
    </div>
  );
  if (!res.ok) return msg(ERR[res.error]);
  const title = config.title || t('w.video.label');
  if (!loaded) {
    return (
      <div className="widget-body" style={{ display: 'grid', placeItems: 'center', background: '#111', color: '#fff', padding: '4cqmin', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2cqmin', textAlign: 'center' }}>
          <button
            type="button"
            data-no-drag
            data-testid="video-load"
            aria-label={t('w.video.load')}
            disabled={!online}
            onClick={() => setLoaded(true)}
            style={{ width: '18cqmin', height: '18cqmin', borderRadius: '50%', border: 0, background: '#ff0033', color: '#fff', display: 'grid', placeItems: 'center', cursor: online ? 'pointer' : 'not-allowed', opacity: online ? 1 : 0.5 }}
          >
            <Play style={{ width: '55%', height: '55%' }} fill="currentColor" />
          </button>
          <div style={{ fontSize: 'min(5cqw, 10cqh)', fontWeight: 800, overflowWrap: 'anywhere' }}>{title}</div>
          <div style={{ fontSize: 'min(3.2cqw, 6cqh)', opacity: 0.75 }}>{online ? t('w.video.note') : t('w.video.offline')}</div>
        </div>
      </div>
    );
  }
  const shield = mode === 'edit' && !control;
  return (
    <div className="widget-body" style={{ position: 'relative', background: '#000' }}>
      <iframe
        title={t('w.video.aria', { title })}
        src={res.embed}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: shield ? 'none' : 'auto' }}
      />
      {mode === 'edit' && (
        <button
          type="button"
          data-no-drag
          data-testid="video-control"
          aria-pressed={control}
          onClick={() => setControl(!control)}
          style={{ position: 'absolute', right: 8, top: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, border: 0, background: 'rgb(0 0 0 / 0.7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          <MousePointer2 size={14} aria-hidden /> {control ? t('w.video.moveMode') : t('w.video.control')}
        </button>
      )}
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const res = parseYouTube(config.url);
  return (
    <>
      <TextField label={t('w.video.url')} value={config.url} max={300} placeholder="https://www.youtube.com/watch?v=…" onChange={(url) => update({ url })} />
      {!res.ok && config.url.trim() !== '' && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {t(ERR[res.error])}
        </p>
      )}
      <p className="mb-3 text-sm text-muted">{t('w.video.hint')}</p>
      <TextField label={t('w.video.title')} value={config.title} max={80} onChange={(title) => update({ title })} />
    </>
  );
}

export const videoWidget: WidgetDefinition<Config> = {
  type: 'video',
  label: 'w.video.label',
  description: 'w.video.desc',
  icon: Video,
  category: 'content',
  defaultSize: { w: 800, h: 450 },
  minSize: { w: 320, h: 180 },
  aspectRatio: () => 16 / 9,
  schema,
  Component: VideoWidget,
  Settings,
};
