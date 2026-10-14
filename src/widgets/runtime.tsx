import { createContext, useContext } from 'react';
import type { ClassList, GroupRules, WidgetInstance } from '@/types';

/** Informácie o okolí widgetu (nastavenia aplikácie, ostatné widgety na obrazovke). Widgety tak nezávisia od store. */
export interface WidgetRuntime {
  sound: boolean;
  animations: boolean;
  /** Aktuálny pomer škálovania plochy (px obrazovky / jednotku plochy). */
  scale: number;
  widgets: WidgetInstance[];
  /** Uložené triedy (zoznamy žiakov) učiteľa. */
  classes: ClassList[];
  saveClass: (c: { id?: string; name: string; names: string[]; rules?: GroupRules }) => string;
  patchConfig: (id: string, patch: Record<string, unknown>) => void;
  patchGeometry: (id: string, patch: { w?: number; h?: number }) => void;
}

export const defaultRuntime: WidgetRuntime = {
  sound: false,
  animations: false,
  scale: 1,
  widgets: [],
  classes: [],
  saveClass: () => '',
  patchConfig: () => undefined,
  patchGeometry: () => undefined,
};

export const RuntimeContext = createContext<WidgetRuntime>(defaultRuntime);
export const useRuntime = () => useContext(RuntimeContext);
