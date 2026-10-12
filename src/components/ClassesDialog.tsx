import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal } from './ui';
import { NamesEditor } from '@/widgets/NamesEditor';
import { t } from '@/i18n';
import { useApp } from '@/store/useApp';
import { useCloud } from '@/backend/useCloud';
import { isBackendConfigured } from '@/backend/client';

/** Správa tried (zoznamov žiakov). Funguje lokálne; do cloudu sa synchronizujú len ak to učiteľ zapne v účte. */
export function ClassesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const classes = useApp((s) => s.classes);
  const saveClass = useApp((s) => s.saveClass);
  const deleteClass = useApp((s) => s.deleteClass);
  const syncOn = useApp((s) => s.settings.syncClasses);
  const signedIn = useCloud((s) => s.status === 'signedIn');
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const list = Object.values(classes).sort((a, b) => a.name.localeCompare(b.name, 'sk', { numeric: true }));
  const cur = selected ? classes[selected] : undefined;

  return (
    <Modal open={open} onClose={onClose} title={t('classes.title')} wide>
      <p className="mb-3 text-sm text-muted">{t('classes.intro')}</p>
      <p className="mb-4 text-sm text-muted">
        {isBackendConfigured && signedIn ? (syncOn ? t('classes.syncOn') : t('classes.syncOff')) : t('classes.localOnly')}
      </p>
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <div>
          <ul className="mb-2 max-h-72 overflow-auto rounded-xl border border-line" data-testid="class-list">
            {list.length === 0 && <li className="p-3 text-sm text-muted">{t('classes.none')}</li>}
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={selected === c.id} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface2 aria-pressed:bg-primary/15" onClick={() => setSelected(c.id)}>
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="text-xs text-muted">{c.names.length}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn w-full" data-testid="new-class" onClick={() => setSelected(saveClass({ name: t('classes.untitled'), names: [] }))}>
            <Plus size={18} aria-hidden /> {t('classes.new')}
          </button>
        </div>
        <div>
          {cur ? (
            <>
              <label className="label" htmlFor="class-name">
                {t('classes.name')}
              </label>
              <div className="mb-3 flex gap-2">
                <input id="class-name" className="input" value={cur.name} maxLength={80} onChange={(e) => saveClass({ id: cur.id, name: e.target.value, names: cur.names })} />
                <button type="button" className="btn btn-danger btn-icon" aria-label={`${t('common.delete')}: ${cur.name}`} onClick={() => setConfirm(cur.id)}>
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
              <NamesEditor names={cur.names} onChange={(names) => saveClass({ id: cur.id, name: cur.name, names })} />
            </>
          ) : (
            <p className="text-sm text-muted">{t('classes.select')}</p>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={t('classes.confirmDelete', { name: confirm ? (classes[confirm]?.name ?? '') : '' })}
        text={t('classes.confirmDeleteText')}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={() => {
          if (confirm) deleteClass(confirm);
          setSelected(null);
        }}
        onClose={() => setConfirm(null)}
      />
    </Modal>
  );
}
