import QRCode from 'qrcode';

export type QrResult = { ok: true; size: number; dark: boolean[][]; value: string } | { ok: false; error: 'empty' | 'invalid-url' | 'too-long' };

export const QR_MAX = 800;

/** Normalizuje a overí vstup. V režime URL sa akceptuje len http(s). */
export function normalizeQrInput(raw: string, kind: 'url' | 'text'): { ok: true; value: string } | { ok: false; error: 'empty' | 'invalid-url' | 'too-long' } {
  const v = raw.trim();
  if (!v) return { ok: false, error: 'empty' };
  if (v.length > QR_MAX) return { ok: false, error: 'too-long' };
  if (kind === 'text') return { ok: true, value: v };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'invalid-url' };
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return { ok: false, error: 'invalid-url' };
    return { ok: true, value: u.toString() };
  } catch {
    return { ok: false, error: 'invalid-url' };
  }
}

export function buildQr(raw: string, kind: 'url' | 'text'): QrResult {
  const n = normalizeQrInput(raw, kind);
  if (!n.ok) return n;
  const qr = QRCode.create(n.value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const dark: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(!!qr.modules.get(r, c));
    dark.push(row);
  }
  return { ok: true, size, dark, value: n.value };
}
