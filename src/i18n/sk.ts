import { app } from './sk/app';
import { widgets } from './sk/widgets';

export const sk = { ...app, ...widgets } as const;
