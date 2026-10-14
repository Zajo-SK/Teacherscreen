import { z } from 'zod';
import {
  CANVAS_SIZES,
  type ClassList,
  type GroupRules,
  DEFAULT_BACKGROUND,
  SCHEMA_VERSION,
  type AspectId,
  type Background,
  type Deck,
  type Screen,
  type WidgetInstance,
} from '@/types';
import { getWidgetDefinition, isWidgetType, sanitizeConfig } from '@/widgets/registry';
import { fitRect } from './geometry';
import { isSafeImageDataUrl } from './image';
import { isBgPresetId } from './backgrounds';
import { uid } from './id';

export class ImportError extends Error {
  constructor(
    public code: 'json' | 'format' | 'too-new' | 'too-large' | 'empty',
    message: string,
    public detail?: string,
  ) {
    super(message);
  }
}

export const MAX_IMPORT_BYTES = 40 * 1024 * 1024;
export const MAX_WIDGETS_PER_SCREEN = 60;

const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
const gradient = z
  .string()
  .max(400)
  .regex(/^(linear|radial)-gradient\([#0-9a-zA-Z\s,.%()-]+\)$/)
  .refine((v) => !/url|expression|var\(|@/i.test(v));

export function sanitizeBackground(raw: unknown): Background {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.kind === 'color' && color.safeParse(r.value).success) return { kind: 'color', value: r.value as string };
  if (r.kind === 'gradient' && gradient.safeParse(r.value).success) return { kind: 'gradient', value: r.value as string };
  if (r.kind === 'image' && isSafeImageDataUrl(r.value)) {
    const credit = typeof r.credit === 'string' ? r.credit.replace(/[\u0000-\u001f<>]/g, '').slice(0, 200) : '';
    return credit ? { kind: 'image', value: r.value, credit } : { kind: 'image', value: r.value };
  }
  if (r.kind === 'preset' && isBgPresetId(r.value)) return { kind: 'preset', value: r.value };
  return DEFAULT_BACKGROUND;
}

const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const text = (v: unknown, max: number, def = '') => (typeof v === 'string' ? v.slice(0, max) : def);

function sanitizeWidget(raw: unknown, aspect: AspectId, seen: Set<string>): WidgetInstance | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isWidgetType(r.type)) return null;
  const def = getWidgetDefinition(r.type);
  const canvas = CANVAS_SIZES[aspect];
  let id = text(r.id, 64);
  if (!id || seen.has(id)) id = uid();
  seen.add(id);
  const rect = fitRect(
    { x: num(r.x, 40), y: num(r.y, 40), w: num(r.w, def.defaultSize.w), h: num(r.h, def.defaultSize.h) },
    canvas,
    def.minSize,
  );
  const colors = (r.colors && typeof r.colors === 'object' ? r.colors : {}) as Record<string, unknown>;
  return {
    id,
    type: r.type,
    ...{ x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) },
    z: Math.round(num(r.z, 0)),
    locked: r.locked === true,
    colors: {
      ...(color.safeParse(colors.bg).success ? { bg: colors.bg as string } : {}),
      ...(color.safeParse(colors.fg).success ? { fg: colors.fg as string } : {}),
    },
    config: sanitizeConfig(r.type, r.config),
  };
}

/** Migrácie starších verzií formátu: kľúč = verzia, z ktorej sa migruje na verziu + 1. */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrateScreenData(raw: Record<string, unknown>): Record<string, unknown> {
  let v = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
  if (v > SCHEMA_VERSION) throw new ImportError('too-new', 'Súbor je z novšej verzie.', String(v));
  let cur = raw;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new ImportError('format', 'Nepodporovaná verzia formátu.', String(v));
    cur = step(cur);
    v++;
  }
  return { ...cur, schemaVersion: SCHEMA_VERSION };
}

export interface SanitizedScreen {
  screen: Screen;
  skippedWidgets: number;
}

/** Overí a opraví obrazovku z ľubovoľného (nedôveryhodného) zdroja: import, IndexedDB, cloud. */
export function sanitizeScreen(raw: unknown, opts: { keepId?: boolean } = {}): SanitizedScreen {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ImportError('format', 'Neplatná obrazovka.');
  const migrated = migrateScreenData(raw as Record<string, unknown>);
  const aspect: AspectId = migrated.aspect === '16:10' || migrated.aspect === '4:3' ? migrated.aspect : '16:9';
  const list = Array.isArray(migrated.widgets) ? migrated.widgets : [];
  const seen = new Set<string>();
  const widgets: WidgetInstance[] = [];
  let skipped = 0;
  for (const w of list.slice(0, MAX_WIDGETS_PER_SCREEN)) {
    const sw = sanitizeWidget(w, aspect, seen);
    if (sw) widgets.push(sw);
    else skipped++;
  }
  skipped += Math.max(0, list.length - MAX_WIDGETS_PER_SCREEN);
  // normalizácia poradia vrstiev na 0..n-1 (zachová relatívne poradie)
  widgets.sort((a, b) => a.z - b.z);
  widgets.forEach((w, i) => (w.z = i));
  const now = Date.now();
  const id = opts.keepId && typeof migrated.id === 'string' && migrated.id ? migrated.id.slice(0, 64) : uid();
  return {
    skippedWidgets: skipped,
    screen: {
      id,
      schemaVersion: SCHEMA_VERSION,
      name: text(migrated.name, 120, 'Bez názvu') || 'Bez názvu',
      description: text(migrated.description, 500),
      aspect,
      background: sanitizeBackground(migrated.background),
      widgets,
      deckId: typeof migrated.deckId === 'string' ? migrated.deckId.slice(0, 64) : null,
      order: Math.round(num(migrated.order, 0)),
      createdAt: num(migrated.createdAt, now),
      updatedAt: num(migrated.updatedAt, now),
      lastOpenedAt: typeof migrated.lastOpenedAt === 'number' ? migrated.lastOpenedAt : null,
      templateId: typeof migrated.templateId === 'string' ? migrated.templateId.slice(0, 64) : null,
    },
  };
}

export function sanitizeDeck(raw: unknown): Deck | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const now = Date.now();
  return { id: r.id.slice(0, 64), name: text(r.name, 120, 'Zostava') || 'Zostava', createdAt: num(r.createdAt, now), updatedAt: num(r.updatedAt, now) };
}

export function sanitizeRules(raw: unknown): GroupRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pairs = (v: unknown): [string, string][] =>
    (Array.isArray(v) ? v : [])
      .filter((p): p is [unknown, unknown] => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string')
      .map((p) => [String(p[0]).trim().slice(0, 60), String(p[1]).trim().slice(0, 60)] as [string, string])
      .filter(([a, b]) => a && b && a !== b)
      .slice(0, 100);
  return { apart: pairs(r.apart), together: pairs(r.together) };
}

export function sanitizeClass(raw: unknown): ClassList | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const names = Array.isArray(r.names) ? r.names.filter((n): n is string => typeof n === 'string').map((n) => n.trim().slice(0, 60)).filter(Boolean).slice(0, 200) : [];
  const rules = sanitizeRules(r.rules);
  const hasRules = rules.apart.length + rules.together.length > 0;
  return { id: r.id.slice(0, 64), name: text(r.name, 80, 'Trieda') || 'Trieda', names, ...(hasRules ? { rules } : {}), updatedAt: num(r.updatedAt, Date.now()) };
}

// ---------------------------------------------------------------- export / import súborov

export const FILE_APP = 'teacherscreen';
export type FileKind = 'screen' | 'backup';

export interface ExportFile {
  app: typeof FILE_APP;
  kind: FileKind;
  formatVersion: number;
  exportedAt: string;
  screens: unknown[];
  decks?: unknown[];
  classes?: unknown[];
}

/** Odstráni zoznamy žiakov zo všetkých widgetov (pre export na zdieľanie). */
export function stripStudentData(screen: Screen): Screen {
  return {
    ...screen,
    widgets: screen.widgets.map((w) => {
      const def = getWidgetDefinition(w.type);
      return def.stripStudentData ? { ...w, config: def.stripStudentData(w.config) } : w;
    }),
  };
}

export function buildExport(screens: Screen[], opts: { kind: FileKind; decks?: Deck[]; classes?: ClassList[]; includeStudents: boolean }): ExportFile {
  return {
    app: FILE_APP,
    kind: opts.kind,
    formatVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    screens: opts.includeStudents ? screens : screens.map(stripStudentData),
    ...(opts.decks ? { decks: opts.decks } : {}),
    ...(opts.classes && opts.includeStudents ? { classes: opts.classes } : {}),
  };
}

export interface ParsedImport {
  screens: Screen[];
  decks: Deck[];
  classes: ClassList[];
  skippedWidgets: number;
  skippedScreens: number;
}

/** Spracuje obsah importovaného súboru. Vždy priradí nové ID obrazoviek (nikdy neprepíše existujúce). Zostavy sa premapujú. */
export function parseImport(textContent: string): ParsedImport {
  if (textContent.length > MAX_IMPORT_BYTES) throw new ImportError('too-large', 'Súbor je príliš veľký.');
  let data: unknown;
  try {
    data = JSON.parse(textContent);
  } catch {
    throw new ImportError('json', 'Súbor nie je platný JSON.');
  }
  if (!data || typeof data !== 'object') throw new ImportError('format', 'Neplatný formát.');
  const d = data as Record<string, unknown>;
  if (d.app !== FILE_APP || !Array.isArray(d.screens)) throw new ImportError('format', 'Súbor nie je v podporovanom formáte.');
  if (typeof d.formatVersion === 'number' && d.formatVersion > SCHEMA_VERSION) {
    throw new ImportError('too-new', 'Súbor je z novšej verzie.', String(d.formatVersion));
  }
  const deckMap = new Map<string, string>();
  const decks: Deck[] = [];
  for (const raw of Array.isArray(d.decks) ? d.decks.slice(0, 200) : []) {
    const dk = sanitizeDeck(raw);
    if (dk) {
      const newId = uid();
      deckMap.set(dk.id, newId);
      decks.push({ ...dk, id: newId });
    }
  }
  const screens: Screen[] = [];
  let skippedWidgets = 0;
  let skippedScreens = 0;
  for (const raw of d.screens.slice(0, 500)) {
    try {
      const { screen, skippedWidgets: sk } = sanitizeScreen(raw);
      skippedWidgets += sk;
      screen.deckId = screen.deckId ? (deckMap.get(screen.deckId) ?? null) : null;
      screens.push(screen);
    } catch (e) {
      if (e instanceof ImportError && e.code === 'too-new') throw e;
      skippedScreens++;
    }
  }
  const classes = (Array.isArray(d.classes) ? d.classes.slice(0, 100) : []).map((c) => sanitizeClass(c)).filter((c): c is ClassList => !!c).map((c) => ({ ...c, id: uid() }));
  if (screens.length === 0 && classes.length === 0) throw new ImportError('empty', 'Súbor neobsahuje žiadnu platnú obrazovku.');
  return { screens, decks, classes, skippedWidgets, skippedScreens };
}
