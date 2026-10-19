import { createPortal } from 'react-dom';
import { Modal } from '@/components/ui';
import { t } from '@/i18n';
import { activeNames, isRowAbsent, toggleRow } from '@/lib/attendance';

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  const w = 44;
  const h = 24;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-no-drag
      data-testid="attendance-switch"
      onClick={onClick}
      style={{ all: 'unset', cursor: 'pointer', flex: 'none', width: w, height: h, borderRadius: h, position: 'relative', background: on ? '#12b886' : 'rgba(120,120,140,.45)', transition: 'background .15s', touchAction: 'manipulation' }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? w - h + 3 : 3, width: h - 6, height: h - 6, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.35)' }} />
    </button>
  );
}

/** Okno „Kto je dnes prítomný“ – otvorí sa nad celou obrazovkou, takže mená sú čitateľné aj pri malom widgete. */
export function AttendancePanel({ names, absent, onChange, onClose }: { names: string[]; absent: string[]; onChange: (a: string[]) => void; onClose: () => void }) {
  const present = activeNames(names, absent).length;
  return createPortal(
    // Udalosti z portálu sa v Reacte šíria do widgetu – zastavíme ich, aby klik nezačal posúvať widget.
    <div data-no-drag onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Modal open onClose={onClose} title={t('att.title')} wide>
        <div data-testid="attendance-panel">
          <p className="mb-1 text-base font-bold" data-testid="attendance-count">
            {t('att.count', { n: present, total: names.length })}
          </p>
          <p className="mb-4 text-sm text-muted">{t('att.hint')}</p>
          <ul className="mb-4 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
            {names.map((n, i) => {
              const absentRow = isRowAbsent(names, absent, i);
              return (
                <li key={`${n}-${i}`}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2" style={{ opacity: absentRow ? 0.6 : 1 }}>
                    <Switch on={!absentRow} label={t(absentRow ? 'att.rowAbsent' : 'att.rowPresent', { name: n })} onClick={() => onChange(toggleRow(names, absent, i))} />
                    <span className={`min-w-0 flex-1 truncate text-base font-semibold ${absentRow ? 'line-through' : ''}`}>{n}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn" onClick={() => onChange([])} disabled={absent.length === 0}>
              {t('att.allPresent')}
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('att.done')}
            </button>
          </div>
        </div>
      </Modal>
    </div>,
    document.body,
  );
}

/** Tá istá funkcia v paneli nastavení (bežné rozmery). */
export function AttendanceSettings({ names, absent, onChange }: { names: string[]; absent: string[]; onChange: (a: string[]) => void }) {
  const present = activeNames(names, absent).length;
  if (names.length === 0) return null;
  return (
    <div className="mb-3 rounded-xl border border-line p-3" data-testid="attendance-settings">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{t('att.title')}</span>
        <span className="text-xs text-muted">{t('att.count', { n: present, total: names.length })}</span>
      </div>
      <p className="mb-2 text-xs text-muted">{t('att.hint')}</p>
      <ul className="mb-2 max-h-56 overflow-auto">
        {names.map((n, i) => {
          const absentRow = isRowAbsent(names, absent, i);
          return (
            <li key={`${n}-${i}`} className="flex items-center gap-3 py-1" style={{ opacity: absentRow ? 0.6 : 1 }}>
              <Switch on={!absentRow} label={t(absentRow ? 'att.rowAbsent' : 'att.rowPresent', { name: n })} onClick={() => onChange(toggleRow(names, absent, i))} />
              <span className={`truncate text-sm ${absentRow ? 'line-through' : ''}`}>{n}</span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn min-h-9 text-sm" disabled={absent.length === 0} onClick={() => onChange([])}>
        {t('att.allPresent')}
      </button>
    </div>
  );
}
