import { useRef, useState } from 'react';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { Segmented, TextField } from '@/components/forms';
import { ImageError, isSafeImageDataUrl, loadImageFile } from '@/lib/image';
import { num, oneOf, str } from '../fields';
import { useRuntime } from '../runtime';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  src: z.string().refine((v) => v === '' || isSafeImageDataUrl(v)).catch(''),
  ratio: num(1.5, 0.05, 20),
  fit: oneOf(['contain', 'cover'] as const, 'contain'),
  alt: str('', 200),
});
type Config = z.output<typeof schema>;

function useUpload(widget: { id: string; w: number; h: number }, update: (p: Partial<Config>) => void) {
  const rt = useRuntime();
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const img = await loadImageFile(file);
      update({ src: img.dataUrl, ratio: img.ratio });
      // Prispôsobí výšku widgetu pomeru strán obrázka.
      rt.patchGeometry(widget.id, { h: Math.max(80, Math.round(widget.w / img.ratio)) });
    } catch (e) {
      setError(e instanceof ImageError && e.message === 'too-large' ? t('w.image.tooLarge') : t('w.image.unsupported'));
    }
  };
  return { upload, error };
}

function ImageWidget({ widget, config, update }: WidgetProps<Config>) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, error } = useUpload(widget, update);
  return (
    <div className="widget-body" style={{ display: 'grid', placeItems: 'center' }}>
      {config.src ? (
        <img src={config.src} alt={config.alt} draggable={false} style={{ width: '100%', height: '100%', objectFit: config.fit, display: 'block', userSelect: 'none' }} />
      ) : (
        <div style={{ textAlign: 'center', padding: 20 }} data-no-drag>
          <ImageIcon size={72} aria-hidden style={{ opacity: 0.5 }} />
          <div style={{ fontSize: 30, margin: '12px 0 20px' }}>{t('w.image.empty')}</div>
          <button type="button" className="wbtn wbtn-primary" onClick={() => input.current?.click()}>
            <Upload size={28} aria-hidden /> {t('w.image.upload')}
          </button>
          {error && (
            <div role="alert" style={{ color: '#dc2626', fontSize: 24, marginTop: 12 }}>
              {error}
            </div>
          )}
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden data-testid="image-input" onChange={(e) => void upload(e.target.files?.[0])} />
        </div>
      )}
    </div>
  );
}

function Settings({ widget, config, update }: SettingsProps<Config>) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, error } = useUpload(widget, update);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => input.current?.click()}>
          <Upload size={18} aria-hidden /> {config.src ? t('w.image.replace') : t('w.image.upload')}
        </button>
        {config.src && (
          <button type="button" className="btn btn-danger" onClick={() => update({ src: '' })}>
            <Trash2 size={18} aria-hidden /> {t('w.image.remove')}
          </button>
        )}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Segmented
        label={t('w.image.fit')}
        value={config.fit}
        onChange={(fit) => update({ fit })}
        options={[
          { value: 'contain', label: t('w.image.contain') },
          { value: 'cover', label: t('w.image.cover') },
        ]}
      />
      <TextField label={t('w.image.alt')} value={config.alt} max={200} onChange={(alt) => update({ alt })} />
      <p className="text-sm text-muted">{t('w.image.note')}</p>
    </>
  );
}

export const imageWidget: WidgetDefinition<Config> = {
  type: 'image',
  label: 'w.image.label',
  description: 'w.image.desc',
  icon: ImageIcon,
  category: 'content',
  defaultSize: { w: 560, h: 380 },
  minSize: { w: 120, h: 90 },
  schema,
  Component: ImageWidget,
  Settings,
  aspectRatio: (c) => (c.src ? c.ratio : null),
};
