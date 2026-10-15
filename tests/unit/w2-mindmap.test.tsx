import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  MAX_NODES,
  addChild,
  addSibling,
  boxesOverlap,
  clearMap,
  connectorPath,
  deleteBranch,
  layoutMindmap,
  navigate,
  repairNodes,
  subtreeIds,
  toggleCollapsed,
  visibleNodes,
  wrapText,
  type MindNode,
} from '@/lib/mindmap';
import { getWidgetDefinition } from '@/widgets/registry';
import { WidgetHarness } from './harness';

const n = (id: string, parent: string | null, text = id, collapsed = false): MindNode => ({ id, parent, text, collapsed });
const def = () => getWidgetDefinition('mindmap');
const parse = (raw: unknown) => def().schema.parse(raw) as { nodes: MindNode[]; layout: string; colorful: boolean };
const roots = (a: MindNode[]) => a.filter((x) => x.parent === null);

function sample(count: number): MindNode[] {
  const out: MindNode[] = [n('root', null, 'Téma')];
  for (let i = 1; i < count; i++) {
    const p = i <= 5 ? 'root' : out[1 + ((i * 7) % (out.length - 1))]!.id;
    out.push(n(`n${i}`, p, i % 3 ? `Vetva číslo ${i}` : `Dlhší text uzla s viacerými slovami ${i}`));
  }
  return out;
}
function assertTree(a: MindNode[]) {
  expect(roots(a)).toHaveLength(1);
  expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
  const root = roots(a)[0]!;
  expect(subtreeIds(a, root.id)).toHaveLength(a.length); // všetko dosiahnuteľné = bez cyklov a sirôt
}

describe('myšlienková mapa – oprava schémy', () => {
  it('predvolená konfigurácia má jediný koreň s prekladateľným textom', () => {
    const c = parse({});
    expect(c.nodes).toHaveLength(1);
    expect(c.nodes[0]!.parent).toBeNull();
    expect(c.nodes[0]!.text).toBe('Téma');
    expect(c.layout).toBe('tree');
    expect(c.colorful).toBe(true);
  });
  it('odolá ľubovoľnému nezmyslu', () => {
    for (const bad of [{}, { nodes: 5 }, { nodes: 'x' }, { nodes: [] }, { nodes: [1, 2, 3] }, { nodes: [null, 4, 'a', {}] }, { nodes: [{ id: 5 }] }, { layout: 9, colorful: 'a' }]) {
      const c = parse(bad);
      assertTree(c.nodes);
      expect(['tree', 'radial']).toContain(c.layout);
    }
  });
  it('opraví cykly', () => {
    const c = parse({ nodes: [n('r', null), n('a', 'b'), n('b', 'c'), n('c', 'a')] });
    assertTree(c.nodes);
    expect(c.nodes).toHaveLength(4);
  });
  it('cyklus bez koreňa a sebareferencia', () => {
    assertTree(repairNodes([n('a', 'b'), n('b', 'a')], () => 'T'));
    assertTree(repairNodes([n('a', 'a')], () => 'T'));
  });
  it('viac koreňov: prvý ostáva, ostatné sa pripoja', () => {
    const a = repairNodes([n('r1', null), n('r2', null), n('r3', null)], () => 'T');
    assertTree(a);
    expect(roots(a)[0]!.id).toBe('r1');
    expect(a.find((x) => x.id === 'r3')!.parent).toBe('r1');
  });
  it('siroty sa pripoja ku koreňu a duplicitné id sa zahodia', () => {
    const a = repairNodes([n('r', null), n('o', 'neexistuje'), n('o', 'r', 'dup')], () => 'T');
    assertTree(a);
    expect(a).toHaveLength(2);
    expect(a.find((x) => x.id === 'o')!.parent).toBe('r');
  });
  it('viac ako 120 uzlov sa orezá, text a id sa skrátia', () => {
    const many = [n('r', null), ...Array.from({ length: 300 }, (_, i) => n(`i${i}`, 'r'))];
    const c = parse({ nodes: many });
    expect(c.nodes).toHaveLength(MAX_NODES);
    assertTree(c.nodes);
    const long = parse({ nodes: [n('abcdefghijkl', null, 'x'.repeat(200))] });
    expect(long.nodes[0]!.id).toHaveLength(8);
    expect(long.nodes[0]!.text).toHaveLength(60);
  });
  it('prázdny text koreňa sa nahradí predvoleným', () => {
    expect(parse({ nodes: [n('r', null, '  ')] }).nodes[0]!.text).toBe('Téma');
  });
});

describe('myšlienková mapa – operácie nad stromom', () => {
  const base = [n('r', null), n('a', 'r'), n('b', 'r'), n('a1', 'a'), n('a2', 'a')];
  it('pridá potomka na koniec podstromu rodiča a rozbalí ho', () => {
    const r = addChild([n('r', null), n('a', 'r', 'a', true), n('a1', 'a'), n('b', 'r')], 'a', '', 'new');
    expect(r.id).toBe('new');
    expect(r.nodes.map((x) => x.id)).toEqual(['r', 'a', 'a1', 'new', 'b']);
    expect(r.nodes.find((x) => x.id === 'a')!.collapsed).toBe(false);
  });
  it('pridá súrodenca hneď za uzol; pri koreni potomka', () => {
    const r = addSibling(base, 'a', '', 'x');
    expect(r.nodes.map((q) => q.id)).toEqual(['r', 'a', 'x', 'b', 'a1', 'a2']);
    expect(r.nodes.find((q) => q.id === 'x')!.parent).toBe('r');
    expect(addSibling(base, 'r', '', 'y').nodes.find((q) => q.id === 'y')!.parent).toBe('r');
  });
  it('rešpektuje limit uzlov', () => {
    const full = sample(MAX_NODES);
    expect(addChild(full, 'root').id).toBeUndefined();
    expect(addSibling(full, 'n3').nodes).toHaveLength(MAX_NODES);
  });
  it('zmaže vetvu aj s potomkami, koreň nie', () => {
    expect(deleteBranch(base, 'a').map((x) => x.id)).toEqual(['r', 'b']);
    expect(deleteBranch(base, 'r')).toHaveLength(base.length);
  });
  it('zbalí a rozbalí len uzol s potomkami; zbalené sa nezobrazia', () => {
    const c = toggleCollapsed(base, 'a');
    expect(c.find((x) => x.id === 'a')!.collapsed).toBe(true);
    expect(visibleNodes(c).map((x) => x.id)).toEqual(['r', 'a', 'b']);
    expect(toggleCollapsed(base, 'b')).toEqual(base);
  });
  it('vymazanie mapy nechá koreň', () => {
    expect(clearMap(base)).toEqual([n('r', null)]);
  });
  it('navigácia šípkami', () => {
    expect(navigate(base, 'a', 'down')).toBe('b');
    expect(navigate(base, 'b', 'up')).toBe('a');
    expect(navigate(base, 'a', 'up')).toBeNull();
    expect(navigate(base, 'a1', 'left')).toBe('a');
    expect(navigate(base, 'a', 'right')).toBe('a1');
    expect(navigate(base, 'r', 'right')).toBe('a');
    expect(navigate(base, 'r', 'left')).toBeNull();
    expect(navigate(toggleCollapsed(base, 'a'), 'a', 'right')).toBeNull();
  });
  it('zalamovanie textu', () => {
    expect(wrapText('jedna dva tri štyri päť', 10)).toEqual(['jedna dva', 'tri štyri', 'päť']);
    expect(wrapText('a'.repeat(25), 10)).toEqual(['a'.repeat(10), 'a'.repeat(10), 'aaaaa']);
    expect(wrapText('', 10)).toEqual(['']);
  });
});

describe('myšlienková mapa – rozloženie', () => {
  for (const layout of ['tree', 'radial'] as const) {
    for (const count of [1, 2, 7, 30, 60, MAX_NODES]) {
      it(`${layout}: ${count} uzlov bez prekrývania`, () => {
        const nodes = sample(count);
        const r = layoutMindmap(nodes, layout);
        expect(r.boxes).toHaveLength(count);
        for (let i = 0; i < r.boxes.length; i++) {
          const a = r.boxes[i]!;
          expect(a.x).toBeGreaterThanOrEqual(0);
          expect(a.y).toBeGreaterThanOrEqual(0);
          expect(a.x + a.w).toBeLessThanOrEqual(r.width + 0.001);
          expect(a.y + a.h).toBeLessThanOrEqual(r.height + 0.001);
          for (let j = i + 1; j < r.boxes.length; j++) expect(boxesOverlap(a, r.boxes[j]!), `${a.id} × ${r.boxes[j]!.id}`).toBe(false);
        }
        expect(r.edges).toHaveLength(count - 1);
      });
    }
    it(`${layout}: je deterministické a zbalené uzly sa nevykreslia`, () => {
      const nodes = sample(40);
      expect(layoutMindmap(nodes, layout)).toEqual(layoutMindmap(nodes, layout));
      const collapsed = nodes.map((x) => (x.id === 'root' ? { ...x, collapsed: true } : x));
      expect(layoutMindmap(collapsed, layout).boxes).toHaveLength(1);
    });
  }
  it('strom: rodič je vľavo od detí a vycentrovaný', () => {
    const r = layoutMindmap([n('r', null), n('a', 'r'), n('b', 'r'), n('c', 'r')], 'tree');
    const box = (id: string) => r.boxes.find((b) => b.id === id)!;
    expect(box('a').x).toBeGreaterThan(box('r').x + box('r').w);
    const mid = (box('a').y + box('a').h / 2 + box('c').y + box('c').h / 2) / 2;
    expect(Math.abs(box('r').y + box('r').h / 2 - mid)).toBeLessThan(1);
    expect(box('a').y).toBeLessThan(box('b').y);
  });
  it('lúčovité: vetvy sú okolo koreňa', () => {
    const nodes = [n('r', null), ...['a', 'b', 'c', 'd'].map((id) => n(id, 'r'))];
    const r = layoutMindmap(nodes, 'radial');
    const c = (id: string) => {
      const b = r.boxes.find((x) => x.id === id)!;
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    };
    const rc = c('r');
    const sides = new Set(['a', 'b', 'c', 'd'].map((id) => `${Math.sign(c(id).x - rc.x)}${Math.sign(c(id).y - rc.y)}`));
    expect(sides.size).toBeGreaterThan(2);
  });
  it('spojnica je platná SVG cesta', () => {
    for (const layout of ['tree', 'radial'] as const) {
      const r = layoutMindmap(sample(10), layout);
      for (const e of r.edges) {
        const d = connectorPath(r, r.boxes.find((b) => b.id === e.from)!, r.boxes.find((b) => b.id === e.to)!);
        expect(d).toMatch(/^M[-\d. ]+C[-\d. ]+$/);
      }
    }
  });
});

describe('widget Myšlienková mapa', () => {
  it('prázdna mapa ukáže koreň a nápovedu', () => {
    render(<WidgetHarness type="mindmap" />);
    expect(screen.getAllByRole('treeitem')).toHaveLength(1);
    expect(screen.getByTestId('mindmap-hint')).toHaveTextContent('Dvojklikom upravte text, Tab pridá vetvu');
  });

  it('klávesnica: Tab pridá potomka, Enter potvrdí, Delete zmaže vetvu', () => {
    let cfg: { nodes: MindNode[] } | undefined;
    render(<WidgetHarness type="mindmap" onConfig={(c) => (cfg = c as { nodes: MindNode[] })} />);
    const rootItem = screen.getByRole('treeitem');
    fireEvent.click(rootItem);
    expect(rootItem).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(rootItem, { key: 'Tab' });
    const input = screen.getByLabelText('Text uzla');
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Vetva A' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByLabelText('Text uzla')).toBeNull();
    expect(cfg!.nodes).toHaveLength(2);
    expect(cfg!.nodes[1]!.text).toBe('Vetva A');
    const branch = screen.getByRole('treeitem', { name: /Vetva A/ });
    expect(branch).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('mindmap-hint')).toBeNull();

    // Enter na vybranom uzle pridá súrodenca; prázdny nový uzol sa Enterom zahodí
    fireEvent.keyDown(branch, { key: 'Enter' });
    expect(cfg!.nodes).toHaveLength(3);
    fireEvent.keyDown(screen.getByLabelText('Text uzla'), { key: 'Enter' });
    expect(cfg!.nodes).toHaveLength(2);

    // Escape pri úprave existujúceho uzla vráti pôvodný text
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /Vetva A/ }), { key: 'F2' });
    fireEvent.change(screen.getByLabelText('Text uzla'), { target: { value: 'Iné' } });
    fireEvent.keyDown(screen.getByLabelText('Text uzla'), { key: 'Escape' });
    expect(cfg!.nodes[1]!.text).toBe('Vetva A');

    // šípka vľavo vyberie rodiča; Delete na koreni nič nezmaže
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /Vetva A/ }), { key: 'ArrowLeft' });
    const rootAgain = screen.getByRole('treeitem', { name: /Téma/ });
    expect(rootAgain).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(rootAgain, { key: 'Delete' });
    expect(cfg!.nodes).toHaveLength(2);

    // Delete na vetve ju zmaže
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /Vetva A/ }), { key: 'Delete' });
    expect(cfg!.nodes).toHaveLength(1);
    expect(screen.getAllByRole('treeitem')).toHaveLength(1);
  });

  it('klávesy vo widgete sa nedostanú ku globálnym skratkám', () => {
    const seen: string[] = [];
    const h = (e: KeyboardEvent) => seen.push(e.key);
    window.addEventListener('keydown', h);
    render(<WidgetHarness type="mindmap" />);
    const item = screen.getByRole('treeitem');
    fireEvent.keyDown(item, { key: 'Delete' });
    fireEvent.keyDown(item, { key: 'ArrowRight' });
    fireEvent.keyDown(item, { key: 'Tab' });
    fireEvent.keyDown(screen.getByLabelText('Text uzla'), { key: 'Backspace' });
    window.removeEventListener('keydown', h);
    expect(seen).toEqual([]);
  });

  it('mazanie väčšej vetvy vyžaduje potvrdenie', () => {
    const nodes = [n('r', null), n('a', 'r', 'Veľká'), n('a1', 'a'), n('a2', 'a'), n('a3', 'a')];
    let cfg: { nodes: MindNode[] } | undefined;
    render(<WidgetHarness type="mindmap" config={{ nodes }} onConfig={(c) => (cfg = c as { nodes: MindNode[] })} />);
    const item = screen.getByRole('treeitem', { name: /Veľká/ });
    fireEvent.click(item);
    fireEvent.keyDown(item, { key: 'Delete' });
    expect(screen.getByRole('alert')).toHaveTextContent('4 uzlov');
    expect(cfg).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Odstrániť' }));
    expect(cfg!.nodes).toHaveLength(1);
  });

  it('Space zbalí vetvu', () => {
    const nodes = [n('r', null), n('a', 'r', 'Vetva'), n('a1', 'a', 'Dieťa')];
    render(<WidgetHarness type="mindmap" config={{ nodes }} />);
    expect(screen.getAllByRole('treeitem')).toHaveLength(3);
    fireEvent.keyDown(screen.getByRole('treeitem', { name: /Vetva/ }), { key: ' ' });
    expect(screen.getAllByRole('treeitem')).toHaveLength(2);
  });

  it('pri limite 120 uzlov ukáže hlášku', () => {
    render(<WidgetHarness type="mindmap" config={{ nodes: sample(MAX_NODES) }} />);
    fireEvent.keyDown(screen.getAllByRole('treeitem')[0]!, { key: 'Tab' });
    expect(screen.getByText('Dosiahnutý limit 120 uzlov.')).toBeInTheDocument();
  });
});
