import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ClassList, Deck, Screen } from '@/types';
import { sanitizeClass, sanitizeDeck, sanitizeScreen } from '@/lib/schema';

export interface LoadResult {
  screens: Screen[];
  decks: Deck[];
  classes: ClassList[];
  /** Počet záznamov, ktoré sa nepodarilo prečítať (poškodené dáta ostávajú v úložisku nedotknuté). */
  corrupted: number;
}

export interface StorageAdapter {
  readonly kind: 'indexeddb' | 'memory';
  loadAll(): Promise<LoadResult>;
  putScreens(screens: Screen[]): Promise<void>;
  deleteScreens(ids: string[]): Promise<void>;
  putDecks(decks: Deck[]): Promise<void>;
  deleteDecks(ids: string[]): Promise<void>;
  putClasses(classes: ClassList[]): Promise<void>;
  deleteClasses(ids: string[]): Promise<void>;
}

interface TsDB extends DBSchema {
  screens: { key: string; value: Screen };
  decks: { key: string; value: Deck };
  classes: { key: string; value: ClassList };
}

export const DB_NAME = 'teacherscreen';
export const DB_VERSION = 2;

function parseAll(rawScreens: unknown[], rawDecks: unknown[], rawClasses: unknown[] = []): LoadResult {
  const classes: ClassList[] = [];
  const screens: Screen[] = [];
  const decks: Deck[] = [];
  let corrupted = 0;
  for (const raw of rawScreens) {
    try {
      screens.push(sanitizeScreen(raw, { keepId: true }).screen);
    } catch {
      corrupted++;
    }
  }
  for (const raw of rawDecks) {
    const d = sanitizeDeck(raw);
    if (d) decks.push(d);
    else corrupted++;
  }
  for (const raw of rawClasses) {
    const c = sanitizeClass(raw);
    if (c) classes.push(c);
    else corrupted++;
  }
  return { screens, decks, classes, corrupted };
}

export class IndexedDbAdapter implements StorageAdapter {
  readonly kind = 'indexeddb' as const;
  private constructor(private db: IDBPDatabase<TsDB>) {}

  static async open(name = DB_NAME): Promise<IndexedDbAdapter> {
    let handle: IDBPDatabase<TsDB> | null = null;
    const db = await openDB<TsDB>(name, DB_VERSION, {
      // Iná karta s novšou verziou aplikácie potrebuje aktualizovať databázu – túto kartu pustíme a načítame ju znova.
      blocking() {
        handle?.close();
        setTimeout(() => location.reload(), 100);
      },
      upgrade(d) {
        if (!d.objectStoreNames.contains('screens')) d.createObjectStore('screens', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('decks')) d.createObjectStore('decks', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('classes')) d.createObjectStore('classes', { keyPath: 'id' });
      },
    });
    handle = db;
    return new IndexedDbAdapter(db);
  }

  async loadAll(): Promise<LoadResult> {
    const [s, d, c] = await Promise.all([this.db.getAll('screens'), this.db.getAll('decks'), this.db.getAll('classes')]);
    return parseAll(s, d, c);
  }
  async putScreens(screens: Screen[]): Promise<void> {
    const tx = this.db.transaction('screens', 'readwrite');
    await Promise.all([...screens.map((s) => tx.store.put(s)), tx.done]);
  }
  async deleteScreens(ids: string[]): Promise<void> {
    const tx = this.db.transaction('screens', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }
  async putDecks(decks: Deck[]): Promise<void> {
    const tx = this.db.transaction('decks', 'readwrite');
    await Promise.all([...decks.map((d) => tx.store.put(d)), tx.done]);
  }
  async deleteDecks(ids: string[]): Promise<void> {
    const tx = this.db.transaction('decks', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }
  async putClasses(classes: ClassList[]): Promise<void> {
    const tx = this.db.transaction('classes', 'readwrite');
    await Promise.all([...classes.map((c) => tx.store.put(c)), tx.done]);
  }
  async deleteClasses(ids: string[]): Promise<void> {
    const tx = this.db.transaction('classes', 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }
}

/** Záložné úložisko v pamäti, ak IndexedDB nie je dostupná (napr. niektoré súkromné okná). Dáta sa po zatvorení stratia. */
export class MemoryAdapter implements StorageAdapter {
  readonly kind = 'memory' as const;
  private screens = new Map<string, Screen>();
  private decks = new Map<string, Deck>();
  private classes = new Map<string, ClassList>();
  async loadAll(): Promise<LoadResult> {
    return parseAll([...this.screens.values()], [...this.decks.values()], [...this.classes.values()]);
  }
  async putScreens(screens: Screen[]) {
    screens.forEach((s) => this.screens.set(s.id, structuredClone(s)));
  }
  async deleteScreens(ids: string[]) {
    ids.forEach((id) => this.screens.delete(id));
  }
  async putDecks(decks: Deck[]) {
    decks.forEach((d) => this.decks.set(d.id, { ...d }));
  }
  async deleteDecks(ids: string[]) {
    ids.forEach((id) => this.decks.delete(id));
  }
  async putClasses(classes: ClassList[]) {
    classes.forEach((c) => this.classes.set(c.id, structuredClone(c)));
  }
  async deleteClasses(ids: string[]) {
    ids.forEach((id) => this.classes.delete(id));
  }
}

export async function openStorage(): Promise<StorageAdapter> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB nie je dostupná');
    return await IndexedDbAdapter.open();
  } catch {
    return new MemoryAdapter();
  }
}
