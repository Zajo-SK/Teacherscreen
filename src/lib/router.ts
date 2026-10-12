import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'edit'; id: string }
  | { name: 'present'; id: string }
  | { name: 'admin' }
  | { name: 'shared'; token: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '');
  const [a, b] = path.split('/');
  if (a === 'edit' && b) return { name: 'edit', id: decodeURIComponent(b) };
  if (a === 'present' && b) return { name: 'present', id: decodeURIComponent(b) };
  if (a === 'admin') return { name: 'admin' };
  if (a === 'shared' && b && /^[A-Za-z0-9]{16,128}$/.test(b)) return { name: 'shared', token: b };
  return { name: 'home' };
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'admin':
      return '#/admin';
    case 'shared':
      return `#/shared/${r.token}`;
    default:
      return `#/${r.name}/${encodeURIComponent(r.id)}`;
  }
}

let cached: { hash: string; route: Route } | null = null;
function getSnapshot(): Route {
  const hash = window.location.hash;
  if (!cached || cached.hash !== hash) cached = { hash, route: parseHash(hash) };
  return cached.route;
}
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, () => ({ name: 'home' }));
}

export function navigate(r: Route, opts: { replace?: boolean } = {}): void {
  const hash = routeToHash(r);
  if (opts.replace) window.location.replace(hash);
  else window.location.hash = hash;
}
