import { clearTombstones, getTombstones } from '@/lib/tombstones';
import { useApp } from '@/store/useApp';
import { t } from '@/i18n';
import { sanitizeRules } from '@/lib/schema';
import { api, BackendError, mergeStudentData } from './api';
import { useCloud } from './useCloud';


export interface Item {
  id: string;
  at: number;
}
export interface PairState {
  remoteAt: number;
  localAt: number;
}
export interface SyncPlan {
  push: string[];
  pull: string[];
  conflict: string[];
  deleteRemote: string[];
  deleteLocal: string[];
}

/**
 * Čisté rozhodovanie synchronizácie. Časy „remote“ pochádzajú zo servera, časy „local“ zo zariadenia –
 * porovnávajú sa vždy len medzi sebou (voči stavu poslednej synchronizácie), takže nezáleží na nastavení hodín.
 */
export function planSync(local: Item[], remote: Item[], state: Record<string, PairState>, deleted: string[]): SyncPlan {
  const plan: SyncPlan = { push: [], pull: [], conflict: [], deleteRemote: [], deleteLocal: [] };
  const L = new Map(local.map((x) => [x.id, x]));
  const R = new Map(remote.map((x) => [x.id, x]));
  const del = new Set(deleted);
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(id);
    const r = R.get(id);
    const st = state[id];
    if (!l && r) {
      if (del.has(id)) plan.deleteRemote.push(id);
      else plan.pull.push(id);
    } else if (l && !r) {
      // Na serveri chýba: ak sme ho už raz synchronizovali a lokálne sa nemenil, zmazal ho iný nástroj/zariadenie.
      if (st && l.at <= st.localAt) plan.deleteLocal.push(id);
      else plan.push.push(id);
    } else if (l && r) {
      const remoteChanged = !st || r.at > st.remoteAt;
      const localChanged = !st || l.at > st.localAt;
      if (remoteChanged && localChanged) plan.conflict.push(id);
      else if (remoteChanged) plan.pull.push(id);
      else if (localChanged) plan.push.push(id);
    }
  }
  return plan;
}

// ---------------------------------------------------------------- stav v localStorage
type Kind = 'screens' | 'classes';
const stateKey = (kind: Kind, user: string) => `ts.sync.${kind}.${user}`;
const OWNER_KEY = 'ts.syncOwner';

function loadState(kind: Kind, user: string): Record<string, PairState> {
  try {
    return JSON.parse(localStorage.getItem(stateKey(kind, user)) ?? '{}') as Record<string, PairState>;
  } catch {
    return {};
  }
}
function saveState(kind: Kind, user: string, s: Record<string, PairState>) {
  try {
    localStorage.setItem(stateKey(kind, user), JSON.stringify(s));
  } catch {
    /* ignorované */
  }
}
export function getSyncOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}
export function setSyncOwner(id: string | null) {
  try {
    if (id) localStorage.setItem(OWNER_KEY, id);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    /* ignorované */
  }
}
export function resetSyncState(user: string) {
  saveState('screens', user, {});
  saveState('classes', user, {});
  clearTombstones('screens');
  clearTombstones('classes');
}

// ---------------------------------------------------------------- vykonanie
let running: Promise<void> | null = null;
let again = false;

export function runSync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = doSync()
    .catch(() => undefined)
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        void runSync();
      }
    });
  return running;
}

async function syncScreens(userId: string) {
  const app = useApp.getState();
  const remoteRows = await api.listMine(userId);
  const remote = remoteRows.map((r) => ({ id: r.id, at: Date.parse(r.updated_at) }));
  const local = Object.values(app.screens).map((s) => ({ id: s.id, at: s.updatedAt }));
  const state = loadState('screens', userId);
  const deleted = getTombstones('screens');
  const plan = planSync(local, remote, state, deleted);
  const remoteAt = new Map(remote.map((r) => [r.id, r.at]));

  for (const id of plan.deleteRemote) {
    await api.deleteRemote(id);
    delete state[id];
  }
  clearTombstones('screens', deleted.filter((id) => !remoteAt.has(id) || plan.deleteRemote.includes(id)));

  for (const id of plan.deleteLocal) {
    useApp.getState().removeLocalScreen(id);
    delete state[id];
  }
  for (const id of plan.conflict) {
    // Zachová obe verzie: lokálna sa uloží ako kópia, hlavná sa nahradí verziou zo servera.
    const mine = useApp.getState().screens[id];
    if (mine) {
      useApp.getState().importParsed({ screens: [{ ...structuredClone(mine), id: crypto.randomUUID(), name: `${mine.name} (${t('sync.localCopy')})` }], decks: [], classes: [], skippedWidgets: 0, skippedScreens: 0 });
    }
    plan.pull.push(id);
  }
  for (const id of plan.pull) {
    const remoteScreen = await api.download(id);
    const mine = useApp.getState().screens[id];
    const merged = mine ? mergeStudentData(remoteScreen, mine) : remoteScreen;
    useApp.getState().applyRemoteScreen(merged);
    state[id] = { remoteAt: remoteAt.get(id) ?? Date.now(), localAt: merged.updatedAt };
  }
  for (const id of plan.push) {
    const s = useApp.getState().screens[id];
    if (!s) continue;
    const at = await api.upload(s);
    state[id] = { remoteAt: at, localAt: s.updatedAt };
  }
  saveState('screens', userId, state);
}

async function syncClasses(userId: string) {
  const remoteRows = await api.listClasses(userId);
  const remote = remoteRows.map((r) => ({ id: r.id, at: Date.parse(r.updated_at) }));
  const local = Object.values(useApp.getState().classes).map((c) => ({ id: c.id, at: c.updatedAt }));
  const state = loadState('classes', userId);
  const deleted = getTombstones('classes');
  const plan = planSync(local, remote, state, deleted);
  const byId = new Map(remoteRows.map((r) => [r.id, r]));

  for (const id of plan.deleteRemote) {
    await api.deleteClass(id);
    delete state[id];
  }
  clearTombstones('classes', deleted.filter((id) => !byId.has(id) || plan.deleteRemote.includes(id)));
  for (const id of plan.deleteLocal) {
    useApp.getState().removeLocalClass(id);
    delete state[id];
  }
  // Pri konflikte vyhráva server, lokálna verzia sa zachová ako samostatná trieda.
  for (const id of plan.conflict) {
    const mine = useApp.getState().classes[id];
    if (mine) useApp.getState().saveClass({ name: `${mine.name} (${t('sync.localCopy')})`, names: mine.names, rules: mine.rules });
    plan.pull.push(id);
  }
  for (const id of plan.pull) {
    const r = byId.get(id);
    if (!r) continue;
    const at = Date.parse(r.updated_at);
    const rules = sanitizeRules(r.rules);
    const hasRules = rules.apart.length + rules.together.length > 0;
    useApp.getState().applyRemoteClass({ id, name: r.name, names: r.names, ...(hasRules ? { rules } : {}), updatedAt: at });
    state[id] = { remoteAt: at, localAt: at };
  }
  for (const id of plan.push) {
    const c = useApp.getState().classes[id];
    if (!c) continue;
    const at = await api.upsertClass(c);
    state[id] = { remoteAt: at, localAt: c.updatedAt };
  }
  saveState('classes', userId, state);
}

async function doSync() {
  const cloud = useCloud.getState();
  if (cloud.status !== 'signedIn' || !cloud.userId) return;
  const userId = cloud.userId;
  const owner = getSyncOwner();
  const hasLocal = Object.keys(useApp.getState().screens).length + Object.keys(useApp.getState().classes).length > 0;
  if (owner && owner !== userId && hasLocal) {
    useCloud.setState({ syncStatus: 'needsChoice' });
    return;
  }
  setSyncOwner(userId);
  useCloud.setState({ syncStatus: 'syncing' });
  try {
    await syncScreens(userId);
    if (useApp.getState().settings.syncClasses) await syncClasses(userId);
    useCloud.setState({ syncStatus: 'ok', lastSyncAt: Date.now() });
  } catch (e) {
    useCloud.setState({ syncStatus: e instanceof BackendError && e.kind === 'offline' ? 'offline' : 'error' });
  }
}

// ---------------------------------------------------------------- automatické spúšťanie
let stop: (() => void) | null = null;

/** Synchronizuje po zmene dát (s oneskorením), po obnovení pripojenia, pri návrate na kartu a pravidelne. */
export function startAutoSync(): void {
  if (stop) return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (ms = 4000) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void runSync(), ms);
  };
  let prevScreens = useApp.getState().screens;
  let prevClasses = useApp.getState().classes;
  const unsub = useApp.subscribe((st) => {
    if (st.screens !== prevScreens || st.classes !== prevClasses) {
      prevScreens = st.screens;
      prevClasses = st.classes;
      schedule();
    }
  });
  const onOnline = () => schedule(500);
  const onVis = () => document.visibilityState === 'visible' && schedule(500);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVis);
  const interval = setInterval(() => void runSync(), 90_000);
  void runSync();
  stop = () => {
    unsub();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVis);
    clearInterval(interval);
    if (timer) clearTimeout(timer);
    stop = null;
  };
}
export function stopAutoSync(): void {
  stop?.();
}
