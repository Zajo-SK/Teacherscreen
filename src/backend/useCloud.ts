import { create } from 'zustand';
import { api, BackendError, type Profile } from './api';
import { getSupabase, isBackendConfigured } from './client';

export type CloudStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn' | 'offline';

interface CloudState {
  status: CloudStatus;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  /** Poslednú chybu zobrazuje UI; nikdy nebráni lokálnej práci. */
  error: string | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<'confirm' | 'signedIn' | false>;
  signOut: () => Promise<void>;
}

const LINKS_KEY = 'ts.cloudLinks';

/** Väzba lokálna obrazovka → vzdialená obrazovka (uložená len v tomto zariadení). */
export function getCloudLink(localId: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(LINKS_KEY) ?? '{}') as Record<string, string>)[localId] ?? null;
  } catch {
    return null;
  }
}
export function setCloudLink(localId: string, remoteId: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(LINKS_KEY) ?? '{}') as Record<string, string>;
    all[localId] = remoteId;
    localStorage.setItem(LINKS_KEY, JSON.stringify(all));
  } catch {
    /* ignorované */
  }
}
export function findLocalByRemote(remoteId: string): string | null {
  try {
    const all = JSON.parse(localStorage.getItem(LINKS_KEY) ?? '{}') as Record<string, string>;
    return Object.entries(all).find(([, r]) => r === remoteId)?.[0] ?? null;
  } catch {
    return null;
  }
}

export function describeError(e: unknown): string {
  if (e instanceof BackendError) return e.kind === 'offline' ? 'cloud.offline' : e.kind === 'denied' ? 'cloud.denied' : 'cloud.failed';
  return 'cloud.failed';
}

export const useCloud = create<CloudState>()((set, get) => {
  async function loadSession() {
    try {
      const sb = await getSupabase();
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return set({ status: 'signedOut', userId: null, email: null, profile: null, error: null });
      let profile: Profile | null = null;
      try {
        profile = await api.getProfile(user.id);
      } catch (e) {
        if (e instanceof BackendError && e.kind === 'offline') {
          return set({ status: 'offline', userId: user.id, email: user.email ?? null, profile: null, error: 'cloud.offline' });
        }
      }
      set({ status: 'signedIn', userId: user.id, email: user.email ?? null, profile, error: null });
    } catch {
      set({ status: 'offline', error: 'cloud.offline' });
    }
  }

  return {
    status: isBackendConfigured ? 'loading' : 'unconfigured',
    userId: null,
    email: null,
    profile: null,
    error: null,
    async init() {
      if (!isBackendConfigured) return;
      await loadSession();
      try {
        const sb = await getSupabase();
        sb.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') void loadSession();
        });
      } catch {
        /* offline */
      }
    },
    async signIn(email, password) {
      try {
        const sb = await getSupabase();
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          set({ error: /network|fetch|abort/i.test(error.message) ? 'cloud.offline' : 'cloud.badCredentials' });
          return false;
        }
        await loadSession();
        return true;
      } catch {
        set({ error: 'cloud.offline', status: get().status === 'signedIn' ? 'signedIn' : 'offline' });
        return false;
      }
    },
    async signUp(email, password) {
      try {
        const sb = await getSupabase();
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) {
          set({ error: /network|fetch|abort/i.test(error.message) ? 'cloud.offline' : 'cloud.signUpFailed' });
          return false;
        }
        if (data.session) {
          await loadSession();
          return 'signedIn';
        }
        return 'confirm';
      } catch {
        set({ error: 'cloud.offline' });
        return false;
      }
    },
    async signOut() {
      try {
        const sb = await getSupabase();
        await sb.auth.signOut();
      } catch {
        /* lokálne odhlásenie prebehne aj bez servera */
      }
      set({ status: 'signedOut', userId: null, email: null, profile: null, error: null });
    },
  };
});
