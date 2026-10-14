import { useEffect, useRef, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { Toggle } from '@/components/forms';
import { randomInt } from '@/lib/random';
import { bool, nullableStr, str, strList } from '../fields';
import { useRuntime } from '../runtime';
import { ClassPicker, NamesEditor } from '../NamesEditor';
import { useStudentNames } from '../studentNames';
import { AttendancePanel, AttendanceSettings } from '../AttendancePanel';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';


const schema = z.object({
  names: strList(200, 60),
  classId: nullableStr,
  absent: strList(200, 70),
  picked: strList(200, 60),
  current: str('', 60),
  excludePicked: bool(true),
  animate: bool(true),
});
type Config = z.output<typeof schema>;

/** Zostávajúce mená po odstránení už vybraných (rešpektuje aj rovnaké mená viackrát). */
export function remainingNames(names: readonly string[], picked: readonly string[]): string[] {
  const used = new Map<string, number>();
  for (const p of picked) used.set(p, (used.get(p) ?? 0) + 1);
  return names.filter((n) => {
    const c = used.get(n) ?? 0;
    if (c > 0) {
      used.set(n, c - 1);
      return false;
    }
    return true;
  });
}

function PickerWidget({ config, update }: WidgetProps<Config>) {
  const rt = useRuntime();
  const [shown, setShown] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const { names, active, absent, setAbsent } = useStudentNames(config, update);
  const [panel, setPanel] = useState(false);
  const remaining = remainingNames(active, config.picked);
  const pool = config.excludePicked ? remaining : active;
  const empty = active.length === 0;
  const exhausted = !empty && pool.length === 0;

  const finish = (name: string) => {
    setSpinning(false);
    setShown(null);
    update({ current: name, picked: [...config.picked, name].slice(-200) });
  };

  const pick = () => {
    if (pool.length === 0 || spinning) return;
    const winner = pool[randomInt(pool.length)]!;
    if (!config.animate || !rt.animations) return finish(winner);
    setSpinning(true);
    const steps = 18;
    let acc = 0;
    for (let i = 0; i < steps; i++) {
      acc += 50 + i * i * 1.1;
      const last = i === steps - 1;
      timers.current.push(
        window.setTimeout(() => (last ? finish(winner) : setShown(pool[randomInt(pool.length)]!)), acc),
      );
    }
  };

  const display = spinning ? shown : config.current;
  return (
    <div className="widget-body" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3cqh', padding: 20, boxSizing: 'border-box', textAlign: 'center' }}>
      <div
        aria-live="polite"
        data-testid="picker-result"
        style={{ fontSize: 'min(11cqw, 28cqh)', fontWeight: 800, lineHeight: 1.1, overflowWrap: 'anywhere', minHeight: '1.2em' }}
        className={spinning ? '' : display ? 'ts-pop' : ''}
      >
        {empty ? <span className="wmuted" style={{ fontSize: '0.45em', fontWeight: 600 }}>{names.length > 0 ? t('att.noneActive') : t('w.picker.empty')}</span> : display || <span className="wmuted">?</span>}
      </div>
      {exhausted && <div style={{ fontSize: 'min(4.5cqw, 7cqh)' }}>{t('w.picker.exhausted')}</div>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }} data-no-drag>
        <button type="button" className="wbtn wbtn-primary" onClick={pick} disabled={empty || exhausted || spinning}>
          <Shuffle size={30} aria-hidden /> {t('w.picker.pick')}
        </button>
        {config.picked.length > 0 && (
          <button type="button" className="wbtn" onClick={() => update({ picked: [], current: '' })}>
            {t('w.picker.reset')}
          </button>
        )}
        {names.length > 0 && (
          <button type="button" className="wbtn" data-testid="attendance-open" aria-expanded={panel} data-tip={t('att.openTip')} onClick={() => setPanel(true)}>
            👥 {t('att.open', { n: active.length, total: names.length })}
          </button>
        )}
      </div>
      {!empty && (
        <div className="wmuted" style={{ fontSize: 'min(3.6cqw, 6cqh)' }}>
          {t('w.picker.remaining', { n: remaining.length, total: active.length })}
        </div>
      )}
      {panel && <AttendancePanel names={names} absent={absent} onChange={setAbsent} onClose={() => setPanel(false)} />}
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const sn = useStudentNames(config, update, { picked: [], current: '' });
  return (
    <>
      <ClassPicker classes={sn.classes} classId={config.classId} hasNames={config.names.length > 0} onPick={sn.pickClass} onSave={sn.saveAsClass} />
      <NamesEditor names={sn.names} onChange={sn.setNames} />
      <AttendanceSettings names={sn.names} absent={sn.absent} onChange={sn.setAbsent} />
      <Toggle label={t('w.picker.exclude')} checked={config.excludePicked} onChange={(excludePicked) => update({ excludePicked })} />
      <Toggle label={t('w.picker.animate')} checked={config.animate} onChange={(animate) => update({ animate })} />
      <p className="text-sm text-muted">{t('w.picker.privacy')}</p>
    </>
  );
}

export const pickerWidget: WidgetDefinition<Config> = {
  type: 'picker',
  label: 'w.picker.label',
  description: 'w.picker.desc',
  icon: Shuffle,
  category: 'class',
  defaultSize: { w: 640, h: 420 },
  minSize: { w: 320, h: 240 },
  schema,
  Component: PickerWidget,
  Settings,
  hasStudentData: true,
  stripStudentData: (c) => ({ ...c, names: [], absent: [], picked: [], current: '' }), // classId ostáva – je to len odkaz, nie mená
};

