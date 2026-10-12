/** Čierna alebo biela podľa svetlosti pozadia (WCAG relatívna luminancia). Pre neznámy formát vráti undefined. */
export function contrastText(hex: string | undefined): string | undefined {
  if (!hex) return undefined;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})/i.exec(hex);
  if (!m) return undefined;
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return lum > 0.4 ? '#0f172a' : '#ffffff';
}
