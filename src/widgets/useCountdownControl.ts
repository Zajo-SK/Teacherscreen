import { useEffect, useRef } from 'react';
import {
  type CountdownState,
  pauseCountdown,
  remainingAt,
  resetCountdown,
  setCountdownDuration,
  startCountdown,
} from '@/lib/countdown';
import { useNow } from '@/lib/useNow';
import { playAlarm, primeAudio } from '@/lib/audio';

export interface CountdownPatch {
  status: CountdownState['status'];
  durationMs: number;
  endsAt: number | null;
  remainingMs: number;
}

/** Spoločná logika časovača pre widgety Časovač a Vizuálny časovač. */
export function useCountdownControl(state: CountdownState, apply: (p: CountdownPatch) => void, sound: boolean) {
  const running = state.status === 'running';
  const now = useNow(running, 100);
  const remaining = remainingAt(state, now);
  const expired = running && remaining <= 0;
  const alarmedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!expired) return;
    apply({ status: 'done', durationMs: state.durationMs, endsAt: null, remainingMs: 0 });
    const endsAt = state.endsAt ?? 0;
    // Zvuk len pri skutočnom skončení „naživo“ (nie pri otvorení obrazovky po dávno uplynutom čase).
    if (sound && alarmedFor.current !== endsAt && Date.now() - endsAt < 5000) {
      alarmedFor.current = endsAt;
      playAlarm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const emit = (s: CountdownState) => apply({ status: s.status, durationMs: s.durationMs, endsAt: s.endsAt, remainingMs: s.remainingMs });

  return {
    remaining: state.status === 'done' ? 0 : remaining,
    running,
    done: state.status === 'done' || expired,
    start: () => {
      primeAudio();
      emit(startCountdown(state, Date.now()));
    },
    pause: () => emit(pauseCountdown(state, Date.now())),
    reset: () => emit(resetCountdown(state)),
    setDuration: (ms: number) => emit(setCountdownDuration(state, Math.min(24 * 3600_000, Math.max(1000, ms)))),
  };
}
