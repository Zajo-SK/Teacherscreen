import { useEffect } from 'react';
import { useApp } from '@/store/useApp';
import { navigate } from '@/lib/router';
import { toggleFullscreen } from '@/lib/fullscreen';

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.closest?.('dialog[open]') !== null;
}

/** Klávesové skratky editora. Vypnuté počas písania do polí a v otvorených dialógoch. */
export function useEditorShortcuts(screenId: string) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const a = useApp.getState();
      const sel = a.selection;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const act = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (mod && key === 'z' && !e.shiftKey) return act(() => a.undo(screenId));
      if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) return act(() => a.redo(screenId));
      if (mod && key === 'a') return act(() => a.select(a.screens[screenId]?.widgets.map((w) => w.id) ?? []));
      if (mod && key === 'c' && sel.length) return act(() => a.copyWidgets(screenId, sel));
      if (mod && key === 'x' && sel.length) return act(() => a.cutWidgets(screenId, sel));
      if (mod && key === 'v') return act(() => a.paste(screenId));
      if (mod && key === 'd' && sel.length) return act(() => a.duplicateWidgets(screenId, sel));
      if (mod && key === 'l' && sel.length) {
        const ws = a.screens[screenId]?.widgets.filter((w) => sel.includes(w.id)) ?? [];
        return act(() => a.setLocked(screenId, sel, !ws.every((w) => w.locked)));
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) return act(() => a.removeWidgets(screenId, sel));
      if (e.key === 'Escape') return a.select([]);
      if (key === ']' && sel.length) return act(() => a.reorderWidgets(screenId, sel, e.shiftKey ? 'front' : 'forward'));
      if (key === '[' && sel.length) return act(() => a.reorderWidgets(screenId, sel, e.shiftKey ? 'back' : 'backward'));
      if (key === 'f5' || (key === 'p' && !mod)) return act(() => navigate({ name: 'present', id: screenId }));
      if (key === 'f' && !mod) return act(() => void toggleFullscreen());
      const step = e.shiftKey ? 10 : 1;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const mv = arrows[e.key];
      if (mv && sel.length) return act(() => a.nudge(screenId, sel, mv[0], mv[1]));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screenId]);
}
