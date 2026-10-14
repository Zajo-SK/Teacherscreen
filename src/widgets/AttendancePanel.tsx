import { X } from 'lucide-react';
import { t } from '@/i18n';
import { activeNames, isRowAbsent, toggleRow } from '@/lib/attendance';

function Switch({ on, label, onClick, big }: { on: boolean; label: string; onClick: () => void; big?: boolean }) {
  const w = big ? 84 : 44;
  const h = big ? 46 : 24;
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

/** Panel „Kto je dnes prítomný“ priamo vo widgete (rozmery v jednotkách plochy). */
export function AttendancePanel({ names, absent, onChange, onClose }: { names: string[]; absent: string[]; onChange: (a: string[]) => void; onClose: () => void }) {
  const present = activeNames(names, absent).length;
  return (
    <div
      role="dialog"
      aria-label={t('att.title')}
      data-no-drag
      data-testid="attendance-panel"
      style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', padding: 18, boxSizing: 'border-box', gap: 10, background: 'var(--widget-bg)', color: 'inherit' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0, flex: 1, fontSize: 30, fontWeight: 800 }}>
          {t('att.title')} <span className="wmuted" style={{ fontSize: 24 }} data-testid="attendance-count">{t('att.count', { n: present, total: names.length })}</span>
        </h3>
        <button type="button" className="wbtn" style={{ padding: '0 14px' }} aria-label={t('common.close')} data-tip={t('common.close')} onClick={onClose}>
          <X size={26} aria-hidden />
        </button>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateColumns: names.length > 8 ? 'repeat(2, 1fr)' : '1fr', gap: '6px 22px', alignContent: 'start' }}>
        {names.map((n, i) => {
          const absentRow = isRowAbsent(names, absent, i);
          return (
            <li key={`${n}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 56, opacity: absentRow ? 0.55 : 1 }}>
              <Switch big on={!absentRow} label={t(absentRow ? 'att.rowAbsent' : 'att.rowPresent', { name: n })} onClick={() => onChange(toggleRow(names, absent, i))} />
              <span style={{ fontSize: 28, fontWeight: 600, textDecoration: absentRow ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{n}</span>
            </li>
          );
        })}
      </ul>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" className="wbtn" onClick={() => onChange([])} disabled={absent.length === 0}>
          {t('att.allPresent')}
        </button>
        <button type="button" className="wbtn wbtn-primary" onClick={onClose}>
          {t('att.done')}
        </button>
      </div>
    </div>
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
