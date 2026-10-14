import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Users, X } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { NumberField, Segmented } from '@/components/forms';
import { moveStudent, ruleViolations, splitWithRules, verifyPartition } from '@/lib/groups';
import { int, nullableStr, oneOf, strList } from '../fields';
import { ClassPicker, NamesEditor } from '../NamesEditor';
import { RulesEditor } from '../RulesEditor';
import { useStudentNames } from '../studentNames';
import { useRuntime } from '../runtime';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const pair = z.tuple([z.string().transform((s) => s.slice(0, 60)), z.string().transform((s) => s.slice(0, 60))]);
const schema = z.object({
  names: strList(200, 60),
  classId: nullableStr,
  rules: z
    .object({ apart: z.array(pair).max(100).catch([]), together: z.array(pair).max(100).catch([]) })
    .catch({ apart: [], together: [] }),
  mode: oneOf(['count', 'size'] as const, 'count'),
  value: int(4, 1, 100),
  result: z
    .array(z.array(z.string().transform((s) => s.slice(0, 60))).max(200))
    .max(100)
    .catch([]),
});
type Config = z.output<typeof schema>;

const GROUP_COLORS = ['#6d5dfc', '#ff4d6d', '#12b886', '#f59f00', '#9c36b5', '#1098ad', '#e64980', '#5c940d'];

interface DragState {
  name: string;
  from: number;
  index: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
  active: boolean;
  over: number | null;
}

function GroupsWidget({ widget, config, update }: WidgetProps<Config>) {
  const rt = useRuntime();
  const { names, rules } = useStudentNames(config, update);
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const resultRef = useRef(config.result);
  resultRef.current = config.result;
  const live = useRef({ update });
  live.current = { update };

  const empty = names.length === 0;
  const flat = config.result.flat();
  const ok = config.result.length > 0 && verifyPartition(names, config.result);
  const stale = config.result.length > 0 && !ok;
  const violations = useMemo(() => ruleViolations(config.result, rules), [config.result, rules]);
  const run = () => {
    const r = splitWithRules(names, config.mode, config.value, rules);
    if (!r.ok) {
      setNotice({ kind: 'error', text: r.reason === 'conflict' ? t('w.groups.conflict', { pair: r.detail ?? '' }) : t('w.groups.noSolution') });
      return;
    }
    const msgs = [!r.balanced ? t('w.groups.unbalanced') : '', r.ignoredRules ? t('w.groups.ignored', { n: r.ignoredRules }) : ''].filter(Boolean);
    setNotice(msgs.length ? { kind: 'info', text: msgs.join(' ') } : null);
    update({ result: r.groups });
  };
  const total = Math.max(1, flat.length);
  const font = Math.round(Math.max(16, Math.min(40, Math.sqrt((widget.w * (widget.h - 140)) / (total * 2.4 + config.result.length * 9)) * 0.42)));

  const move = (from: number, index: number, to: number) => {
    const next = moveStudent(resultRef.current, from, index, to);
    live.current.update({ result: next });
    setNotice(null);
  };

  // Presúvanie žiakov ťahaním (myš aj dotyk). Ghost sa kreslí mimo plochy (portal), preto sa mierka berie z rt.scale.
  const startDrag = (e: ReactPointerEvent, name: string, from: number, index: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const st: DragState = { name, from, index, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, active: false, over: null };
    dragRef.current = st;
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      d.x = ev.clientX;
      d.y = ev.clientY;
      if (!d.active && Math.hypot(d.x - d.sx, d.y - d.sy) > 5) d.active = true;
      if (d.active) {
        const target = document.elementsFromPoint(ev.clientX, ev.clientY).map((el) => el.closest<HTMLElement>('[data-group-index]')).find(Boolean);
        d.over = target ? Number(target.dataset.groupIndex) : null;
        setDrag({ ...d });
      }
    };
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d?.active && ev.type === 'pointerup' && d.over !== null && d.over !== d.from) move(d.from, d.index, d.over);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const chipKey = (e: ReactKeyboardEvent, gi: number, j: number) => {
    const to = e.key === 'ArrowLeft' ? gi - 1 : e.key === 'ArrowRight' ? gi + 1 : null;
    if (to === null || to < 0 || to >= config.result.length) return;
    e.preventDefault();
    e.stopPropagation();
    move(gi, j, to);
    setNotice({ kind: 'info', text: t('w.groups.moved', { name: config.result[gi]![j]!, n: to + 1 }) });
  };

  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', padding: 20, boxSizing: 'border-box', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }} data-no-drag>
        <button type="button" className="wbtn wbtn-primary" onClick={run} disabled={empty}>
          <Users size={28} aria-hidden /> {config.result.length ? t('w.groups.again') : t('w.groups.split')}
        </button>
        {config.result.length > 0 && (
          <button type="button" className="wbtn" style={{ padding: '0 18px' }} aria-label={t('w.groups.addGroup')} data-tip={t('w.groups.addGroup')} onClick={() => update({ result: [...config.result, []] })} disabled={config.result.length >= 100}>
            <Plus size={26} aria-hidden />
          </button>
        )}
        <span className="wmuted" style={{ fontSize: 26 }} data-testid="groups-status">
          {empty
            ? t('w.groups.empty')
            : stale
              ? t('w.groups.stale')
              : config.result.length
                ? t('w.groups.verified', { n: flat.length })
                : t('w.groups.summary', { n: names.length, mode: config.mode === 'count' ? t('w.groups.countN', { n: config.value }) : t('w.groups.sizeN', { n: config.value }) })}
        </span>
      </div>
      {notice && (
        <div role={notice.kind === 'error' ? 'alert' : 'status'} style={{ fontSize: 24, fontWeight: 600, color: notice.kind === 'error' ? '#d6336c' : undefined }} data-testid="groups-notice">
          {notice.text}
        </div>
      )}
      <div
        data-testid="groups-result"
        style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${Math.round(font * 8)}px, 1fr))`, gap: 14, alignContent: 'start' }}
      >
        {config.result.map((g, i) => {
          const hot = drag?.active && drag.over === i && drag.from !== i;
          return (
            <section
              key={i}
              data-group-index={i}
              aria-label={t('w.groups.groupN', { n: i + 1 })}
              style={{
                border: `3px ${hot ? 'solid' : 'solid'} ${hot ? GROUP_COLORS[i % GROUP_COLORS.length] : 'color-mix(in srgb, currentColor 30%, transparent)'}`,
                borderRadius: 16,
                padding: 14,
                minHeight: font * 2.4,
                background: hot ? `color-mix(in srgb, ${GROUP_COLORS[i % GROUP_COLORS.length]} 16%, transparent)` : 'color-mix(in srgb, currentColor 6%, transparent)',
                transition: 'background .15s, border-color .15s',
              }}
            >
              <h3 style={{ margin: 0, fontSize: font * 1.2, fontWeight: 800, color: GROUP_COLORS[i % GROUP_COLORS.length], display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>
                  {t('w.groups.groupN', { n: i + 1 })} <span className="wmuted" style={{ fontSize: font * 0.7, fontWeight: 600 }}>({g.length})</span>
                </span>
                {g.length === 0 && (
                  <button type="button" data-no-drag className="wbtn" style={{ minHeight: font * 1.3, minWidth: 0, padding: '0 10px', fontSize: font * 0.8 }} aria-label={t('w.groups.removeGroup')} data-tip={t('w.groups.removeGroup')} onClick={() => update({ result: config.result.filter((_, k) => k !== i) })}>
                    <X size={font * 0.8} aria-hidden />
                  </button>
                )}
              </h3>
              <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', fontSize: font, lineHeight: 1.3, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {g.map((n, j) => {
                  const bad = violations.has(n);
                  const dragging = drag?.active && drag.from === i && drag.index === j;
                  return (
                    <li key={`${n}-${j}`} style={{ overflowWrap: 'anywhere' }}>
                      <button
                        type="button"
                        data-no-drag
                        data-testid="group-student"
                        data-tip={bad ? t('w.groups.violates') : t('w.groups.dragHint')}
                        aria-label={n}
                        onPointerDown={(e) => startDrag(e, n, i, j)}
                        onKeyDown={(e) => chipKey(e, i, j)}
                        style={{
                          all: 'unset',
                          boxSizing: 'border-box',
                          display: 'block',
                          width: '100%',
                          cursor: 'grab',
                          touchAction: 'none',
                          borderRadius: 10,
                          padding: '2px 8px',
                          opacity: dragging ? 0.35 : 1,
                          outline: bad ? '3px solid #d6336c' : undefined,
                          background: bad ? 'color-mix(in srgb, #d6336c 14%, transparent)' : undefined,
                        }}
                      >
                        {n}
                        {bad && <span aria-hidden> ⚠</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {drag?.active &&
        createPortal(
          <div
            aria-hidden
            style={{ position: 'fixed', left: drag.x, top: drag.y, transform: 'translate(-50%, -60%) rotate(-3deg)', pointerEvents: 'none', zIndex: 100002, fontSize: Math.max(14, font * rt.scale), fontWeight: 700, padding: '4px 14px', borderRadius: 999, background: 'var(--primary)', color: 'var(--primary-fg)', boxShadow: '0 10px 24px rgba(0,0,0,.3)' }}
          >
            {drag.name}
          </div>,
          document.body,
        )}
    </div>
  );
}

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
      <RulesEditor names={sn.names} rules={sn.rules} onChange={sn.setRules} />
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
  stripStudentData: (c) => ({ ...c, names: [], result: [], rules: { apart: [], together: [] } }),
};
