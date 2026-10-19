import { canvasOf, sizeOf, type AspectId, type Size, type Background, type Screen, type WidgetInstance } from '@/types';
import { uid } from './id';
import { clamp, fitRect, remapForAspect } from './geometry';

/** Čisté (immutable) operácie nad widgetmi jednej obrazovky. Testované samostatne, store ich len volá. */

export function sortByZ(widgets: readonly WidgetInstance[]): WidgetInstance[] {
  return widgets.slice().sort((a, b) => a.z - b.z);
}

export function normalizeZ(widgets: WidgetInstance[]): WidgetInstance[] {
  return sortByZ(widgets).map((w, i) => (w.z === i ? w : { ...w, z: i }));
}

export function nextZ(widgets: readonly WidgetInstance[]): number {
  return widgets.reduce((m, w) => Math.max(m, w.z), -1) + 1;
}

export function addWidget(widgets: WidgetInstance[], w: WidgetInstance, aspect: AspectId | Size): WidgetInstance[] {
  const canvas = sizeOf(aspect);
  const r = fitRect(w, canvas);
  return [...widgets, { ...w, ...r, z: nextZ(widgets) }];
}

export function patchWidget(widgets: WidgetInstance[], id: string, patch: Partial<WidgetInstance>): WidgetInstance[] {
  return widgets.map((w) => (w.id === id ? { ...w, ...patch } : w));
}

export function removeWidgets(widgets: WidgetInstance[], ids: readonly string[]): WidgetInstance[] {
  const set = new Set(ids);
  return normalizeZ(widgets.filter((w) => !set.has(w.id)));
}

export function setRects(widgets: WidgetInstance[], rects: Record<string, { x: number; y: number; w: number; h: number }>, aspect: AspectId | Size): WidgetInstance[] {
  const canvas = sizeOf(aspect);
  return widgets.map((w) => {
    const r = rects[w.id];
    if (!r) return w;
    return { ...w, ...fitRect(r, canvas, { w: 60, h: 40 }) };
  });
}

/** Kópie widgetov s novými ID a posunom; nové vrstvy nad existujúcimi. Pozície prepočíta, aby zostali v ploche. */
export function cloneWidgets(
  source: readonly WidgetInstance[],
  target: WidgetInstance[],
  aspect: AspectId | Size,
  offset = 30,
): { widgets: WidgetInstance[]; created: WidgetInstance[] } {
  const canvas = sizeOf(aspect);
  let z = nextZ(target);
  const created = sortByZ(source).map((w) => {
    const r = fitRect({ x: w.x + offset, y: w.y + offset, w: w.w, h: w.h }, canvas);
    return { ...JSON.parse(JSON.stringify(w)), ...r, id: uid(), z: z++, locked: false } as WidgetInstance;
  });
  return { widgets: [...target, ...created], created };
}

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Zarovná vybrané widgety. Pri jednom widgete voči ploche, pri viacerých voči ich spoločnému ohraničeniu. */
export function alignWidgets(widgets: WidgetInstance[], ids: readonly string[], how: Align, aspect: AspectId | Size): WidgetInstance[] {
  const canvas = sizeOf(aspect);
  const sel = widgets.filter((w) => ids.includes(w.id) && !w.locked);
  if (sel.length === 0) return widgets;
  const box =
    sel.length === 1
      ? { x: 0, y: 0, w: canvas.w, h: canvas.h }
      : (() => {
          const x1 = Math.min(...sel.map((w) => w.x));
          const y1 = Math.min(...sel.map((w) => w.y));
          const x2 = Math.max(...sel.map((w) => w.x + w.w));
          const y2 = Math.max(...sel.map((w) => w.y + w.h));
          return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        })();
  const set = new Set(sel.map((w) => w.id));
  return widgets.map((w) => {
    if (!set.has(w.id)) return w;
    switch (how) {
      case 'left':
        return { ...w, x: box.x };
      case 'center':
        return { ...w, x: Math.round(box.x + (box.w - w.w) / 2) };
      case 'right':
        return { ...w, x: box.x + box.w - w.w };
      case 'top':
        return { ...w, y: box.y };
      case 'middle':
        return { ...w, y: Math.round(box.y + (box.h - w.h) / 2) };
      case 'bottom':
        return { ...w, y: box.y + box.h - w.h };
    }
  });
}

/** Rovnomerné rozloženie (min. 3 widgety). */
export function distributeWidgets(widgets: WidgetInstance[], ids: readonly string[], axis: 'h' | 'v'): WidgetInstance[] {
  const sel = widgets.filter((w) => ids.includes(w.id) && !w.locked);
  if (sel.length < 3) return widgets;
  const key = axis === 'h' ? 'x' : 'y';
  const size = axis === 'h' ? 'w' : 'h';
  const sorted = sel.slice().sort((a, b) => a[key] - b[key]);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const totalSize = sorted.reduce((s, w) => s + w[size], 0);
  const gap = (last[key] + last[size] - first[key] - totalSize) / (sorted.length - 1);
  let pos = first[key];
  const pos2: Record<string, number> = {};
  for (const w of sorted) {
    pos2[w.id] = Math.round(pos);
    pos += w[size] + gap;
  }
  return widgets.map((w) => (w.id in pos2 ? { ...w, [key]: pos2[w.id]! } : w));
}

export function reorder(widgets: WidgetInstance[], ids: readonly string[], how: 'forward' | 'backward' | 'front' | 'back'): WidgetInstance[] {
  const sorted = sortByZ(widgets);
  const set = new Set(ids);
  let result: WidgetInstance[];
  if (how === 'front') result = [...sorted.filter((w) => !set.has(w.id)), ...sorted.filter((w) => set.has(w.id))];
  else if (how === 'back') result = [...sorted.filter((w) => set.has(w.id)), ...sorted.filter((w) => !set.has(w.id))];
  else {
    result = sorted.slice();
    if (how === 'forward') {
      for (let i = result.length - 2; i >= 0; i--) {
        if (set.has(result[i]!.id) && !set.has(result[i + 1]!.id)) [result[i], result[i + 1]] = [result[i + 1]!, result[i]!];
      }
    } else {
      for (let i = 1; i < result.length; i++) {
        if (set.has(result[i]!.id) && !set.has(result[i - 1]!.id)) [result[i], result[i - 1]] = [result[i - 1]!, result[i]!];
      }
    }
  }
  return result.map((w, i) => (w.z === i ? w : { ...w, z: i }));
}

export function setAspect(screen: Screen, aspect: AspectId): Screen {
  if (screen.aspect === aspect) return screen;
  return { ...screen, aspect, widgets: remapForAspect(screen.widgets, canvasOf(screen), canvasOf({ aspect, zoom: screen.zoom })) };
}

/** Zmena veľkosti obsahu: widgety si nechajú rozmery (budú teda pomerne menšie/väčšie), ich stredy sa posunú pomerne. */
export function setZoom(screen: Screen, zoom: number): Screen {
  const from = canvasOf(screen);
  const next: Screen = zoom === 1 ? (({ zoom: _z, ...rest }) => rest)(screen) : { ...screen, zoom };
  const to = canvasOf(next);
  if (from.w === to.w && from.h === to.h) return next;
  const sx = to.w / from.w;
  const sy = to.h / from.h;
  return {
    ...next,
    widgets: screen.widgets.map((w) => {
      const r = fitRect({ x: Math.round((w.x + w.w / 2) * sx - w.w / 2), y: Math.round((w.y + w.h / 2) * sy - w.h / 2), w: w.w, h: w.h }, to);
      return { ...w, ...r };
    }),
  };
}

export function moveBy(widgets: WidgetInstance[], ids: readonly string[], dx: number, dy: number, aspect: AspectId | Size): WidgetInstance[] {
  const canvas = sizeOf(aspect);
  const set = new Set(ids);
  return widgets.map((w) => (set.has(w.id) && !w.locked ? { ...w, x: clamp(w.x + dx, 0, canvas.w - w.w), y: clamp(w.y + dy, 0, canvas.h - w.h) } : w));
}

export interface Snapshot {
  widgets: WidgetInstance[];
  background: Background;
  aspect: AspectId;
  zoom: number | undefined;
}
export function snapshotOf(s: Screen): Snapshot {
  return { widgets: s.widgets, background: s.background, aspect: s.aspect, zoom: s.zoom };
}
