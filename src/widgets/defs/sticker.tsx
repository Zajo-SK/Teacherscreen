import { Heart } from 'lucide-react';
import { z } from 'zod';
import type { WidgetDefinition, WidgetProps } from '../types';

// TODO: implementácia
const schema = z.object({});
type Config = z.output<typeof schema>;

function W(_: WidgetProps<Config>) {
  return <div className="widget-body" />;
}

export const stickerWidget: WidgetDefinition<Config> = {
  type: 'sticker',
  label: 'w.sticker.label',
  description: 'w.sticker.desc',
  icon: Heart,
  category: 'content',
  defaultSize: { w: 400, h: 300 },
  minSize: { w: 200, h: 140 },
  schema,
  Component: W,
};
