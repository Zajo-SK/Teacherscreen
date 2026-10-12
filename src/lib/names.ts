/** Rozdelí vložený text na mená (nový riadok, čiarka, bodkočiarka, tabulátor). Prázdne položky vynechá. */
export function parseNames(text: string, max = 200): string[] {
  return text
    .split(/[\n\r,;\t]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, max);
}
