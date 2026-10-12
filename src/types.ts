/** Aktuálna verzia formátu uloženej obrazovky. Zvýšiť pri zmene štruktúry a doplniť migráciu v lib/schema.ts. */
export const SCHEMA_VERSION = 1;

export type AspectId = '16:9' | '16:10' | '4:3';

/** Virtuálne rozmery pracovnej plochy. Pozície a veľkosti widgetov sú v týchto jednotkách (nezávislé od okna). */
export const CANVAS_SIZES: Record<AspectId, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '16:10': { w: 1920, h: 1200 },
  '4:3': { w: 1600, h: 1200 },
};

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
  | 'visual-timer';

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
  | { kind: 'image'; value: string };

export interface Screen {
  id: string;
  schemaVersion: number;
  name: string;
  description: string;
  aspect: AspectId;
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

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  theme: ThemeMode;
  sound: boolean;
  /** Zapnuté animácie (náhodný výber, kocky). */
  animations: boolean;
  snapToGrid: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', sound: true, animations: true, snapToGrid: true };

export const DEFAULT_BACKGROUND: Background = { kind: 'gradient', value: 'linear-gradient(135deg,#dbeafe 0%,#e0e7ff 100%)' };
