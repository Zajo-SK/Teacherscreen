import { Link } from 'lucide-react';
import { z } from 'zod';
import type { WidgetDefinition, WidgetProps } from '../types';

// TODO: implementácia
const schema = z.object({});
type Config = z.output<typeof schema>;

function W(_: WidgetProps<Config>) {
  return <div className="widget-body" />;
}

export const linkWidget: WidgetDefinition<Config> = {
  type: 'link',
  label: 'w.link.label',
  description: 'w.link.desc',
  icon: Link,
  category: 'content',
  defaultSize: { w: 400, h: 300 },
  minSize: { w: 200, h: 140 },
  schema,
  Component: W,
};
