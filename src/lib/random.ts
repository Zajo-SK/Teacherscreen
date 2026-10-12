/** Rovnomerné náhodné celé číslo z intervalu [0, max) bez modulo skreslenia. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) throw new RangeError('max musí byť kladné celé číslo');
  if (max === 1) return 0;
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (!c?.getRandomValues) return Math.floor(Math.random() * max);
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    c.getRandomValues(buf);
    const v = buf[0]!;
    if (v < limit) return v % max;
  }
}

/** Fisher–Yates; nemení vstup. */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
