import type { AspectId, WidgetInstance } from '@/types';
import { sizeOf, type Size } from '@/types';

export const GRID = 10;

export function snap(v: number, enabled: boolean, grid = GRID): number {
  return enabled ? Math.round(v / grid) * grid : Math.round(v);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Udrží widget celý v rámci plochy (a pri príliš veľkom widgete ho zmenší). */
export function fitRect(r: Rect, canvas: { w: number; h: number }, min = { w: 120, h: 80 }): Rect {
  const w = clamp(r.w, Math.min(min.w, canvas.w), canvas.w);
  const h = clamp(r.h, Math.min(min.h, canvas.h), canvas.h);
  return { w, h, x: clamp(r.x, 0, canvas.w - w), y: clamp(r.y, 0, canvas.h - h) };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Prepočíta rozloženie pri zmene pomeru strán – pomerovo, aby všetko zostalo viditeľné a použiteľné. */
export function remapForAspect(widgets: WidgetInstance[], from: AspectId | Size, to: AspectId | Size): WidgetInstance[] {
  if (from === to) return widgets;
  const a = sizeOf(from);
  const b = sizeOf(to);
  const sx = b.w / a.w;
  const sy = b.h / a.h;
  return widgets.map((wd) => {
    const r = fitRect(
      { x: Math.round(wd.x * sx), y: Math.round(wd.y * sy), w: Math.round(wd.w * sx), h: Math.round(wd.h * sy) },
      b,
    );
    return { ...wd, ...r };
  });
}
