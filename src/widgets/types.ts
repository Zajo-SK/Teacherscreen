import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { z } from 'zod';
import type { WidgetInstance, WidgetType } from '@/types';
import type { TKey } from '@/i18n';

export type WidgetCategory = 'content' | 'time' | 'class' | 'tools';

export interface WidgetProps<C> {
  widget: WidgetInstance<C>;
  config: C;
  /** Čiastočná aktualizácia konfigurácie widgetu (ukladá sa automaticky). */
  update: (patch: Partial<C>) => void;
  /** 'edit' = editor, 'present' = prezentačný režim. */
  mode: 'edit' | 'present';
}

export interface SettingsProps<C> {
  widget: WidgetInstance<C>;
  config: C;
  update: (patch: Partial<C>) => void;
}

/**
 * Spoločné rozhranie widgetu. Nový widget stačí zaregistrovať v `widgets/registry.ts` –
 * editor, prezentácia, import/export a šablóny s ním pracujú cez túto definíciu.
 */
export interface WidgetDefinition<C = any> {
  type: WidgetType;
  label: TKey;
  description: TKey;
  icon: LucideIcon;
  category: WidgetCategory;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  /** Schéma konfigurácie. Každé pole má `.catch(default)`, takže poškodený vstup sa opraví namiesto zlyhania. */
  schema: z.ZodType<C, unknown>;
  Component: ComponentType<WidgetProps<C>>;
  Settings?: ComponentType<SettingsProps<C>>;
  /** Ak vráti číslo (šírka/výška), zmena veľkosti zachováva pomer strán. */
  aspectRatio?: (config: C) => number | null;
  /** Odstráni osobné údaje žiakov pred odoslaním na server. */
  stripStudentData?: (config: C) => C;
  /** Obsahuje widget zoznam žiakov (pre export bez mien). */
  hasStudentData?: boolean;
}
