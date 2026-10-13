import { describe, expect, it } from 'vitest';
import { BG_CATEGORIES, BG_PRESETS, bgPresetUrl, isBgPresetId } from '@/lib/backgrounds';
import { sanitizeBackground } from '@/lib/schema';
import { TEMPLATES } from '@/templates';
import { DEFAULT_BACKGROUND } from '@/types';

describe('knižnica pozadí', () => {
  it('obsahuje aspoň 30 predvolieb s jedinečnými ID a názvami vo všetkých kategóriách', () => {
    expect(BG_PRESETS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(BG_PRESETS.map((p) => p.id)).size).toBe(BG_PRESETS.length);
    expect(new Set(BG_PRESETS.map((p) => p.name)).size).toBe(BG_PRESETS.length);
    for (const c of BG_CATEGORIES) expect(BG_PRESETS.some((p) => p.category === c.id), c.id).toBe(true);
  });
  it('každá predvoľba je platné SVG bez skriptov a externých odkazov, a je malá', () => {
    for (const p of BG_PRESETS) {
      const svg = p.svg();
      expect(svg.startsWith('<svg'), p.id).toBe(true);
      expect(svg, p.id).not.toMatch(/<script|javascript:|href=|onload|<image|<foreignObject/i);
      expect(svg.length, p.id).toBeLessThan(60_000);
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(doc.querySelector('parsererror'), p.id).toBeNull();
      expect(bgPresetUrl(p.id)).toContain('data:image/svg+xml,');
    }
  });
  it('obrázky sú deterministické (rovnaké ID = rovnaký obrázok)', () => {
    for (const p of BG_PRESETS) expect(p.svg()).toBe(p.svg());
  });
  it('import prijme platné ID predvoľby a odmietne neznáme/škodlivé hodnoty', () => {
    expect(sanitizeBackground({ kind: 'preset', value: 'mesh-ocean' })).toEqual({ kind: 'preset', value: 'mesh-ocean' });
    expect(sanitizeBackground({ kind: 'preset', value: '"); alert(1); ("' })).toEqual(DEFAULT_BACKGROUND);
    expect(isBgPresetId('nie-je')).toBe(false);
    expect(bgPresetUrl('nie-je')).toBeNull();
  });
  it('šablóny používajú existujúce pozadia z knižnice', () => {
    for (const t of TEMPLATES) expect(t.background.kind === 'preset' && isBgPresetId(t.background.value), t.id).toBe(true);
  });
});
