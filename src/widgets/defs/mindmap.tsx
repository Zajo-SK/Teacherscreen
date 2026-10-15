import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronsDownUp, ChevronsUpDown, CornerDownRight, Download, Network, Pencil, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { Segmented, Toggle } from '@/components/forms';
import {
  BRANCH_COLORS,
  MAX_NODES,
  MAX_TEXT,
  addChild,
  addSibling,
  canAdd,
  childrenMap,
  clearMap,
  connectorPath,
  deleteBranch,
  layoutMindmap,
  navigate,
  repairNodes,
  rootOf,
  setNodeText,
  subtreeIds,
  toggleCollapsed,
  type MindBox,
  type MindNode,
  type NavDir,
} from '@/lib/mindmap';
import { bool, oneOf } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  nodes: z
    .array(z.unknown())
    .catch([])
    .transform((a) => repairNodes(a, () => t('w.mindmap.def.root'))),
  layout: oneOf(['tree', 'radial'], 'tree'),
  colorful: bool(true),
});
type Config = z.output<typeof schema>;

const PRIMARY = '#6d5dfc';
const MIN_VW = 560;
const MIN_VH = 360;
const FONT = 'ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif';
const KEY_DIR: Record<string, NavDir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

const CTRL = 56;
const ctrlStyle = (bg: string) => ({
  width: CTRL,
  height: CTRL,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 16,
  border: '3px solid rgba(255,255,255,.9)',
  background: bg,
  color: '#fff',
  cursor: 'pointer',
  padding: 0,
  touchAction: 'manipulation',
});

function MindmapWidget({ widget, config, update }: WidgetProps<Config>) {
  const { nodes, layout, colorful } = config;
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: widget.w, h: widget.h });
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; n: number } | null>(null);
  const [notice, setNotice] = useState('');
  const newIds = useRef(new Set<string>());
  const wantFocus = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => el.clientWidth > 0 && el.clientHeight > 0 && setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const result = useMemo(() => layoutMindmap(nodes, layout), [nodes, layout]);
  const root = rootOf(nodes);
  const kids = useMemo(() => childrenMap(nodes), [nodes]);
  const byId = useMemo(() => new Map(result.boxes.map((b) => [b.id, b])), [result]);
  const sel = selected && nodes.some((n) => n.id === selected) ? selected : null;
  const tabbable = sel && byId.has(sel) ? sel : root.id;

  const vw = Math.max(result.width, MIN_VW);
  const vh = Math.max(result.height, MIN_VH);
  const ox = (vw - result.width) / 2;
  const oy = (vh - result.height) / 2;
  const s = Math.min(size.w / vw, size.h / vh);
  const ex = (size.w - vw * s) / 2 + ox * s;
  const ey = (size.h - vh * s) / 2 + oy * s;

  // po zmene výberu klávesnicou vrátime fokus na uzol
  useEffect(() => {
    if (!wantFocus.current || editing) return;
    wantFocus.current = false;
    boxRef.current?.querySelector<SVGGElement>(`[data-node-id="${sel ?? root.id}"]`)?.focus();
  });

  const commit = (next: MindNode[]) => update({ nodes: next });
  const select = (id: string | null, focus = true) => {
    setSelected(id);
    setConfirm(null);
    wantFocus.current = focus;
  };
  const startEdit = (id: string, initial?: string) => {
    const text = initial ?? nodes.find((x) => x.id === id)?.text;
    if (text === undefined) return;
    finished.current = false;
    setSelected(id);
    setConfirm(null);
    setDraft(text);
    setEditing(id);
  };
  const add = (kind: 'child' | 'sibling', id: string) => {
    if (!canAdd(nodes)) return setNotice(t('w.mindmap.limit', { max: MAX_NODES }));
    const r = kind === 'child' ? addChild(nodes, id) : addSibling(nodes, id);
    if (!r.id) return;
    newIds.current.add(r.id);
    commit(r.nodes);
    startEdit(r.id, '');
  };
  const finishEdit = (id: string, value: string | null) => {
    if (finished.current) return;
    finished.current = true;
    const node = nodes.find((x) => x.id === id);
    const isNew = newIds.current.delete(id);
    const text = (value ?? '').trim();
    setEditing(null);
    if (!node) return;
    if (value !== null && text) {
      commit(setNodeText(nodes, id, text));
      select(id);
    } else if (isNew && node.text === '' && node.parent !== null) {
      commit(deleteBranch(nodes, id));
      select(node.parent);
    } else select(id);
  };
  const remove = (id: string, force = false) => {
    const n = nodes.find((x) => x.id === id);
    if (!n || n.parent === null) return;
    const count = subtreeIds(nodes, id).length;
    if (count > 3 && !force) {
      setConfirm({ id, n: count });
      return;
    }
    commit(deleteBranch(nodes, id));
    select(n.parent);
  };
  const toggle = (id: string) => commit(toggleCollapsed(nodes, id));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT') return;
    const nav = KEY_DIR[e.key];
    const isDel = e.key === 'Delete' || e.key === 'Backspace';
    const id = target.getAttribute('role') === 'treeitem' ? target.getAttribute('data-node-id') : null;
    // klávesy vo vnútri widgetu nesmú spustiť globálne skratky editora (napr. zmazanie celého widgetu)
    if (!id) {
      if (nav || isDel) e.stopPropagation();
      if (e.key === 'Escape' && confirm) {
        e.stopPropagation();
        setConfirm(null);
        wantFocus.current = true;
        setSelected(confirm.id);
      }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const done = () => (e.preventDefault(), e.stopPropagation());
    if (nav) {
      done();
      const to = navigate(nodes, id, nav);
      if (to) select(to);
      else if (nav === 'right' && nodes.find((n) => n.id === id)?.collapsed) toggle(id);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      done();
      add('child', id);
    } else if (e.key === 'Enter') {
      done();
      add('sibling', id);
    } else if (e.key === 'F2') {
      done();
      startEdit(id);
    } else if (isDel) {
      done();
      remove(id);
    } else if (e.key === ' ') {
      done();
      toggle(id);
    } else if (e.key === 'Escape' && confirm) {
      done();
      setConfirm(null);
    }
  };

  const colorOf = (b: MindBox) => (b.depth === 0 ? PRIMARY : colorful ? BRANCH_COLORS[b.branch % BRANCH_COLORS.length]! : 'currentColor');

  const exportImage = async () => {
    const svg = svgRef.current;
    const frame = boxRef.current?.closest<HTMLElement>('[data-widget-id]') ?? boxRef.current;
    if (!svg || !frame) return;
    try {
      const cs = getComputedStyle(frame);
      const bg = widget.colors.bg ?? (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '#ffffff');
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.querySelectorAll('[data-export-skip]').forEach((n) => n.remove());
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(vw * 2));
      clone.setAttribute('height', String(vh * 2));
      clone.setAttribute('style', `color:${cs.color}`);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', String(vw));
      rect.setAttribute('height', String(vh));
      rect.setAttribute('fill', bg);
      clone.insertBefore(rect, clone.firstChild);
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = vw * 2;
      canvas.height = vh * 2;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('blob');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(root.text || 'mindmap').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch {
      setNotice(t('w.mindmap.exportFail'));
    }
  };

  const selBox = sel ? byId.get(sel) : undefined;
  const selNode = sel ? nodes.find((n) => n.id === sel) : undefined;
  const editBox = editing ? byId.get(editing) : undefined;
  const sx = (x: number) => ex + x * s;
  const sy = (y: number) => ey + y * s;

  // plávajúce ovládanie pod (alebo nad) vybraným uzlom
  let barLeft = 0;
  let barTop = 0;
  const barW = confirm ? 460 : CTRL * 5 + 8 * 4 + 16;
  const barH = CTRL + 16;
  if (selBox) {
    const cx = sx(selBox.x + selBox.w / 2);
    barLeft = Math.min(Math.max(8, cx - barW / 2), Math.max(8, size.w - barW - 8));
    const below = sy(selBox.y + selBox.h) + 14;
    barTop = below + barH <= size.h - 4 ? below : Math.max(4, sy(selBox.y) - barH - 14);
  }
  const hasKids = !!selNode && (kids.get(selNode.id)?.length ?? 0) > 0;

  return (
    <div ref={boxRef} className="widget-body" style={{ position: 'relative' }} onKeyDown={onKeyDown}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        role="tree"
        aria-label={t('w.mindmap.aria')}
        data-testid="mindmap-svg"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        fontFamily={FONT}
      >
        <g transform={`translate(${ox} ${oy})`}>
          <g aria-hidden="true" fill="none" strokeLinecap="round">
            {result.edges.map((e) => {
              const from = byId.get(e.from)!;
              const to = byId.get(e.to)!;
              return (
                <path
                  key={e.to}
                  d={connectorPath(result, from, to)}
                  stroke={colorful ? colorOf(to) : 'currentColor'}
                  strokeOpacity={colorful ? 0.9 : 0.5}
                  strokeWidth={to.depth === 1 ? 7 : to.depth === 2 ? 5 : 3.5}
                />
              );
            })}
          </g>
          <g>
            {result.boxes.map((b) => {
              const n = nodes.find((x) => x.id === b.id)!;
              const color = colorOf(b);
              const isRoot = b.depth === 0;
              const isSel = b.id === sel;
              const lh = b.fontSize * 1.25;
              const cy = b.y + b.h / 2;
              const hidden = n.collapsed ? subtreeIds(nodes, n.id).length - 1 : 0;
              const label = t('w.mindmap.node', { text: n.text || t('w.mindmap.nodeEmpty') });
              return (
                <g
                  key={b.id}
                  role="treeitem"
                  aria-label={label}
                  aria-selected={isSel}
                  aria-level={b.depth + 1}
                  aria-expanded={(kids.get(b.id)?.length ?? 0) > 0 ? !n.collapsed : undefined}
                  tabIndex={b.id === tabbable ? 0 : -1}
                  data-node-id={b.id}
                  data-no-drag
                  style={{ cursor: 'pointer', outline: 'none' }}
                  onClick={() => select(b.id)}
                  onDoubleClick={() => startEdit(b.id)}
                  onFocus={() => b.id !== sel && setSelected(b.id)}
                >
                  {isSel && (
                    <rect data-export-skip x={b.x - 8} y={b.y - 8} width={b.w + 16} height={b.h + 16} rx={26} fill="none" stroke={PRIMARY} strokeWidth={5} />
                  )}
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx={isRoot ? 26 : 20}
                    fill={isRoot ? PRIMARY : color}
                    fillOpacity={isRoot ? 1 : colorful ? 0.2 : 0.08}
                    stroke={isRoot ? PRIMARY : color}
                    strokeOpacity={isRoot ? 1 : colorful ? 1 : 0.55}
                    strokeWidth={isRoot ? 0 : 4}
                  />
                  <text
                    x={b.x + b.w / 2}
                    y={cy - ((b.lines.length - 1) * lh) / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={b.fontSize}
                    fontWeight={isRoot ? 800 : 600}
                    fill={isRoot ? '#fff' : 'currentColor'}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {b.lines.map((l, i) => (
                      <tspan key={i} x={b.x + b.w / 2} dy={i === 0 ? 0 : lh}>
                        {editing === b.id ? '' : l}
                      </tspan>
                    ))}
                  </text>
                  {hidden > 0 && (
                    <g>
                      <circle cx={b.x + b.w} cy={cy} r={20} fill={PRIMARY} stroke="#fff" strokeWidth={3} />
                      <text x={b.x + b.w} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={800} fill="#fff" style={{ pointerEvents: 'none' }}>
                        +{hidden}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {nodes.length === 1 && !editing && (
        <p
          className="wmuted"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 20, margin: 0, textAlign: 'center', fontSize: 26, pointerEvents: 'none', padding: '0 24px' }}
          data-testid="mindmap-hint"
        >
          {t('w.mindmap.hint')}
        </p>
      )}

      <button
        type="button"
        data-no-drag
        aria-label={t('w.mindmap.export')}
        title={t('w.mindmap.export')}
        onClick={() => void exportImage()}
        style={{ position: 'absolute', right: 12, top: 12, width: 48, height: 48, borderRadius: 14, border: '2px solid currentColor', background: 'transparent', color: 'inherit', opacity: 0.45, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
      >
        <Download size={26} aria-hidden />
      </button>

      {editing && editBox && (
        <input
          autoFocus
          data-no-drag
          aria-label={t('w.mindmap.input')}
          value={draft}
          maxLength={MAX_TEXT}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_TEXT))}
          onBlur={() => finishEdit(editing, draft)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              finishEdit(editing, draft);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              finishEdit(editing, null);
            }
          }}
          style={{
            position: 'absolute',
            boxSizing: 'border-box',
            left: sx(editBox.x + editBox.w / 2) - Math.max(editBox.w * s, 220) / 2,
            top: sy(editBox.y + editBox.h / 2) - Math.max(editBox.h * s, 56) / 2,
            width: Math.max(editBox.w * s, 220),
            height: Math.max(editBox.h * s, 56),
            fontFamily: FONT,
            fontSize: Math.max(editBox.fontSize * s, 24),
            fontWeight: editBox.depth === 0 ? 800 : 600,
            textAlign: 'center',
            borderRadius: 20 * s + 6,
            border: `4px solid ${PRIMARY}`,
            background: widget.colors.bg ?? 'var(--widget-bg)',
            color: 'inherit',
            outline: 'none',
            padding: '0 12px',
            userSelect: 'text',
          }}
        />
      )}

      {sel && selNode && selBox && !editing && (
        <div
          role="toolbar"
          aria-label={t('w.mindmap.controls')}
          data-no-drag
          style={{ position: 'absolute', left: barLeft, top: barTop, height: barH, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', borderRadius: 24, background: 'rgba(31,27,46,.92)', boxShadow: '0 6px 18px rgba(0,0,0,.3)', color: '#fff' }}
        >
          {confirm && confirm.id === sel ? (
            <>
              <span style={{ fontSize: 24, fontWeight: 700, padding: '0 8px', flex: 1 }} role="alert">
                {t('w.mindmap.confirm', { n: confirm.n })}
              </span>
              <button type="button" autoFocus data-no-drag style={{ ...ctrlStyle('#e11d48'), width: 'auto', padding: '0 16px', fontSize: 22, fontWeight: 700 }} onClick={() => remove(confirm.id, true)}>
                {t('w.mindmap.confirmYes')}
              </button>
              <button
                type="button"
                data-no-drag
                style={{ ...ctrlStyle('#475569'), width: 'auto', padding: '0 16px', fontSize: 22, fontWeight: 700 }}
                onClick={() => {
                  setConfirm(null);
                  wantFocus.current = true;
                  setSelected(confirm.id);
                }}
              >
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <>
              <button type="button" data-no-drag aria-label={t('w.mindmap.addChild')} title={t('w.mindmap.addChild')} style={ctrlStyle(PRIMARY)} onClick={() => add('child', sel)}>
                <Plus size={30} aria-hidden />
              </button>
              <button type="button" data-no-drag aria-label={t('w.mindmap.addSibling')} title={t('w.mindmap.addSibling')} style={ctrlStyle(PRIMARY)} onClick={() => add('sibling', sel)}>
                <CornerDownRight size={28} aria-hidden />
              </button>
              <button type="button" data-no-drag aria-label={t('w.mindmap.edit')} title={t('w.mindmap.edit')} style={ctrlStyle('#475569')} onClick={() => startEdit(sel)}>
                <Pencil size={26} aria-hidden />
              </button>
              <button
                type="button"
                data-no-drag
                disabled={!hasKids}
                aria-label={selNode.collapsed ? t('w.mindmap.expand') : t('w.mindmap.collapse')}
                title={selNode.collapsed ? t('w.mindmap.expand') : t('w.mindmap.collapse')}
                style={{ ...ctrlStyle('#475569'), opacity: hasKids ? 1 : 0.35, cursor: hasKids ? 'pointer' : 'default' }}
                onClick={() => toggle(sel)}
              >
                {selNode.collapsed ? <ChevronsUpDown size={28} aria-hidden /> : <ChevronsDownUp size={28} aria-hidden />}
              </button>
              <button
                type="button"
                data-no-drag
                disabled={selNode.parent === null}
                aria-label={t('w.mindmap.delete')}
                title={t('w.mindmap.delete')}
                style={{ ...ctrlStyle('#e11d48'), opacity: selNode.parent === null ? 0.35 : 1, cursor: selNode.parent === null ? 'default' : 'pointer' }}
                onClick={() => remove(sel)}
              >
                <Trash2 size={26} aria-hidden />
              </button>
            </>
          )}
        </div>
      )}

      <div role="status" aria-live="polite" style={{ position: 'absolute', left: 0, right: 0, top: 12, textAlign: 'center', pointerEvents: 'none' }}>
        {notice && <span style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 16, background: '#e11d48', color: '#fff', fontSize: 24, fontWeight: 700 }}>{notice}</span>}
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const n = config.nodes.length;
  return (
    <>
      <Segmented
        label={t('w.mindmap.layout')}
        value={config.layout}
        onChange={(layout) => update({ layout })}
        options={[
          { value: 'tree', label: t('w.mindmap.layout.tree') },
          { value: 'radial', label: t('w.mindmap.layout.radial') },
        ]}
      />
      <Toggle label={t('w.mindmap.colorful')} checked={config.colorful} onChange={(colorful) => update({ colorful })} />
      <div className="mb-3">
        <button type="button" className="btn" disabled={n <= 1} onClick={() => update({ nodes: clearMap(config.nodes) })}>
          {t('w.mindmap.clear')}
        </button>
      </div>
      <p className="text-sm text-muted" role="status">
        {n >= MAX_NODES ? t('w.mindmap.countFull', { n, max: MAX_NODES }) : t('w.mindmap.count', { n, max: MAX_NODES })}
      </p>
      <p className="text-sm text-muted">{t('w.mindmap.keys')}</p>
    </>
  );
}

export const mindmapWidget: WidgetDefinition<Config> = {
  type: 'mindmap',
  label: 'w.mindmap.label',
  description: 'w.mindmap.desc',
  icon: Network,
  category: 'tools',
  defaultSize: { w: 900, h: 600 },
  minSize: { w: 360, h: 260 },
  schema,
  Component: MindmapWidget,
  Settings,
};
