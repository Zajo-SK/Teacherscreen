import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { t, type TKey } from '@/i18n';
import { useCloud } from '@/backend/useCloud';

export interface TourStep {
  /** CSS selektory – použije sa prvý, ktorý je na stránke viditeľný. */
  target: string[];
  title: TKey;
  text: TKey;
}

const keyFor = (id: string, user: string | null) => `ts.tour.${id}.${user ?? 'guest'}`;
const EVENT = 'ts-start-tour';

export function restartTours(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('ts.tour.'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignorované */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

function visible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
const findTarget = (sels: string[]) => {
  for (const s of sels) {
    const el = document.querySelector(s);
    if (visible(el)) return el;
  }
  return null;
};

/** Krátka úvodná prehliadka: zvýrazní prvok, vysvetlí ho a posunie sa ďalej. Zobrazí sa raz pre každého používateľa. */
export function Tour({ id, steps, ready = true }: { id: string; steps: TourStep[]; ready?: boolean }) {
  const userId = useCloud((s) => s.userId);
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [list, setList] = useState<{ step: TourStep; el: HTMLElement }[]>([]);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const storageKey = keyFor(id, userId);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* ignorované */
    }
    setActive(false);
  }, [storageKey]);

  const start = useCallback(() => {
    const found = steps.map((step) => ({ step, el: findTarget(step.target) })).filter((x): x is { step: TourStep; el: HTMLElement } => !!x.el);
    if (found.length === 0) return;
    setList(found);
    setI(0);
    setActive(true);
  }, [steps]);

  // automatický štart pri prvej návšteve
  useEffect(() => {
    if (!ready) return;
    let done = false;
    try {
      done = localStorage.getItem(storageKey) === '1' || localStorage.getItem('ts.notour') === '1';
    } catch {
      /* ignorované */
    }
    if (done) return;
    const timer = setTimeout(start, 900);
    return () => clearTimeout(timer);
  }, [ready, storageKey, start]);

  useEffect(() => {
    const on = () => setTimeout(start, 200);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [start]);

  const cur = list[i];
  const measure = useCallback(() => {
    const el = cur ? (findTarget(cur.step.target) ?? cur.el) : null;
    if (!el) return setRect(null);
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    setRect(el.getBoundingClientRect());
  }, [cur]);
  useLayoutEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') setI((n) => Math.min(list.length - 1, n + 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, finish, list.length, i]);

  if (!active || !cur || !rect) return null;
  const pad = 8;
  const cardW = Math.min(340, window.innerWidth - 24);
  const spaceBelow = window.innerHeight - rect.bottom;
  const placeBelow = spaceBelow > 230 || rect.top < 230;
  const left = Math.min(Math.max(rect.left + rect.width / 2 - cardW / 2, 12), window.innerWidth - cardW - 12);
  const top = placeBelow ? Math.min(rect.bottom + pad + 12, window.innerHeight - 220) : Math.max(12, rect.top - pad - 12 - 200);
  const last = i === list.length - 1;

  return (
    <div className="fixed inset-0 z-[100001]" data-testid="tour" role="presentation">
      <div className="absolute inset-0" onClick={finish} aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-2xl transition-all duration-300"
        style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(20,18,31,.62), 0 0 0 3px var(--primary)' }}
      />
      <div
        role="dialog"
        aria-label={t('tour.aria')}
        className="absolute rounded-3xl border border-line bg-surface p-5 shadow-2xl"
        style={{ left, top, width: cardW }}
      >
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
          {t('tour.step', { n: i + 1, total: list.length })}
        </div>
        <h2 className="mb-1 text-lg font-extrabold">{t(cur.step.title)}</h2>
        <p className="mb-4 text-sm text-muted">{t(cur.step.text)}</p>
        <div className="mb-3 flex gap-1" aria-hidden>
          {list.map((_, k) => (
            <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= i ? 'bg-primary' : 'bg-line'}`} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost min-h-9 px-3 text-sm" onClick={finish}>
            {t('tour.skip')}
          </button>
          <span className="flex-1" />
          {i > 0 && (
            <button type="button" className="btn min-h-9 px-4 text-sm" onClick={() => setI(i - 1)}>
              {t('common.back')}
            </button>
          )}
          <button ref={nextRef} type="button" className="btn btn-primary min-h-9 px-4 text-sm" data-testid="tour-next" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
