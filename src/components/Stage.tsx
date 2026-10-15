import { Component, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ErrorInfo, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { GripHorizontal, Lock, LockOpen, Settings2 } from 'lucide-react';
import { CANVAS_SIZES, type Background, type WidgetInstance } from '@/types';
import { useApp } from '@/store/useApp';
import { t } from '@/i18n';
import { clamp, fitRect, rectsIntersect, snap, type Rect } from '@/lib/geometry';
import { contrastText } from '@/lib/color';
import { bgPresetUrl } from '@/lib/backgrounds';
import { sortByZ } from '@/lib/screenOps';
import { getWidgetDefinition } from '@/widgets/registry';
import { ScreenRuntime } from '@/widgets/ScreenRuntime';
import { RuntimeContext, defaultRuntime } from '@/widgets/runtime';

export function backgroundStyle(bg: Background): CSSProperties {
  switch (bg.kind) {
    case 'color':
    case 'gradient':
      return { background: bg.value };
    case 'image':
      return { background: `center / cover no-repeat url("${bg.value}")` };
    case 'preset':
      return { background: `center / cover no-repeat ${bgPresetUrl(bg.value) ?? 'var(--bg)'}` };
  }
}

class WidgetBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Widget zlyhal', error, info.componentStack);
  }
  render() {
    if (this.state.failed) {
      return (
        <div role="alert" style={{ padding: 24, fontSize: 28 }}>
          {this.props.label}: {t('common.error')}
        </div>
      );
    }
    return this.props.children;
  }
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: { id: HandleId; cx: number; cy: number; cursor: string }[] = [
  { id: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
  { id: 'n', cx: 0.5, cy: 0, cursor: 'ns-resize' },
  { id: 'ne', cx: 1, cy: 0, cursor: 'nesw-resize' },
  { id: 'e', cx: 1, cy: 0.5, cursor: 'ew-resize' },
  { id: 'se', cx: 1, cy: 1, cursor: 'nwse-resize' },
  { id: 's', cx: 0.5, cy: 1, cursor: 'ns-resize' },
  { id: 'sw', cx: 0, cy: 1, cursor: 'nesw-resize' },
  { id: 'w', cx: 0, cy: 0.5, cursor: 'ew-resize' },
];

type Gesture =
  | { kind: 'move'; sx: number; sy: number; ids: string[]; start: Record<string, Rect>; primary: string; moved: boolean; pointerId: number }
  | { kind: 'resize'; sx: number; sy: number; id: string; handle: HandleId; start: Rect; ratio: number | null; min: { w: number; h: number }; pointerId: number }
  | { kind: 'marquee'; ox: number; oy: number; additive: boolean; base: string[]; pointerId: number };

const INTERACTIVE = 'button, input, textarea, select, a, canvas, [contenteditable="true"], [data-no-drag]';

interface ViewProps {
  widget: WidgetInstance;
  rect: Rect;
  mode: 'edit' | 'present';
  selected: boolean;
  scale: number;
  screenId: string;
  onFramePointerDown: (e: RPointerEvent<HTMLDivElement>, w: WidgetInstance) => void;
  onGesturePointer: (e: RPointerEvent<HTMLElement>) => void;
  onGestureEnd: (e: RPointerEvent<HTMLElement>) => void;
}

const WidgetView = memo(function WidgetView({ widget, rect, mode, selected, scale, screenId, onFramePointerDown, onGesturePointer, onGestureEnd }: ViewProps) {
  const def = getWidgetDefinition(widget.type);
  const patchConfig = useApp((s) => s.patchConfig);
  const update = useCallback((patch: Record<string, unknown>) => patchConfig(screenId, widget.id, patch), [patchConfig, screenId, widget.id]);
  const edit = mode === 'edit';
  const bg = widget.colors.bg;
  const fg = widget.colors.fg ?? (bg ? contrastText(bg) : undefined);
  const px = (n: number) => n / scale;
  const frameless = !!def.frameless && !bg;
  const style: CSSProperties = {
    position: 'absolute',
    left: rect.x,
    top: rect.y,
    width: rect.w,
    height: rect.h,
    zIndex: widget.z + 1,
    background: bg ?? (frameless ? 'transparent' : 'var(--widget-bg)'),
    color: fg ?? 'var(--widget-fg)',
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: selected ? `0 0 0 ${px(4)}px var(--primary)${frameless ? '' : ', 0 8px 24px rgba(0,0,0,.18)'}` : frameless ? 'none' : '0 6px 20px rgba(0,0,0,.16)',
    touchAction: edit ? 'none' : 'manipulation',
    cursor: edit && !widget.locked ? 'move' : 'default',
    userSelect: 'none',
  };
  const Comp = def.Component;
  return (
    <div
      className="group"
      style={style}
      data-widget-id={widget.id}
      data-widget-type={widget.type}
      data-selected={selected || undefined}
      role="group"
      aria-label={t(def.label)}
      tabIndex={edit ? 0 : undefined}
      onPointerDown={edit ? (e) => onFramePointerDown(e, widget) : undefined}
      onPointerMove={edit ? onGesturePointer : undefined}
      onPointerUp={edit ? onGestureEnd : undefined}
      onPointerCancel={edit ? onGestureEnd : undefined}
    >
      <WidgetBoundary label={t(def.label)}>
        <Comp widget={{ ...widget, w: rect.w, h: rect.h }} config={widget.config} update={update} mode={mode} />
      </WidgetBoundary>
    </div>
  );
});

export function Stage({ screenId, mode }: { screenId: string; mode: 'edit' | 'present' }) {
  const screen = useApp((s) => s.screens[screenId]);
  const selection = useApp((s) => s.selection);
  const settings = useApp((s) => s.settings);
  const select = useApp((s) => s.select);
  const commitRects = useApp((s) => s.commitRects);

  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [override, setOverride] = useState<Record<string, Rect> | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const overrideRef = useRef<Record<string, Rect> | null>(null);
  const live = useRef({ screen, selection, scale, settings });
  live.current = { screen, selection, scale, settings };

  const canvas = screen ? CANVAS_SIZES[screen.aspect] : CANVAS_SIZES['16:9'];

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const calc = () => {
      const pad = mode === 'edit' ? 24 : 0;
      const s = Math.min((host.clientWidth - pad) / canvas.w, (host.clientHeight - pad) / canvas.h);
      if (s > 0 && Number.isFinite(s)) setScale(s);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(host);
    return () => ro.disconnect();
  }, [canvas.w, canvas.h, mode]);

  const toCanvas = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / live.current.scale, y: (clientY - r.top) / live.current.scale };
  };

  const startMove = useCallback((e: RPointerEvent<HTMLElement>, w: WidgetInstance) => {
    const { selection: sel, screen: sc } = live.current;
    if (!sc || w.locked) return;
    const alreadySelected = sel.includes(w.id);
    const ids = (alreadySelected ? sel : [w.id]).filter((id) => sc.widgets.some((x) => x.id === id && !x.locked));
    const start: Record<string, Rect> = {};
    sc.widgets.filter((x) => ids.includes(x.id)).forEach((x) => (start[x.id] = { x: x.x, y: x.y, w: x.w, h: x.h }));
    gesture.current = { kind: 'move', sx: e.clientX, sy: e.clientY, ids, start, primary: w.id, moved: false, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onFramePointerDown = useCallback(
    (e: RPointerEvent<HTMLDivElement>, w: WidgetInstance) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const { selection: sel } = live.current;
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const alreadySelected = sel.includes(w.id);
      if (additive) {
        useApp.getState().select(alreadySelected ? sel.filter((x) => x !== w.id) : [...sel, w.id]);
        return;
      }
      if (!alreadySelected) useApp.getState().select([w.id]);
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
      startMove(e, w);
    },
    [startMove],
  );

  const onHandleDown = (e: RPointerEvent<HTMLDivElement>, handle: HandleId, w: WidgetInstance) => {
    e.stopPropagation();
    e.preventDefault();
    const def = getWidgetDefinition(w.type);
    gesture.current = {
      kind: 'resize', sx: e.clientX, sy: e.clientY, id: w.id, handle, start: { x: w.x, y: w.y, w: w.w, h: w.h },
      ratio: def.aspectRatio?.(w.config) ?? null, min: def.minSize, pointerId: e.pointerId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onBgPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (mode !== 'edit' || e.target !== e.currentTarget) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = toCanvas(e.clientX, e.clientY);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    gesture.current = { kind: 'marquee', ox: p.x, oy: p.y, additive, base: additive ? live.current.selection : [], pointerId: e.pointerId };
    if (!additive) select([]);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onGesturePointer = useCallback((e: RPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const { scale: sc, screen: scr, settings: st } = live.current;
    if (!scr) return;
    const cv = CANVAS_SIZES[scr.aspect];
    if (g.kind === 'move') {
      const dx = (e.clientX - g.sx) / sc;
      const dy = (e.clientY - g.sy) / sc;
      if (!g.moved && Math.hypot(dx, dy) * sc < 4) return;
      g.moved = true;
      const rects = Object.values(g.start);
      const minDx = -Math.min(...rects.map((r) => r.x));
      const maxDx = Math.min(...rects.map((r) => cv.w - r.x - r.w));
      const minDy = -Math.min(...rects.map((r) => r.y));
      const maxDy = Math.min(...rects.map((r) => cv.h - r.y - r.h));
      const p = g.start[g.primary]!;
      const free = e.altKey;
      let ddx = snap(p.x + dx, st.snapToGrid && !free) - p.x;
      let ddy = snap(p.y + dy, st.snapToGrid && !free) - p.y;
      ddx = clamp(ddx, minDx, Math.max(minDx, maxDx));
      ddy = clamp(ddy, minDy, Math.max(minDy, maxDy));
      const next: Record<string, Rect> = {};
      for (const [id, r] of Object.entries(g.start)) next[id] = { ...r, x: r.x + ddx, y: r.y + ddy };
      overrideRef.current = next;
      setOverride(next);
    } else if (g.kind === 'resize') {
      const dx = (e.clientX - g.sx) / sc;
      const dy = (e.clientY - g.sy) / sc;
      const s = g.start;
      const hd = g.handle;
      const grid = st.snapToGrid && !e.altKey;
      let { x, y, w, h } = s;
      if (hd.includes('e')) w = s.w + dx;
      if (hd.includes('s')) h = s.h + dy;
      if (hd.includes('w')) { x = s.x + dx; w = s.w - dx; }
      if (hd.includes('n')) { y = s.y + dy; h = s.h - dy; }
      if (grid) {
        if (hd.includes('e')) w = snap(s.x + w, true) - s.x;
        if (hd.includes('s')) h = snap(s.y + h, true) - s.y;
        if (hd.includes('w')) { const r = s.x + s.w; x = snap(x, true); w = r - x; }
        if (hd.includes('n')) { const b = s.y + s.h; y = snap(y, true); h = b - y; }
      }
      w = Math.max(w, g.min.w);
      h = Math.max(h, g.min.h);
      if (g.ratio) {
        const r = g.ratio;
        if (hd === 'n' || hd === 's') w = h * r;
        else h = w / r;
        if (h < g.min.h) { h = g.min.h; w = h * r; }
        if (w < g.min.w) { w = g.min.w; h = w / r; }
      }
      if (hd.includes('w')) x = s.x + s.w - w;
      if (hd.includes('n')) y = s.y + s.h - h;
      if (g.ratio) {
        if (hd === 'n' || hd === 's') x = s.x;
        if (hd === 'e' || hd === 'w') y = s.y;
      }
      let r: Rect = { x, y, w, h };
      if (g.ratio) {
        if (r.x < 0 || r.y < 0 || r.x + r.w > cv.w || r.y + r.h > cv.h) return;
      } else r = fitRect(r, cv, g.min);
      overrideRef.current = { [g.id]: r };
      setOverride(overrideRef.current);
    } else {
      const p = { x: clamp((e.clientX - stageRef.current!.getBoundingClientRect().left) / sc, 0, cv.w), y: clamp((e.clientY - stageRef.current!.getBoundingClientRect().top) / sc, 0, cv.h) };
      const box: Rect = { x: Math.min(g.ox, p.x), y: Math.min(g.oy, p.y), w: Math.abs(p.x - g.ox), h: Math.abs(p.y - g.oy) };
      setMarquee(box);
      const hit = scr.widgets.filter((w) => rectsIntersect(box, w)).map((w) => w.id);
      useApp.getState().select(Array.from(new Set([...g.base, ...hit])));
    }
  }, []);

  const onGestureEnd = useCallback((e: RPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    setMarquee(null);
    const cur = overrideRef.current;
    overrideRef.current = null;
    setOverride(null);
    if (cur && e.type !== 'pointercancel') commitRects(screenId, cur);
  }, [commitRects, screenId]);

  const widgets = useMemo(() => (screen ? sortByZ(screen.widgets) : []), [screen]);

  // Pri zmene obrazovky zruš rozpracované gestá.
  useEffect(() => () => {
    gesture.current = null;
  }, [screenId]);

  if (!screen) return null;
  const single = mode === 'edit' && selection.length === 1 ? widgets.find((w) => w.id === selection[0]) : undefined;
  const hs = 18 / scale;
  const hit = 44 / scale;

  return (
    <div ref={hostRef} className="relative flex size-full items-center justify-center overflow-hidden" data-testid="stage-host">
      <div style={{ width: canvas.w * scale, height: canvas.h * scale, position: 'relative', flex: 'none', boxShadow: mode === 'edit' ? '0 10px 40px rgba(0,0,0,.25)' : undefined, borderRadius: mode === 'edit' ? 8 : 0, overflow: 'hidden', ...backgroundStyle(screen.background) }}>
        <ScreenRuntime screenId={screenId} scale={scale}>
          <div
            ref={stageRef}
            data-testid="stage"
            data-scale={scale.toFixed(4)}
            role="region"
            aria-label={t('editor.canvasLabel')}
            style={{ position: 'absolute', left: 0, top: 0, width: canvas.w, height: canvas.h, transform: `scale(${scale})`, transformOrigin: '0 0', touchAction: mode === 'edit' ? 'none' : 'manipulation' }}
            onPointerDown={onBgPointerDown}
            onPointerMove={mode === 'edit' ? (e) => gesture.current?.kind === 'marquee' && onGesturePointer(e) : undefined}
            onPointerUp={mode === 'edit' ? (e) => gesture.current?.kind === 'marquee' && onGestureEnd(e) : undefined}
            onPointerCancel={mode === 'edit' ? (e) => gesture.current?.kind === 'marquee' && onGestureEnd(e) : undefined}
          >
            {widgets.map((w) => (
              <WidgetView
                key={w.id}
                widget={w}
                rect={override?.[w.id] ?? w}
                mode={mode}
                selected={mode === 'edit' && selection.includes(w.id)}
                scale={scale}
                screenId={screenId}
                onFramePointerDown={onFramePointerDown}
                onGesturePointer={onGesturePointer}
                onGestureEnd={onGestureEnd}
              />
            ))}
            {single && !single.locked && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
                {HANDLES.map((h) => {
                  const r = override?.[single.id] ?? single;
                  const inner = 12 / scale; // zásah zasahuje do widgetu len málo, aby neprekrýval jeho ovládacie prvky
                  const mid = h.id === 'n' || h.id === 's' || h.id === 'e' || h.id === 'w';
                  const hz = mid ? 28 / scale : hit; // stredné úchyty majú menší zásah, aby neprekrývali lištu nad widgetom
                  const pos = (c: number, start: number, size: number) => (c === 0 ? start - hz + inner : c === 1 ? start + size - inner : start + size / 2 - hz / 2);
                  return (
                    <div key={h.id}>
                      <div style={{ position: 'absolute', left: r.x + r.w * h.cx - hs / 2, top: r.y + r.h * h.cy - hs / 2, width: hs, height: hs, borderRadius: hs / 4, background: 'var(--surface)', border: `${3 / scale}px solid var(--primary)`, boxSizing: 'border-box' }} />
                      <div
                        data-handle={h.id}
                        aria-label={t('sel.resize')}
                        onPointerDown={(e) => onHandleDown(e, h.id, { ...single, ...r })}
                        onPointerMove={onGesturePointer}
                        onPointerUp={onGestureEnd}
                        onPointerCancel={onGestureEnd}
                        style={{ position: 'absolute', left: pos(h.cx, r.x, r.w), top: pos(h.cy, r.y, r.h), width: hz, height: hz, cursor: h.cursor, pointerEvents: 'auto', touchAction: 'none' }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {single && (() => {
              const r = override?.[single.id] ?? single;
              const btn = 40 / scale;
              const barH = btn + 8 / scale;
              const barW = (single.locked ? 2 : 3) * btn + 14 / scale;
              const gap = 24 / scale;
              let top = r.y - gap - barH;
              if (top < 4 / scale) top = r.y + r.h + gap;
              if (top + barH > canvas.h - 4 / scale) top = r.y + 10 / scale;
              const left = clamp(r.x + r.w / 2 - barW / 2, 4 / scale, canvas.w - barW - 4 / scale);
              const base = { width: btn, height: btn, display: 'grid', placeItems: 'center', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--primary-fg)', padding: 0, cursor: 'pointer', pointerEvents: 'auto' as const, touchAction: 'none' as const };
              return (
                <div data-testid="widget-chrome" style={{ position: 'absolute', left, top, height: barH, width: barW, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 / scale, borderRadius: barH, background: 'var(--primary)', boxShadow: '0 6px 18px rgba(0,0,0,.28)', pointerEvents: 'auto', zIndex: 5 }}>
                  {!single.locked && (
                    <div
                      data-drag-handle
                      data-testid="widget-grip"
                      role="button"
                      aria-label={t('sel.dragHandle')}
                      data-tip={t('sel.dragHandle')}
                      style={{ ...base, cursor: 'grab' }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        startMove(e, single);
                      }}
                      onPointerMove={onGesturePointer}
                      onPointerUp={onGestureEnd}
                      onPointerCancel={onGestureEnd}
                    >
                      <GripHorizontal size={btn * 0.55} aria-hidden />
                    </div>
                  )}
                  <button type="button" data-testid="widget-gear" aria-label={t('sel.settings')} data-tip={t('sel.settingsTip')} style={base} onClick={() => useApp.getState().setInspectorOpen(true)}>
                    <Settings2 size={btn * 0.55} aria-hidden />
                  </button>
                  <button type="button" data-testid="widget-lock" aria-label={single.locked ? t('sel.unlock') : t('sel.lock')} data-tip={single.locked ? t('sel.unlock') : t('sel.lock')} style={base} onClick={() => useApp.getState().setLocked(screenId, [single.id], !single.locked)}>
                    {single.locked ? <Lock size={btn * 0.5} aria-hidden /> : <LockOpen size={btn * 0.5} aria-hidden />}
                  </button>
                </div>
              );
            })()}
            {marquee && <div style={{ position: 'absolute', left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, border: `${2 / scale}px dashed var(--primary)`, background: 'rgba(37,99,235,.12)', zIndex: 10001, pointerEvents: 'none' }} />}
          </div>
        </ScreenRuntime>
        {screen.background.kind === 'image' && screen.background.credit && (
          <div data-testid="bg-credit" style={{ position: 'absolute', right: 6, bottom: 4, maxWidth: '70%', zIndex: 50, pointerEvents: 'none', fontSize: 11, color: '#fff', background: 'rgba(0,0,0,.38)', padding: '1px 8px', borderRadius: 999, textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>
            {t('bg.photoBy')}: {screen.background.credit}
          </div>
        )}
      </div>
    </div>
  );
}

/** Zjednodušený náhľad (použije sa, kým sa skutočný náhľad nenačíta alebo ak nie je dostupné meranie). */
function ThumbFallback({ widgets, aspect, background }: { widgets: WidgetInstance[]; aspect: keyof typeof CANVAS_SIZES; background: Background }) {
  const c = CANVAS_SIZES[aspect];
  return (
    <svg viewBox={`0 0 ${c.w} ${c.h}`} role="img" aria-hidden className="block w-full rounded-lg" style={{ aspectRatio: `${c.w} / ${c.h}`, ...backgroundStyle(background) }}>
      {sortByZ(widgets).map((w) => (
        <g key={w.id}>
          <rect x={w.x} y={w.y} width={w.w} height={w.h} rx={24} fill={w.colors.bg ?? 'rgba(255,255,255,0.88)'} stroke="rgba(15,23,42,.3)" strokeWidth={6} />
          <rect x={w.x + w.w * 0.12} y={w.y + w.h * 0.3} width={w.w * 0.76} height={Math.max(14, w.h * 0.1)} rx={8} fill="rgba(15,23,42,.35)" />
          <rect x={w.x + w.w * 0.12} y={w.y + w.h * 0.52} width={w.w * 0.5} height={Math.max(14, w.h * 0.1)} rx={8} fill="rgba(15,23,42,.2)" />
        </g>
      ))}
    </svg>
  );
}

const noopUpdate = () => undefined;

/** Skutočný (nehybný a nedotykový) obraz widgetu v náhľade – rovnaké vykreslenie ako na ploche. */
function ThumbWidget({ widget }: { widget: WidgetInstance }) {
  const def = getWidgetDefinition(widget.type);
  const bg = widget.colors.bg;
  const fg = widget.colors.fg ?? (bg ? contrastText(bg) : undefined);
  const frameless = !!def.frameless && !bg;
  const Comp = def.Component;
  return (
    <div
      style={{
        position: 'absolute',
        left: widget.x,
        top: widget.y,
        width: widget.w,
        height: widget.h,
        zIndex: widget.z + 1,
        background: bg ?? (frameless ? 'transparent' : 'var(--widget-bg)'),
        color: fg ?? 'var(--widget-fg)',
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: frameless ? 'none' : '0 6px 20px rgba(0,0,0,.16)',
      }}
    >
      <WidgetBoundary label={t(def.label)}>
        <Comp widget={widget} config={widget.config} update={noopUpdate} mode="present" />
      </WidgetBoundary>
    </div>
  );
}

/**
 * Náhľad obrazovky: skutočne vykreslené widgety zmenšené na šírku karty. Vykreslia sa až keď je náhľad vo výhľade
 * (šetrí výkon pri dlhých zoznamoch); dovtedy (a bez merania veľkosti) sa ukáže zjednodušená kresba.
 */
export const ScreenThumb = memo(function ScreenThumb({ widgets, aspect, background }: { widgets: WidgetInstance[]; aspect: keyof typeof CANVAS_SIZES; background: Background }) {
  const c = CANVAS_SIZES[aspect];
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => setWidth(el.clientWidth));
      ro.observe(el);
    }
    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (setVisible(true), io?.disconnect()), { rootMargin: '200px' });
      io.observe(el);
    }
    return () => {
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);
  const scale = width / c.w;
  const live = visible && width > 0;
  const runtime = useMemo(() => ({ ...defaultRuntime, widgets, scale }), [widgets, scale]);
  return (
    <div ref={box} aria-hidden className="relative block w-full overflow-hidden rounded-lg" style={{ aspectRatio: `${c.w} / ${c.h}`, ...backgroundStyle(background) }}>
      {live ? (
        <RuntimeContext.Provider value={runtime}>
          <div
            // @ts-expect-error `inert` je vo väčšine typov React ešte neúplne podporované
            inert=""
            style={{ position: 'absolute', left: 0, top: 0, width: c.w, height: c.h, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none', userSelect: 'none' }}
          >
            {sortByZ(widgets).map((w) => (
              <ThumbWidget key={w.id} widget={w} />
            ))}
          </div>
        </RuntimeContext.Provider>
      ) : (
        <ThumbFallback widgets={widgets} aspect={aspect} background={background} />
      )}
    </div>
  );
});
