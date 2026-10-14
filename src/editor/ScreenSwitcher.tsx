import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { useApp, screensInDeck } from '@/store/useApp';
import { Filmstrip } from './Filmstrip';

/** Malý prepínač plôch vľavo dole; po kliknutí na číslo sa otvorí prehľad plôch (s presúvaním poradia). */
export function ScreenSwitcher({ screenId }: { screenId: string }) {
  const screens = useApp((s) => s.screens);
  const createScreen = useApp((s) => s.createScreen);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  const current = screens[screenId];
  if (!current) return null;
  const list = screensInDeck(screens, current.deckId);
  const idx = list.findIndex((s) => s.id === screenId);
  const go = (i: number) => {
    const s = list[i];
    if (s) navigate({ name: 'edit', id: s.id });
  };
  return (
    <div ref={root} className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-2" data-tour="screens">
      {open && (
        <div className="w-[min(92vw,640px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" data-testid="screens-panel">
          <Filmstrip screenId={screenId} />
        </div>
      )}
      <div className="flex items-center gap-1 rounded-2xl bg-[#0b0f24]/85 px-2 py-1.5 text-white shadow-lg backdrop-blur">
        <button type="button" className="btn btn-icon min-h-9 border-0 bg-transparent text-white" aria-label={t('bar.prevScreen')} disabled={idx <= 0} onClick={() => go(idx - 1)}>
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button type="button" className="min-h-9 rounded-lg border-2 border-white px-2 text-sm font-extrabold" aria-expanded={open} aria-label={t('editor.screens')} data-tip={t('editor.screens')} data-testid="screens-toggle" onClick={() => setOpen(!open)}>
          {idx + 1}/{list.length}
        </button>
        <button type="button" className="btn btn-icon min-h-9 border-0 bg-transparent text-white" aria-label={t('bar.nextScreen')} disabled={idx < 0 || idx >= list.length - 1} onClick={() => go(idx + 1)}>
          <ChevronRight size={18} aria-hidden />
        </button>
        <button
          type="button"
          className="btn btn-icon min-h-9 border-0 bg-transparent text-white"
          aria-label={t('editor.addScreen')}
          data-tip={t('editor.addScreen')}
          data-testid="screen-add"
          onClick={() => navigate({ name: 'edit', id: createScreen({ deckId: current.deckId }) })}
        >
          <Plus size={20} aria-hidden />
        </button>
      </div>
    </div>
  );
}
