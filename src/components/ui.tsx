import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { t } from '@/i18n';
import { useApp } from '@/store/useApp';

/** Modálne okno nad natívnym <dialog> – prehliadač rieši zachytenie fokusu a Esc. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`m-auto max-h-[90vh] w-[calc(100%-2rem)] ${wide ? 'max-w-3xl' : 'max-w-lg'} overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50`}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-lg font-bold">{title}</h2>
            <button type="button" className="btn btn-ghost btn-icon" aria-label={t('common.close')} onClick={onClose}>
              <X aria-hidden />
            </button>
          </div>
          <div className="overflow-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {text && <p className="mb-5 text-muted">{text}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" role="region" aria-label={t('a11y.toasts')} aria-live="polite">
      {toasts.map((x) => (
        <div
          key={x.id}
          role={x.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl border px-4 py-3 text-base shadow-lg ${
            x.tone === 'error' ? 'border-danger bg-surface text-danger' : x.tone === 'success' ? 'border-success bg-surface text-ink' : 'border-line bg-surface text-ink'
          }`}
        >
          <span>{x.text}</span>
          {x.action && (
            <button
              type="button"
              className="btn btn-primary min-h-9"
              onClick={() => {
                x.action!.run();
                dismiss(x.id);
              }}
            >
              {x.action.label}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-icon min-h-9 min-w-9" aria-label={t('common.close')} onClick={() => dismiss(x.id)}>
            <X size={18} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
