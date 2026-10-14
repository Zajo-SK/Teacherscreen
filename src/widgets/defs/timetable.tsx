import { Table2 } from 'lucide-react';
import { z } from 'zod';
import type { WidgetDefinition, WidgetProps } from '../types';

// TODO: implementácia
const schema = z.object({});
type Config = z.output<typeof schema>;

function W(_: WidgetProps<Config>) {
  return <div className="widget-body" />;
}

export const timetableWidget: WidgetDefinition<Config> = {
  type: 'timetable',
  label: 'w.timetable.label',
  description: 'w.timetable.desc',
  icon: Table2,
  category: 'class',
  defaultSize: { w: 400, h: 300 },
  minSize: { w: 200, h: 140 },
  schema,
  Component: W,
};
