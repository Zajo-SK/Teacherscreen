import { describe, expect, it } from 'vitest';
import { buildExport, ImportError, parseImport, sanitizeBackground, sanitizeScreen, stripStudentData } from '@/lib/schema';
import { buildScreen, screenFromTemplate, TEMPLATES } from '@/templates';
import { createWidget, widgetDefinitions } from '@/widgets/registry';
import { DEFAULT_BACKGROUND, SCHEMA_VERSION } from '@/types';
import { isSafeImageDataUrl } from '@/lib/image';
import { normalizeQrInput, buildQr } from '@/lib/qr';

describe('šablóny', () => {
  it('existuje 10 šablón s reálne nakonfigurovanými widgetmi', () => {
    expect(TEMPLATES).toHaveLength(10);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(10);
    for (const t of TEMPLATES) {
      const widgets = t.build();
      expect(widgets.length, t.name).toBeGreaterThanOrEqual(4);
      expect(new Set(widgets.map((w) => w.type)).size, t.name).toBeGreaterThanOrEqual(3);
    }
  });
  it('každá šablóna prejde validáciou bez straty widgetov a bez presahov mimo plochu', () => {
    for (const t of TEMPLATES) {
      const screen = screenFromTemplate(t);
      const { screen: clean, skippedWidgets } = sanitizeScreen(JSON.parse(JSON.stringify(screen)), { keepId: true });
      expect(skippedWidgets, t.name).toBe(0);
      expect(clean.widgets, t.name).toHaveLength(screen.widgets.length);
      clean.widgets.forEach((w, i) => {
        const o = ops(screen.widgets, w.id);
        expect({ x: w.x, y: w.y, w: w.w, h: w.h }, `${t.name} #${i}`).toEqual({ x: o.x, y: o.y, w: o.w, h: o.h });
      });
    }
  });
  it('widgety v šablónach majú obsah (nie len predvolené hodnoty)', () => {
    const screen = screenFromTemplate(TEMPLATES.find((t) => t.id === 'group-work')!);
    const groups = screen.widgets.find((w) => w.type === 'groups')!;
    expect((groups.config as { names: string[] }).names.length).toBeGreaterThan(5);
  });
});
const ops = (ws: { id: string; x: number; y: number; w: number; h: number }[], id: string) => ws.find((w) => w.id === id)!;

describe('register widgetov', () => {
  it('obsahuje všetkých 27 widgetov a každý má platné predvolené nastavenia', () => {
    expect(widgetDefinitions).toHaveLength(27);
    for (const d of widgetDefinitions) {
      const w = createWidget(d.type);
      expect(w.config, d.type).toBeTruthy();
      expect(d.defaultSize.w).toBeGreaterThanOrEqual(d.minSize.w);
      expect(d.defaultSize.h).toBeGreaterThanOrEqual(d.minSize.h);
    }
  });
  it('poškodená konfigurácia sa opraví namiesto zlyhania', () => {
    const w = createWidget('timer', { config: { durationMs: 'abc', status: 'hocičo', endsAt: 'x' } });
    expect(w.config).toMatchObject({ durationMs: 300_000, status: 'idle', endsAt: null });
    const s = createWidget('scoreboard', { config: { teams: 'nie', teamCount: 99 } });
    expect((s.config as { teamCount: number }).teamCount).toBe(4);
  });
});

describe('import a validácia', () => {
  const good = () => screenFromTemplate(TEMPLATES[0]!);

  it('export → import vráti rovnakú obrazovku (okrem nového ID)', () => {
    const s = good();
    const file = JSON.stringify(buildExport([s], { kind: 'screen', includeStudents: true }));
    const parsed = parseImport(file);
    expect(parsed.screens).toHaveLength(1);
    const back = parsed.screens[0]!;
    expect(back.id).not.toBe(s.id);
    expect(back.name).toBe(s.name);
    expect(back.widgets).toEqual(s.widgets);
    expect(back.background).toEqual(s.background);
    expect(back.schemaVersion).toBe(SCHEMA_VERSION);
  });
  it('odmietne neplatný JSON, cudzí formát a prázdny súbor', () => {
    expect(() => parseImport('{nie json')).toThrow(ImportError);
    expect(() => parseImport('[1,2,3]')).toThrow(/formát/i);
    expect(() => parseImport(JSON.stringify({ app: 'iný', screens: [] }))).toThrow(ImportError);
    expect(() => parseImport(JSON.stringify({ app: 'teacherscreen', formatVersion: 1, screens: [] }))).toThrow(/neobsahuje/);
    try {
      parseImport('xx');
    } catch (e) {
      expect((e as ImportError).code).toBe('json');
    }
  });
  it('odmietne súbor z novšej verzie formátu', () => {
    const f = { app: 'teacherscreen', formatVersion: SCHEMA_VERSION + 1, screens: [good()] };
    expect(() => parseImport(JSON.stringify(f))).toThrow(/novšej/);
    const s = { ...good(), schemaVersion: SCHEMA_VERSION + 5 };
    expect(() => parseImport(JSON.stringify({ app: 'teacherscreen', formatVersion: 1, screens: [s] }))).toThrow(ImportError);
  });
  it('preskočí neznáme widgety a poškodené obrazovky, zvyšok importuje', () => {
    const s = JSON.parse(JSON.stringify(good()));
    s.widgets.push({ type: 'spusti-skript', x: 1, y: 1, w: 100, h: 100, config: { code: 'alert(1)' } }, 42, null);
    const parsed = parseImport(JSON.stringify({ app: 'teacherscreen', formatVersion: 1, screens: [s, 'zle', { widgets: 5 }] }));
    expect(parsed.skippedWidgets).toBe(3);
    expect(parsed.screens.length).toBeGreaterThanOrEqual(1);
    expect(parsed.screens[0]!.widgets.every((w) => w.type !== ('spusti-skript' as never))).toBe(true);
  });
  it('opraví súradnice mimo plochu, NaN, duplicitné ID a nesprávne typy', () => {
    const raw = {
      name: 'x'.repeat(500),
      aspect: 'nezmysel',
      widgets: [
        { id: 'a', type: 'text', x: -999, y: 1e9, w: 99999, h: -5, z: 'x', config: null },
        { id: 'a', type: 'clock', x: NaN, y: 'nie', w: 300, h: 150, config: { showSeconds: 'áno' } },
      ],
    };
    const { screen } = sanitizeScreen(raw);
    expect(screen.name).toHaveLength(120);
    expect(screen.aspect).toBe('16:9');
    const [a, b] = screen.widgets;
    expect(a!.x).toBeGreaterThanOrEqual(0);
    expect(a!.x + a!.w).toBeLessThanOrEqual(1920);
    expect(a!.y + a!.h).toBeLessThanOrEqual(1080);
    expect(new Set([a!.id, b!.id]).size).toBe(2);
    expect((b!.config as { showSeconds: boolean }).showSeconds).toBe(false);
  });
  it('pozadie nepustí url(), skripty ani cudzie dátové URL', () => {
    expect(sanitizeBackground({ kind: 'gradient', value: 'linear-gradient(red, url(https://evil.example/x.png))' })).toEqual(DEFAULT_BACKGROUND);
    expect(sanitizeBackground({ kind: 'gradient', value: 'linear-gradient(red, url(https://evil.example/x.png))' }).value).not.toContain('evil');
    expect(sanitizeBackground({ kind: 'color', value: 'red; background:url(x)' }).kind).not.toBe('color');
    expect(sanitizeBackground({ kind: 'image', value: 'https://evil.example/a.png' }).kind).not.toBe('image');
    expect(sanitizeBackground({ kind: 'image', value: 'data:image/svg+xml;base64,PHN2Zz4=' }).kind).not.toBe('image');
    expect(sanitizeBackground({ kind: 'color', value: '#aabbcc' })).toEqual({ kind: 'color', value: '#aabbcc' });
  });
  it('dátové URL obrázkov: len PNG/JPEG/WebP/GIF v base64', () => {
    expect(isSafeImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSafeImageDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isSafeImageDataUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageDataUrl('data:image/png;base64,AAA" onerror="x')).toBe(false);
    const w = createWidget('image', { config: { src: 'javascript:alert(1)' } });
    expect((w.config as { src: string }).src).toBe('');
  });
  it('export bez žiakov odstráni mená, export s nimi ich zachová', () => {
    const s = screenFromTemplate(TEMPLATES.find((t) => t.id === 'group-work')!);
    const stripped = stripStudentData(s);
    for (const w of stripped.widgets) {
      if (w.type === 'groups' || w.type === 'picker') expect((w.config as { names: string[] }).names).toEqual([]);
    }
    const withNames = buildExport([s], { kind: 'screen', includeStudents: true }).screens[0] as typeof s;
    expect((withNames.widgets.find((w) => w.type === 'groups')!.config as { names: string[] }).names.length).toBeGreaterThan(0);
    const without = buildExport([s], { kind: 'screen', includeStudents: false }).screens[0] as typeof s;
    expect(JSON.stringify(without)).not.toContain('Katarína');
  });
  it('premapuje zostavy pri importe zálohy', () => {
    const a = { ...buildScreen({ name: 'A' }), deckId: 'd1' };
    const file = { app: 'teacherscreen', formatVersion: 1, screens: [a], decks: [{ id: 'd1', name: 'Zostava 1' }] };
    const p = parseImport(JSON.stringify(file));
    expect(p.decks).toHaveLength(1);
    expect(p.screens[0]!.deckId).toBe(p.decks[0]!.id);
    expect(p.decks[0]!.id).not.toBe('d1');
  });
});

describe('QR kód', () => {
  it('v režime URL doplní https a odmietne nebezpečné schémy', () => {
    expect(normalizeQrInput('www.skola.sk/trieda', 'url')).toEqual({ ok: true, value: 'https://www.skola.sk/trieda' });
    expect(normalizeQrInput('javascript:alert(1)', 'url')).toEqual({ ok: false, error: 'invalid-url' });
    expect(normalizeQrInput('data:text/html,<b>', 'url')).toEqual({ ok: false, error: 'invalid-url' });
    expect(normalizeQrInput('nieje url', 'url')).toEqual({ ok: false, error: 'invalid-url' });
    expect(normalizeQrInput('  ', 'url')).toEqual({ ok: false, error: 'empty' });
    expect(normalizeQrInput('a'.repeat(900), 'text')).toEqual({ ok: false, error: 'too-long' });
    expect(normalizeQrInput('Ahoj svet', 'text')).toEqual({ ok: true, value: 'Ahoj svet' });
  });
  it('vygeneruje štvorcovú maticu s hľadáčikmi v rohoch', () => {
    const q = buildQr('https://example.org', 'url');
    expect(q.ok).toBe(true);
    if (q.ok) {
      expect(q.dark).toHaveLength(q.size);
      expect(q.dark[0]!.slice(0, 7).every(Boolean)).toBe(true); // horný okraj hľadáčika
      expect(q.dark[q.size - 1]!.slice(0, 7).every(Boolean)).toBe(true);
    }
  });
});
