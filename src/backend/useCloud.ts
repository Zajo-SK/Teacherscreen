import { create } from 'zustand';
import { useApp } from '@/store/useApp';
import { api, BackendError, type Profile } from './api';
import { getSupabase, isBackendConfigured } from './client';
import { emailToNick, nickToEmail, validateNick } from './nick';
import { getSyncOwner, resetSyncState, runSync, setSyncOwner, startAutoSync, stopAutoSync } from './sync';

export type CloudStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn' | 'offline';
export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'offline' | 'error' | 'needsChoice';

interface CloudState {
  status: CloudStatus;
  userId: string | null;
  /** Zobrazovaná prezývka. */
  nick: string | null;
  profile: Profile | null;
  syncStatus: SyncStatus;
  lastSyncAt: number | null;
  /** Kľúč prekladu poslednej chyby; UI ju zobrazuje, nikdy nebráni lokálnej práci. */
  error: string | null;
  init: () => Promise<void>;
  signIn: (nick: string, password: string) => Promise<boolean>;
  signUp: (nick: string, password: string) => Promise<boolean>;
  signOut: (opts?: { wipeLocal?: boolean }) => Promise<void>;
  /** Vyrieši situáciu, keď sa na zariadení s cudzími lokálnymi dátami prihlási iný používateľ. */
  resolveOwnerChoice: (choice: 'merge' | 'wipe') => Promise<void>;
}

export function describeError(e: unknown): string {
  if (e instanceof BackendError) return e.kind === 'offline' ? 'cloud.offline' : e.kind === 'denied' ? 'cloud.denied' : 'cloud.failed';
  return 'cloud.failed';
}

const isNetwork = (m: string) => /network|fetch|abort|failed to fetch|load failed/i.test(m);

export const useCloud = create<CloudState>()((set, get) => {
  async function loadSession() {
    try {
      const sb = await getSupabase();
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        stopAutoSync();
        return set({ status: 'signedOut', userId: null, nick: null, profile: null, error: null, syncStatus: 'idle' });
      }
      const fallbackNick = emailToNick(user.email);
      let profile: Profile | null = null;
      try {
        profile = await api.getProfile(user.id);
      } catch (e) {
        if (e instanceof BackendError && e.kind === 'offline') {
          set({ status: 'signedIn', userId: user.id, nick: fallbackNick, profile: null, error: null, syncStatus: 'offline' });
          startAutoSync();
          return;
        }
      }
      set({ status: 'signedIn', userId: user.id, nick: profile?.display_name || fallbackNick, profile, error: null });
      startAutoSync();
    } catch {
      set({ status: 'offline', error: 'cloud.offline' });
    }
  }

  return {
    status: isBackendConfigured ? 'loading' : 'unconfigured',
    userId: null,
    nick: null,
    profile: null,
    syncStatus: 'idle',
    lastSyncAt: null,
    error: null,
    async init() {
      if (!isBackendConfigured) return;
      await loadSession();
      try {
        const sb = await getSupabase();
        sb.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') void loadSession();
        });
      } catch {
        /* offline */
      }
    },
    async signIn(nickRaw, password) {
      const v = validateNick(nickRaw);
      if (!v.ok) return set({ error: 'cloud.nickInvalid' }), false;
      try {
        const sb = await getSupabase();
        const { error } = await sb.auth.signInWithPassword({ email: nickToEmail(v.nick), password });
        if (error) {
          set({ error: isNetwork(error.message) ? 'cloud.offline' : 'cloud.badCredentials' });
          return false;
        }
        await loadSession();
        return true;
      } catch {
        set({ error: 'cloud.offline' });
        return false;
      }
    },
    async signUp(nickRaw, password) {
      const v = validateNick(nickRaw);
      if (!v.ok) return set({ error: 'cloud.nickInvalid' }), false;
      if (password.length < 8) return set({ error: 'cloud.passwordShort' }), false;
      try {
        const sb = await getSupabase();
        const { data, error } = await sb.auth.signUp({ email: nickToEmail(v.nick), password, options: { data: { display_name: v.nick } } });
        if (error) {
          set({ error: isNetwork(error.message) ? 'cloud.offline' : /already|registered|exists/i.test(error.message) ? 'cloud.nickTaken' : 'cloud.signUpFailed' });
          return false;
        }
        // Supabase pri už existujúcom používateľovi (a zapnutom potvrdzovaní) vráti „úspech“ bez session.
        if (!data.session) {
          set({ error: 'cloud.confirmRequired' });
          return false;
        }
        await loadSession();
        return true;
      } catch {
        set({ error: 'cloud.offline' });
        return false;
      }
    },
    async signOut(opts = {}) {
      stopAutoSync();
      const uid = get().userId;
      try {
        const sb = await getSupabase();
        await sb.auth.signOut();
      } catch {
        /* lokálne odhlásenie prebehne aj bez servera */
      }
      if (opts.wipeLocal) {
        useApp.getState().wipeLocal();
        await useApp.getState().flush();
        setSyncOwner(null);
        if (uid) resetSyncState(uid);
      }
      set({ status: 'signedOut', userId: null, nick: null, profile: null, error: null, syncStatus: 'idle' });
    },
    async resolveOwnerChoice(choice) {
      const uid = get().userId;
      if (!uid) return;
      if (choice === 'wipe') {
        useApp.getState().wipeLocal();
        await useApp.getState().flush();
      }
      resetSyncState(uid);
      setSyncOwner(uid);
      set({ syncStatus: 'idle' });
      void runSync();
      void getSyncOwner();
    },
  };
});
