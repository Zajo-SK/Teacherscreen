/**
 * Knižnica pozadí: 36 originálnych ilustrácií generovaných v kóde (SVG). Sú voľne použiteľné bez licenčných
 * obmedzení, nesťahujú sa z internetu (fungujú offline), majú niekoľko kB a v dátach obrazovky nesú len ID.
 */
import { t, type TKey } from '@/i18n';

export type BgCategory = 'mesh' | 'waves' | 'shapes' | 'landscape' | 'patterns' | 'school';

export interface BgPreset {
  id: string;
  name: string;
  category: BgCategory;
  svg: () => string;
}

const W = 1600;
const H = 900;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const wrap = (inner: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${inner}</svg>`;
const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- farebné palety
const PAL: Record<string, string[]> = {
  sunrise: ['#ffe29f', '#ffa99f', '#ff719a', '#ffd3a5'],
  ocean: ['#a1c4fd', '#c2e9fb', '#4facfe', '#00f2fe'],
  mint: ['#d4fc79', '#96e6a1', '#43e97b', '#38f9d7'],
  grape: ['#e0c3fc', '#8ec5fc', '#a18cd1', '#fbc2eb'],
  candy: ['#ff9a9e', '#fecfef', '#a18cd1', '#fad0c4'],
  lemon: ['#fff1a8', '#ffd86f', '#fcb045', '#fd746c'],
  dusk: ['#667eea', '#764ba2', '#f093fb', '#f5576c'],
  aurora: ['#0f2027', '#2c5364', '#38ef7d', '#11998e'],
};

function mesh(name: string, seed: number, base: string): string {
  const p = PAL[name]!;
  const R = rng(seed);
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const c = p[i % p.length]!;
    return `<circle cx="${r1(R() * W)}" cy="${r1(R() * H)}" r="${r1(260 + R() * 260)}" fill="${c}" opacity="0.85"/>`;
  }).join('');
  return wrap(`<rect width="${W}" height="${H}" fill="${base}"/><g filter="url(#b)">${blobs}</g>`, `<filter id="b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="120"/></filter>`);
}

function waves(colors: string[], bg: string, seed: number): string {
  const R = rng(seed);
  const layers = colors
    .map((c, i) => {
      const y0 = H * (0.38 + i * (0.5 / colors.length));
      const amp = 40 + R() * 50;
      const ph = R() * 6;
      const f = 1.2 + R() * 1.4;
      let d = `M0 ${H} L0 ${r1(y0)}`;
      for (let x = 0; x <= W; x += 40) d += ` L${x} ${r1(y0 + Math.sin((x / W) * Math.PI * 2 * f + ph) * amp)}`;
      d += ` L${W} ${H} Z`;
      return `<path d="${d}" fill="${c}" opacity="${0.55 + i * 0.1}"/>`;
    })
    .join('');
  return wrap(`<rect width="${W}" height="${H}" fill="${bg}"/>${layers}`);
}

function bubbles(colors: string[], bg: string, seed: number, n = 38): string {
  const R = rng(seed);
  const items = Array.from({ length: n }, () => {
    const r = 20 + R() * R() * 150;
    return `<circle cx="${r1(R() * W)}" cy="${r1(R() * H)}" r="${r1(r)}" fill="${colors[Math.floor(R() * colors.length)]}" opacity="${r1(0.25 + R() * 0.5)}"/>`;
  }).join('');
  return wrap(`<rect width="${W}" height="${H}" fill="${bg}"/>${items}`);
}

function lowpoly(colors: string[], seed: number): string {
  const R = rng(seed);
  const cols = 10;
  const rows = 6;
  const cw = W / cols;
  const rh = H / rows;
  const pts: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    pts.push([]);
    for (let i = 0; i <= cols; i++) {
      const jitter = (v: number, edge: boolean) => (edge ? v : v + (R() - 0.5) * cw * 0.6);
      pts[j]!.push([jitter(i * cw, i === 0 || i === cols), jitter(j * rh, j === 0 || j === rows)]);
    }
  }
  let out = '';
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = pts[j]![i]!;
      const b = pts[j]![i + 1]!;
      const c = pts[j + 1]![i + 1]!;
      const d = pts[j + 1]![i]!;
      const f = () => colors[Math.floor(R() * colors.length)]!;
      const o = () => r1(0.55 + R() * 0.45);
      out += `<path d="M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}L${r1(c[0])} ${r1(c[1])}Z" fill="${f()}" opacity="${o()}"/>`;
      out += `<path d="M${r1(a[0])} ${r1(a[1])}L${r1(c[0])} ${r1(c[1])}L${r1(d[0])} ${r1(d[1])}Z" fill="${f()}" opacity="${o()}"/>`;
    }
  }
  return wrap(`<rect width="${W}" height="${H}" fill="${colors[0]}"/>${out}`);
}

function rings(colors: string[], bg: string, seed: number): string {
  const R = rng(seed);
  const items = Array.from({ length: 9 }, () => {
    const cx = R() * W;
    const cy = R() * H;
    const c = colors[Math.floor(R() * colors.length)]!;
    return Array.from({ length: 4 }, (_, k) => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${60 + k * 38}" fill="none" stroke="${c}" stroke-width="10" opacity="${r1(0.5 - k * 0.1)}"/>`).join('');
  }).join('');
  return wrap(`<rect width="${W}" height="${H}" fill="${bg}"/>${items}`);
}

function sky(top: string, bottom: string, sun: string | null, hills: string[], seed: number, sunY = 0.5): string {
  const R = rng(seed);
  const layers = hills
    .map((c, i) => {
      const y0 = H * (0.5 + i * 0.12);
      const amp = 50 + R() * 60;
      const ph = R() * 6;
      let d = `M0 ${H} L0 ${r1(y0)}`;
      for (let x = 0; x <= W; x += 40) d += ` L${x} ${r1(y0 + Math.sin((x / W) * Math.PI * (1.4 + i * 0.5) + ph) * amp)}`;
      return `<path d="${d} L${W} ${H} Z" fill="${c}"/>`;
    })
    .join('');
  const s = sun ? `<circle cx="${r1(W * (0.25 + R() * 0.5))}" cy="${r1(H * sunY)}" r="110" fill="${sun}" opacity="0.95"/>` : '';
  return wrap(`<rect width="${W}" height="${H}" fill="url(#g)"/>${s}${layers}`, `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`);
}

function mountains(top: string, bottom: string, cols: string[], seed: number): string {
  const R = rng(seed);
  const peaks = cols
    .map((c, i) => {
      const base = H * (0.62 + i * 0.1);
      let d = `M0 ${H} L0 ${r1(base)}`;
      let x = 0;
      while (x < W) {
        const w = 120 + R() * 160;
        d += ` L${r1(x + w / 2)} ${r1(base - 120 - R() * 220 + i * 40)} L${r1(x + w)} ${r1(base)}`;
        x += w;
      }
      return `<path d="${d} L${W} ${H} Z" fill="${c}"/>`;
    })
    .join('');
  return wrap(`<rect width="${W}" height="${H}" fill="url(#g)"/>${peaks}`, `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`);
}

function night(seed: number, top: string, bottom: string): string {
  const R = rng(seed);
  const stars = Array.from({ length: 110 }, () => `<circle cx="${r1(R() * W)}" cy="${r1(R() * H * 0.8)}" r="${r1(0.8 + R() * 2.2)}" fill="#fff" opacity="${r1(0.4 + R() * 0.6)}"/>`).join('');
  return wrap(
    `<rect width="${W}" height="${H}" fill="url(#g)"/>${stars}<circle cx="1250" cy="200" r="90" fill="#fff6d6"/><circle cx="1290" cy="180" r="84" fill="${top}" opacity="0.55"/><path d="M0 ${H} L0 760 Q400 680 800 770 T1600 740 L1600 ${H} Z" fill="#0b1026"/>`,
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`,
  );
}

function dots(fg: string, bg: string, size = 56, r = 6): string {
  return wrap(`<rect width="${W}" height="${H}" fill="${bg}"/><rect width="${W}" height="${H}" fill="url(#p)"/>`, `<pattern id="p" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${fg}"/></pattern>`);
}
function grid(line: string, bg: string, size = 50, w = 2): string {
  return wrap(`<rect width="${W}" height="${H}" fill="${bg}"/><rect width="${W}" height="${H}" fill="url(#p)"/>`, `<pattern id="p" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><path d="M${size} 0H0V${size}" fill="none" stroke="${line}" stroke-width="${w}"/></pattern>`);
}
function stripes(a: string, b: string, size = 60): string {
  return wrap(`<rect width="${W}" height="${H}" fill="${a}"/><rect width="${W}" height="${H}" fill="url(#p)"/>`, `<pattern id="p" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${size / 2}" height="${size}" fill="${b}"/></pattern>`);
}
function confetti(colors: string[], bg: string, seed: number): string {
  const R = rng(seed);
  const items = Array.from({ length: 90 }, () => {
    const x = r1(R() * W);
    const y = r1(R() * H);
    const c = colors[Math.floor(R() * colors.length)]!;
    const rot = Math.round(R() * 180);
    return R() > 0.5
      ? `<rect x="${x}" y="${y}" width="${r1(10 + R() * 16)}" height="${r1(10 + R() * 16)}" rx="3" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`
      : `<circle cx="${x}" cy="${y}" r="${r1(5 + R() * 9)}" fill="${c}"/>`;
  }).join('');
  return wrap(`<rect width="${W}" height="${H}" fill="${bg}"/>${items}`);
}

function chalkboard(): string {
  const R = rng(7);
  const smudges = Array.from({ length: 14 }, () => `<ellipse cx="${r1(R() * W)}" cy="${r1(R() * H)}" rx="${r1(120 + R() * 260)}" ry="${r1(30 + R() * 70)}" fill="#fff" opacity="${r1(0.025 + R() * 0.03)}" transform="rotate(${Math.round(R() * 40 - 20)} 800 450)"/>`).join('');
  return wrap(`<rect width="${W}" height="${H}" fill="#2f4a3f"/>${smudges}<rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="#8a6a45" stroke-width="22" rx="14"/>`);
}
function notebook(): string {
  return wrap(`<rect width="${W}" height="${H}" fill="#fffdf7"/><rect width="${W}" height="${H}" fill="url(#p)"/><line x1="130" y1="0" x2="130" y2="${H}" stroke="#ff8a8a" stroke-width="3"/>`, `<pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#bcd4f0" stroke-width="1.5"/></pattern>`);
}
function blueprint(): string {
  return wrap(`<rect width="${W}" height="${H}" fill="#1b4b8f"/><rect width="${W}" height="${H}" fill="url(#s)"/><rect width="${W}" height="${H}" fill="url(#p)"/>`, `<pattern id="s" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="1"/></pattern><pattern id="p" width="125" height="125" patternUnits="userSpaceOnUse"><path d="M125 0H0V125" fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="2"/></pattern>`);
}

const P = (id: string, _name: string, category: BgCategory, svg: () => string): BgPreset => ({
  id,
  get name() {
    return t(`bg.${id}` as TKey);
  },
  category,
  svg,
});

export const BG_PRESETS: readonly BgPreset[] = [
  P('mesh-sunrise', 'mesh-sunrise', 'mesh', () => mesh('sunrise', 11, '#fff4e0')),
  P('mesh-ocean', 'mesh-ocean', 'mesh', () => mesh('ocean', 12, '#e8f6ff')),
  P('mesh-mint', 'mesh-mint', 'mesh', () => mesh('mint', 13, '#effff2')),
  P('mesh-grape', 'mesh-grape', 'mesh', () => mesh('grape', 14, '#f5eeff')),
  P('mesh-candy', 'mesh-candy', 'mesh', () => mesh('candy', 15, '#fff0f6')),
  P('mesh-lemon', 'mesh-lemon', 'mesh', () => mesh('lemon', 16, '#fffbe6')),
  P('mesh-dusk', 'mesh-dusk', 'mesh', () => mesh('dusk', 17, '#2a2150')),
  P('mesh-aurora', 'mesh-aurora', 'mesh', () => mesh('aurora', 18, '#0b1c22')),
  P('waves-blue', 'waves-blue', 'waves', () => waves(['#cfe8ff', '#9ccaff', '#6aa9f5', '#3f83e0'], '#eef6ff', 21)),
  P('waves-pink', 'waves-pink', 'waves', () => waves(['#ffd6e7', '#ffb3d1', '#ff8cba', '#f55f9c'], '#fff2f7', 22)),
  P('waves-green', 'waves-green', 'waves', () => waves(['#d8f5e3', '#a9e8c1', '#6fd49c', '#35b77a'], '#f1fff6', 23)),
  P('waves-sunset', 'waves-sunset', 'waves', () => waves(['#ffe0a3', '#ffb86b', '#ff8a5c', '#e5566d'], '#fff3d6', 24)),
  P('waves-violet', 'waves-violet', 'waves', () => waves(['#e6dcff', '#c8b6ff', '#a68bf5', '#7b5ce0'], '#f6f1ff', 25)),
  P('waves-night', 'waves-night', 'waves', () => waves(['#2b3a67', '#3a4f8f', '#4c68b8', '#6f8ee0'], '#161b3a', 26)),
  P('bubbles-pastel', 'bubbles-pastel', 'shapes', () => bubbles(['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'], '#fffdf8', 31)),
  P('bubbles-ocean', 'bubbles-ocean', 'shapes', () => bubbles(['#7fd1ff', '#5aa9ff', '#a5f3fc', '#c4b5fd'], '#0e2a5c', 32)),
  P('rings-fun', 'rings-fun', 'shapes', () => rings(['#ff6b6b', '#ffc233', '#2ec4a6', '#6c5ce7', '#4cc9f0'], '#fffaf0', 33)),
  P('lowpoly-sky', 'lowpoly-sky', 'shapes', () => lowpoly(['#4facfe', '#6fc3ff', '#a1dcff', '#d5f0ff'], 34)),
  P('lowpoly-fire', 'lowpoly-fire', 'shapes', () => lowpoly(['#ff9a76', '#ffb88c', '#ff6f91', '#ffd3a5'], 35)),
  P('lowpoly-forest', 'lowpoly-forest', 'shapes', () => lowpoly(['#2d6a4f', '#40916c', '#74c69d', '#b7e4c7'], 36)),
  P('land-sunset', 'land-sunset', 'landscape', () => sky('#ff9a8b', '#ffe3a3', '#fff3c4', ['#e86a6a', '#c0476a', '#7a3567'], 41, 0.52)),
  P('land-meadow', 'land-meadow', 'landscape', () => sky('#8ed1fc', '#e4f6ff', '#fff59d', ['#9be07a', '#66c26a', '#3f9d57'], 42, 0.3)),
  P('land-mountains', 'land-mountains', 'landscape', () => mountains('#a8d8ff', '#f4fbff', ['#9db7d6', '#6f8fb8', '#44628f'], 43)),
  P('land-desert', 'land-desert', 'landscape', () => sky('#ffd9a0', '#fff1d6', '#ffb347', ['#f2b66d', '#dd9a4f', '#b9783a'], 44, 0.4)),
  P('land-night', 'land-night', 'landscape', () => night(45, '#0b1026', '#2b2a6b')),
  P('land-sea', 'land-sea', 'landscape', () => sky('#7ad7f0', '#d9f7ff', '#fff3a8', ['#4cc3e6', '#2a9fd0', '#1b6fa8'], 46, 0.35)),
  P('pat-dots', 'pat-dots', 'patterns', () => dots('#ffb3c6', '#fff5f8')),
  P('pat-stripes', 'pat-stripes', 'patterns', () => stripes('#e7f0ff', '#d3e3ff')),
  P('pat-confetti', 'pat-confetti', 'patterns', () => confetti(['#ff6b6b', '#ffc233', '#2ec4a6', '#6c5ce7', '#4cc9f0'], '#fffdf7', 51)),
  P('pat-grid', 'pat-grid', 'patterns', () => grid('#d9d4f2', '#f7f5ff', 60, 2)),
  P('school-chalk', 'school-chalk', 'school', chalkboard),
  P('school-notebook', 'school-notebook', 'school', notebook),
  P('school-blueprint', 'school-blueprint', 'school', blueprint),
  P('school-dots', 'school-dots', 'school', () => dots('#c9c3e8', '#fffefb', 40, 3)),
];

const BY_ID = new Map(BG_PRESETS.map((p) => [p.id, p]));

export const BG_CATEGORIES: { id: BgCategory; label: string }[] = [
  { id: 'mesh', get label() { return t('bg.cat.mesh'); } },
  { id: 'waves', get label() { return t('bg.cat.waves'); } },
  { id: 'shapes', get label() { return t('bg.cat.shapes'); } },
  { id: 'landscape', get label() { return t('bg.cat.landscape'); } },
  { id: 'patterns', get label() { return t('bg.cat.patterns'); } },
  { id: 'school', get label() { return t('bg.cat.school'); } },
];

export function isBgPresetId(v: unknown): v is string {
  return typeof v === 'string' && BY_ID.has(v);
}

const cache = new Map<string, string>();
/** CSS hodnota `url("data:image/svg+xml,…")` pre dané ID predvoľby. */
export function bgPresetUrl(id: string): string | null {
  const p = BY_ID.get(id);
  if (!p) return null;
  let u = cache.get(id);
  if (!u) {
    u = `url("data:image/svg+xml,${encodeURIComponent(p.svg())}")`;
    cache.set(id, u);
  }
  return u;
}
