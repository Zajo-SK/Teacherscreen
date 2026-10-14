import type { WidgetInstance, WidgetType } from '@/types';
import { uid } from '@/lib/id';
import type { WidgetCategory, WidgetDefinition } from './types';
import { textWidget } from './defs/text';
import { clockWidget } from './defs/clock';
import { timerWidget } from './defs/timer';
import { stopwatchWidget } from './defs/stopwatch';
import { trafficWidget } from './defs/traffic';
import { pickerWidget } from './defs/picker';
import { groupsWidget } from './defs/groups';
import { scoreboardWidget } from './defs/scoreboard';
import { diceWidget } from './defs/dice';
import { imageWidget } from './defs/image';
import { qrWidget } from './defs/qr';
import { stepsWidget } from './defs/steps';
import { pollWidget } from './defs/poll';
import { drawWidget } from './defs/draw';
import { visualTimerWidget } from './defs/visualTimer';
import { numberWidget } from './defs/number';
import { calendarWidget } from './defs/calendar';
import { countdownWidget } from './defs/countdown';
import { timetableWidget } from './defs/timetable';
import { noiseWidget } from './defs/noise';
import { symbolsWidget } from './defs/symbols';
import { stickerWidget } from './defs/sticker';
import { linkWidget } from './defs/link';
import { videoWidget } from './defs/video';
import { embedWidget } from './defs/embed';
import { pdfWidget } from './defs/pdf';

/**
 * Register widgetov. Nový widget = nový súbor v `defs/` + jeden riadok tu (+ preklady v i18n).
 * Editor, prezentácia, import/export a šablóny sa o ostatné starajú samy.
 */
const ALL: WidgetDefinition[] = [
  textWidget,
  clockWidget,
  timerWidget,
  visualTimerWidget,
  stopwatchWidget,
  trafficWidget,
  pickerWidget,
  groupsWidget,
  scoreboardWidget,
  diceWidget,
  numberWidget,
  imageWidget,
  qrWidget,
  stepsWidget,
  pollWidget,
  drawWidget,
  calendarWidget,
  countdownWidget,
  timetableWidget,
  noiseWidget,
  symbolsWidget,
  stickerWidget,
  linkWidget,
  videoWidget,
  embedWidget,
  pdfWidget,
];

const BY_TYPE = new Map<string, WidgetDefinition>(ALL.map((d) => [d.type, d]));

export const widgetDefinitions: readonly WidgetDefinition[] = ALL;
export const widgetCategories: readonly WidgetCategory[] = ['content', 'time', 'class', 'tools'];

export function isWidgetType(v: unknown): v is WidgetType {
  return typeof v === 'string' && BY_TYPE.has(v);
}

export function getWidgetDefinition(type: WidgetType): WidgetDefinition {
  const d = BY_TYPE.get(type);
  if (!d) throw new Error(`Neznámy typ widgetu: ${type}`);
  return d;
}

/** Overí/opraví konfiguráciu podľa schémy widgetu (chýbajúce polia doplní predvolenými). */
export function sanitizeConfig(type: WidgetType, raw: unknown): unknown {
  const def = getWidgetDefinition(type);
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return def.schema.parse(input);
}

export function defaultConfig(type: WidgetType): unknown {
  return sanitizeConfig(type, {});
}

export function createWidget(
  type: WidgetType,
  opts: { x?: number; y?: number; w?: number; h?: number; z?: number; config?: Record<string, unknown>; colors?: WidgetInstance['colors']; locked?: boolean } = {},
): WidgetInstance {
  const def = getWidgetDefinition(type);
  return {
    id: uid(),
    type,
    x: opts.x ?? 100,
    y: opts.y ?? 100,
    w: opts.w ?? def.defaultSize.w,
    h: opts.h ?? def.defaultSize.h,
    z: opts.z ?? 0,
    locked: opts.locked ?? false,
    colors: opts.colors ?? {},
    config: sanitizeConfig(type, opts.config ?? {}),
  };
}
