import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Tip {
  text: string;
  x: number;
  y: number;
  below: boolean;
  host: HTMLElement;
}

/**
 * Globálne popisky ikon. Zobrazia sa pri nabehnutí myšou, pri fokuse klávesnicou a pri dlhom stlačení prstom.
 * Text sa berie z `data-tip`, `title` (prevedie sa na data-tip, aby sa nezobrazoval aj natívny popisok)
 * alebo z `aria-label` prvkov bez viditeľného textu (ikonové tlačidlá).
 */
function tipFor(target: EventTarget | null): { el: HTMLElement; text: string } | null {
  const start = target instanceof Element ? target : null;
  const el = start?.closest<HTMLElement>('[data-tip],[title],[aria-label]');
  if (!el) return null;
  const title = el.getAttribute('title');
  if (title) {
    el.setAttribute('data-tip', title);
    el.removeAttribute('title');
  }
  const explicit = el.getAttribute('data-tip');
  if (explicit) return { el, text: explicit };
  const label = el.getAttribute('aria-label');
  const iconOnly = (el.textContent ?? '').trim() === '';
  const interactive = el.matches('button,a,[role=button],[role=radio],[role=tab],[role=checkbox],input,select');
  if (label && iconOnly && interactive) return { el, text: label };
  return null;
}

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLElement | null = null;
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
    };
    const show = (el: HTMLElement, text: string) => {
      const r = el.getBoundingClientRect();
      const below = r.top < 56;
      setTip({ text, x: Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130), y: below ? r.bottom + 8 : r.top - 8, below, host: el });
    };
    const schedule = (target: EventTarget | null, delay: number) => {
      const f = tipFor(target);
      if (!f || f.el === current) return;
      hide();
      current = f.el;
      timer = setTimeout(() => show(f.el, f.text), delay);
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') schedule(e.target, 350);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const rel = e.relatedTarget as Node | null;
      if (current && rel && current.contains(rel)) return;
      hide();
    };
    const onFocus = (e: FocusEvent) => {
      if ((e.target as HTMLElement).matches?.(':focus-visible')) schedule(e.target, 0);
    };
    let press: ReturnType<typeof setTimeout> | undefined;
    const onDown = (e: PointerEvent) => {
      hide();
      clearTimeout(press);
      if (e.pointerType === 'touch') {
        const f = tipFor(e.target);
        if (f) press = setTimeout(() => (show(f.el, f.text), setTimeout(hide, 2500)), 600);
      }
    };
    const cancelPress = () => clearTimeout(press);
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', cancelPress);
    document.addEventListener('pointercancel', cancelPress);
    document.addEventListener('keydown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      hide();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', cancelPress);
      document.removeEventListener('pointercancel', cancelPress);
      document.removeEventListener('keydown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!tip) return null;
  // Popisok musí byť v tej istej vrstve ako prvok (modálne okno <dialog> je nad všetkým ostatným).
  const container = tip.host.closest('dialog[open]') ?? document.body;
  return createPortal(
    <div
      role="tooltip"
      data-testid="tooltip"
      style={{ position: 'fixed', left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})`, zIndex: 100000, pointerEvents: 'none' }}
      className="max-w-64 rounded-xl bg-ink px-3 py-1.5 text-center text-xs font-semibold leading-snug text-bg shadow-lg"
    >
      {tip.text}
    </div>,
    container,
  );
}
