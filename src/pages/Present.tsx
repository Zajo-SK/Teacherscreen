import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, PencilLine } from 'lucide-react';
import { Stage, backgroundStyle } from '@/components/Stage';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { fullscreenSupported, toggleFullscreen, useFullscreen } from '@/lib/fullscreen';
import { screensInDeck, useApp } from '@/store/useApp';

export function Present({ id }: { id: string }) {
  const screen = useApp((s) => s.screens[id]);
  const screens = useApp((s) => s.screens);
  const markOpened = useApp((s) => s.markOpened);
  const fs = useFullscreen();
  const [barVisible, setBarVisible] = useState(true);
  const hideTimer = useRef<number>(0);

  const list = screen ? screensInDeck(screens, screen.deckId) : [];
  const idx = list.findIndex((s) => s.id === id);

  const poke = useCallback(() => {
    setBarVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setBarVisible(false), 3000);
  }, []);

  useEffect(() => {
    poke();
    return () => window.clearTimeout(hideTimer.current);
  }, [poke, id]);

  useEffect(() => {
    if (screen) markOpened(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const go = useCallback(
    (delta: number) => {
      const next = list[idx + delta];
      if (next) navigate({ name: 'present', id: next.id });
    },
    [list, idx],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      poke();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
      else if (e.key === 'Home' && list[0]) navigate({ name: 'present', id: list[0].id });
      else if (e.key === 'End' && list.length) navigate({ name: 'present', id: list[list.length - 1]!.id });
      else if (e.key.toLowerCase() === 'f') void toggleFullscreen();
      else if (e.key === 'Escape') navigate({ name: 'edit', id });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, id, list, poke]);

  if (!screen) {
    return (
      <main className="grid h-dvh place-items-center bg-bg p-6 text-center">
        <div>
          <p className="mb-4 text-lg">{t('editor.notFound')}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'home' })}>
            {t('editor.toHome')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-black" style={backgroundStyle(screen.background)} onPointerMove={poke} onPointerDown={poke} data-testid="present-root">
      <Stage screenId={id} mode="present" bleed />
      <div
        className={`absolute right-3 top-3 z-50 flex items-center gap-2 rounded-2xl bg-black/70 p-2 text-white backdrop-blur transition-opacity ${barVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        role="toolbar"
        aria-label={t('home.present')}
      >
        <button type="button" className="btn btn-ghost btn-icon text-white hover:bg-white/20" aria-label={t('present.prev')} disabled={idx <= 0} onClick={() => go(-1)}>
          <ChevronLeft aria-hidden />
        </button>
        <span className="min-w-12 text-center text-sm tabular-nums" aria-live="polite">
          {idx + 1} / {list.length}
        </span>
        <button type="button" className="btn btn-ghost btn-icon text-white hover:bg-white/20" aria-label={t('present.next')} disabled={idx >= list.length - 1} onClick={() => go(1)}>
          <ChevronRight aria-hidden />
        </button>
        {fullscreenSupported() && (
          <button type="button" className="btn btn-ghost btn-icon text-white hover:bg-white/20" aria-label={fs ? t('editor.exitFullscreen') : t('editor.fullscreen')} onClick={() => void toggleFullscreen()}>
            {fs ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
          </button>
        )}
        <button type="button" data-testid="back-to-editor" className="btn btn-ghost text-white hover:bg-white/20" onClick={() => navigate({ name: 'edit', id })}>
          <PencilLine size={18} aria-hidden /> {t('present.exit')}
        </button>
      </div>
      <p className={`pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1 text-sm text-white transition-opacity ${barVisible ? 'opacity-100' : 'opacity-0'}`}>{t('present.hint')}</p>
      {screen.widgets.length === 0 && <p className="pointer-events-none absolute inset-0 grid place-items-center text-2xl text-white/80">{t('present.empty')}</p>}
    </main>
  );
}
