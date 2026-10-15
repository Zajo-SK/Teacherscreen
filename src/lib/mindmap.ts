/**
 * Myšlienková mapa – čisté pomocné funkcie (bez Reactu): oprava dát, operácie nad stromom a rozloženie.
 * Pozície sa nikdy neukladajú; rozloženie sa počíta pri každej zmene.
 */

export const MAX_NODES = 120;
export const MAX_TEXT = 60;
export const MAX_ID = 8;
export const BRANCH_COLORS = ['#ff6b81', '#12b886', '#f59f00', '#38bdf8', '#b794f6', '#fb923c', '#2dd4a7', '#e879f9'] as const;

export interface MindNode {
  id: string;
  parent: string | null;
  text: string;
  collapsed: boolean;
}
export type MindLayout = 'tree' | 'radial';

export function newNodeId(nodes: readonly MindNode[]): string {
  const used = new Set(nodes.map((n) => n.id));
  for (;;) {
    const id = Math.random().toString(36).slice(2, 2 + MAX_ID).padEnd(MAX_ID, '0');
    if (!used.has(id)) return id;
  }
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Opraví ľubovoľný vstup na platný strom: práve jeden koreň, žiadne cykly ani siroty, najviac MAX_NODES uzlov.
 * Nikdy nevyhodí výnimku.
 */
export function repairNodes(raw: unknown, defaultRootText: () => string): MindNode[] {
  const list: MindNode[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (list.length >= MAX_NODES) break;
      const o = asObj(item);
      if (!o || typeof o.id !== 'string') continue;
      const id = o.id.slice(0, MAX_ID);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      list.push({
        id,
        parent: typeof o.parent === 'string' ? o.parent.slice(0, MAX_ID) : null,
        text: typeof o.text === 'string' ? o.text.slice(0, MAX_TEXT) : '',
        collapsed: o.collapsed === true,
      });
    }
  }
  if (list.length === 0) return [{ id: 'root', parent: null, text: defaultRootText().slice(0, MAX_TEXT), collapsed: false }];
  // neplatný rodič (neexistuje / sám seba) = bez rodiča
  for (const n of list) if (n.parent !== null && (n.parent === n.id || !seen.has(n.parent))) n.parent = null;
  // práve jeden koreň: prvý bezrodičovský, ostatní sa stanú jeho potomkami
  const root = list.find((n) => n.parent === null) ?? list[0]!;
  root.parent = null;
  for (const n of list) if (n !== root && n.parent === null) n.parent = root.id;
  // cykly: všetko, čo sa z koreňa nedá dosiahnuť, pripojíme ku koreňu (po jednom, aby sa zachovali podstromy)
  const reach = () => {
    const kids = new Map<string, MindNode[]>();
    for (const n of list) if (n.parent) (kids.get(n.parent) ?? kids.set(n.parent, []).get(n.parent)!).push(n);
    const ok = new Set<string>([root.id]);
    const stack = [root.id];
    while (stack.length) for (const c of kids.get(stack.pop()!) ?? []) if (!ok.has(c.id)) (ok.add(c.id), stack.push(c.id));
    return ok;
  };
  let ok = reach();
  while (ok.size < list.length) {
    const bad = list.find((n) => !ok.has(n.id))!;
    bad.parent = root.id;
    ok = reach();
  }
  if (!root.text.trim()) root.text = defaultRootText().slice(0, MAX_TEXT);
  return list;
}

export function rootOf(nodes: readonly MindNode[]): MindNode {
  return nodes.find((n) => n.parent === null) ?? nodes[0]!;
}

export function childrenMap(nodes: readonly MindNode[]): Map<string, MindNode[]> {
  const m = new Map<string, MindNode[]>();
  for (const n of nodes) m.set(n.id, []);
  for (const n of nodes) if (n.parent !== null) m.get(n.parent)?.push(n);
  return m;
}

/** Id uzla a všetkých jeho potomkov. */
export function subtreeIds(nodes: readonly MindNode[], id: string): string[] {
  const kids = childrenMap(nodes);
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    for (const c of kids.get(cur) ?? []) stack.push(c.id);
  }
  return out;
}

export const canAdd = (nodes: readonly MindNode[]) => nodes.length < MAX_NODES;

export interface OpResult {
  nodes: MindNode[];
  /** Id nového uzla (pri pridaní). */
  id?: string;
}

export function addChild(nodes: readonly MindNode[], parentId: string, text = '', id?: string): OpResult {
  if (!canAdd(nodes) || !nodes.some((n) => n.id === parentId)) return { nodes: [...nodes] };
  const nid = id ?? newNodeId(nodes);
  const next = nodes.map((n) => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n));
  // nový uzol sa zaradí za posledný existujúci uzol podstromu rodiča (poradie súrodencov = poradie v poli)
  const last = Math.max(...subtreeIds(nodes, parentId).map((i) => nodes.findIndex((n) => n.id === i)));
  next.splice(last + 1, 0, { id: nid, parent: parentId, text: text.slice(0, MAX_TEXT), collapsed: false });
  return { nodes: next, id: nid };
}

/** Sourodenec za uzlom; pre koreň pridá potomka. */
export function addSibling(nodes: readonly MindNode[], id: string, text = '', nid?: string): OpResult {
  const n = nodes.find((x) => x.id === id);
  if (!n) return { nodes: [...nodes] };
  if (n.parent === null) return addChild(nodes, id, text, nid);
  if (!canAdd(nodes)) return { nodes: [...nodes] };
  const newId = nid ?? newNodeId(nodes);
  const last = Math.max(...subtreeIds(nodes, id).map((i) => nodes.findIndex((x) => x.id === i)));
  const next = [...nodes];
  next.splice(last + 1, 0, { id: newId, parent: n.parent, text: text.slice(0, MAX_TEXT), collapsed: false });
  return { nodes: next, id: newId };
}

/** Odstráni uzol aj s potomkami. Koreň sa neodstraňuje. */
export function deleteBranch(nodes: readonly MindNode[], id: string): MindNode[] {
  const n = nodes.find((x) => x.id === id);
  if (!n || n.parent === null) return [...nodes];
  const gone = new Set(subtreeIds(nodes, id));
  return nodes.filter((x) => !gone.has(x.id));
}

export function toggleCollapsed(nodes: readonly MindNode[], id: string): MindNode[] {
  const has = nodes.some((x) => x.parent === id);
  return nodes.map((n) => (n.id === id && has ? { ...n, collapsed: !n.collapsed } : n));
}

export function setNodeText(nodes: readonly MindNode[], id: string, text: string): MindNode[] {
  return nodes.map((n) => (n.id === id ? { ...n, text: text.slice(0, MAX_TEXT) } : n));
}

/** Zostane iba koreň. */
export function clearMap(nodes: readonly MindNode[]): MindNode[] {
  const r = rootOf(nodes);
  return [{ ...r, collapsed: false }];
}

/** Uzly, ktoré sú vidieť (nie sú pod zbaleným uzlom), v poradí DFS. */
export function visibleNodes(nodes: readonly MindNode[]): MindNode[] {
  const kids = childrenMap(nodes);
  const out: MindNode[] = [];
  const walk = (n: MindNode) => {
    out.push(n);
    if (!n.collapsed) for (const c of kids.get(n.id) ?? []) walk(c);
  };
  walk(rootOf(nodes));
  return out;
}

export type NavDir = 'up' | 'down' | 'left' | 'right';

/** Nový výber po šípke: hore/dole = súrodenci, vľavo = rodič, vpravo = prvé dieťa. */
export function navigate(nodes: readonly MindNode[], id: string, dir: NavDir): string | null {
  const n = nodes.find((x) => x.id === id);
  if (!n) return null;
  const kids = childrenMap(nodes);
  if (dir === 'left') return n.parent;
  if (dir === 'right') return n.collapsed ? null : (kids.get(id)?.[0]?.id ?? null);
  if (n.parent === null) return null;
  const sib = kids.get(n.parent) ?? [];
  const i = sib.findIndex((x) => x.id === id);
  return sib[dir === 'up' ? i - 1 : i + 1]?.id ?? null;
}

// ---------------------------------------------------------------- rozloženie

export interface MindBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  /** Index vetvy prvej úrovne (−1 pre koreň). */
  branch: number;
  lines: string[];
  fontSize: number;
}
export interface MindLayoutResult {
  boxes: MindBox[];
  edges: { from: string; to: string }[];
  width: number;
  height: number;
  layout: MindLayout;
}

export const FONT_ROOT = 38;
export const FONT_NODE = 28;
const CHAR_W = 0.6;
const LINE_H = 1.25;
const PAD = 40;

export function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (let w of words) {
    while (w.length > maxChars) {
      if (cur) (lines.push(cur), (cur = ''));
      lines.push(w.slice(0, maxChars));
      w = w.slice(maxChars);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else (lines.push(cur), (cur = w));
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export function measureNode(text: string, depth: number): { w: number; h: number; lines: string[]; fontSize: number } {
  const fontSize = depth === 0 ? FONT_ROOT : FONT_NODE;
  const lines = wrapText(text, depth === 0 ? 16 : 18);
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const w = Math.max(depth === 0 ? 130 : 80, Math.ceil(longest * fontSize * CHAR_W) + (depth === 0 ? 56 : 40));
  const h = Math.ceil(lines.length * fontSize * LINE_H) + (depth === 0 ? 36 : 24);
  return { w, h, lines, fontSize };
}

interface Item extends MindBox {
  kids: Item[];
  cx: number;
  cy: number;
}

function buildItems(nodes: readonly MindNode[]): Item {
  const kids = childrenMap(nodes);
  const root = rootOf(nodes);
  const make = (n: MindNode, depth: number, branch: number): Item => {
    const m = measureNode(n.text, depth);
    const item: Item = { id: n.id, x: 0, y: 0, w: m.w, h: m.h, depth, branch, lines: m.lines, fontSize: m.fontSize, kids: [], cx: 0, cy: 0 };
    if (!n.collapsed) {
      const list = kids.get(n.id) ?? [];
      item.kids = list.map((c, i) => make(c, depth + 1, depth === 0 ? i : branch));
    }
    return item;
  };
  return make(root, 0, -1);
}

function flatten(root: Item): Item[] {
  const out: Item[] = [];
  const walk = (i: Item) => (out.push(i), i.kids.forEach(walk));
  walk(root);
  return out;
}

const H_GAP = 90;
const V_GAP = 18;

function layoutTree(root: Item) {
  const colW: number[] = [];
  for (const i of flatten(root)) colW[i.depth] = Math.max(colW[i.depth] ?? 0, i.w);
  const colX: number[] = [];
  let acc = 0;
  colW.forEach((w, d) => {
    colX[d] = acc;
    acc += w + H_GAP;
  });
  const band = new Map<Item, number>();
  const bandOf = (i: Item): number => {
    const b = i.kids.length ? Math.max(i.h, i.kids.reduce((s, k) => s + bandOf(k), 0) + V_GAP * (i.kids.length - 1)) : i.h;
    band.set(i, b);
    return b;
  };
  bandOf(root);
  const place = (i: Item, top: number) => {
    const b = band.get(i)!;
    i.x = colX[i.depth]!;
    if (i.kids.length) {
      const total = i.kids.reduce((s, k) => s + band.get(k)!, 0) + V_GAP * (i.kids.length - 1);
      let y = top + (b - total) / 2;
      for (const k of i.kids) {
        place(k, y);
        y += band.get(k)! + V_GAP;
      }
      const mid = (i.kids[0]!.cy + i.kids[i.kids.length - 1]!.cy) / 2;
      i.cy = Math.min(top + b - i.h / 2, Math.max(top + i.h / 2, mid));
    } else i.cy = top + b / 2;
    i.cx = i.x + i.w / 2;
  };
  place(root, 0);
}

const overlaps = (a: Item, b: Item, gap = 6) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

function layoutRadial(root: Item) {
  const leaves = new Map<Item, number>();
  const count = (i: Item): number => {
    const c = i.kids.length ? i.kids.reduce((s, k) => s + count(k), 0) : 1;
    leaves.set(i, c);
    return c;
  };
  const total = count(root);
  const angle = new Map<Item, number>();
  const span = Math.min(2 * Math.PI, total * (70 * Math.PI) / 180);
  const assign = (i: Item, a0: number, a1: number) => {
    angle.set(i, (a0 + a1) / 2);
    let a = a0;
    for (const k of i.kids) {
      const part = ((a1 - a0) * leaves.get(k)!) / leaves.get(i)!;
      assign(k, a, a + part);
      a += part;
    }
  };
  assign(root, -span / 2, span / 2);
  const byDepth: Item[][] = [];
  for (const i of flatten(root)) (byDepth[i.depth] ??= []).push(i);
  const ext = (i: Item) => {
    const a = angle.get(i)!;
    return Math.abs(Math.cos(a)) * i.w / 2 + Math.abs(Math.sin(a)) * i.h / 2;
  };
  root.cx = 0;
  root.cy = 0;
  root.x = -root.w / 2;
  root.y = -root.h / 2;
  const placed: Item[] = [root];
  let prevR = 0;
  let prevExt = Math.hypot(root.w, root.h) / 2;
  for (let d = 1; d < byDepth.length; d++) {
    const ring = byDepth[d]!;
    const curExt = Math.max(...ring.map(ext));
    let r = prevR + prevExt + curExt + 56;
    const put = () => {
      for (const i of ring) {
        const a = angle.get(i)!;
        i.cx = r * Math.cos(a);
        i.cy = r * Math.sin(a);
        i.x = i.cx - i.w / 2;
        i.y = i.cy - i.h / 2;
      }
    };
    put();
    for (let guard = 0; guard < 600; guard++) {
      const bad = ring.some((a, ia) => placed.some((b) => overlaps(a, b)) || ring.some((b, ib) => ib > ia && overlaps(a, b)));
      if (!bad) break;
      r += 8;
      put();
    }
    placed.push(...ring);
    prevR = r;
    prevExt = curExt;
  }
}

/** Rozloženie uzlov (len viditeľných) do virtuálneho priestoru; bez prekrývania, deterministické. */
export function layoutMindmap(nodes: readonly MindNode[], layout: MindLayout): MindLayoutResult {
  const root = buildItems(nodes);
  if (layout === 'radial') layoutRadial(root);
  else layoutTree(root);
  const items = flatten(root);
  for (const i of items) {
    i.x = i.cx - i.w / 2;
    i.y = i.cy - i.h / 2;
  }
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.w));
  const maxY = Math.max(...items.map((i) => i.y + i.h));
  const edges: { from: string; to: string }[] = [];
  for (const i of items) for (const k of i.kids) edges.push({ from: i.id, to: k.id });
  return {
    boxes: items.map((i) => ({ id: i.id, x: i.x - minX + PAD, y: i.y - minY + PAD, w: i.w, h: i.h, depth: i.depth, branch: i.branch, lines: i.lines, fontSize: i.fontSize })),
    edges,
    width: maxX - minX + 2 * PAD,
    height: maxY - minY + 2 * PAD,
    layout,
  };
}

/** Bod na hranici obdĺžnika v smere k bodu (tx, ty). */
function edgePoint(b: MindBox, tx: number, ty: number) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const s = Math.min(dx !== 0 ? b.w / 2 / Math.abs(dx) : Infinity, dy !== 0 ? b.h / 2 / Math.abs(dy) : Infinity);
  return { x: cx + dx * s, y: cy + dy * s };
}

/** SVG cesta hladkej spojnice rodič → dieťa. */
export function connectorPath(result: MindLayoutResult, from: MindBox, to: MindBox): string {
  const f = (n: number) => Math.round(n * 10) / 10;
  if (result.layout === 'tree') {
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const k = (x2 - x1) * 0.55;
    return `M${f(x1)} ${f(y1)}C${f(x1 + k)} ${f(y1)} ${f(x2 - k)} ${f(y2)} ${f(x2)} ${f(y2)}`;
  }
  const p1 = edgePoint(from, to.x + to.w / 2, to.y + to.h / 2);
  const p2 = edgePoint(to, from.x + from.w / 2, from.y + from.h / 2);
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  // ťažiskom mapy je koreň (0,0 pred posunom) – smer „von“ odvodíme zo vzájomnej polohy
  const rootBox = result.boxes[0]!;
  const rc = { x: rootBox.x + rootBox.w / 2, y: rootBox.y + rootBox.h / 2 };
  const unit = (b: MindBox) => {
    const dx = b.x + b.w / 2 - rc.x;
    const dy = b.y + b.h / 2 - rc.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  };
  const uf = from.depth === 0 ? unit(to) : unit(from);
  const ut = unit(to);
  const k = len * 0.4;
  return `M${f(p1.x)} ${f(p1.y)}C${f(p1.x + uf.x * k)} ${f(p1.y + uf.y * k)} ${f(p2.x - ut.x * k)} ${f(p2.y - ut.y * k)} ${f(p2.x)} ${f(p2.y)}`;
}

export function boxesOverlap(a: MindBox, b: MindBox): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
