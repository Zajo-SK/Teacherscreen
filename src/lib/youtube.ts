/** Rozpoznanie odkazov na YouTube a zostavenie bezpečnej adresy na vloženie (bez cookies: youtube-nocookie.com). */
export type YtResult =
  | { ok: true; kind: 'video' | 'playlist'; id: string; start: number; embed: string; watch: string }
  | { ok: false; error: 'empty' | 'invalid' | 'too-long' };

const MAX = 300;
// eslint-disable-next-line no-control-regex
const FORBIDDEN = new RegExp('[\\x00-\\x20\\x7f-\\x9f\\u2028\\u2029\\u200b-\\u200f\\ufeff\\\\]');
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtube-nocookie.com', 'youtube-nocookie.com']);

/** "90", "1m30s", "1h2m3s" → sekundy (0 pri neplatnom vstupe, najviac 24 h). */
export function parseStart(raw: string | null): number {
  if (!raw) return 0;
  const v = raw.trim().toLowerCase();
  if (/^\d+$/.test(v)) return Math.min(86400, parseInt(v, 10));
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v);
  if (!m || (!m[1] && !m[2] && !m[3])) return 0;
  return Math.min(86400, (parseInt(m[1] ?? '0', 10) * 60 + parseInt(m[2] ?? '0', 10)) * 60 + parseInt(m[3] ?? '0', 10));
}

export function parseYouTube(input: string): YtResult {
  const v = (typeof input === 'string' ? input : '').trim();
  if (!v) return { ok: false, error: 'empty' };
  if (v.length > MAX) return { ok: false, error: 'too-long' };
  if (FORBIDDEN.test(v)) return { ok: false, error: 'invalid' };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : v.startsWith('//') ? `https:${v}` : `https://${v}`);
  } catch {
    return { ok: false, error: 'invalid' };
  }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || !HOSTS.has(u.hostname.toLowerCase())) return { ok: false, error: 'invalid' };
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);
  const start = parseStart(u.searchParams.get('t') ?? u.searchParams.get('start'));
  const list = u.searchParams.get('list');
  let id: string | null = null;
  if (host === 'youtu.be') id = parts[0] ?? null;
  else if (parts[0] === 'watch') id = u.searchParams.get('v');
  else if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'v') id = parts[1] ?? null;
  if (id && VIDEO_ID.test(id)) {
    const q = new URLSearchParams({ rel: '0', playsinline: '1' });
    if (start > 0) q.set('start', String(start));
    return { ok: true, kind: 'video', id, start, embed: `https://www.youtube-nocookie.com/embed/${id}?${q}`, watch: `https://www.youtube.com/watch?v=${id}` };
  }
  const plId = (parts[0] === 'playlist' || (parts[0] === 'embed' && parts[1] === 'videoseries') ? list : null) ?? null;
  if (plId && LIST_ID.test(plId)) {
    const q = new URLSearchParams({ list: plId, rel: '0', playsinline: '1' });
    return { ok: true, kind: 'playlist', id: plId, start: 0, embed: `https://www.youtube-nocookie.com/embed/videoseries?${q}`, watch: `https://www.youtube.com/playlist?list=${plId}` };
  }
  return { ok: false, error: 'invalid' };
}
