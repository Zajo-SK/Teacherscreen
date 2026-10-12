import { useState, type ReactNode } from 'react';
import { createWidget, getWidgetDefinition, sanitizeConfig } from '@/widgets/registry';
import { defaultRuntime, RuntimeContext, type WidgetRuntime } from '@/widgets/runtime';
import type { WidgetType } from '@/types';

/** Vykreslí jeden widget s lokálnym stavom konfigurácie – podobne ako ho vykreslí editor. */
export function WidgetHarness({ type, config, runtime, onConfig }: { type: WidgetType; config?: Record<string, unknown>; runtime?: Partial<WidgetRuntime>; onConfig?: (c: unknown) => void }): ReactNode {
  const def = getWidgetDefinition(type);
  const [cfg, setCfg] = useState(() => createWidget(type, { config }).config);
  const widget = { ...createWidget(type), id: 'w1', config: cfg };
  return (
    <RuntimeContext.Provider value={{ ...defaultRuntime, ...runtime }}>
      <def.Component
        widget={widget}
        config={cfg}
        mode="present"
        update={(p: Record<string, unknown>) =>
          setCfg((c: unknown) => {
            const next = sanitizeConfig(type, { ...(c as object), ...p });
            onConfig?.(next);
            return next;
          })
        }
      />
    </RuntimeContext.Provider>
  );
}
