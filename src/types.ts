/** Aktuálna verzia formátu uloženej obrazovky. Zvýšiť pri zmene štruktúry a doplniť migráciu v lib/schema.ts. */
export const SCHEMA_VERSION = 1;

export type AspectId = '16:9' | '16:10' | '4:3';

/** Virtuálne rozmery pracovnej plochy. Pozície a veľkosti widgetov sú v týchto jednotkách (nezávislé od okna). */
export const CANVAS_SIZES: Record<AspectId, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '16:10': { w: 1920, h: 1200 },
  '4:3': { w: 1600, h: 1200 },
};

/** Veľkosť obsahu plochy: 1 = 100 %. Menšia hodnota = väčšia virtuálna plocha, všetko na nej je menšie. */
export const ZOOM_LEVELS = [1, 0.9, 0.8, 0.7, 0.6, 0.5] as const;

export interface Size {
  w: number;
  h: number;
}

export function isZoomLevel(v: unknown): v is number {
  return typeof v === 'number' && (ZOOM_LEVELS as readonly number[]).includes(v);
}

/** Rozmery plochy obrazovky v jednotkách widgetov (pomer strán × veľkosť obsahu). */
export function canvasOf(s: { aspect: AspectId; zoom?: number }): Size {
  const base = CANVAS_SIZES[s.aspect];
  const z = isZoomLevel(s.zoom) ? s.zoom : 1;
  return z === 1 ? base : { w: Math.round(base.w / z), h: Math.round(base.h / z) };
}

/** Prijme pomer strán alebo hotové rozmery plochy. */
export function sizeOf(a: AspectId | Size): Size {
  return typeof a === 'string' ? CANVAS_SIZES[a] : a;
}

export type WidgetType =
  | 'text'
  | 'clock'
  | 'timer'
  | 'stopwatch'
  | 'traffic'
  | 'picker'
  | 'groups'
  | 'scoreboard'
  | 'dice'
  | 'image'
  | 'qr'
  | 'steps'
  | 'poll'
  | 'draw'
  | 'number'
  | 'visual-timer'
  | 'calendar'
  | 'countdown'
  | 'timetable'
  | 'noise'
  | 'symbols'
  | 'sticker'
  | 'link'
  | 'video'
  | 'embed'
  | 'pdf'
  | 'mindmap';

export interface WidgetColors {
  /** CSS farba pozadia widgetu; undefined = predvolená podľa témy. */
  bg?: string;
  /** CSS farba textu; undefined = automaticky podľa pozadia/témy. */
  fg?: string;
}

export interface WidgetInstance<C = unknown> {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  locked: boolean;
  colors: WidgetColors;
  config: C;
}

export type Background =
  | { kind: 'color'; value: string }
  | { kind: 'gradient'; value: string }
  | { kind: 'image'; value: string; /** Autor a licencia fotky (ak je z knižnice fotiek). */ credit?: string }
  /** Predvoľba z knižnice pozadí (ID z lib/backgrounds.ts). */
  | { kind: 'preset'; value: string };

export interface Screen {
  id: string;
  schemaVersion: number;
  name: string;
  description: string;
  aspect: AspectId;
  /** Veľkosť obsahu (viď ZOOM_LEVELS); chýba = 100 %. */
  zoom?: number;
  background: Background;
  widgets: WidgetInstance[];
  /** Zostava, do ktorej obrazovka patrí (voliteľné). */
  deckId: string | null;
  /** Poradie v rámci zostavy (alebo v zozname bez zostavy). */
  order: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
  templateId: string | null;
}

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Pravidlá triedy: dvojice žiakov, ktorí NESMÚ byť v jednej skupine, a dvojice, ktorí MUSIA byť spolu (podľa mien). */
export interface GroupRules {
  apart: [string, string][];
  together: [string, string][];
}

/** Zoznam žiakov jednej triedy. Ukladá sa lokálne; do cloudu iba ak to učiteľ výslovne zapne. */
export interface ClassList {
  id: string;
  name: string;
  names: string[];
  /** Pravidlá pre rozdeľovač skupín (voliteľné). */
  rules?: GroupRules;
  updatedAt: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  theme: ThemeMode;
  sound: boolean;
  /** Zapnuté animácie (náhodný výber, kocky). */
  animations: boolean;
  snapToGrid: boolean;
  /** Synchronizovať zoznamy tried (mená žiakov) do cloudu – predvolene vypnuté. */
  syncClasses: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', sound: true, animations: true, snapToGrid: true, syncClasses: false };

export const DEFAULT_BACKGROUND: Background = { kind: 'preset', value: 'mesh-ocean' };
