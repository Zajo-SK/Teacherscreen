/** Zoznam lokálne zmazaných záznamov, ktoré ešte treba odstrániť aj z cloudu (uložené len v tomto zariadení). */
export type TombKind = 'screens' | 'classes';
const key = (k: TombKind) => `ts.deleted.${k}`;

export function getTombstones(kind: TombKind): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key(kind)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function addTombstone(kind: TombKind, id: string): void {
  try {
    localStorage.setItem(key(kind), JSON.stringify(Array.from(new Set([...getTombstones(kind), id])).slice(-500)));
  } catch {
    /* ignorované */
  }
}
export function clearTombstones(kind: TombKind, ids?: string[]): void {
  try {
    const rest = ids ? getTombstones(kind).filter((x) => !ids.includes(x)) : [];
    localStorage.setItem(key(kind), JSON.stringify(rest));
  } catch {
    /* ignorované */
  }
}
