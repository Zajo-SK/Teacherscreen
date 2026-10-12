import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryAdapter } from '@/storage/db';
import { screensInDeck, useApp } from '@/store/useApp';
import { parseImport, buildExport } from '@/lib/schema';

async function fresh() {
  localStorage.clear();
  useApp.setState({ screens: {}, decks: {}, classes: {}, history: {}, selection: [], clipboard: [], toasts: [] });
  const adapter = new MemoryAdapter();
  await useApp.getState().init(adapter);
  return adapter;
}
const A = () => useApp.getState();

describe('store: obrazovky a widgety', () => {
  let adapter: MemoryAdapter;
  beforeEach(async () => {
    adapter = await fresh();
  });

  it('vytvorí obrazovku, pridá päť rôznych widgetov a všetko sa uloží do úložiska', async () => {
    const id = A().createScreen({ name: 'Hodina' });
    for (const type of ['text', 'clock', 'timer', 'picker', 'scoreboard'] as const) expect(A().addWidget(id, type)).toBeTruthy();
    expect(A().screens[id]!.widgets.map((w) => w.type)).toEqual(['text', 'clock', 'timer', 'picker', 'scoreboard']);
    await A().flush();
    const saved = (await adapter.loadAll()).screens;
    expect(saved).toHaveLength(1);
    expect(saved[0]!.widgets).toHaveLength(5);
    expect(new Set(saved[0]!.widgets.map((w) => w.id)).size).toBe(5);
  });

  it('po „obnovení stránky“ (nová inicializácia nad rovnakým úložiskom) sú dáta zachované', async () => {
    const id = A().createScreen({ name: 'Trvalá' });
    A().addWidget(id, 'timer');
    await A().flush();
    useApp.setState({ screens: {}, ready: false });
    await A().init(adapter);
    expect(A().screens[id]!.name).toBe('Trvalá');
    expect(A().screens[id]!.widgets).toHaveLength(1);
  });

  it('späť/znova vrátia pridanie aj odstránenie; odstránený widget sa dá obnoviť', () => {
    const id = A().createScreen();
    const wid = A().addWidget(id, 'text')!;
    A().addWidget(id, 'clock');
    expect(A().screens[id]!.widgets).toHaveLength(2);
    A().undo(id);
    expect(A().screens[id]!.widgets).toHaveLength(1);
    A().redo(id);
    expect(A().screens[id]!.widgets).toHaveLength(2);
    A().removeWidgets(id, [wid]);
    expect(A().screens[id]!.widgets).toHaveLength(1);
    expect(A().toasts.at(-1)!.action).toBeTruthy();
    A().toasts.at(-1)!.action!.run(); // „Vrátiť“
    expect(A().screens[id]!.widgets.map((w) => w.id)).toContain(wid);
  });

  it('commitRects (presun/zmena veľkosti) je jeden krok histórie a drží widget v ploche', () => {
    const id = A().createScreen();
    const wid = A().addWidget(id, 'text')!;
    const before = A().screens[id]!.widgets[0]!;
    A().commitRects(id, { [wid]: { x: 5000, y: -50, w: 400, h: 300 } });
    const w = A().screens[id]!.widgets[0]!;
    expect(w.x + w.w).toBeLessThanOrEqual(1920);
    expect(w.y).toBe(0);
    A().undo(id);
    expect(A().screens[id]!.widgets[0]).toMatchObject({ x: before.x, y: before.y, w: before.w, h: before.h });
  });

  it('opakované zmeny konfigurácie toho istého widgetu sa zlúčia do jedného kroku histórie', () => {
    const id = A().createScreen();
    const wid = A().addWidget(id, 'text')!;
    for (const body of ['a', 'ab', 'abc']) A().patchConfig(id, wid, { body });
    expect((A().screens[id]!.widgets[0]!.config as { body: string }).body).toBe('abc');
    A().undo(id);
    expect((A().screens[id]!.widgets[0]!.config as { body: string }).body).not.toBe('a');
    expect(A().screens[id]!.widgets).toHaveLength(1);
  });

  it('kopírovanie, vkladanie, duplikovanie a kopírovanie na inú obrazovku vytvoria nové ID', () => {
    const id = A().createScreen();
    const other = A().createScreen();
    const wid = A().addWidget(id, 'scoreboard')!;
    A().patchConfig(id, wid, { step: 5 });
    A().copyWidgets(id, [wid]);
    A().paste(id);
    A().duplicateWidgets(id, [wid]);
    const ws = A().screens[id]!.widgets;
    expect(ws).toHaveLength(3);
    expect(new Set(ws.map((w) => w.id)).size).toBe(3);
    expect(ws.every((w) => (w.config as { step: number }).step === 5)).toBe(true);
    A().copyToScreen(id, [wid], other);
    expect(A().screens[other]!.widgets).toHaveLength(1);
    expect(A().screens[other]!.widgets[0]!.id).not.toBe(wid);
  });

  it('uzamknutý widget sa neposúva šípkami ani zarovnaním', () => {
    const id = A().createScreen();
    const wid = A().addWidget(id, 'text')!;
    A().setLocked(id, [wid], true);
    const before = A().screens[id]!.widgets[0]!;
    A().nudge(id, [wid], 100, 100);
    A().align(id, [wid], 'left');
    expect(A().screens[id]!.widgets[0]).toMatchObject({ x: before.x, y: before.y, locked: true });
    A().setLocked(id, [wid], false);
    A().nudge(id, [wid], 10, 0);
    expect(A().screens[id]!.widgets[0]!.x).toBe(before.x + 10);
  });

  it('zmena pomeru strán zachová všetky widgety v ploche', () => {
    const id = A().createFromTemplate('morning-circle')!;
    const n = A().screens[id]!.widgets.length;
    A().setAspect(id, '4:3');
    const s = A().screens[id]!;
    expect(s.widgets).toHaveLength(n);
    s.widgets.forEach((w) => expect(w.x + w.w).toBeLessThanOrEqual(1600));
    A().undo(id);
    expect(A().screens[id]!.aspect).toBe('16:9');
  });

  it('duplikovanie obrazovky, poradie, zostavy a mazanie', async () => {
    const a = A().createScreen({ name: 'A' });
    const b = A().createScreen({ name: 'B' });
    const copy = A().duplicateScreen(a)!;
    expect(A().screens[copy]!.name).toContain('A');
    const deck = A().createDeck('Pondelok');
    A().setScreenDeck(a, deck);
    A().setScreenDeck(b, deck);
    expect(screensInDeck(A().screens, deck).map((s) => s.name)).toEqual(['A', 'B']);
    A().moveScreen(b, -1);
    expect(screensInDeck(A().screens, deck).map((s) => s.name)).toEqual(['B', 'A']);
    A().deleteDeck(deck);
    expect(A().screens[a]!.deckId).toBeNull();
    A().deleteScreen(a);
    await A().flush();
    expect((await adapter.loadAll()).screens.map((s) => s.id)).not.toContain(a);
  });

  it('export a import obrazovky zachová widgety a vytvorí novú obrazovku', () => {
    const id = A().createFromTemplate('math-contest')!;
    const json = JSON.stringify(buildExport([A().screens[id]!], { kind: 'screen', includeStudents: true }));
    const ids = A().importParsed(parseImport(json));
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(id);
    expect(A().screens[ids[0]!]!.widgets).toEqual(A().screens[id]!.widgets);
  });

  it('limit počtu widgetov na obrazovke', () => {
    const id = A().createScreen();
    for (let i = 0; i < 70; i++) A().addWidget(id, 'clock');
    expect(A().screens[id]!.widgets).toHaveLength(60);
    expect(A().toasts.some((t) => t.tone === 'error')).toBe(true);
  });

  it('triedy: uloženie, úprava, uloženie do úložiska a zmazanie so záznamom pre synchronizáciu', async () => {
    const id = A().saveClass({ name: ' 5.A ', names: ['Anna', ' ', 'Peter'] });
    expect(A().classes[id]).toMatchObject({ name: '5.A', names: ['Anna', 'Peter'] });
    A().saveClass({ id, name: '5.A', names: ['Anna', 'Peter', 'Eva'] });
    await A().flush();
    expect((await adapter.loadAll()).classes[0]!.names).toHaveLength(3);
    A().deleteClass(id);
    await A().flush();
    expect((await adapter.loadAll()).classes).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('ts.deleted.classes') ?? '[]')).toContain(id);
  });

  it('zmazanie obrazovky sa zapíše do záznamu pre synchronizáciu; prevzatie zo servera zachová čas úpravy', () => {
    const id = A().createScreen({ name: 'Z' });
    const s = A().screens[id]!;
    A().deleteScreen(id);
    expect(JSON.parse(localStorage.getItem('ts.deleted.screens') ?? '[]')).toContain(id);
    A().applyRemoteScreen({ ...s, name: 'Zo servera', updatedAt: 12345 });
    expect(A().screens[id]).toMatchObject({ name: 'Zo servera', updatedAt: 12345 });
  });

  it('wipeLocal odstráni všetko lokálne aj z úložiska', async () => {
    A().createScreen();
    A().saveClass({ name: 'X', names: ['a'] });
    await A().flush();
    A().wipeLocal();
    await A().flush();
    const d = await adapter.loadAll();
    expect(d.screens).toHaveLength(0);
    expect(d.classes).toHaveLength(0);
  });
});
