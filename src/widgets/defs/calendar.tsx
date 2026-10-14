import { CalendarDays } from 'lucide-react';
import { z } from 'zod';
import type { WidgetDefinition, WidgetProps } from '../types';

// TODO: implementácia
const schema = z.object({});
type Config = z.output<typeof schema>;

function W(_: WidgetProps<Config>) {
  return <div className="widget-body" />;
}

export const calendarWidget: WidgetDefinition<Config> = {
  type: 'calendar',
  label: 'w.calendar.label',
  description: 'w.calendar.desc',
  icon: CalendarDays,
  category: 'time',
  defaultSize: { w: 400, h: 300 },
  minSize: { w: 200, h: 140 },
  schema,
  Component: W,
};
