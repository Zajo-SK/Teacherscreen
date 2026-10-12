import { shuffle } from './random';

export type GroupMode = 'count' | 'size';

export interface GroupPlan {
  groupCount: number;
}

/** Určí počet skupín podľa režimu. Vždy 1 ≤ počet ≤ počet žiakov. */
export function planGroups(studentCount: number, mode: GroupMode, value: number): GroupPlan {
  if (studentCount <= 0) return { groupCount: 0 };
  const v = Math.max(1, Math.floor(value) || 1);
  const groupCount = mode === 'count' ? v : Math.ceil(studentCount / v);
  return { groupCount: Math.min(Math.max(1, groupCount), studentCount) };
}

/** Náhodne rozdelí mená do vyvážených skupín (veľkosti sa líšia najviac o 1). */
export function splitIntoGroups(names: readonly string[], mode: GroupMode, value: number): string[][] {
  const { groupCount } = planGroups(names.length, mode, value);
  if (groupCount === 0) return [];
  const shuffled = shuffle(names);
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((n, i) => groups[i % groupCount]!.push(n));
  return groups;
}

/** Overí, že každý vstupný záznam je vo výsledku presne raz (zohľadňuje aj rovnaké mená). */
export function verifyPartition(names: readonly string[], groups: readonly (readonly string[])[]): boolean {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  for (const g of groups) {
    for (const n of g) {
      const c = counts.get(n);
      if (!c) return false;
      counts.set(n, c - 1);
    }
  }
  for (const c of counts.values()) if (c !== 0) return false;
  return true;
}
