import { useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { t } from '@/i18n';
import { useApp } from '@/store/useApp';
import type { Background } from '@/types';
import { loadImageFile } from '@/lib/image';

const COLORS = ['#ffffff', '#f1f5f9', '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#e2e8f0', '#1e293b', '#0f172a', '#14532d', '#1e3a8a', '#7c2d12'];
const GRADIENTS = [
  'linear-gradient(135deg,#dbeafe 0%,#e0e7ff 100%)',
  'linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)',
  'linear-gradient(135deg,#dcfce7 0%,#cffafe 100%)',
  'linear-gradient(135deg,#fce7f3 0%,#e0f2fe 100%)',
  'linear-gradient(135deg,#1e293b 0%,#334155 100%)',
  'linear-gradient(135deg,#1e3a8a 0%,#6d28d9 100%)',
  'linear-gradient(135deg,#065f46 0%,#0e7490 100%)',
  'linear-gradient(135deg,#7c2d12 0%,#be123c 100%)',
];

export function BackgroundPicker({ screenId, background }: { screenId: string; background: Background }) {
  const setBackground = useApp((s) => s.setBackground);
  const toast = useApp((s) => s.toast);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const isSel = (b: Background) => b.kind === background.kind && b.value === background.value;
  const swatch = (b: Background, label: string) => (
    <button
      key={b.value}
      type="button"
      aria-label={label}
      aria-pressed={isSel(b)}
      onClick={() => setBackground(screenId, b)}
      className="size-10 rounded-lg border-2 border-line aria-pressed:ring-4 aria-pressed:ring-primary"
      style={{ background: b.value }}
    />
  );
  return (
    <div>
      <span className="label">{t('bg.colors')}</span>
      <div className="mb-3 flex flex-wrap gap-2">
        {COLORS.map((c) => swatch({ kind: 'color', value: c }, c))}
        <input type="color" aria-label={t('bg.custom')} className="size-10 cursor-pointer rounded-lg border-2 border-line bg-transparent p-0" value={background.kind === 'color' && /^#[0-9a-f]{6}$/i.test(background.value) ? background.value : '#ffffff'} onChange={(e) => setBackground(screenId, { kind: 'color', value: e.target.value })} />
      </div>
      <span className="label">{t('bg.gradients')}</span>
      <div className="mb-3 flex flex-wrap gap-2">{GRADIENTS.map((g, i) => swatch({ kind: 'gradient', value: g }, `${t('bg.gradients')} ${i + 1}`))}</div>
      <span className="label">{t('bg.image')}</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={busy} onClick={() => file.current?.click()}>
          <Upload size={18} aria-hidden /> {t('bg.upload')}
        </button>
        {background.kind === 'image' && (
          <button type="button" className="btn btn-danger" onClick={() => setBackground(screenId, { kind: 'gradient', value: GRADIENTS[0]! })}>
            <Trash2 size={18} aria-hidden /> {t('bg.removeImage')}
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            try {
              const img = await loadImageFile(f, 2000);
              setBackground(screenId, { kind: 'image', value: img.dataUrl });
            } catch {
              toast(t('w.image.unsupported'), { tone: 'error' });
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
}
