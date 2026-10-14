import { useId, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

const PREFIX = 'ts.ui.sec.';

function read(id: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(PREFIX + id);
    return v === null ? def : v === '1';
  } catch {
    return def;
  }
}

/**
 * Zbaliteľná sekcia (roll‑up menu). Stav (otvorená/zbalená) sa pamätá v zariadení.
 * Obsah zbalenej sekcie sa nevykresľuje, takže je neviditeľný aj pre čítačky a klávesnicu.
 */
export function Collapsible({
  id,
  title,
  defaultOpen = false,
  badge,
  preview,
  accent,
  children,
  level = 1,
}: {
  id: string;
  title: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  /** Náhľad v hlavičke, kým je sekcia zbalená (napr. ikony widgetov). */
  preview?: ReactNode;
  accent?: string;
  children: ReactNode;
  level?: 1 | 2;
}) {
  const [open, setOpen] = useState(() => read(id, defaultOpen));
  const panelId = useId();
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(PREFIX + id, next ? '1' : '0');
    } catch {
      /* ignorované */
    }
  };
  return (
    <section className={level === 1 ? 'border-b border-line' : 'mb-1'} data-section={id}>
      <h3 className="m-0">
        <button
          type="button"
          data-testid={`sec-${id}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className={`flex w-full items-center gap-2 text-left transition-colors hover:bg-surface2 ${level === 1 ? 'px-4 py-3 text-sm font-extrabold uppercase tracking-wide' : 'rounded-xl px-2 py-2 text-sm font-bold'}`}
        >
          <ChevronRight size={16} aria-hidden className={`flex-none transition-transform duration-200 ${open ? 'rotate-90' : ''}`} style={accent ? { color: accent } : undefined} />
          {accent && <span className="size-2.5 flex-none rounded-full" style={{ background: accent }} aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {!open && preview}
          {badge !== undefined && <span className="flex-none rounded-full bg-surface2 px-2 py-0.5 text-xs font-bold text-muted">{badge}</span>}
        </button>
      </h3>
      {open && (
        <div id={panelId} className={level === 1 ? 'px-4 pb-4 pt-1' : 'px-2 pb-3 pt-1'}>
          {children}
        </div>
      )}
    </section>
  );
}
