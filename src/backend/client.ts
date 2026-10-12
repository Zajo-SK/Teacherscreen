import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Backend je voliteľný. Konfiguruje sa iba verejnými premennými (URL projektu a *anon* kľúč).
 * Tajné kľúče (service_role) sa do frontendu nikdy nedávajú – prístup chráni Row Level Security v databáze.
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isBackendConfigured: boolean = !!url && !!anon && /^https?:\/\//.test(url);

const REQUEST_TIMEOUT_MS = 10_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  init?.signal?.addEventListener('abort', () => ctrl.abort());
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

let client: Promise<SupabaseClient> | null = null;

/** Knižnica sa načíta dynamicky až pri prvom použití – lokálny režim ju vôbec nestiahne. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!isBackendConfigured) return Promise.reject(new Error('backend-not-configured'));
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anon!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: fetchWithTimeout },
    }),
  );
  return client;
}
