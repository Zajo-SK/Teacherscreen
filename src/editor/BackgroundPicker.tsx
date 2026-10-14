import { useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { t } from '@/i18n';
import { useApp } from '@/store/useApp';
import type { Background } from '@/types';
import { loadImageFile } from '@/lib/image';
import { PhotoBrowser } from './PhotoBrowser';
import { Collapsible } from '@/components/Collapsible';
import { BG_CATEGORIES, BG_PRESETS, bgPresetUrl, type BgCategory } from '@/lib/backgrounds';

const COLORS = ['#ffffff', '#fbf8f3', '#fff1b8', '#d7f5e6', '#d6ecff', '#ffe0ec', '#e9e4ff', '#2a2540', '#14121f', '#14532d', '#1e3a8a', '#7c2d12'];
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
  const [cat, setCat] = useState<BgCategory>(() => (background.kind === 'preset' ? (BG_PRESETS.find((p) => p.id === background.value)?.category ?? 'mesh') : 'mesh'));
  const isSel = (b: Background) => b.kind === background.kind && b.value === background.value;
  const swatch = (b: Background, label: string) => (
    <button
      key={b.value}
      type="button"
      aria-label={label}
      data-tip={label}
      aria-pressed={isSel(b)}
      onClick={() => setBackground(screenId, b)}
      className="size-10 rounded-xl border-2 border-line transition-transform hover:scale-110 aria-pressed:ring-4 aria-pressed:ring-primary"
      style={{ background: b.value }}
    />
  );
  return (
    <div data-testid="bg-picker" className="-mx-2">
      <Collapsible level={2} id="bg-library" title={t('bg.library')} defaultOpen>
        <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label={t('bg.library')}>
          {BG_CATEGORIES.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className="rounded-full border border-line px-3 py-1 text-xs font-semibold aria-selected:border-transparent aria-selected:bg-primary aria-selected:text-primary-fg" onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2" data-testid="bg-presets">
          {BG_PRESETS.filter((p) => p.category === cat).map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`bg-${p.id}`}
              aria-label={p.name}
              data-tip={p.name}
              aria-pressed={background.kind === 'preset' && background.value === p.id}
              onClick={() => setBackground(screenId, { kind: 'preset', value: p.id })}
              className="aspect-video rounded-xl border-2 border-line transition-transform hover:scale-105 aria-pressed:ring-4 aria-pressed:ring-primary"
              style={{ background: `center / cover no-repeat ${bgPresetUrl(p.id) ?? ''}` }}
            />
          ))}
        </div>
      </Collapsible>
      <Collapsible level={2} id="bg-photos" title={`📷 ${t('bg.photos')}`}>
        <PhotoBrowser screenId={screenId} />
      </Collapsible>
      <Collapsible level={2} id="bg-colors" title={t('bg.colors')}>
        <div className="mb-3 flex flex-wrap gap-2">
          {COLORS.map((c) => swatch({ kind: 'color', value: c }, c))}
          <input type="color" aria-label={t('bg.custom')} data-tip={t('bg.custom')} className="size-10 cursor-pointer rounded-xl border-2 border-line bg-transparent p-0" value={background.kind === 'color' && /^#[0-9a-f]{6}$/i.test(background.value) ? background.value : '#ffffff'} onChange={(e) => setBackground(screenId, { kind: 'color', value: e.target.value })} />
        </div>
        <span className="label">{t('bg.gradients')}</span>
        <div className="flex flex-wrap gap-2">{GRADIENTS.map((g, i) => swatch({ kind: 'gradient', value: g }, `${t('bg.gradients')} ${i + 1}`))}</div>
      </Collapsible>
      <Collapsible level={2} id="bg-own" title={t('bg.image')}>
        {background.kind === 'image' && background.credit && (
          <p className="mb-3 text-xs text-muted" data-testid="bg-credit-info">
            {t('bg.photoBy')}: {background.credit}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={busy} onClick={() => file.current?.click()}>
            <Upload size={18} aria-hidden /> {t('bg.upload')}
          </button>
          {background.kind === 'image' && (
            <button type="button" className="btn btn-danger" onClick={() => setBackground(screenId, { kind: 'preset', value: 'mesh-ocean' })}>
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
      </Collapsible>
    </div>
  );
}
