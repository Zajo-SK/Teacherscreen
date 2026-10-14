import { MessageCircle } from 'lucide-react';
import { z } from 'zod';
import type { WidgetDefinition, WidgetProps } from '../types';

// TODO: implementácia
const schema = z.object({});
type Config = z.output<typeof schema>;

function W(_: WidgetProps<Config>) {
  return <div className="widget-body" />;
}

export const symbolsWidget: WidgetDefinition<Config> = {
  type: 'symbols',
  label: 'w.symbols.label',
  description: 'w.symbols.desc',
  icon: MessageCircle,
  category: 'class',
  defaultSize: { w: 400, h: 300 },
  minSize: { w: 200, h: 140 },
  schema,
  Component: W,
};
