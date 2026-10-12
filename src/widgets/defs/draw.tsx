import { useCallback, useEffect, useRef } from 'react';
import { Download, Eraser, Pencil, PenLine, Trash2, Undo2 } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { Segmented } from '@/components/forms';
import { int, oneOf } from '../fields';
import { useRuntime } from '../runtime';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

/** Súradnice ťahov sú v „návrhových jednotkách“: šírka plochy = DESIGN_W (škáluje sa jednotne pri zmene veľkosti widgetu). */
const DESIGN_W = 1000;
const MAX_STROKES = 1500;
const MAX_POINTS = 60_000;
const COLORS = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#ffffff'];
const TOOLBAR_H = 96;

const stroke = z.object({
  tool: oneOf(['pen', 'eraser'] as const, 'pen'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).catch('#111827'),
  size: int(6, 1, 120),
  pts: z.array(z.number()).max(20_000).catch([]),
});
const schema = z.object({
  strokes: z.array(stroke).max(MAX_STROKES).catch([]),
  tool: oneOf(['pen', 'eraser'] as const, 'pen'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).catch('#111827'),
  size: int(6, 1, 120),
});
type Config = z.output<typeof schema>;
type Stroke = Config['strokes'][number];

function paint(ctx: CanvasRenderingContext2D, s: Stroke, k: number) {
  const pts = s.pts;
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size * k * (s.tool === 'eraser' ? 3 : 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 2) {
    ctx.beginPath();
    ctx.arc(pts[0]! * k, pts[1]! * k, (ctx.lineWidth || 1) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0]! * k, pts[1]! * k);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]! * k, pts[i + 1]! * k);
    ctx.stroke();
  }
  ctx.restore();
}

function DrawWidget({ widget, config, update }: WidgetProps<Config>) {
  const rt = useRuntime();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committed = useRef<HTMLCanvasElement | null>(null);
  const current = useRef<Stroke | null>(null);
  const raf = useRef(0);
  const areaW = widget.w;
  const areaH = Math.max(40, widget.h - TOOLBAR_H);
  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const pxW = Math.max(1, Math.round(areaW * rt.scale * dpr));
  const pxH = Math.max(1, Math.round(areaH * rt.scale * dpr));
  const k = pxW / DESIGN_W;

  const redrawCommitted = useCallback(() => {
    const off = (committed.current ??= document.createElement('canvas'));
    off.width = pxW;
    off.height = pxH;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    config.strokes.forEach((s) => paint(ctx, s, k));
  }, [config.strokes, pxW, pxH, k]);

  const composite = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (committed.current) ctx.drawImage(committed.current, 0, 0);
    if (current.current) paint(ctx, current.current, k);
  }, [k]);

  useEffect(() => {
    redrawCommitted();
    composite();
  }, [redrawCommitted, composite]);

  const toDesign = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * DESIGN_W * 10) / 10, Math.round(((e.clientY - r.top) / r.width) * DESIGN_W * 10) / 10] as const;
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toDesign(e);
    current.current = { tool: config.tool, color: config.color, size: config.size, pts: [x, y] };
    composite();
  };
  const move = (e: React.PointerEvent) => {
    const s = current.current;
    if (!s) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    const list = events.length ? events : [e.nativeEvent as PointerEvent];
    const r = canvasRef.current!.getBoundingClientRect();
    for (const ev of list) {
      s.pts.push(Math.round(((ev.clientX - r.left) / r.width) * DESIGN_W * 10) / 10, Math.round(((ev.clientY - r.top) / r.width) * DESIGN_W * 10) / 10);
    }
    if (!raf.current) raf.current = requestAnimationFrame(() => ((raf.current = 0), composite()));
  };
  const up = () => {
    const s = current.current;
    current.current = null;
    if (!s) return;
    const total = config.strokes.reduce((a, x) => a + x.pts.length, 0) + s.pts.length;
    if (config.strokes.length >= MAX_STROKES || total > MAX_POINTS * 2) {
      composite();
      return;
    }
    update({ strokes: [...config.strokes, s] });
  };

  const download = () => {
    const off = committed.current;
    if (!off) return;
    const out = document.createElement('canvas');
    out.width = off.width;
    out.height = off.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(off, 0, 0);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kresba.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  };

  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column' }}>
      <div data-no-drag style={{ height: TOOLBAR_H, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', boxSizing: 'border-box', overflow: 'hidden' }}>
        <button type="button" className="wbtn" style={{ padding: '0 14px' }} aria-pressed={config.tool === 'pen'} aria-label={t('w.draw.pen')} onClick={() => update({ tool: 'pen' })}>
          <Pencil size={28} aria-hidden />
        </button>
        <button type="button" className="wbtn" style={{ padding: '0 14px' }} aria-pressed={config.tool === 'eraser'} aria-label={t('w.draw.eraser')} onClick={() => update({ tool: 'eraser' })}>
          <Eraser size={28} aria-hidden />
        </button>
        {[3, 8, 20].map((s) => (
          <button key={s} type="button" className="wbtn" style={{ padding: '0 14px', borderColor: config.size === s ? '#2563eb' : undefined }} aria-pressed={config.size === s} aria-label={t('w.draw.sizeN', { n: s })} onClick={() => update({ size: s })}>
            <span style={{ width: 8 + s, height: 8 + s, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
          </button>
        ))}
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={config.color === c && config.tool === 'pen'}
            onClick={() => update({ color: c, tool: 'pen' })}
            style={{ width: 48, height: 48, borderRadius: '50%', background: c, border: config.color === c ? '5px solid #2563eb' : '3px solid #94a3b8', flex: 'none', cursor: 'pointer' }}
          />
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" className="wbtn" style={{ padding: '0 14px' }} aria-label={t('w.draw.undo')} disabled={config.strokes.length === 0} onClick={() => update({ strokes: config.strokes.slice(0, -1) })}>
          <Undo2 size={28} aria-hidden />
        </button>
        <button type="button" className="wbtn" style={{ padding: '0 14px' }} aria-label={t('w.draw.download')} disabled={config.strokes.length === 0} onClick={download}>
          <Download size={28} aria-hidden />
        </button>
        <button type="button" className="wbtn" style={{ padding: '0 14px' }} aria-label={t('w.draw.clear')} disabled={config.strokes.length === 0} onClick={() => update({ strokes: [] })}>
          <Trash2 size={28} aria-hidden />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        data-no-drag
        data-testid="draw-canvas"
        width={pxW}
        height={pxH}
        aria-label={t('w.draw.canvas')}
        style={{ width: areaW, height: areaH, touchAction: 'none', cursor: config.tool === 'eraser' ? 'cell' : 'crosshair', flex: 'none' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <Segmented
        label={t('w.draw.tool')}
        value={config.tool}
        onChange={(tool) => update({ tool })}
        options={[
          { value: 'pen', label: t('w.draw.pen') },
          { value: 'eraser', label: t('w.draw.eraser') },
        ]}
      />
      <Segmented label={t('w.draw.size')} value={config.size} onChange={(size) => update({ size })} options={[3, 8, 20].map((n) => ({ value: n, label: String(n) }))} />
      <button type="button" className="btn btn-danger" disabled={config.strokes.length === 0} onClick={() => update({ strokes: [] })}>
        {t('w.draw.clear')}
      </button>
      <p className="mt-3 text-sm text-muted">{t('w.draw.note')}</p>
    </>
  );
}

export const drawWidget: WidgetDefinition<Config> = {
  type: 'draw',
  label: 'w.draw.label',
  description: 'w.draw.desc',
  icon: PenLine,
  category: 'tools',
  defaultSize: { w: 900, h: 600 },
  minSize: { w: 420, h: 300 },
  schema,
  Component: DrawWidget,
  Settings,
};
