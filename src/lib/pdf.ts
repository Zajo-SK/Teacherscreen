/** Pomocné funkcie pre widget PDF (bez závislosti na pdfjs – ten sa načíta až pri zobrazení). */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
/** Obmedzenie dĺžky dátovej URL: 5 MB v base64 ≈ 6,7 M znakov; obrazovka v cloude má limit 8 MB. */
export const MAX_PDF_DATA_URL = 7_000_000;
export const PDF_PREFIX = 'data:application/pdf;base64,';

export type PdfError = 'unsupported' | 'too-large' | 'empty' | 'read';

export class PdfFileError extends Error {
  constructor(public code: PdfError) {
    super(code);
  }
}

export function hasPdfMagic(bytes: Uint8Array): boolean {
  const m = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  return bytes.length >= m.length && m.every((b, i) => bytes[i] === b);
}

/** Overí veľkosť a magické bajty (prvých 1024 bajtov môže predchádzať smetie, ako dovoľuje špecifikácia – tu vyžadujeme začiatok). */
export function validatePdfBytes(bytes: Uint8Array): PdfError | null {
  if (bytes.length === 0) return 'empty';
  if (bytes.length > MAX_PDF_BYTES) return 'too-large';
  if (!hasPdfMagic(bytes)) return 'unsupported';
  return null;
}

export function isSafePdfDataUrl(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_PDF_DATA_URL && v.startsWith(PDF_PREFIX) && /^[A-Za-z0-9+/=]+$/.test(v.slice(PDF_PREFIX.length));
}

export function bytesToDataUrl(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return PDF_PREFIX + btoa(bin);
}

export function dataUrlToBytes(url: string): Uint8Array {
  const bin = atob(url.slice(PDF_PREFIX.length));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function clampPage(page: number, total: number): number {
  const n = Number.isFinite(page) ? Math.round(page) : 1;
  return Math.min(Math.max(1, total || 1), Math.max(1, n));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export async function readPdfFile(file: File): Promise<{ dataUrl: string; name: string; size: number }> {
  if (file.size > MAX_PDF_BYTES) throw new PdfFileError('too-large');
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new PdfFileError('read');
  }
  const err = validatePdfBytes(bytes);
  if (err) throw new PdfFileError(err);
  return { dataUrl: bytesToDataUrl(bytes), name: file.name.slice(0, 120), size: bytes.length };
}
