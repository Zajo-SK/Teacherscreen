/**
 * Čistá logika časovača odolná voči oneskoreniu JavaScriptu: zdrojom pravdy je absolútny čas
 * ukončenia (`endsAt`, ms od epochy), nie počet tikov intervalu.
 */
export type CountdownStatus = 'idle' | 'running' | 'paused' | 'done';

export interface CountdownState {
  status: CountdownStatus;
  durationMs: number;
  /** Absolútny čas ukončenia (len keď status = running). */
  endsAt: number | null;
  /** Zostávajúci čas pri pozastavení. */
  remainingMs: number;
}

export function initialCountdown(durationMs: number): CountdownState {
  return { status: 'idle', durationMs, endsAt: null, remainingMs: durationMs };
}

export function remainingAt(s: CountdownState, now: number): number {
  switch (s.status) {
    case 'running':
      return Math.max(0, (s.endsAt ?? now) - now);
    case 'done':
      return 0;
    default:
      return s.remainingMs;
  }
}

export function startCountdown(s: CountdownState, now: number): CountdownState {
  if (s.status === 'running') return s;
  const base = s.status === 'paused' ? s.remainingMs : s.status === 'done' ? s.durationMs : s.remainingMs || s.durationMs;
  if (base <= 0) return s;
  return { ...s, status: 'running', endsAt: now + base, remainingMs: base };
}

export function pauseCountdown(s: CountdownState, now: number): CountdownState {
  if (s.status !== 'running') return s;
  const rem = remainingAt(s, now);
  if (rem <= 0) return { ...s, status: 'done', endsAt: null, remainingMs: 0 };
  return { ...s, status: 'paused', endsAt: null, remainingMs: rem };
}

export function resetCountdown(s: CountdownState): CountdownState {
  return { ...s, status: 'idle', endsAt: null, remainingMs: s.durationMs };
}

export function setCountdownDuration(s: CountdownState, durationMs: number): CountdownState {
  return { ...s, status: 'idle', durationMs, endsAt: null, remainingMs: durationMs };
}

/** Ak bežiaci časovač vypršal, vráti stav `done`, inak pôvodný objekt. */
export function settleCountdown(s: CountdownState, now: number): CountdownState {
  if (s.status === 'running' && (s.endsAt ?? 0) <= now) return { ...s, status: 'done', endsAt: null, remainingMs: 0 };
  return s;
}

/** Formát mm:ss (alebo h:mm:ss od hodiny). Zostávajúci čas sa zaokrúhľuje nahor – ako na bežných časovačoch. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  return formatSeconds(total);
}

export function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** Stopky – absolútny čas štartu + nahromadený čas. */
export interface StopwatchState {
  status: 'idle' | 'running' | 'paused';
  startedAt: number | null;
  accumulatedMs: number;
}

export const initialStopwatch: StopwatchState = { status: 'idle', startedAt: null, accumulatedMs: 0 };

export function elapsedAt(s: StopwatchState, now: number): number {
  return s.accumulatedMs + (s.status === 'running' && s.startedAt !== null ? Math.max(0, now - s.startedAt) : 0);
}
export function startStopwatch(s: StopwatchState, now: number): StopwatchState {
  return s.status === 'running' ? s : { ...s, status: 'running', startedAt: now };
}
export function pauseStopwatch(s: StopwatchState, now: number): StopwatchState {
  return s.status !== 'running' ? s : { status: 'paused', startedAt: null, accumulatedMs: elapsedAt(s, now) };
}
export function resetStopwatch(): StopwatchState {
  return initialStopwatch;
}
/** mm:ss.d */
export function formatElapsed(ms: number): string {
  const tenths = Math.floor(ms / 100) % 10;
  return `${formatSeconds(Math.floor(ms / 1000))}.${tenths}`;
}
