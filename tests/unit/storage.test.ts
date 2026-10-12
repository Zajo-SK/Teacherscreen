import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbAdapter, MemoryAdapter } from '@/storage/db';
import { AutoSaver } from '@/storage/autosave';
import { buildScreen, screenFromTemplate, TEMPLATES } from '@/templates';
import { openDB } from 'idb';
import type { Deck, Screen } from '@/types';

let n = 0;
const dbName = () => `test-db-${++n}`;

describe('IndexedDB úložisko', () => {
  it('uloží, načíta a zmaže obrazovky aj zostavy; dáta prežijú „reštart“ (nové pripojenie)', async () => {
    const name = dbName();
    const a = await IndexedDbAdapter.open(name);
    const s = screenFromTemplate(TEMPLATES[3]!);
    const deck: Deck = { id: 'd1', name: 'Zostava', createdAt: 1, updatedAt: 1 };
    await a.putScreens([s]);
    await a.putDecks([deck]);

    const b = await IndexedDbAdapter.open(name); // ako po obnovení stránky
    const loaded = await b.loadAll();
    expect(loaded.screens).toHaveLength(1);
    expect(loaded.screens[0]).toEqual(s);
    expect(loaded.decks).toEqual([deck]);
    expect(loaded.corrupted).toBe(0);

    await b.deleteScreens([s.id]);
    await b.deleteDecks(['d1']);
    expect((await b.loadAll()).screens).toHaveLength(0);
  });

  it('poškodený záznam preskočí a ostatné načíta', async () => {
    const name = dbName();
    const a = await IndexedDbAdapter.open(name);
    await a.putScreens([buildScreen({ name: 'OK' })]);
    const raw = await openDB(name, 1);
    await raw.put('screens', { id: 'zly', schemaVersion: 1, widgets: 'nie pole' }); // chýbajúce polia – opraví sa
    await raw.put('screens', { id: 'zly2', schemaVersion: 999 }); // novšia verzia – nedá sa načítať
    await raw.put('screens', 'nie je objekt', 'kluc').catch(() => undefined);
    raw.close();
    const loaded = await a.loadAll();
    expect(loaded.screens.map((s) => s.name)).toContain('OK');
    expect(loaded.corrupted).toBeGreaterThanOrEqual(1);
  });

  it('záložné úložisko v pamäti funguje rovnako', async () => {
    const m = new MemoryAdapter();
    const s = buildScreen({ name: 'X' });
    await m.putScreens([s]);
    expect((await m.loadAll()).screens[0]!.name).toBe('X');
  });
});

describe('automatické ukladanie', () => {
  let adapter: MemoryAdapter;
  let screens: Record<string, Screen>;
  let statuses: string[];
  beforeEach(() => {
    adapter = new MemoryAdapter();
    screens = {};
    statuses = [];
  });
  const make = (delay = 20) => new AutoSaver(adapter, { screen: (id) => screens[id], deck: () => undefined }, (s) => statuses.push(s), delay);

  it('zlučuje zmeny a zapíše naposledy známy stav', async () => {
    const s = buildScreen({ name: 'A' });
    screens[s.id] = s;
    const saver = make();
    saver.markScreen(s.id);
    screens[s.id] = { ...s, name: 'B' };
    saver.markScreen(s.id);
    expect(statuses.at(-1)).toBe('unsaved');
    await new Promise((r) => setTimeout(r, 80));
    expect((await adapter.loadAll()).screens[0]!.name).toBe('B');
    expect(statuses.at(-1)).toBe('saved');
    expect(statuses).toContain('saving');
  });
  it('flush zapíše okamžite', async () => {
    const s = buildScreen({ name: 'A' });
    screens[s.id] = s;
    const saver = make(10_000);
    saver.markScreen(s.id);
    await saver.flush();
    expect((await adapter.loadAll()).screens).toHaveLength(1);
  });
  it('pri chybe zápisu nahlási error a zmenu ponechá vo fronte', async () => {
    const s = buildScreen({ name: 'A' });
    screens[s.id] = s;
    adapter.putScreens = async () => {
      throw new Error('disk plný');
    };
    const saver = make();
    saver.markScreen(s.id);
    await saver.flush();
    expect(statuses.at(-1)).toBe('error');
    expect(saver.pending).toBe(true);
  });
  it('zmazanie obrazovky ju odstráni z úložiska', async () => {
    const s = buildScreen({ name: 'A' });
    await adapter.putScreens([s]);
    const saver = make();
    saver.removeScreen(s.id);
    await saver.flush();
    expect((await adapter.loadAll()).screens).toHaveLength(0);
  });
});
