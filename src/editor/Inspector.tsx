import { Lock, Unlock } from 'lucide-react';
import { t } from '@/i18n';
import { useApp } from '@/store/useApp';
import { ASPECTS } from './aspects';
import { COLOR_PRESETS, ColorField, NumberField, TextField } from '@/components/forms';
import { getWidgetDefinition } from '@/widgets/registry';
import { BackgroundPicker } from './BackgroundPicker';
import type { WidgetInstance } from '@/types';
import { CANVAS_SIZES } from '@/types';

export function Inspector({ screenId }: { screenId: string }) {
  const screen = useApp((s) => s.screens[screenId]);
  const selection = useApp((s) => s.selection);
  const patchConfig = useApp((s) => s.patchConfig);
  const patchWidget = useApp((s) => s.patchWidget);
  const setColors = useApp((s) => s.setColors);
  const setLocked = useApp((s) => s.setLocked);
  const updateMeta = useApp((s) => s.updateScreenMeta);
  const setAspect = useApp((s) => s.setAspect);
  if (!screen) return null;
  const selected = screen.widgets.filter((w) => selection.includes(w.id));

  if (selected.length === 0) {
    return (
      <div className="p-4" aria-label={t('editor.inspector')}>
        <p className="mb-4 text-sm text-muted">{t('editor.nothingSelected')}</p>
        <TextField label={t('editor.screenName')} value={screen.name} max={120} onChange={(name) => updateMeta(screenId, { name })} />
        <TextField label={t('editor.screenDescription')} value={screen.description} max={500} multiline onChange={(description) => updateMeta(screenId, { description })} />
        <div className="mb-4">
          <label className="label" htmlFor="aspect">
            {t('editor.aspect')}
          </label>
          <select id="aspect" className="input" value={screen.aspect} onChange={(e) => setAspect(screenId, e.target.value as keyof typeof CANVAS_SIZES)}>
            {ASPECTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <BackgroundPicker screenId={screenId} background={screen.background} />
      </div>
    );
  }

  const ids = selected.map((w) => w.id);
  const first = selected[0]!;
  const single = selected.length === 1 ? first : null;
  const def = single ? getWidgetDefinition(single.type) : null;
  const canvas = CANVAS_SIZES[screen.aspect];

  const geo = (w: WidgetInstance, key: 'x' | 'y' | 'w' | 'h', label: string, max: number, min = 0) => (
    <NumberField label={label} value={w[key]} min={min} max={max} onChange={(v) => patchWidget(screenId, w.id, { [key]: v })} />
  );

  return (
    <div className="p-4" aria-label={t('editor.inspector')}>
      <h2 className="mb-3 text-lg font-bold">{single && def ? t(def.label) : t('sel.selected', { n: selected.length })}</h2>
      {single && def?.Settings && (
        <div className="mb-4 border-b border-line pb-2">
          <def.Settings widget={single} config={single.config} update={(patch: Record<string, unknown>) => patchConfig(screenId, single.id, patch)} />
        </div>
      )}
      <section className="mb-4 border-b border-line pb-2" aria-label={t('sel.colors')}>
        <ColorField label={t('sel.bg')} value={first.colors.bg} presets={COLOR_PRESETS} autoLabel={t('sel.colorAuto')} onChange={(bg) => setColors(screenId, ids, { bg })} />
        <ColorField label={t('sel.fg')} value={first.colors.fg} presets={COLOR_PRESETS} autoLabel={t('sel.colorAuto')} onChange={(fg) => setColors(screenId, ids, { fg })} />
      </section>
      {single && (
        <section aria-label={t('sel.position')}>
          <h3 className="mb-2 text-sm font-bold text-muted">{t('sel.position')}</h3>
          <div className="grid grid-cols-2 gap-x-3">
            {geo(single, 'x', 'X', canvas.w)}
            {geo(single, 'y', 'Y', canvas.h)}
            {geo(single, 'w', t('sel.width'), canvas.w, def?.minSize.w ?? 60)}
            {geo(single, 'h', t('sel.height'), canvas.h, def?.minSize.h ?? 40)}
          </div>
        </section>
      )}
      <button type="button" className="btn mt-2 w-full" onClick={() => setLocked(screenId, ids, !selected.every((w) => w.locked))}>
        {selected.every((w) => w.locked) ? <Unlock size={18} aria-hidden /> : <Lock size={18} aria-hidden />}
        {selected.every((w) => w.locked) ? t('sel.unlock') : t('sel.lock')}
      </button>
    </div>
  );
}
