import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from './ui';
import { Segmented, Toggle } from './forms';
import { t, useLanguage, setLanguage, LANGUAGES, LANG_CODES } from '@/i18n';
import { useApp } from '@/store/useApp';
import { usePwaInstall } from '@/lib/pwa';
import { restartTours } from './Tour';
import type { ThemeMode } from '@/types';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const storageKind = useApp((s) => s.storageKind);
  const lang = useLanguage();
  const { canInstall, install } = usePwaInstall();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    if (open) void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={t('settings.title')}>
      <div className="mb-3">
        <label htmlFor="settings-lang" className="mb-1 block text-sm font-semibold">{t('settings.language')}</label>
        <select id="settings-lang" data-testid="settings-language" className="input" value={lang} onChange={(e) => void setLanguage(e.target.value)}>
          {LANG_CODES.map((c) => (
            <option key={c} value={c} lang={c}>{LANGUAGES[c].label}</option>
          ))}
        </select>
      </div>
      <Segmented<ThemeMode>
        label={t('settings.theme')}
        value={settings.theme}
        onChange={(theme) => update({ theme })}
        options={[
          { value: 'light', label: t('settings.theme.light') },
          { value: 'dark', label: t('settings.theme.dark') },
          { value: 'system', label: t('settings.theme.system') },
        ]}
      />
      <Toggle label={t('settings.sound')} checked={settings.sound} onChange={(sound) => update({ sound })} />
      <Toggle label={t('settings.animations')} checked={settings.animations} onChange={(animations) => update({ animations })} />
      <Toggle label={t('settings.snap')} checked={settings.snapToGrid} onChange={(snapToGrid) => update({ snapToGrid })} />
      <button type="button" className="btn mb-3 mr-2" data-testid="restart-tour" onClick={() => { onClose(); restartTours(); }}>
        {t('tour.restart')}
      </button>
      {canInstall && (
        <button type="button" className="btn mb-3" onClick={() => void install()}>
          <Download size={18} aria-hidden /> {t('settings.install')}
        </button>
      )}
      <p className="text-sm text-muted">{t('settings.localMode')}</p>
      {storageKind === 'memory' && <p className="mt-2 text-sm text-danger">{t('save.unavailable')}</p>}
      {persisted === false && <p className="mt-2 text-sm text-muted">{t('settings.notPersistent')}</p>}
    </Modal>
  );
}
