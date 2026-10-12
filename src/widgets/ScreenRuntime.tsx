import { useMemo, type ReactNode } from 'react';
import { useApp } from '@/store/useApp';
import { RuntimeContext, type WidgetRuntime } from './runtime';

/** Poskytuje widgetom (a ich nastaveniam v paneli vlastností) informácie o okolí: ostatné widgety, triedy, nastavenia. */
export function ScreenRuntime({ screenId, scale, children }: { screenId: string; scale: number; children: ReactNode }) {
  const widgets = useApp((s) => s.screens[screenId]?.widgets);
  const settings = useApp((s) => s.settings);
  const classesMap = useApp((s) => s.classes);
  const saveClass = useApp((s) => s.saveClass);
  const patchConfigStore = useApp((s) => s.patchConfig);
  const patchWidgetStore = useApp((s) => s.patchWidget);
  const value = useMemo<WidgetRuntime>(
    () => ({
      sound: settings.sound,
      animations: settings.animations,
      scale,
      widgets: widgets ?? [],
      classes: Object.values(classesMap),
      saveClass,
      patchConfig: (id, patch) => patchConfigStore(screenId, id, patch),
      patchGeometry: (id, patch) => patchWidgetStore(screenId, id, patch),
    }),
    [settings.sound, settings.animations, scale, widgets, classesMap, saveClass, screenId, patchConfigStore, patchWidgetStore],
  );
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}
