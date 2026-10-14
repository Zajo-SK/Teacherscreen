/** Overenie a normalizácia URL pre widget Odkaz. Povolené sú výlučne http: a https:. */
export const URL_MAX = 500;

// eslint-disable-next-line no-control-regex
const FORBIDDEN = new RegExp('[\\x00-\\x20\\x7f-\\x9f\\u2028\\u2029\\u200b-\\u200f\\ufeff\\\\]');

export type UrlResult = { ok: true; url: string; host: string } | { ok: false; error: 'empty' | 'invalid' | 'too-long' };

export function normalizeUrl(input: string): UrlResult {
  const v = (typeof input === 'string' ? input : '').trim();
  if (!v) return { ok: false, error: 'empty' };
  if (v.length > URL_MAX) return { ok: false, error: 'too-long' };
  // Ovládacie znaky a medzery vo vnútri (napr. "java\nscript:") sa používajú na obfuskáciu schémy.
  if (FORBIDDEN.test(v)) return { ok: false, error: 'invalid' };
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(v);
  const hostPort = /^[^/?#:@]+:\d+(?:[/?#]|$)/.test(v); // example.org:8080/cesta
  let candidate = v;
  if (v.startsWith('//')) candidate = `https:${v}`;
  else if (!hasScheme || hostPort) candidate = `https://${v}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'invalid' };
    if (u.username || u.password) return { ok: false, error: 'invalid' };
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return { ok: false, error: 'invalid' };
    return { ok: true, url: u.toString(), host: u.hostname.replace(/^www\./, '') };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}
