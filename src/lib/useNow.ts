import { useEffect, useState } from 'react';

/** Vracia Date.now(), aktualizované každých `intervalMs`, kým je `active`. Čas sa vždy číta z hodín, nie z počtu tikov. */
export function useNow(active: boolean, intervalMs = 200): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, intervalMs]);
  return active ? now : Date.now();
}
