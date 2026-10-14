import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { bytesToDataUrl, clampPage, dataUrlToBytes, formatBytes, hasPdfMagic, isSafePdfDataUrl, MAX_PDF_BYTES, validatePdfBytes } from '@/lib/pdf';
import { WidgetHarness } from './harness';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.reject(new Error('encrypted')), destroy: () => Promise.resolve() }),
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker.mjs' }));

const MIN_PDF =
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF';
const bytes = new TextEncoder().encode(MIN_PDF);

describe('pdf helpers', () => {
  it('overí magické bajty a veľkosť', () => {
    expect(hasPdfMagic(bytes)).toBe(true);
    expect(validatePdfBytes(bytes)).toBeNull();
    expect(validatePdfBytes(new TextEncoder().encode('<html>'))).toBe('unsupported');
    expect(validatePdfBytes(new Uint8Array())).toBe('empty');
    const big = new Uint8Array(MAX_PDF_BYTES + 1);
    big.set(bytes);
    expect(validatePdfBytes(big)).toBe('too-large');
  });
  it('dátová URL sa obojsmerne prevedie a overí', () => {
    const url = bytesToDataUrl(bytes);
    expect(isSafePdfDataUrl(url)).toBe(true);
    expect(Array.from(dataUrlToBytes(url))).toEqual(Array.from(bytes));
    expect(isSafePdfDataUrl('data:text/html;base64,AAAA')).toBe(false);
    expect(isSafePdfDataUrl('data:application/pdf;base64,<script>')).toBe(false);
  });
  it('orezáva stránku', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(NaN, 5)).toBe(1);
    expect(clampPage(2, 0)).toBe(1);
  });
  it('formátuje veľkosť', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 kB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3,0 MB');
  });
});

describe('pdf widget', () => {
  it('prázdny stav vyzve na výber súboru', () => {
    render(<WidgetHarness type="pdf" />);
    expect(screen.getByText('Vyberte súbor PDF v nastaveniach widgetu.')).toBeTruthy();
  });
  it('poškodený alebo zaheslovaný PDF ukáže chybu a nespadne', async () => {
    render(<WidgetHarness type="pdf" config={{ src: bytesToDataUrl(bytes), name: 'a.pdf', size: bytes.length }} />);
    expect((await screen.findByRole('alert')).textContent).toContain('PDF sa nepodarilo otvoriť');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });
  it('neplatná src sa pri načítaní zahodí', () => {
    render(<WidgetHarness type="pdf" config={{ src: 'data:text/html;base64,AAAA' }} />);
    expect(screen.getByText('Vyberte súbor PDF v nastaveniach widgetu.')).toBeTruthy();
  });
});
