import { describe, expect, it } from 'vitest';
import { isFreeLicense, parsePhotoResponse, stripHtml } from '@/lib/photos';
import { sanitizeBackground } from '@/lib/schema';

const page = (title: string, over: Record<string, unknown> = {}, license = 'CC BY-SA 4.0', artist = '<a href="//x">Jana <b>Nováková</b></a>') => ({
  title,
  index: 1,
  imageinfo: [{ thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/T.jpg/480px-T.jpg', width: 4000, height: 2500, mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: license }, Artist: { value: artist } }, ...over }],
});

describe('fotky z Wikimedia Commons', () => {
  it('rozpozná iba voľné licencie bez NC/ND', () => {
    for (const ok of ['CC0', 'CC0 1.0', 'Public domain', 'PD-old', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 2.0 DE']) expect(isFreeLicense(ok), ok).toBe(true);
    for (const bad of ['CC BY-NC 4.0', 'CC BY-ND 2.0', 'CC BY-NC-SA 3.0', 'All rights reserved', 'Copyrighted free use', '']) expect(isFreeLicense(bad), bad).toBe(false);
  });
  it('vyčistí HTML v mene autora', () => {
    expect(stripHtml('<a href="//x">Jana <b>Nováková</b></a>')).toBe('Jana Nováková');
  });
  it('vyberie len vhodné fotky: voľná licencia, na šírku, dostatočné rozlíšenie, bezpečná adresa', () => {
    const r = parsePhotoResponse({
      query: {
        pages: [
          page('File:Dobra.jpg'),
          page('File:NC.jpg', {}, 'CC BY-NC 4.0'),
          page('File:Male.jpg', { width: 800, height: 500 }),
          page('File:Portret.jpg', { width: 2000, height: 3000 }),
          page('File:Panorama.jpg', { width: 9000, height: 1000 }),
          page('File:Pdf.pdf', { mime: 'application/pdf' }),
          page('File:Cudzi.jpg', { thumburl: 'https://evil.example/x.jpg' }),
          page('File:BezMeta.jpg', { extmetadata: {} }),
        ],
      },
      continue: { gsroffset: 40 },
    });
    expect(r.photos.map((p) => p.title)).toEqual(['File:Dobra.jpg']);
    expect(r.photos[0]).toMatchObject({ author: 'Jana Nováková', license: 'CC BY-SA 4.0' });
    expect(r.next).toBe(40);
  });
  it('prázdna odpoveď nevyhodí chybu', () => {
    expect(parsePhotoResponse({})).toEqual({ photos: [], next: null });
  });
  it('kredit pozadia sa pri importe očistí od značiek a skráti', () => {
    const bg = sanitizeBackground({ kind: 'image', value: 'data:image/png;base64,iVBORw0KGgo=', credit: '<script>x</script>' + 'a'.repeat(400) });
    expect(bg.kind).toBe('image');
    if (bg.kind === 'image') {
      expect(bg.credit).not.toMatch(/[<>]/);
      expect(bg.credit!.length).toBeLessThanOrEqual(200);
    }
  });
});
