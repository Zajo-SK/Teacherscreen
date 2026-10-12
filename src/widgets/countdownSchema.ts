import { int, nullableNum, oneOf } from './fields';

export const countdownShape = {
  status: oneOf(['idle', 'running', 'paused', 'done'] as const, 'idle'),
  durationMs: int(300_000, 1000, 86_400_000),
  endsAt: nullableNum,
  remainingMs: int(300_000, 0, 86_400_000),
};
