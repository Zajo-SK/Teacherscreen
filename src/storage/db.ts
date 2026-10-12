import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Deck, Screen } from '@/types';
import { sanitizeDeck, sanitizeScreen } from '@/lib/schema';

export interface LoadResult {
  screens: Screen[];
  decks: Deck[];
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
}

interface TsDB extends DBSchema {
  screens: { key: string; value: Screen };
  decks: { key: string; value: Deck };
}

export const DB_NAME = 'teacherscreen';
export const DB_VERSION = 1;

function parseAll(rawScreens: unknown[], rawDecks: unknown[]): LoadResult {
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
  return { screens, decks, corrupted };
}

export class IndexedDbAdapter implements StorageAdapter {
  readonly kind = 'indexeddb' as const;
  private constructor(private db: IDBPDatabase<TsDB>) {}

  static async open(name = DB_NAME): Promise<IndexedDbAdapter> {
    const db = await openDB<TsDB>(name, DB_VERSION, {
      upgrade(d) {
        d.createObjectStore('screens', { keyPath: 'id' });
        d.createObjectStore('decks', { keyPath: 'id' });
      },
    });
    return new IndexedDbAdapter(db);
  }

  async loadAll(): Promise<LoadResult> {
    const [s, d] = await Promise.all([this.db.getAll('screens'), this.db.getAll('decks')]);
    return parseAll(s, d);
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
}

/** Záložné úložisko v pamäti, ak IndexedDB nie je dostupná (napr. niektoré súkromné okná). Dáta sa po zatvorení stratia. */
export class MemoryAdapter implements StorageAdapter {
  readonly kind = 'memory' as const;
  private screens = new Map<string, Screen>();
  private decks = new Map<string, Deck>();
  async loadAll(): Promise<LoadResult> {
    return parseAll([...this.screens.values()], [...this.decks.values()]);
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
}

export async function openStorage(): Promise<StorageAdapter> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB nie je dostupná');
    return await IndexedDbAdapter.open();
  } catch {
    return new MemoryAdapter();
  }
}
