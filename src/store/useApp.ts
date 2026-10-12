import { create } from 'zustand';
import {
  CANVAS_SIZES,
  DEFAULT_SETTINGS,
  type AspectId,
  type Background,
  type Deck,
  type Screen,
  type Settings,
  type WidgetColors,
  type WidgetInstance,
  type WidgetType,
} from '@/types';
import { uid } from '@/lib/id';
import { fitRect } from '@/lib/geometry';
import * as ops from '@/lib/screenOps';
import type { Align, Snapshot } from '@/lib/screenOps';
import type { ParsedImport } from '@/lib/schema';
import { MAX_WIDGETS_PER_SCREEN } from '@/lib/schema';
import { buildScreen, getTemplate, screenFromTemplate } from '@/templates';
import { createWidget, getWidgetDefinition, sanitizeConfig } from '@/widgets/registry';
import { openStorage, type StorageAdapter } from '@/storage/db';
import { AutoSaver, type SaveStatus } from '@/storage/autosave';
import { t } from '@/i18n';

export interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'error' | 'success';
  action?: { label: string; run: () => void };
}

interface History {
  past: Snapshot[];
  future: Snapshot[];
}

interface AppState {
  ready: boolean;
  storageKind: 'indexeddb' | 'memory';
  corrupted: number;
  screens: Record<string, Screen>;
  decks: Record<string, Deck>;
  settings: Settings;
  saveStatus: SaveStatus;
  selection: string[];
  clipboard: WidgetInstance[];
  history: Record<string, History>;
  toasts: Toast[];

  init: (storage?: StorageAdapter) => Promise<void>;
  flush: () => Promise<void>;
  updateSettings: (p: Partial<Settings>) => void;

  createScreen: (opts?: { name?: string; deckId?: string | null }) => string;
  createFromTemplate: (templateId: string) => string | null;
  duplicateScreen: (id: string) => string | null;
  deleteScreen: (id: string) => void;
  updateScreenMeta: (id: string, p: { name?: string; description?: string }) => void;
  markOpened: (id: string) => void;
  moveScreen: (id: string, dir: -1 | 1) => void;
  setScreenDeck: (id: string, deckId: string | null) => void;
  createDeck: (name: string) => string;
  renameDeck: (id: string, name: string) => void;
  deleteDeck: (id: string) => void;
  importParsed: (p: ParsedImport) => string[];

  select: (ids: string[], additive?: boolean) => void;
  addWidget: (screenId: string, type: WidgetType) => string | null;
  commitRects: (screenId: string, rects: Record<string, { x: number; y: number; w: number; h: number }>) => void;
  patchConfig: (screenId: string, widgetId: string, patch: Record<string, unknown>) => void;
  patchWidget: (screenId: string, widgetId: string, patch: Partial<Pick<WidgetInstance, 'x' | 'y' | 'w' | 'h' | 'locked'>>) => void;
  setColors: (screenId: string, ids: string[], patch: Partial<WidgetColors>) => void;
  removeWidgets: (screenId: string, ids: string[]) => void;
  restoreWidgets: (screenId: string, widgets: WidgetInstance[]) => void;
  duplicateWidgets: (screenId: string, ids: string[]) => void;
  copyWidgets: (screenId: string, ids: string[]) => void;
  cutWidgets: (screenId: string, ids: string[]) => void;
  paste: (screenId: string) => void;
  copyToScreen: (fromScreenId: string, ids: string[], toScreenId: string) => void;
  reorderWidgets: (screenId: string, ids: string[], how: 'forward' | 'backward' | 'front' | 'back') => void;
  align: (screenId: string, ids: string[], how: Align) => void;
  distribute: (screenId: string, ids: string[], axis: 'h' | 'v') => void;
  setLocked: (screenId: string, ids: string[], locked: boolean) => void;
  nudge: (screenId: string, ids: string[], dx: number, dy: number) => void;
  setBackground: (screenId: string, bg: Background) => void;
  setAspect: (screenId: string, aspect: AspectId) => void;
  undo: (screenId: string) => void;
  redo: (screenId: string) => void;

  toast: (text: string, opts?: { tone?: Toast['tone']; action?: Toast['action']; ms?: number }) => void;
  dismissToast: (id: string) => void;
}

const SETTINGS_KEY = 'ts.settings';
const HISTORY_LIMIT = 100;

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>;
    return {
      theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system',
      sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_SETTINGS.sound,
      animations: typeof raw.animations === 'boolean' ? raw.animations : DEFAULT_SETTINGS.animations,
      snapToGrid: typeof raw.snapToGrid === 'boolean' ? raw.snapToGrid : DEFAULT_SETTINGS.snapToGrid,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let saver: AutoSaver | null = null;
let lastHistoryKey: { screenId: string; key: string; at: number } | null = null;

export const useApp = create<AppState>()((set, get) => {
  const setScreen = (s: Screen) => set((st) => ({ screens: { ...st.screens, [s.id]: s } }));

  /** Jednotný zápis zmeny obrazovky: história (s zlučovaním opakovaných zmien), čas úpravy, automatické uloženie. */
  function mutate(id: string, fn: (s: Screen) => Screen, opts: { history?: boolean; key?: string } = {}): boolean {
    const cur = get().screens[id];
    if (!cur) return false;
    const next = fn(cur);
    if (next === cur) return false;
    const stamped = { ...next, updatedAt: Date.now() };
    set((st) => {
      let history = st.history;
      if (opts.history !== false) {
        const now = Date.now();
        const coalesce = opts.key && lastHistoryKey && lastHistoryKey.screenId === id && lastHistoryKey.key === opts.key && now - lastHistoryKey.at < 1200;
        lastHistoryKey = opts.key ? { screenId: id, key: opts.key, at: now } : null;
        if (!coalesce) {
          const h = st.history[id] ?? { past: [], future: [] };
          history = { ...st.history, [id]: { past: [...h.past, ops.snapshotOf(cur)].slice(-HISTORY_LIMIT), future: [] } };
        }
      }
      const ids = new Set(stamped.widgets.map((w) => w.id));
      return { screens: { ...st.screens, [id]: stamped }, history, selection: st.selection.filter((x) => ids.has(x)) };
    });
    saver?.markScreen(id);
    return true;
  }

  return {
    ready: false,
    storageKind: 'indexeddb',
    corrupted: 0,
    screens: {},
    decks: {},
    settings: loadSettings(),
    saveStatus: 'saved',
    selection: [],
    clipboard: [],
    history: {},
    toasts: [],

    async init(storage) {
      const adapter = storage ?? (await openStorage());
      saver = new AutoSaver(
        adapter,
        { screen: (id) => get().screens[id], deck: (id) => get().decks[id] },
        (status, error) => {
          set({ saveStatus: status });
          if (status === 'error') {
            console.error('Uloženie zlyhalo', error);
            get().toast(t('save.error'), { tone: 'error' });
          }
        },
      );
      const data = await adapter.loadAll();
      set({
        ready: true,
        storageKind: adapter.kind,
        corrupted: data.corrupted,
        screens: Object.fromEntries(data.screens.map((s) => [s.id, s])),
        decks: Object.fromEntries(data.decks.map((d) => [d.id, d])),
        saveStatus: 'saved',
      });
    },

    flush: () => saver?.flush() ?? Promise.resolve(),

    updateSettings(p) {
      const settings = { ...get().settings, ...p };
      set({ settings });
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* úložisko nemusí byť dostupné */
      }
    },

    // ---- obrazovky
    createScreen(opts = {}) {
      const order = Object.values(get().screens).length;
      const s = buildScreen({ name: opts.name ?? t('home.newScreenName'), deckId: opts.deckId ?? null, order });
      setScreen(s);
      saver?.markScreen(s.id);
      return s.id;
    },
    createFromTemplate(templateId) {
      const tpl = getTemplate(templateId);
      if (!tpl) return null;
      const s = screenFromTemplate(tpl);
      setScreen(s);
      saver?.markScreen(s.id);
      return s.id;
    },
    duplicateScreen(id) {
      const src = get().screens[id];
      if (!src) return null;
      const copy: Screen = {
        ...structuredClone(src),
        id: uid(),
        name: `${src.name} (${t('home.copySuffix')})`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastOpenedAt: null,
        order: src.order + 0.5,
        widgets: src.widgets.map((w) => ({ ...structuredClone(w) })),
      };
      setScreen(copy);
      saver?.markScreen(copy.id);
      return copy.id;
    },
    deleteScreen(id) {
      set((st) => {
        const { [id]: _removed, ...rest } = st.screens;
        void _removed;
        const { [id]: _h, ...hist } = st.history;
        void _h;
        return { screens: rest, history: hist, selection: [] };
      });
      saver?.removeScreen(id);
    },
    updateScreenMeta(id, p) {
      mutate(id, (s) => ({ ...s, name: p.name !== undefined ? p.name.slice(0, 120) : s.name, description: p.description !== undefined ? p.description.slice(0, 500) : s.description }), { history: false });
    },
    markOpened(id) {
      const s = get().screens[id];
      if (!s) return;
      setScreen({ ...s, lastOpenedAt: Date.now() });
      saver?.markScreen(id);
    },
    moveScreen(id, dir) {
      const s = get().screens[id];
      if (!s) return;
      const siblings = Object.values(get().screens)
        .filter((x) => x.deckId === s.deckId)
        .sort((a, b) => a.order - b.order);
      const i = siblings.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= siblings.length) return;
      const reordered = siblings.slice();
      [reordered[i], reordered[j]] = [reordered[j]!, reordered[i]!];
      reordered.forEach((x, idx) => {
        if (x.order !== idx) {
          setScreen({ ...get().screens[x.id]!, order: idx });
          saver?.markScreen(x.id);
        }
      });
    },
    setScreenDeck(id, deckId) {
      const maxOrder = Object.values(get().screens).filter((x) => x.deckId === deckId).reduce((m, x) => Math.max(m, x.order), -1);
      mutate(id, (s) => ({ ...s, deckId, order: maxOrder + 1 }), { history: false });
    },
    createDeck(name) {
      const now = Date.now();
      const d: Deck = { id: uid(), name: name.slice(0, 120) || t('home.newDeck'), createdAt: now, updatedAt: now };
      set((st) => ({ decks: { ...st.decks, [d.id]: d } }));
      saver?.markDeck(d.id);
      return d.id;
    },
    renameDeck(id, name) {
      const d = get().decks[id];
      if (!d) return;
      set((st) => ({ decks: { ...st.decks, [id]: { ...d, name: name.slice(0, 120), updatedAt: Date.now() } } }));
      saver?.markDeck(id);
    },
    deleteDeck(id) {
      Object.values(get().screens)
        .filter((s) => s.deckId === id)
        .forEach((s) => mutate(s.id, (x) => ({ ...x, deckId: null }), { history: false }));
      set((st) => {
        const { [id]: _d, ...rest } = st.decks;
        void _d;
        return { decks: rest };
      });
      saver?.removeDeck(id);
    },
    importParsed(p) {
      const ids: string[] = [];
      set((st) => {
        const decks = { ...st.decks };
        p.decks.forEach((d) => {
          decks[d.id] = d;
          saver?.markDeck(d.id);
        });
        const screens = { ...st.screens };
        p.screens.forEach((s) => {
          screens[s.id] = { ...s, updatedAt: Date.now() };
          ids.push(s.id);
          saver?.markScreen(s.id);
        });
        return { screens, decks };
      });
      return ids;
    },

    // ---- widgety
    select(ids, additive) {
      set((st) => ({ selection: additive ? Array.from(new Set([...st.selection, ...ids])) : ids }));
    },
    addWidget(screenId, type) {
      const s = get().screens[screenId];
      if (!s) return null;
      if (s.widgets.length >= MAX_WIDGETS_PER_SCREEN) {
        get().toast(t('editor.tooManyWidgets', { n: MAX_WIDGETS_PER_SCREEN }), { tone: 'error' });
        return null;
      }
      const def = getWidgetDefinition(type);
      const canvas = CANVAS_SIZES[s.aspect];
      const n = s.widgets.length % 8;
      const w = Math.min(def.defaultSize.w, canvas.w - 40);
      const h = Math.min(def.defaultSize.h, canvas.h - 40);
      const widget = createWidget(type, { w, h, x: Math.round((canvas.w - w) / 2 + (n - 4) * 30), y: Math.round((canvas.h - h) / 2 + (n - 4) * 24) });
      mutate(screenId, (x) => ({ ...x, widgets: ops.addWidget(x.widgets, widget, x.aspect) }));
      set({ selection: [widget.id] });
      return widget.id;
    },
    commitRects(screenId, rects) {
      mutate(screenId, (s) => ({ ...s, widgets: ops.setRects(s.widgets, rects, s.aspect) }));
    },
    patchConfig(screenId, widgetId, patch) {
      mutate(
        screenId,
        (s) => {
          const w = s.widgets.find((x) => x.id === widgetId);
          if (!w) return s;
          const config = sanitizeConfig(w.type, { ...(w.config as object), ...patch });
          return { ...s, widgets: ops.patchWidget(s.widgets, widgetId, { config }) };
        },
        { key: `cfg:${widgetId}` },
      );
    },
    patchWidget(screenId, widgetId, patch) {
      mutate(screenId, (s) => {
        const w = s.widgets.find((x) => x.id === widgetId);
        if (!w) return s;
        const def = getWidgetDefinition(w.type);
        const next = { ...w, ...patch };
        const r = fitRect(next, CANVAS_SIZES[s.aspect], def.minSize);
        return { ...s, widgets: ops.patchWidget(s.widgets, widgetId, { ...patch, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }) };
      }, { key: `geo:${widgetId}` });
    },
    setColors(screenId, ids, patch) {
      mutate(screenId, (s) => ({
        ...s,
        widgets: s.widgets.map((w) => {
          if (!ids.includes(w.id)) return w;
          const colors = { ...w.colors, ...patch };
          (Object.keys(colors) as (keyof WidgetColors)[]).forEach((k) => colors[k] === undefined && delete colors[k]);
          return { ...w, colors };
        }),
      }), { key: `colors:${ids.join(',')}` });
    },
    removeWidgets(screenId, ids) {
      const s = get().screens[screenId];
      if (!s || ids.length === 0) return;
      const removed = s.widgets.filter((w) => ids.includes(w.id));
      mutate(screenId, (x) => ({ ...x, widgets: ops.removeWidgets(x.widgets, ids) }));
      set({ selection: [] });
      get().toast(ids.length === 1 ? t('editor.widgetRemoved') : t('editor.widgetsRemoved', { n: ids.length }), {
        action: { label: t('editor.restore'), run: () => get().restoreWidgets(screenId, removed) },
      });
    },
    restoreWidgets(screenId, widgets) {
      mutate(screenId, (s) => {
        const have = new Set(s.widgets.map((w) => w.id));
        const back = widgets.filter((w) => !have.has(w.id));
        if (!back.length) return s;
        return { ...s, widgets: ops.normalizeZ([...s.widgets, ...back.map((w, i) => ({ ...w, z: ops.nextZ(s.widgets) + i }))]) };
      });
      set({ selection: widgets.map((w) => w.id) });
    },
    duplicateWidgets(screenId, ids) {
      const s = get().screens[screenId];
      if (!s) return;
      const src = s.widgets.filter((w) => ids.includes(w.id));
      if (!src.length || s.widgets.length + src.length > MAX_WIDGETS_PER_SCREEN) return;
      let created: WidgetInstance[] = [];
      mutate(screenId, (x) => {
        const r = ops.cloneWidgets(src, x.widgets, x.aspect);
        created = r.created;
        return { ...x, widgets: r.widgets };
      });
      set({ selection: created.map((w) => w.id) });
    },
    copyWidgets(screenId, ids) {
      const s = get().screens[screenId];
      if (!s) return;
      const src = s.widgets.filter((w) => ids.includes(w.id));
      if (!src.length) return;
      set({ clipboard: structuredClone(src) });
      get().toast(t('editor.copied', { n: src.length }), { ms: 1500 });
    },
    cutWidgets(screenId, ids) {
      get().copyWidgets(screenId, ids);
      get().removeWidgets(screenId, ids);
    },
    paste(screenId) {
      const s = get().screens[screenId];
      const clip = get().clipboard;
      if (!s || !clip.length || s.widgets.length + clip.length > MAX_WIDGETS_PER_SCREEN) return;
      let created: WidgetInstance[] = [];
      mutate(screenId, (x) => {
        const r = ops.cloneWidgets(clip, x.widgets, x.aspect, 40);
        created = r.created;
        return { ...x, widgets: r.widgets };
      });
      set({ selection: created.map((w) => w.id) });
      get().toast(t('editor.pasted', { n: created.length }), { ms: 1500 });
    },
    copyToScreen(fromScreenId, ids, toScreenId) {
      const from = get().screens[fromScreenId];
      const to = get().screens[toScreenId];
      if (!from || !to) return;
      const src = from.widgets.filter((w) => ids.includes(w.id));
      if (!src.length || to.widgets.length + src.length > MAX_WIDGETS_PER_SCREEN) return;
      mutate(toScreenId, (x) => ({ ...x, widgets: ops.cloneWidgets(src, x.widgets, x.aspect, 0).widgets }));
      get().toast(t('editor.copiedToScreen', { name: to.name }), { tone: 'success' });
    },
    reorderWidgets(screenId, ids, how) {
      mutate(screenId, (s) => ({ ...s, widgets: ops.reorder(s.widgets, ids, how) }));
    },
    align(screenId, ids, how) {
      mutate(screenId, (s) => ({ ...s, widgets: ops.alignWidgets(s.widgets, ids, how, s.aspect) }));
    },
    distribute(screenId, ids, axis) {
      mutate(screenId, (s) => ({ ...s, widgets: ops.distributeWidgets(s.widgets, ids, axis) }));
    },
    setLocked(screenId, ids, locked) {
      mutate(screenId, (s) => ({ ...s, widgets: s.widgets.map((w) => (ids.includes(w.id) ? { ...w, locked } : w)) }));
    },
    nudge(screenId, ids, dx, dy) {
      mutate(screenId, (s) => ({ ...s, widgets: ops.moveBy(s.widgets, ids, dx, dy, s.aspect) }), { key: 'nudge' });
    },
    setBackground(screenId, background) {
      mutate(screenId, (s) => ({ ...s, background }), { key: 'bg' });
    },
    setAspect(screenId, aspect) {
      mutate(screenId, (s) => ops.setAspect(s, aspect));
    },
    undo(screenId) {
      const h = get().history[screenId];
      const cur = get().screens[screenId];
      if (!h || !cur || h.past.length === 0) return;
      const prev = h.past[h.past.length - 1]!;
      lastHistoryKey = null;
      set((st) => ({
        history: { ...st.history, [screenId]: { past: h.past.slice(0, -1), future: [...h.future, ops.snapshotOf(cur)] } },
        screens: { ...st.screens, [screenId]: { ...cur, ...prev, updatedAt: Date.now() } },
        selection: st.selection.filter((id) => prev.widgets.some((w) => w.id === id)),
      }));
      saver?.markScreen(screenId);
    },
    redo(screenId) {
      const h = get().history[screenId];
      const cur = get().screens[screenId];
      if (!h || !cur || h.future.length === 0) return;
      const next = h.future[h.future.length - 1]!;
      lastHistoryKey = null;
      set((st) => ({
        history: { ...st.history, [screenId]: { past: [...h.past, ops.snapshotOf(cur)], future: h.future.slice(0, -1) } },
        screens: { ...st.screens, [screenId]: { ...cur, ...next, updatedAt: Date.now() } },
        selection: st.selection.filter((id) => next.widgets.some((w) => w.id === id)),
      }));
      saver?.markScreen(screenId);
    },

    toast(text, opts = {}) {
      const id = uid();
      set((st) => ({ toasts: [...st.toasts.slice(-3), { id, text, tone: opts.tone ?? 'info', action: opts.action }] }));
      const ms = opts.ms ?? (opts.action ? 7000 : 4000);
      setTimeout(() => get().dismissToast(id), ms);
    },
    dismissToast(id) {
      set((st) => ({ toasts: st.toasts.filter((x) => x.id !== id) }));
    },
  };
});

export function getAutoSaver(): AutoSaver | null {
  return saver;
}

/** Zoradené obrazovky v rámci zostavy (alebo všetky bez zostavy). */
export function screensInDeck(screens: Record<string, Screen>, deckId: string | null): Screen[] {
  return Object.values(screens)
    .filter((s) => s.deckId === deckId)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

