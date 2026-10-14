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

import { emptyRules, moveStudent, ruleViolations, splitWithRules, type GroupRules } from '@/lib/groups';

describe('rozdelenie s pravidlami', () => {
  const N = (n: number) => Array.from({ length: n }, (_, i) => `Ž${i + 1}`);
  const rulesOf = (apart: [string, string][] = [], together: [string, string][] = []): GroupRules => ({ apart, together });

  it('bez pravidiel dáva rovnaký výsledok ako bežné delenie (vyvážené, každý raz)', () => {
    for (let n = 1; n <= 30; n++) {
      const list = N(n);
      for (let v = 1; v <= 6; v++) {
        const r = splitWithRules(list, 'count', v, emptyRules());
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(verifyPartition(list, r.groups)).toBe(true);
          expect(r.balanced).toBe(true);
          const sizes = r.groups.map((g) => g.length);
          expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('dvojice, ktoré nesmú byť spolu, nikdy nie sú v jednej skupine (stovky náhodných rozdelení)', () => {
    const list = N(24);
    const rules = rulesOf([['Ž1', 'Ž2'], ['Ž1', 'Ž3'], ['Ž4', 'Ž5'], ['Ž6', 'Ž7'], ['Ž8', 'Ž9'], ['Ž2', 'Ž3']]);
    for (let i = 0; i < 300; i++) {
      const r = splitWithRules(list, 'count', 4, rules);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(verifyPartition(list, r.groups)).toBe(true);
        expect(ruleViolations(r.groups, rules).size).toBe(0);
      }
    }
  });

  it('dvojice, ktoré musia byť spolu, sú vždy spolu (aj reťaz a priateľstvá cez tretieho)', () => {
    const list = N(20);
    const rules = rulesOf([['Ž1', 'Ž10']], [['Ž1', 'Ž2'], ['Ž2', 'Ž3'], ['Ž5', 'Ž6']]);
    for (let i = 0; i < 200; i++) {
      const r = splitWithRules(list, 'count', 4, rules);
      expect(r.ok).toBe(true);
      if (r.ok) {
        const where = (nm: string) => r.groups.findIndex((g) => g.includes(nm));
        expect(where('Ž1')).toBe(where('Ž2'));
        expect(where('Ž2')).toBe(where('Ž3'));
        expect(where('Ž5')).toBe(where('Ž6'));
        expect(where('Ž1')).not.toBe(where('Ž10'));
        expect(verifyPartition(list, r.groups)).toBe(true);
      }
    }
  });

  it('rozpozná rozpor (musia byť spolu aj nesmú byť spolu)', () => {
    const r = splitWithRules(N(10), 'count', 2, rulesOf([['Ž1', 'Ž3']], [['Ž1', 'Ž2'], ['Ž2', 'Ž3']]));
    expect(r).toMatchObject({ ok: false, reason: 'conflict' });
  });

  it('nemožné rozdelenie nahlási (trojica navzájom odmietajúcich sa pri dvoch skupinách)', () => {
    const r = splitWithRules(N(6), 'count', 2, rulesOf([['Ž1', 'Ž2'], ['Ž2', 'Ž3'], ['Ž1', 'Ž3']]));
    expect(r).toMatchObject({ ok: false, reason: 'impossible' });
  });

  it('keď sa presné vyváženie nedá, povolí väčšie skupiny a oznámi to', () => {
    // 7 žiakov, 3 skupiny (3+2+2); päť žiakov musí byť spolu → skupina o 5, nevyvážené
    const list = N(7);
    const r = splitWithRules(list, 'count', 3, rulesOf([], [['Ž1', 'Ž2'], ['Ž2', 'Ž3'], ['Ž3', 'Ž4'], ['Ž4', 'Ž5']]));
    if (r.ok) {
      expect(r.balanced).toBe(false);
      expect(verifyPartition(list, r.groups)).toBe(true);
    } else expect(r.reason).toBe('impossible');
  });

  it('pravidlá s menom, ktoré v zozname nie je, sa ignorujú a spočítajú', () => {
    const r = splitWithRules(N(8), 'count', 2, rulesOf([['Ž1', 'Cudzí']], [['Neznámy', 'Ž2']]));
    expect(r).toMatchObject({ ok: true, ignoredRules: 2 });
  });

  it('rovnaké mená: pravidlo platí pre všetkých s daným menom', () => {
    const list = ['Anna', 'Anna', 'Peter', 'Eva', 'Jakub', 'Mária'];
    for (let i = 0; i < 100; i++) {
      const r = splitWithRules(list, 'count', 2, rulesOf([['Anna', 'Peter']]));
      expect(r.ok).toBe(true);
      if (r.ok) expect(ruleViolations(r.groups, rulesOf([['Anna', 'Peter']])).size).toBe(0);
    }
  });

  it('ruleViolations a moveStudent: ručný presun zachová každého práve raz a odhalí porušenie', () => {
    const groups = [['A', 'B'], ['C', 'D']];
    const rules = rulesOf([['A', 'C']], [['B', 'D']]);
    expect([...ruleViolations(groups, rules)].sort()).toEqual(['B', 'D']);
    const moved = moveStudent(groups, 0, 1, 1); // B → skupina 2
    expect(moved).toEqual([['A'], ['C', 'D', 'B']]);
    expect(groups).toEqual([['A', 'B'], ['C', 'D']]); // vstup sa nemení
    expect([...ruleViolations(moved, rules)]).toEqual([]); // B už je s D
    const bad = moveStudent(groups, 0, 0, 1); // A → k C: porušuje „nesmú byť spolu“
    expect([...ruleViolations(bad, rules)].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(verifyPartition(['A', 'B', 'C', 'D'], moved)).toBe(true);
    expect(moveStudent(groups, 0, 5, 1)).toEqual(groups);
    expect(moveStudent(groups, 0, 0, 0)).toEqual(groups);
  });

  it('režim podľa veľkosti skupiny rešpektuje pravidlá', () => {
    const list = N(15);
    const rules = rulesOf([['Ž1', 'Ž2']]);
    for (let i = 0; i < 50; i++) {
      const r = splitWithRules(list, 'size', 4, rules);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.groups).toHaveLength(4);
        expect(ruleViolations(r.groups, rules).size).toBe(0);
      }
    }
  });
});

import { drawNumbers, remainingCount } from '@/lib/numbers';

describe('náhodné čísla', () => {
  it('čísla sú v rozsahu a pri „bez opakovania“ sa nikdy neopakujú, kým zostávajú voľné', () => {
    const drawn: number[] = [];
    for (let i = 0; i < 5; i++) drawn.push(...drawNumbers(1, 25, 5, drawn, true));
    expect(drawn).toHaveLength(25);
    expect(new Set(drawn).size).toBe(25);
    expect(Math.min(...drawn)).toBe(1);
    expect(Math.max(...drawn)).toBe(25);
    expect(drawNumbers(1, 25, 1, drawn, true)).toEqual([]);
    expect(remainingCount(1, 25, drawn)).toBe(0);
  });
  it('vráti menej čísel, ak ich zostáva menej, a nikdy duplicitu v jednom hode', () => {
    for (let i = 0; i < 200; i++) {
      const r = drawNumbers(1, 6, 10, [], true);
      expect(r).toHaveLength(6);
      expect(new Set(r).size).toBe(6);
    }
    expect(drawNumbers(1, 3, 5, [1, 2], true)).toEqual([3]);
  });
  it('povoľuje opakovanie, záporné čísla a prehodené hranice', () => {
    const r = drawNumbers(5, -5, 500, [], false);
    expect(r).toHaveLength(500);
    expect(r.every((x) => x >= -5 && x <= 5)).toBe(true);
    expect(new Set(r).size).toBeGreaterThan(5);
    expect(drawNumbers(7, 7, 3, [], false)).toEqual([7, 7, 7]);
  });
  it('rozdelenie je približne rovnomerné a veľký rozsah funguje', () => {
    const counts = new Array(10).fill(0) as number[];
    for (let i = 0; i < 20_000; i++) counts[drawNumbers(0, 9, 1)[0]!]!++;
    counts.forEach((c) => expect(c).toBeGreaterThan(1700));
    const big = drawNumbers(1, 100_000, 50, [], true);
    expect(new Set(big).size).toBe(50);
  });
});
