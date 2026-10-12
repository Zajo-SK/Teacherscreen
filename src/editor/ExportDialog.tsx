import { useState } from 'react';
import { Modal } from '@/components/ui';
import { Toggle } from '@/components/forms';
import { t } from '@/i18n';
import { buildExport } from '@/lib/schema';
import { downloadText, safeFilename } from '@/lib/download';
import { useApp } from '@/store/useApp';

export function ExportDialog({ screenId, open, onClose }: { screenId: string; open: boolean; onClose: () => void }) {
  const screen = useApp((s) => s.screens[screenId]);
  const toast = useApp((s) => s.toast);
  const [noStudents, setNoStudents] = useState(true);
  if (!screen) return null;
  return (
    <Modal open={open} onClose={onClose} title={t('editor.export')}>
      <Toggle label={t('editor.exportNoStudents')} checked={noStudents} onChange={setNoStudents} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            const file = buildExport([screen], { kind: 'screen', includeStudents: !noStudents });
            downloadText(`${safeFilename(screen.name)}.teacherscreen.json`, JSON.stringify(file, null, 2));
            toast(t('io.exportDone'), { tone: 'success' });
            onClose();
          }}
        >
          {t('common.export')}
        </button>
      </div>
    </Modal>
  );
}
