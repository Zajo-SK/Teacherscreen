/**
 * Fotky z internetu cez Wikimedia Commons (bez kľúča, s povoleným CORS). Zobrazujú sa iba vybrané („Featured pictures“)
 * obrázky s voľnou licenciou (CC0, verejná doména, CC BY, CC BY‑SA – bez NC/ND). Vybraná fotka sa zmenší a uloží
 * priamo do obrazovky, takže po výbere funguje aj bez internetu. Pri CC BY(-SA) sa uvádza autor (kredit).
 */
const API = 'https://commons.wikimedia.org/w/api.php';

export const PHOTO_TOPICS: { id: string; label: string; query: string }[] = [
  { id: 'landscape', label: 'Krajina', query: 'landscape' },
  { id: 'mountain', label: 'Hory', query: 'mountain' },
  { id: 'sea', label: 'More', query: 'sea beach' },
  { id: 'forest', label: 'Les', query: 'forest' },
  { id: 'sunset', label: 'Západ slnka', query: 'sunset' },
  { id: 'sky', label: 'Obloha', query: 'sky clouds' },
  { id: 'flowers', label: 'Kvety', query: 'flowers meadow' },
  { id: 'autumn', label: 'Jeseň', query: 'autumn' },
  { id: 'snow', label: 'Zima', query: 'snow winter' },
  { id: 'city', label: 'Mesto', query: 'city skyline' },
  { id: 'space', label: 'Vesmír', query: 'galaxy nebula' },
  { id: 'animals', label: 'Zvieratá', query: 'wildlife' },
];

export interface Photo {
  title: string;
  thumb: string;
  width: number;
  height: number;
  license: string;
  author: string;
}

export interface PhotoStats {
  /** Počet súborov vrátených serverom a dôvody vyradenia – pomáha pri diagnostike. */
  total: number;
  noInfo: number;
  mime: number;
  size: number;
  ratio: number;
  license: number;
  url: number;
  sampleLicenses: string[];
}

export interface PhotoPage {
  photos: Photo[];
  next: number | null;
  stats: PhotoStats;
}

const ALLOWED_LICENSE = /^(cc0|cc[- ]zero|public domain|pd\b|cc[- ]by(?![- ](nc|nd))(?:[- ]sa)?(?:[- ][\d.]+)?)/i;
const BLOCKED = /\b(nc|nd)\b/i;

export function isFreeLicense(license: string): boolean {
  const l = license.trim();
  return ALLOWED_LICENSE.test(l) && !BLOCKED.test(l);
}

export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

interface ApiPage {
  title: string;
  index?: number;
  imageinfo?: { thumburl?: string; url?: string; width?: number; height?: number; mime?: string; extmetadata?: Record<string, { value?: string }> }[];
}
interface ApiResponse {
  query?: { pages?: ApiPage[] };
  continue?: { gsroffset?: number };
}

/** Prevedie odpoveď API na zoznam vhodných fotiek (voľná licencia, na šírku, dostatočné rozlíšenie). Testované samostatne. */
export function parsePhotoResponse(data: ApiResponse): PhotoPage {
  const pages = (data.query?.pages ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const photos: Photo[] = [];
  const stats: PhotoStats = { total: pages.length, noInfo: 0, mime: 0, size: 0, ratio: 0, license: 0, url: 0, sampleLicenses: [] };
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info?.thumburl || !info.width || !info.height) {
      stats.noInfo++;
      continue;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(info.mime ?? '')) {
      stats.mime++;
      continue;
    }
    if (info.width < 1280) {
      stats.size++;
      continue;
    }
    const ratio = info.width / info.height;
    if (ratio < 1.15 || ratio > 3) {
      stats.ratio++;
      continue;
    }
    const license = (info.extmetadata?.LicenseShortName?.value ?? '').trim();
    if (stats.sampleLicenses.length < 5) stats.sampleLicenses.push(license || '∅');
    if (!isFreeLicense(license)) {
      stats.license++;
      continue;
    }
    if (!/^https:\/\/upload\.wikimedia\.org\//.test(info.thumburl)) {
      stats.url++;
      continue;
    }
    const author = stripHtml(info.extmetadata?.Artist?.value ?? '').slice(0, 80) || 'Wikimedia Commons';
    photos.push({ title: p.title, thumb: info.thumburl, width: info.width, height: info.height, license: license.slice(0, 40), author });
  }
  return { photos, next: data.continue?.gsroffset ?? null, stats };
}

const base = (extra: Record<string, string>) => new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...extra });

export async function searchPhotos(query: string, offset = 0, signal?: AbortSignal): Promise<PhotoPage> {
  const params = base({
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `incategory:"Featured pictures on Wikimedia Commons" filetype:bitmap ${query}`,
    gsrlimit: '40',
    gsroffset: String(offset),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '480',
    iiextmetadatafilter: 'LicenseShortName|Artist',
  });
  const res = await fetch(`${API}?${params}`, { signal });
  if (!res.ok) throw new Error(`http-${res.status}`);
  return parsePhotoResponse((await res.json()) as ApiResponse);
}

async function fullUrl(title: string, signal?: AbortSignal): Promise<string> {
  const params = base({ titles: title, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '1920' });
  const res = await fetch(`${API}?${params}`, { signal });
  if (!res.ok) throw new Error(`http-${res.status}`);
  const data = (await res.json()) as ApiResponse;
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  const url = info?.thumburl ?? info?.url;
  if (!url || !/^https:\/\/upload\.wikimedia\.org\//.test(url)) throw new Error('no-url');
  return url;
}

/** Dekóduje obrázok: najprv createImageBitmap, pri zlyhaní (starší prehliadač) cez <img>. */
async function decode(blob: Blob): Promise<{ image: CanvasImageSource; width: number; height: number; release: () => void }> {
  try {
    const bmp = await createImageBitmap(blob);
    return { image: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close?.() };
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('decode'));
        i.src = url;
      });
      return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }
}

/** Stiahne fotku, zmenší na max. 1920 px a vráti dátovú URL (JPEG) + kredit pre zobrazenie autora. */
export async function importPhoto(photo: Photo, signal?: AbortSignal): Promise<{ dataUrl: string; credit: string }> {
  const url = await fullUrl(photo.title, signal);
  const res = await fetch(url, { mode: 'cors', signal });
  if (!res.ok) throw new Error(`http-${res.status}`);
  const blob = await res.blob();
  const src = await decode(blob);
  const scale = Math.min(1, 1920 / Math.max(src.width, src.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(src.width * scale));
  canvas.height = Math.max(1, Math.round(src.height * scale));
  canvas.getContext('2d')!.drawImage(src.image, 0, 0, canvas.width, canvas.height);
  src.release();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { dataUrl, credit: `${photo.author} · ${photo.license} · Wikimedia Commons` };
}
