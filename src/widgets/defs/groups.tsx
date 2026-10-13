import { Users } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { NumberField, Segmented } from '@/components/forms';
import { splitIntoGroups, verifyPartition } from '@/lib/groups';
import { int, nullableStr, oneOf, strList } from '../fields';
import { ClassPicker, NamesEditor } from '../NamesEditor';
import { useStudentNames } from '../studentNames';
import { useRuntime } from '../runtime';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  names: strList(200, 60),
  classId: nullableStr,
  mode: oneOf(['count', 'size'] as const, 'count'),
  value: int(4, 1, 100),
  result: z
    .array(z.array(z.string().transform((s) => s.slice(0, 60))).max(200))
    .max(100)
    .catch([]),
});
type Config = z.output<typeof schema>;

function GroupsWidget({ widget, config, update }: WidgetProps<Config>) {
  const { names } = useStudentNames(config, update);
  const empty = names.length === 0;
  const flat = config.result.flat();
  const ok = config.result.length > 0 && verifyPartition(names, config.result);
  const stale = config.result.length > 0 && !ok;
  const run = () => update({ result: splitIntoGroups(names, config.mode, config.value) });
  const total = Math.max(1, flat.length);
  const font = Math.round(Math.max(16, Math.min(40, Math.sqrt((widget.w * (widget.h - 140)) / (total * 2.4 + config.result.length * 9)) * 0.42)));
  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', padding: 20, boxSizing: 'border-box', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }} data-no-drag>
        <button type="button" className="wbtn wbtn-primary" onClick={run} disabled={empty}>
          <Users size={28} aria-hidden /> {config.result.length ? t('w.groups.again') : t('w.groups.split')}
        </button>
        <span className="wmuted" style={{ fontSize: 26 }}>
          {empty
            ? t('w.groups.empty')
            : stale
              ? t('w.groups.stale')
              : config.result.length
                ? t('w.groups.verified', { n: flat.length })
                : t('w.groups.summary', { n: names.length, mode: config.mode === 'count' ? t('w.groups.countN', { n: config.value }) : t('w.groups.sizeN', { n: config.value }) })}
        </span>
      </div>
      <div
        data-testid="groups-result"
        style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${Math.round(font * 8)}px, 1fr))`, gap: 14, alignContent: 'start' }}
      >
        {config.result.map((g, i) => (
          <section key={i} aria-label={t('w.groups.groupN', { n: i + 1 })} style={{ border: '3px solid color-mix(in srgb, currentColor 30%, transparent)', borderRadius: 16, padding: 14, background: 'color-mix(in srgb, currentColor 6%, transparent)' }}>
            <h3 style={{ margin: 0, fontSize: font * 1.2, fontWeight: 800, color: GROUP_COLORS[i % GROUP_COLORS.length] }}>{t('w.groups.groupN', { n: i + 1 })}</h3>
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', fontSize: font, lineHeight: 1.3 }}>
              {g.map((n, j) => (
                <li key={j} style={{ overflowWrap: 'anywhere' }}>
                  {n}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

const GROUP_COLORS = ['#6d5dfc', '#ff4d6d', '#12b886', '#f59f00', '#9c36b5', '#1098ad', '#e64980', '#5c940d'];

function Settings({ config, update }: SettingsProps<Config>) {
  const rt = useRuntime();
  const sn = useStudentNames(config, update, { result: [] });
  const pickers = rt.widgets.filter((w) => w.type === 'picker' && Array.isArray((w.config as { names?: unknown }).names) && (w.config as { names: string[] }).names.length > 0);
  return (
    <>
      <ClassPicker classes={sn.classes} classId={config.classId} hasNames={config.names.length > 0} onPick={sn.pickClass} onSave={sn.saveAsClass} />
      <NamesEditor names={sn.names} onChange={sn.setNames} />
      {pickers.length > 0 && !config.classId && (
        <button type="button" className="btn mb-3" onClick={() => update({ names: (pickers[0]!.config as { names: string[] }).names.slice(), result: [] })}>
          {t('w.groups.fromPicker')}
        </button>
      )}
      <Segmented
        label={t('w.groups.mode')}
        value={config.mode}
        onChange={(mode) => update({ mode, result: [] })}
        options={[
          { value: 'count', label: t('w.groups.byCount') },
          { value: 'size', label: t('w.groups.bySize') },
        ]}
      />
      <NumberField label={config.mode === 'count' ? t('w.groups.countLabel') : t('w.groups.sizeLabel')} value={config.value} min={1} max={100} onChange={(value) => update({ value, result: [] })} />
      <p className="text-sm text-muted">{t('w.picker.privacy')}</p>
    </>
  );
}

export const groupsWidget: WidgetDefinition<Config> = {
  type: 'groups',
  label: 'w.groups.label',
  description: 'w.groups.desc',
  icon: Users,
  category: 'class',
  defaultSize: { w: 900, h: 560 },
  minSize: { w: 360, h: 260 },
  schema,
  Component: GroupsWidget,
  Settings,
  hasStudentData: true,
  stripStudentData: (c) => ({ ...c, names: [], result: [] }),
};
