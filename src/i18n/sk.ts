import { app } from './sk/app';
import { widgets } from './sk/widgets';
import { w2a } from './sk/w2a';
import { w2b } from './sk/w2b';
import { w2c } from './sk/w2c';
import { w2d } from './sk/w2d';

export const sk = { ...app, ...widgets, ...w2a, ...w2b, ...w2c, ...w2d } as const;
