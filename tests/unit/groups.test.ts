import { describe, expect, it } from 'vitest';
import { planGroups, splitIntoGroups, verifyPartition } from '@/lib/groups';
import { parseNames } from '@/lib/names';
import { randomInt, shuffle } from '@/lib/random';

const names = (n: number) => Array.from({ length: n }, (_, i) => `Žiak ${i + 1}`);

describe('rozdeľovač skupín', () => {
  it('každý žiak je zaradený presne raz pre všetky kombinácie počtu žiakov a skupín', () => {
    for (let n = 1; n <= 40; n++) {
      for (const mode of ['count', 'size'] as const) {
        for (let v = 1; v <= 12; v++) {
          const list = names(n);
          const groups = splitIntoGroups(list, mode, v);
          expect(verifyPartition(list, groups), `n=${n} ${mode}=${v}`).toBe(true);
          expect(groups.flat()).toHaveLength(n);
          expect(groups.every((g) => g.length > 0)).toBe(true);
          const sizes = groups.map((g) => g.length);
          expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it('zvláda rovnaké mená (každý záznam je jeden žiak)', () => {
    const list = ['Anna', 'Anna', 'Peter', 'Jakub', 'Jakub', 'Jakub'];
    const groups = splitIntoGroups(list, 'count', 2);
    expect(verifyPartition(list, groups)).toBe(true);
  });
  it('počet skupín nikdy nepresiahne počet žiakov', () => {
    expect(planGroups(3, 'count', 10).groupCount).toBe(3);
    expect(planGroups(10, 'size', 4).groupCount).toBe(3);
    expect(planGroups(0, 'count', 3).groupCount).toBe(0);
    expect(splitIntoGroups([], 'count', 3)).toEqual([]);
  });
  it('verifyPartition odhalí duplicitu aj chýbajúceho žiaka', () => {
    expect(verifyPartition(['a', 'b', 'c'], [['a', 'b'], ['b']])).toBe(false);
    expect(verifyPartition(['a', 'b', 'c'], [['a', 'b']])).toBe(false);
    expect(verifyPartition(['a', 'b'], [['a'], ['b'], ['x']])).toBe(false);
    expect(verifyPartition(['a', 'b'], [['b'], ['a']])).toBe(true);
  });
});

describe('mená a náhoda', () => {
  it('parseNames rozdelí riadky, čiarky a odstráni prázdne položky', () => {
    expect(parseNames('Anna, Peter\n\n  Mária ;Jakub\t Eva ')).toEqual(['Anna', 'Peter', 'Mária', 'Jakub', 'Eva']);
    expect(parseNames('   \n ,, ')).toEqual([]);
  });
  it('randomInt je v rozsahu a približne rovnomerný', () => {
    const counts = new Array(6).fill(0) as number[];
    for (let i = 0; i < 12_000; i++) counts[randomInt(6)]!++;
    counts.forEach((c) => expect(c).toBeGreaterThan(1700));
    expect(() => randomInt(0)).toThrow();
    expect(randomInt(1)).toBe(0);
  });
  it('shuffle zachová prvky a nemení vstup', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src);
    expect(out.slice().sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
});
