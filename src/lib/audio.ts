let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/** Volať z používateľskej akcie (klik), aby prehliadač neskôr dovolil zvuk. */
export function primeAudio(): void {
  try {
    void getCtx()?.resume();
  } catch {
    /* zvuk nie je dostupný – vizuálne upozornenie stále funguje */
  }
}

/** Krátka trojtónová fanfára po skončení časovača. */
export function playAlarm(): void {
  try {
    const c = getCtx();
    if (!c || c.state === 'suspended') return;
    const t0 = c.currentTime;
    [0, 0.35, 0.7].forEach((off, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = [660, 880, 1100][i]!;
      g.gain.setValueAtTime(0.0001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.3);
      o.connect(g).connect(c.destination);
      o.start(t0 + off);
      o.stop(t0 + off + 0.32);
    });
  } catch {
    /* ignorované */
  }
}
