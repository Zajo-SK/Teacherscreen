import { useEffect, useState } from 'react';
import { Check, CircleAlert, Cloud, Home, Loader2, Maximize, Minimize, PanelLeft, PanelRight, Play, Redo2, Settings, Share, Undo2 } from 'lucide-react';
import { Stage } from '@/components/Stage';
import { SettingsDialog } from '@/components/SettingsDialog';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { fullscreenSupported, toggleFullscreen, useFullscreen } from '@/lib/fullscreen';
import { useApp } from '@/store/useApp';
import { Palette } from '@/editor/Palette';
import { Inspector } from '@/editor/Inspector';
import { SelectionBar } from '@/editor/SelectionBar';
import { Filmstrip } from '@/editor/Filmstrip';
import { ExportDialog } from '@/editor/ExportDialog';
import { useEditorShortcuts } from '@/editor/useShortcuts';
import { CloudScreenButton } from '@/backend/CloudPanel';

function SaveIndicator() {
  const status = useApp((s) => s.saveStatus);
  const storageKind = useApp((s) => s.storageKind);
  const map = {
    saved: { icon: <Check size={16} aria-hidden />, text: t('save.saved'), cls: 'text-success' },
    saving: { icon: <Loader2 size={16} className="animate-spin" aria-hidden />, text: t('save.saving'), cls: 'text-muted' },
    unsaved: { icon: <Cloud size={16} aria-hidden />, text: t('save.unsaved'), cls: 'text-muted' },
    error: { icon: <CircleAlert size={16} aria-hidden />, text: t('save.error'), cls: 'text-danger' },
  } as const;
  const m = storageKind === 'memory' ? { icon: <CircleAlert size={16} aria-hidden />, text: t('save.unavailable'), cls: 'text-danger' } : map[status];
  return (
    <span role="status" aria-live="polite" data-testid="save-status" data-status={status} className={`flex items-center gap-1 text-sm font-medium ${m.cls}`} title={m.text}>
      {m.icon}
      <span className="hidden md:inline">{storageKind === 'memory' ? t('save.error') : m.text}</span>
    </span>
  );
}

export function Editor({ id }: { id: string }) {
  const screen = useApp((s) => s.screens[id]);
  const history = useApp((s) => s.history[id]);
  const undo = useApp((s) => s.undo);
  const redo = useApp((s) => s.redo);
  const updateMeta = useApp((s) => s.updateScreenMeta);
  const markOpened = useApp((s) => s.markOpened);
  const select = useApp((s) => s.select);
  const fs = useFullscreen();
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth >= 1100);
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 1280);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exists = !!screen;

  useEditorShortcuts(id);

  useEffect(() => {
    if (exists) markOpened(id);
    select([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, exists]);

  if (!screen) {
    return (
      <main className="grid h-dvh place-items-center p-6 text-center">
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
    <div className="flex h-dvh flex-col bg-bg" data-testid="editor-root">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-2 py-2">
        <button type="button" className="btn btn-icon" aria-label={t('editor.home')} title={t('editor.home')} onClick={() => navigate({ name: 'home' })}>
          <Home size={20} aria-hidden />
        </button>
        <button type="button" className="btn btn-icon lg:hidden" aria-label={t('editor.palette')} aria-pressed={leftOpen} onClick={() => setLeftOpen(!leftOpen)}>
          <PanelLeft size={20} aria-hidden />
        </button>
        <input
          className="input min-w-0 max-w-sm flex-1 font-semibold"
          aria-label={t('editor.screenName')}
          data-testid="screen-name"
          value={screen.name}
          maxLength={120}
          onChange={(e) => updateMeta(id, { name: e.target.value })}
        />
        <SaveIndicator />
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button type="button" className="btn btn-icon" aria-label={t('common.undo')} title={`${t('common.undo')} (Ctrl+Z)`} data-testid="undo" disabled={!history?.past.length} onClick={() => undo(id)}>
            <Undo2 size={20} aria-hidden />
          </button>
          <button type="button" className="btn btn-icon" aria-label={t('common.redo')} title={`${t('common.redo')} (Ctrl+Y)`} data-testid="redo" disabled={!history?.future.length} onClick={() => redo(id)}>
            <Redo2 size={20} aria-hidden />
          </button>
          <button type="button" className="btn" data-testid="export-btn" onClick={() => setExportOpen(true)}>
            <Share size={18} aria-hidden /> <span className="hidden xl:inline">{t('common.export')}</span>
          </button>
          <CloudScreenButton screenId={id} />
          {fullscreenSupported() && (
            <button type="button" className="btn btn-icon" aria-label={fs ? t('editor.exitFullscreen') : t('editor.fullscreen')} title={`${fs ? t('editor.exitFullscreen') : t('editor.fullscreen')} (F)`} onClick={() => void toggleFullscreen()}>
              {fs ? <Minimize size={20} aria-hidden /> : <Maximize size={20} aria-hidden />}
            </button>
          )}
          <button type="button" className="btn btn-icon" aria-label={t('settings.title')} title={t('settings.title')} onClick={() => setSettingsOpen(true)}>
            <Settings size={20} aria-hidden />
          </button>
          <button type="button" className="btn btn-icon xl:hidden" aria-label={t('editor.inspector')} aria-pressed={rightOpen} onClick={() => setRightOpen(!rightOpen)}>
            <PanelRight size={20} aria-hidden />
          </button>
          <button type="button" className="btn btn-primary" data-testid="present-btn" onClick={() => navigate({ name: 'present', id })}>
            <Play size={18} aria-hidden /> {t('editor.present')}
          </button>
        </div>
      </header>
      <div className="border-b border-line bg-surface">
        <SelectionBar screenId={id} />
      </div>
      <div className="relative flex min-h-0 flex-1">
        {leftOpen && (
          <aside className="absolute inset-y-0 left-0 z-30 w-64 overflow-auto border-r border-line bg-surface shadow-xl lg:static lg:shadow-none">
            <Palette screenId={id} onAdded={() => window.innerWidth < 1100 && setLeftOpen(false)} />
          </aside>
        )}
        <main className="min-w-0 flex-1" aria-label={t('editor.canvasLabel')}>
          <Stage screenId={id} mode="edit" />
        </main>
        {rightOpen && (
          <aside className="absolute inset-y-0 right-0 z-30 w-80 overflow-auto border-l border-line bg-surface shadow-xl xl:static xl:shadow-none" data-testid="inspector">
            <Inspector screenId={id} />
          </aside>
        )}
      </div>
      <Filmstrip screenId={id} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportDialog screenId={id} open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
