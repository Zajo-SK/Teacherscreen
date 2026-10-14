import { randomInt } from './random';

export const MAX_RANGE = 100_000;

/**
 * Vylosuje `count` čísel z intervalu [min, max]. Pri `unique` sa čísla neopakujú (ani voči `exclude`).
 * Vráti menej čísel, ak ich zostáva menej; prázdne pole, ak už nezostalo žiadne.
 */
export function drawNumbers(min: number, max: number, count: number, exclude: readonly number[] = [], unique = false): number[] {
  const lo = Math.round(Math.min(min, max));
  let hi = Math.round(Math.max(min, max));
  if (hi - lo + 1 > MAX_RANGE) hi = lo + MAX_RANGE - 1;
  const size = hi - lo + 1;
  const n = Math.max(0, Math.floor(count));
  if (!unique) return Array.from({ length: n }, () => lo + randomInt(size));

  const used = new Set(exclude.filter((x) => x >= lo && x <= hi));
  const free = size - used.size;
  if (free <= 0) return [];
  const want = Math.min(n, free);
  if (free <= 2000 || want * 2 >= free) {
    // malý zostatok: zoznam voľných čísel a čiastočné premiešanie
    const pool: number[] = [];
    for (let v = lo; v <= hi; v++) if (!used.has(v)) pool.push(v);
    const out: number[] = [];
    for (let i = 0; i < want; i++) {
      const j = i + randomInt(pool.length - i);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      out.push(pool[i]!);
    }
    return out;
  }
  const out: number[] = [];
  while (out.length < want) {
    const v = lo + randomInt(size);
    if (!used.has(v)) {
      used.add(v);
      out.push(v);
    }
  }
  return out;
}

export function remainingCount(min: number, max: number, drawn: readonly number[]): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const used = new Set(drawn.filter((x) => x >= lo && x <= hi));
  return Math.min(hi - lo + 1, MAX_RANGE) - used.size;
}
