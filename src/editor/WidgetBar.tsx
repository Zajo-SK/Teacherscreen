import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Image as ImageIcon, LayoutGrid, Pencil, Pin, PinOff } from 'lucide-react';
import { t } from '@/i18n';
import type { TKey } from '@/i18n';
import { useApp } from '@/store/useApp';
import { widgetDefinitions } from '@/widgets/registry';
import type { WidgetDefinition } from '@/widgets/types';
import { BackgroundPicker } from './BackgroundPicker';

const CAT_COLOR: Record<string, string> = { content: 'var(--coral)', time: 'var(--sky)', class: 'var(--mint)', tools: 'var(--lilac)' };
const BAR_KEY = 'ts.bar';
const DEFAULT_BAR = ['groups', 'picker', 'poll', 'traffic', 'text', 'image', 'timer', 'clock'];

function loadBar(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BAR_KEY) ?? 'null') as unknown;
    if (Array.isArray(raw)) {
      const known = new Set(widgetDefinitions.map((d) => d.type as string));
      return raw.filter((x): x is string => typeof x === 'string' && known.has(x));
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_BAR;
}

function Tile({ def, onClick, pinned, editing, labelled }: { def: WidgetDefinition; onClick: () => void; pinned?: boolean; editing?: boolean; labelled?: boolean }) {
  const Icon = def.icon;
  const c = CAT_COLOR[def.category] ?? 'var(--primary)';
  return (
    <button
      type="button"
      data-testid={`add-${def.type}`}
      data-tip={`${t(def.label)} – ${t(def.description)}`}
      aria-label={labelled ? undefined : t(def.label)}
      aria-pressed={editing ? !!pinned : undefined}
      onClick={onClick}
      className={`group flex flex-none flex-col items-center gap-1 rounded-2xl px-1 py-1 text-center text-xs font-bold normal-case tracking-normal text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 ${labelled ? 'w-[70px]' : 'w-[54px]'}`}
    >
      <span className="relative grid h-12 w-12 place-items-center rounded-2xl shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)]" style={{ background: c }}>
        <Icon size={24} aria-hidden color="#fff" />
        {editing && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-black shadow">
            {pinned ? <Pin size={12} aria-hidden /> : <PinOff size={12} aria-hidden />}
          </span>
        )}
      </span>
      {labelled && <span className="line-clamp-2 leading-tight">{t(def.label)}</span>}
    </button>
  );
}

/** Spodná plávajúca lišta widgetov: obľúbené nástroje, panel „Viac“ (všetky ostatné) a pozadie plochy. */
export function WidgetBar({ screenId }: { screenId: string }) {
  const addWidget = useApp((s) => s.addWidget);
  const toast = useApp((s) => s.toast);
  const screen = useApp((s) => s.screens[screenId]);
  const [bar, setBar] = useState<string[]>(loadBar);
  const [panel, setPanel] = useState<'more' | 'bg' | null>(null);
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ts.bar.collapsed') === '1';
    } catch {
      return false;
    }
  });
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(BAR_KEY, JSON.stringify(bar));
    } catch {
      /* ignore */
    }
  }, [bar]);
  useEffect(() => {
    try {
      localStorage.setItem('ts.bar.collapsed', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  useEffect(() => {
    if (!panel) return;
    const down = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setPanel(null);
        setEditing(false);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanel(null);
        setEditing(false);
      }
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [panel]);

  if (!screen) return null;
  const byType = new Map(widgetDefinitions.map((d) => [d.type as string, d]));
  const pinned = bar.map((x) => byType.get(x)).filter((d): d is WidgetDefinition => !!d);
  const rest = widgetDefinitions.filter((d) => !bar.includes(d.type));

  const add = (d: WidgetDefinition) => {
    if (addWidget(screenId, d.type)) toast(t('editor.widgetAdded', { name: t(d.label) }), { ms: 1500 });
    setPanel(null);
  };
  const toggle = (d: WidgetDefinition) => setBar((cur) => (cur.includes(d.type) ? cur.filter((x) => x !== d.type) : [...cur, d.type]));

  if (collapsed) {
    return (
      <div className="pointer-events-none flex min-w-0 flex-1 justify-center">
        <button type="button" className="btn pointer-events-auto gap-2 rounded-full bg-black/70 px-4 text-white shadow-lg backdrop-blur" data-testid="bar-expand" onClick={() => setCollapsed(false)}>
          <ChevronUp size={18} aria-hidden /> {t('bar.expand')}
        </button>
      </div>
    );
  }

  return (
    <div ref={root} className="pointer-events-none flex min-w-0 flex-1 flex-col items-center gap-2" data-testid="widget-bar" data-tour="palette">
      {panel === 'more' && (
        <section aria-label={t('bar.more')} data-testid="bar-more" className="pointer-events-auto max-h-[60vh] w-full max-w-xl overflow-auto rounded-3xl bg-[#0b0f24]/95 p-4 text-white shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="display text-lg font-extrabold">{t('bar.moreTitle')}</h2>
            <button type="button" className="btn min-h-9 gap-1.5 rounded-full border-white/40 bg-transparent text-white" data-testid="bar-edit" aria-pressed={editing} onClick={() => setEditing(!editing)}>
              {editing ? <Check size={16} aria-hidden /> : <Pencil size={16} aria-hidden />}
              {editing ? t('bar.editDone') : t('bar.edit')}
            </button>
          </div>
          {editing && <p className="mb-3 rounded-xl border border-dashed border-white/40 p-2 text-sm text-white/80">{t('bar.editHint')}</p>}
          <ul className="grid grid-cols-4 gap-x-1 gap-y-2 sm:grid-cols-5">
            {(editing ? widgetDefinitions : rest).map((d) => (
              <li key={d.type} className="flex justify-center">
                <Tile labelled def={d} editing={editing} pinned={bar.includes(d.type)} onClick={() => (editing ? toggle(d) : add(d))} />
              </li>
            ))}
          </ul>
          {!editing && rest.length === 0 && <p className="text-sm text-white/70">{t('bar.allPinned')}</p>}
        </section>
      )}
      {panel === 'bg' && (
        <section aria-label={t('editor.background')} data-testid="bar-bg" className="pointer-events-auto max-h-[60vh] w-full max-w-md overflow-auto rounded-3xl border border-line bg-surface p-4 text-fg shadow-2xl">
          <h2 className="display mb-2 text-lg font-extrabold">{t('editor.background')}</h2>
          <BackgroundPicker screenId={screenId} background={screen.background} />
        </section>
      )}
      <div className="pointer-events-auto flex max-w-full items-end gap-1 rounded-[26px] bg-[#0b0f24]/90 px-3 pb-2 pt-2 shadow-2xl backdrop-blur">
        <div className="flex min-w-0 items-end gap-1 overflow-x-auto overflow-y-hidden pt-1">
          <button
            type="button"
            data-testid="bar-background"
            data-tip={t('bar.backgroundTip')}
            aria-label={t('bar.background')}
            aria-expanded={panel === 'bg'}
            onClick={() => setPanel(panel === 'bg' ? null : 'bg')}
            className="flex w-[54px] flex-none flex-col items-center gap-1 rounded-2xl px-1 py-1 text-center text-xs font-bold normal-case tracking-normal text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)]" style={{ background: 'var(--primary)' }}>
              <ImageIcon size={24} aria-hidden color="#fff" />
            </span>
          </button>
          {pinned.map((d) => (
            <Tile key={d.type} def={d} onClick={() => add(d)} />
          ))}
          <button
            type="button"
            data-testid="bar-more-btn"
            data-tip={t('bar.moreTip')}
            aria-label={t('bar.more')}
            aria-expanded={panel === 'more'}
            onClick={() => setPanel(panel === 'more' ? null : 'more')}
            className="flex w-[54px] flex-none flex-col items-center gap-1 rounded-2xl px-1 py-1 text-center text-xs font-bold normal-case tracking-normal text-white transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)]" style={{ background: 'color-mix(in srgb, var(--primary) 70%, #000)', outline: panel === 'more' ? '3px solid #fff' : undefined, outlineOffset: 2 }}>
              <LayoutGrid size={24} aria-hidden color="#fff" />
            </span>
          </button>
        </div>
        <button type="button" className="btn btn-icon mb-5 ml-1 flex-none rounded-xl border-0 bg-white/10 text-white" aria-label={t('bar.collapse')} data-tip={t('bar.collapse')} data-testid="bar-collapse" onClick={() => { setPanel(null); setCollapsed(true); }}>
          <ChevronDown size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export type { TKey };
