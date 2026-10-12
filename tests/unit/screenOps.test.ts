import { describe, expect, it } from 'vitest';
import * as ops from '@/lib/screenOps';
import { createWidget } from '@/widgets/registry';
import { buildScreen } from '@/templates';
import { CANVAS_SIZES, type WidgetInstance } from '@/types';

const mk = (x: number, y: number, w = 200, h = 100, z = 0): WidgetInstance => ({ ...createWidget('text', { x, y, w, h, z }), id: `w${x}-${y}-${z}` });

describe('operácie nad widgetmi', () => {
  it('addWidget drží widget v ploche a dá ho navrch', () => {
    const base = [mk(0, 0, 200, 100, 0)];
    const out = ops.addWidget(base, mk(5000, 5000, 300, 200), '16:9');
    const added = out[1]!;
    expect(added.x + added.w).toBeLessThanOrEqual(CANVAS_SIZES['16:9'].w);
    expect(added.y + added.h).toBeLessThanOrEqual(CANVAS_SIZES['16:9'].h);
    expect(added.z).toBe(1);
  });
  it('reorder presúva dopredu/dozadu a udržiava súvislé poradie', () => {
    const ws = [mk(0, 0, 100, 100, 0), mk(1, 0, 100, 100, 1), mk(2, 0, 100, 100, 2)];
    const fwd = ops.reorder(ws, [ws[0]!.id], 'forward');
    expect(ops.sortByZ(fwd).map((w) => w.id)).toEqual([ws[1]!.id, ws[0]!.id, ws[2]!.id]);
    const front = ops.reorder(ws, [ws[0]!.id], 'front');
    expect(ops.sortByZ(front).at(-1)!.id).toBe(ws[0]!.id);
    const back = ops.reorder(ws, [ws[2]!.id], 'back');
    expect(ops.sortByZ(back)[0]!.id).toBe(ws[2]!.id);
    expect(ops.sortByZ(back).map((w) => w.z)).toEqual([0, 1, 2]);
  });
  it('zarovnanie jedného widgetu ide voči ploche, viacerých voči ich ohraničeniu; zamknuté sa nehýbu', () => {
    const a = mk(100, 100, 200, 100, 0);
    const b = mk(500, 300, 100, 100, 1);
    const left = ops.alignWidgets([a, b], [a.id, b.id], 'left', '16:9');
    expect(left.map((w) => w.x)).toEqual([100, 100]);
    const center = ops.alignWidgets([a], [a.id], 'center', '16:9');
    expect(center[0]!.x).toBe((1920 - 200) / 2);
    const locked = { ...b, locked: true };
    expect(ops.alignWidgets([a, locked], [a.id, locked.id], 'left', '16:9')[1]!.x).toBe(500);
  });
  it('rovnomerné rozloženie vyžaduje aspoň 3 widgety a zachová krajné', () => {
    const ws = [mk(0, 0, 100, 50, 0), mk(150, 0, 100, 50, 1), mk(900, 0, 100, 50, 2)];
    const out = ops.distributeWidgets(ws, ws.map((w) => w.id), 'h');
    expect(out.map((w) => w.x)).toEqual([0, 450, 900]);
    expect(ops.distributeWidgets(ws.slice(0, 2), ws.slice(0, 2).map((w) => w.id), 'h')).toEqual(ws.slice(0, 2));
  });
  it('cloneWidgets vytvorí nové ID a ponechá obsah (hlboká kópia)', () => {
    const src = [mk(100, 100)];
    const { widgets, created } = ops.cloneWidgets(src, src, '16:9');
    expect(widgets).toHaveLength(2);
    expect(created[0]!.id).not.toBe(src[0]!.id);
    expect(created[0]!.config).toEqual(src[0]!.config);
    expect(created[0]!.config).not.toBe(src[0]!.config);
    expect(created[0]!.x).toBe(130);
  });
  it('zmena pomeru strán nechá všetky widgety celé v ploche a nezmení ich počet', () => {
    const screen = buildScreen({ name: 'x', widgets: [mk(1700, 900, 200, 160), mk(0, 0, 1920, 1080)] });
    for (const aspect of ['4:3', '16:10', '16:9'] as const) {
      const out = ops.setAspect(screen, aspect);
      const c = CANVAS_SIZES[aspect];
      expect(out.widgets).toHaveLength(2);
      out.widgets.forEach((w) => {
        expect(w.x).toBeGreaterThanOrEqual(0);
        expect(w.y).toBeGreaterThanOrEqual(0);
        expect(w.x + w.w).toBeLessThanOrEqual(c.w);
        expect(w.y + w.h).toBeLessThanOrEqual(c.h);
      });
    }
  });
  it('moveBy neposunie widget mimo plochu ani zamknutý widget', () => {
    const a = mk(10, 10, 100, 100);
    const l = { ...mk(50, 50, 100, 100, 1), locked: true };
    const out = ops.moveBy([a, l], [a.id, l.id], -500, 5000, '16:9');
    expect(out[0]!.x).toBe(0);
    expect(out[0]!.y).toBe(1080 - 100);
    expect(out[1]).toEqual(l);
  });
  it('removeWidgets normalizuje vrstvy', () => {
    const ws = [mk(0, 0, 10, 10, 0), mk(1, 0, 10, 10, 1), mk(2, 0, 10, 10, 2)];
    expect(ops.removeWidgets(ws, [ws[1]!.id]).map((w) => w.z)).toEqual([0, 1]);
  });
});
