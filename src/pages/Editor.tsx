import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, CircleAlert, Cloud, Home, Loader2, Maximize, Minimize, PanelRight, Play, Redo2, Settings, Share, Undo2 } from 'lucide-react';
import { Stage, backgroundStyle } from '@/components/Stage';
import { SettingsDialog } from '@/components/SettingsDialog';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { fullscreenSupported, toggleFullscreen, useFullscreen } from '@/lib/fullscreen';
import { useApp } from '@/store/useApp';
import { ScreenRuntime } from '@/widgets/ScreenRuntime';
import { WidgetBar } from '@/editor/WidgetBar';
import { ScreenSwitcher } from '@/editor/ScreenSwitcher';
import { Inspector } from '@/editor/Inspector';
import { SelectionBar } from '@/editor/SelectionBar';
import { ExportDialog } from '@/editor/ExportDialog';
import { useEditorShortcuts } from '@/editor/useShortcuts';
import { CloudScreenButton } from '@/backend/CloudPanel';
import { Tour, type TourStep } from '@/components/Tour';

const EDITOR_TOUR: TourStep[] = [
  { target: ['[data-tour=palette]'], title: 'tour.editor.palette.title', text: 'tour.editor.palette.text' },
  { target: ['[data-tour=stage]'], title: 'tour.editor.stage.title', text: 'tour.editor.stage.text' },
  { target: ['[data-tour=inspector-toggle]'], title: 'tour.editor.settings.title', text: 'tour.editor.settings.text' },
  { target: ['[data-tour=undo]'], title: 'tour.editor.undo.title', text: 'tour.editor.undo.text' },
  { target: ['[data-tour=screens]'], title: 'tour.editor.screens.title', text: 'tour.editor.screens.text' },
  { target: ['[data-tour=present]'], title: 'tour.editor.present.title', text: 'tour.editor.present.text' },
];

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
  const rightOpen = useApp((s) => s.inspectorOpen);
  const setRightOpen = useApp((s) => s.setInspectorOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(() => {
    try {
      return localStorage.getItem('ts.header.hidden') === '1';
    } catch {
      return false;
    }
  });
  const toggleHeader = (hidden: boolean) => {
    setHeaderHidden(hidden);
    try {
      localStorage.setItem('ts.header.hidden', hidden ? '1' : '0');
    } catch {
      /* ignore */
    }
  };
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
    <div className="relative h-dvh overflow-hidden bg-bg" data-testid="editor-root">
      <div className="absolute inset-0 flex">
        <main data-tour="stage" className="relative min-w-0 flex-1 overflow-hidden" style={backgroundStyle(screen.background)} aria-label={t('editor.canvasLabel')}>
          <div className="absolute inset-0">
            <Stage screenId={id} mode="edit" bleed />
          </div>
          {headerHidden && (
            <button type="button" className="btn absolute left-2 top-2 z-40 gap-2 rounded-full bg-black/70 px-4 text-white shadow-lg backdrop-blur" data-testid="header-show" onClick={() => toggleHeader(false)}>
              <ChevronDown size={18} aria-hidden /> {t('editor.headerShow')}
            </button>
          )}
          <header hidden={headerHidden} className="absolute inset-x-2 top-2 z-40 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/90 px-2 py-2 shadow-lg backdrop-blur data-[hidden]:hidden">
            <button type="button" className="btn btn-icon" aria-label={t('editor.home')} title={t('editor.home')} onClick={() => navigate({ name: 'home' })}>
              <Home size={20} aria-hidden />
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
            <button type="button" className="btn btn-icon" data-testid="header-hide" aria-label={t('editor.headerHide')} data-tip={t('editor.headerHide')} onClick={() => toggleHeader(true)}>
              <ChevronUp size={20} aria-hidden />
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <button type="button" className="btn btn-icon" aria-label={t('common.undo')} title={`${t('common.undo')} (Ctrl+Z)`} data-tour="undo" data-testid="undo" disabled={!history?.past.length} onClick={() => undo(id)}>
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
              <button type="button" className="btn btn-icon" data-tour="inspector-toggle" data-testid="inspector-toggle" aria-label={t('editor.inspector')} data-tip={t('editor.inspectorTip')} aria-pressed={rightOpen} onClick={() => setRightOpen(!rightOpen)}>
                <PanelRight size={20} aria-hidden />
              </button>
              <button type="button" className="btn btn-primary" data-tour="present" data-testid="present-btn" onClick={() => navigate({ name: 'present', id })}>
                <Play size={18} aria-hidden /> {t('editor.present')}
              </button>
            </div>
              </header>
          <div className="pointer-events-none absolute inset-x-0 top-[76px] z-20 flex justify-center px-2">
            <div className="pointer-events-auto max-w-full rounded-2xl border border-line bg-surface/95 shadow-lg backdrop-blur empty:hidden">
              <SelectionBar screenId={id} />
            </div>
          </div>
          <ScreenSwitcher screenId={id} />
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-[216px]">
            <WidgetBar screenId={id} />
          </div>
        </main>
        {rightOpen && (
          <aside className="absolute inset-y-0 right-0 z-30 w-80 overflow-auto max-xl:pt-[76px] border-l border-line bg-surface shadow-xl xl:static xl:shadow-none" data-testid="inspector">
            <ScreenRuntime screenId={id} scale={1}>
              <Inspector screenId={id} />
            </ScreenRuntime>
          </aside>
        )}
      </div>
      <Tour id="editor" steps={EDITOR_TOUR} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportDialog screenId={id} open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
