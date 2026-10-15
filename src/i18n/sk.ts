import { app } from './sk/app';
import { widgets } from './sk/widgets';
import { w2a } from './sk/w2a';
import { w2b } from './sk/w2b';
import { w2c } from './sk/w2c';
import { w2d } from './sk/w2d';
import { w2f } from './sk/w2f';
import { w2e } from './sk/w2e';
import { w2g } from './sk/w2g';

export const sk = { ...app, ...widgets, ...w2a, ...w2b, ...w2c, ...w2d, ...w2f, ...w2e, ...w2g } as const;
