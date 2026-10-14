/**
 * Jednorazová „neprítomnosť“ žiakov: zoznam kľúčov žiakov, ktorí sa pri losovaní a delení preskočia.
 * Kľúč je meno; pri opakovanom mene (dvaja žiaci „Anna“) má druhý výskyt kľúč „Anna␟2“ atď., takže sa dá
 * vypnúť každý zvlášť.
 */
const SEP = '␟';

/** Kľúč žiaka na pozícii `index` (podľa poradia výskytu jeho mena). */
export function studentKey(names: readonly string[], index: number): string {
  const name = names[index] ?? '';
  const rank = names.slice(0, index).filter((n) => n === name).length;
  return rank === 0 ? name : `${name}${SEP}${rank + 1}`;
}

/** Mená bez neprítomných (zachováva poradie). */
export function activeNames(names: readonly string[], absent: readonly string[]): string[] {
  if (absent.length === 0) return names.slice();
  const off = new Set(absent);
  return names.filter((_, i) => !off.has(studentKey(names, i)));
}

export const isRowAbsent = (names: readonly string[], absent: readonly string[], index: number): boolean => index < names.length && absent.includes(studentKey(names, index));

/** Prepne prítomnosť riadku a vráti nový zoznam neprítomných. */
export function toggleRow(names: readonly string[], absent: readonly string[], index: number): string[] {
  if (index < 0 || index >= names.length) return absent.slice();
  const key = studentKey(names, index);
  return absent.includes(key) ? absent.filter((k) => k !== key) : [...absent, key];
}

/** Ponechá len kľúče, ktoré zodpovedajú žiakom v aktuálnom zozname (po úprave zoznamu). */
export function normalizeAbsent(names: readonly string[], absent: readonly string[]): string[] {
  const valid = new Set(names.map((_, i) => studentKey(names, i)));
  return Array.from(new Set(absent.filter((k) => valid.has(k))));
}
