import { Settings2, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceAround, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceAround, ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, CopyPlus, Lock, Trash2, Unlock, type LucideIcon } from 'lucide-react';
import { t, getLocale, type TKey } from '@/i18n';
import { useApp, screensInDeck } from '@/store/useApp';
import type { Align } from '@/lib/screenOps';

function Btn({ icon: Icon, label, onClick, disabled, pressed }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return (
    <button type="button" className="btn btn-icon btn-ghost" title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon size={20} aria-hidden />
    </button>
  );
}

const ALIGN: { how: Align; icon: LucideIcon; label: TKey }[] = [
  { how: 'left', icon: AlignStartVertical, label: 'sel.alignLeft' },
  { how: 'center', icon: AlignCenterVertical, label: 'sel.alignCenter' },
  { how: 'right', icon: AlignEndVertical, label: 'sel.alignRight' },
  { how: 'top', icon: AlignStartHorizontal, label: 'sel.alignTop' },
  { how: 'middle', icon: AlignCenterHorizontal, label: 'sel.alignMiddle' },
  { how: 'bottom', icon: AlignEndHorizontal, label: 'sel.alignBottom' },
];

export function SelectionBar({ screenId }: { screenId: string }) {
  const screen = useApp((s) => s.screens[screenId]);
  const screens = useApp((s) => s.screens);
  const selection = useApp((s) => s.selection);
  const a = useApp.getState();
  const inspectorOpen = useApp((s) => s.inspectorOpen);
  if (!screen || selection.length === 0) return <div className="h-12" aria-hidden />;
  const sel = screen.widgets.filter((w) => selection.includes(w.id));
  const allLocked = sel.length > 0 && sel.every((w) => w.locked);
  const others = Object.values(screens).filter((s) => s.id !== screenId).sort((x, y) => x.name.localeCompare(y.name, getLocale()));
  void screensInDeck;
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1 px-2" role="toolbar" aria-label={t('sel.align')}>
      <button type="button" className="btn btn-primary min-h-10" data-testid="widget-settings-btn" aria-pressed={inspectorOpen} data-tip={t('sel.settingsTip')} onClick={() => a.setInspectorOpen(!inspectorOpen)}>
        <Settings2 size={18} aria-hidden /> {t('sel.settings')}
      </button>
      <span className="mx-1 h-6 w-px bg-line" aria-hidden />
      {ALIGN.map((x) => (
        <Btn key={x.how} icon={x.icon} label={t(x.label)} onClick={() => a.align(screenId, selection, x.how)} />
      ))}
      <Btn icon={AlignHorizontalSpaceAround} label={t('sel.distributeH')} disabled={sel.length < 3} onClick={() => a.distribute(screenId, selection, 'h')} />
      <Btn icon={AlignVerticalSpaceAround} label={t('sel.distributeV')} disabled={sel.length < 3} onClick={() => a.distribute(screenId, selection, 'v')} />
      <span className="mx-1 h-6 w-px bg-line" aria-hidden />
      <Btn icon={ArrowUpToLine} label={t('sel.front')} onClick={() => a.reorderWidgets(screenId, selection, 'front')} />
      <Btn icon={ChevronUp} label={t('sel.forward')} onClick={() => a.reorderWidgets(screenId, selection, 'forward')} />
      <Btn icon={ChevronDown} label={t('sel.backward')} onClick={() => a.reorderWidgets(screenId, selection, 'backward')} />
      <Btn icon={ArrowDownToLine} label={t('sel.back')} onClick={() => a.reorderWidgets(screenId, selection, 'back')} />
      <span className="mx-1 h-6 w-px bg-line" aria-hidden />
      <Btn icon={allLocked ? Unlock : Lock} label={allLocked ? t('sel.unlock') : t('sel.lock')} pressed={allLocked} onClick={() => a.setLocked(screenId, selection, !allLocked)} />
      <Btn icon={Copy} label={t('sel.copy')} onClick={() => a.copyWidgets(screenId, selection)} />
      <Btn icon={CopyPlus} label={t('common.duplicate')} onClick={() => a.duplicateWidgets(screenId, selection)} />
      <Btn icon={Trash2} label={t('common.delete')} onClick={() => a.removeWidgets(screenId, selection)} />
      {others.length > 0 && (
        <>
          <label className="sr-only" htmlFor="copy-to">
            {t('editor.copyToScreen')}
          </label>
          <select
            id="copy-to"
            className="input ml-1 w-auto max-w-48"
            value=""
            onChange={(e) => {
              if (e.target.value) a.copyToScreen(screenId, selection, e.target.value);
            }}
          >
            <option value="">{t('editor.copyToScreen')}…</option>
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
