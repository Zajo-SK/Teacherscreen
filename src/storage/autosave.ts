import type { ClassList, Deck, Screen } from '@/types';
import type { StorageAdapter } from './db';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * Automatické ukladanie s oneskorením (debounce). Zmeny sa zbierajú a zapíšu naraz;
 * `flush()` sa volá aj pri skrytí/zatvorení stránky.
 */
export class AutoSaver {
  private screens = new Set<string>();
  private decks = new Set<string>();
  private delScreens = new Set<string>();
  private delDecks = new Set<string>();
  private classes = new Set<string>();
  private delClasses = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<void> = Promise.resolve();

  constructor(
    private storage: StorageAdapter,
    private read: { screen: (id: string) => Screen | undefined; deck: (id: string) => Deck | undefined; cls?: (id: string) => ClassList | undefined },
    private onStatus: (s: SaveStatus, error?: unknown) => void,
    private delayMs = 300,
  ) {}

  markScreen(id: string) {
    this.delScreens.delete(id);
    this.screens.add(id);
    this.schedule();
  }
  markDeck(id: string) {
    this.delDecks.delete(id);
    this.decks.add(id);
    this.schedule();
  }
  removeScreen(id: string) {
    this.screens.delete(id);
    this.delScreens.add(id);
    this.schedule();
  }
  removeDeck(id: string) {
    this.decks.delete(id);
    this.delDecks.add(id);
    this.schedule();
  }
  markClass(id: string) {
    this.delClasses.delete(id);
    this.classes.add(id);
    this.schedule();
  }
  removeClass(id: string) {
    this.classes.delete(id);
    this.delClasses.add(id);
    this.schedule();
  }
  get pending(): boolean {
    return this.screens.size + this.decks.size + this.delScreens.size + this.delDecks.size + this.classes.size + this.delClasses.size > 0;
  }
  isDirty(id: string) {
    return this.screens.has(id);
  }

  private schedule() {
    this.onStatus('unsaved');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
  }

  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return this.inflight;
    const screens = [...this.screens].map((id) => this.read.screen(id)).filter((s): s is Screen => !!s);
    const decks = [...this.decks].map((id) => this.read.deck(id)).filter((d): d is Deck => !!d);
    const cls = [...this.classes].map((id) => this.read.cls?.(id)).filter((c): c is ClassList => !!c);
    const delC = [...this.delClasses];
    const delS = [...this.delScreens];
    const delD = [...this.delDecks];
    this.screens.clear();
    this.decks.clear();
    this.delScreens.clear();
    this.delDecks.clear();
    this.classes.clear();
    this.delClasses.clear();
    this.onStatus('saving');
    this.inflight = this.inflight
      .then(async () => {
        await this.storage.putScreens(screens);
        await this.storage.putDecks(decks);
        await this.storage.deleteScreens(delS);
        await this.storage.deleteDecks(delD);
        await this.storage.putClasses(cls);
        await this.storage.deleteClasses(delC);
        if (!this.pending) this.onStatus('saved');
      })
      .catch((e) => {
        // vráť späť do fronty, nech sa to skúsi znova
        screens.forEach((s) => this.screens.add(s.id));
        decks.forEach((d) => this.decks.add(d.id));
        delS.forEach((id) => this.delScreens.add(id));
        delD.forEach((id) => this.delDecks.add(id));
        cls.forEach((c) => this.classes.add(c.id));
        delC.forEach((id) => this.delClasses.add(id));
        this.onStatus('error', e);
      });
    return this.inflight;
  }
}
