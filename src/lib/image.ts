export const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export class ImageError extends Error {}

export interface LoadedImage {
  dataUrl: string;
  /** šírka / výška */
  ratio: number;
}

/** Overí, že reťazec je bezpečná dátová URL rastrového obrázka (bez SVG, kvôli skriptom). */
export function isSafeImageDataUrl(v: unknown, maxLen = 8_000_000): v is string {
  return typeof v === 'string' && v.length <= maxLen && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v);
}

/** Načíta obrázok zo súboru, zmenší na max. `maxSide` px a vráti dátovú URL. */
export async function loadImageFile(file: File, maxSide = 1600): Promise<LoadedImage> {
  if (!ALLOWED.includes(file.type)) throw new ImageError('unsupported');
  if (file.size > MAX_IMAGE_INPUT_BYTES) throw new ImageError('too-large');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new ImageError('decode'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('canvas');
    ctx.drawImage(img, 0, 0, w, h);
    const keepAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
    const dataUrl = canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.85);
    if (!isSafeImageDataUrl(dataUrl)) throw new ImageError('too-large');
    return { dataUrl, ratio: w / h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
