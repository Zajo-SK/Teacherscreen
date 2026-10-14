import type { GroupRules } from '@/types';
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

// ---------------------------------------------------------------- pravidlá pre rozdeľovanie

export type { GroupRules };

export const emptyRules = (): GroupRules => ({ apart: [], together: [] });

export type SplitResult =
  | { ok: true; groups: string[][]; /** false, ak kvôli pravidlám nie sú skupiny rovnako veľké */ balanced: boolean; /** počet pravidiel s menom, ktoré v zozname nie je */ ignoredRules: number }
  | { ok: false; reason: 'conflict' | 'impossible'; detail?: string };

class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]!]!;
      x = this.parent[x]!;
    }
    return x;
  }
  union(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b);
  }
}

/**
 * Náhodné rozdelenie s pravidlami. Najprv sa hľadá presne vyvážené rozdelenie (veľkosti sa líšia najviac o 1),
 * ak neexistuje, povolia sa väčšie skupiny (balanced = false). Ak pravidlá nemožno splniť, vráti dôvod.
 */
export function splitWithRules(names: readonly string[], mode: GroupMode, value: number, rules: GroupRules): SplitResult {
  const n = names.length;
  const { groupCount: g } = planGroups(n, mode, value);
  if (g === 0) return { ok: true, groups: [], balanced: true, ignoredRules: 0 };

  const byName = new Map<string, number[]>();
  names.forEach((nm, i) => byName.set(nm, [...(byName.get(nm) ?? []), i]));
  let ignored = 0;
  const known = (p: [string, string]) => {
    const ok = byName.has(p[0]) && byName.has(p[1]) && p[0] !== p[1];
    if (!ok) ignored++;
    return ok;
  };
  const together = rules.together.filter(known);
  const apart = rules.apart.filter(known);

  const dsu = new DSU(n);
  for (const [a, b] of together) for (const i of byName.get(a)!) for (const j of byName.get(b)!) dsu.union(i, j);
  const members = new Map<number, number[]>();
  for (let i = 0; i < n; i++) members.set(dsu.find(i), [...(members.get(dsu.find(i)) ?? []), i]);
  const roots = [...members.keys()];
  const edges = new Map<number, Set<number>>(roots.map((r) => [r, new Set()]));
  for (const [a, b] of apart) {
    for (const i of byName.get(a)!) {
      for (const j of byName.get(b)!) {
        const ri = dsu.find(i);
        const rj = dsu.find(j);
        if (ri === rj) return { ok: false, reason: 'conflict', detail: `${a} / ${b}` };
        edges.get(ri)!.add(rj);
        edges.get(rj)!.add(ri);
      }
    }
  }

  const base = Math.floor(n / g);
  const extra = n % g;
  const capProfiles: { caps: number[]; balanced: boolean }[] = [
    { caps: Array.from({ length: g }, (_, k) => (k < extra ? base + 1 : base)), balanced: true },
    { caps: Array.from({ length: g }, () => Math.ceil(n / g)), balanced: false },
    { caps: Array.from({ length: g }, () => Math.ceil(n / g) + 1), balanced: false },
  ];

  for (const prof of capProfiles) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const order = shuffle(roots).sort((a, b) => members.get(b)!.length - members.get(a)!.length);
      const load = new Array<number>(g).fill(0);
      const placed: number[][] = Array.from({ length: g }, () => []); // koreňové zhluky v skupine
      let budget = 20_000;
      const place = (k: number): boolean => {
        if (k === order.length) return true;
        if (budget-- <= 0) return false;
        const r = order[k]!;
        const size = members.get(r)!.length;
        const tried = new Set<string>();
        for (const gi of shuffle(Array.from({ length: g }, (_, x) => x))) {
          if (load[gi]! + size > prof.caps[gi]!) continue;
          if (placed[gi]!.some((o) => edges.get(r)!.has(o))) continue;
          const key = `${load[gi]}|${prof.caps[gi]}|${placed[gi]!.length === 0}`;
          if (placed[gi]!.length === 0 && tried.has(key)) continue; // prázdne rovnocenné skupiny sú zameniteľné
          tried.add(key);
          load[gi]! += size;
          placed[gi]!.push(r);
          if (place(k + 1)) return true;
          load[gi]! -= size;
          placed[gi]!.pop();
        }
        return false;
      };
      if (place(0)) {
        const groups = placed.map((rs) => shuffle(rs.flatMap((r) => members.get(r)!)).map((i) => names[i]!));
        if (groups.some((x) => x.length === 0)) continue; // prázdna skupina nemá zmysel
        return { ok: true, groups, balanced: prof.balanced, ignoredRules: ignored };
      }
    }
  }
  return { ok: false, reason: 'impossible' };
}

/** Mená žiakov, ktorí v danom rozdelení porušujú niektoré pravidlo (po ručnom presune). */
export function ruleViolations(groups: readonly (readonly string[])[], rules: GroupRules): Set<string> {
  const where = new Map<string, number[]>();
  groups.forEach((g, gi) => g.forEach((nm) => where.set(nm, [...(where.get(nm) ?? []), gi])));
  const bad = new Set<string>();
  for (const [a, b] of rules.apart) {
    const wa = where.get(a);
    const wb = where.get(b);
    if (!wa || !wb || a === b) continue;
    if (wa.some((x) => wb.includes(x))) {
      bad.add(a);
      bad.add(b);
    }
  }
  for (const [a, b] of rules.together) {
    const wa = where.get(a);
    const wb = where.get(b);
    if (!wa || !wb || a === b) continue;
    if (!wa.some((x) => wb.includes(x))) {
      bad.add(a);
      bad.add(b);
    }
  }
  return bad;
}

/** Presunie jedného žiaka (podľa pozície) do inej skupiny. Nemení vstup. */
export function moveStudent(groups: readonly (readonly string[])[], from: number, index: number, to: number): string[][] {
  const out = groups.map((g) => g.slice());
  if (from === to || !out[from] || !out[to] || index < 0 || index >= out[from]!.length) return out;
  const [nm] = out[from]!.splice(index, 1);
  out[to]!.push(nm!);
  return out;
}
