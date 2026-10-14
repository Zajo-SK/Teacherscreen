import { useState } from 'react';
import { CheckSquare, Pencil, Plus, Square, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { TextField } from '@/components/forms';
import { uid } from '@/lib/id';
import { str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const step = z.object({ id: str('', 40), text: str('', 200), done: z.boolean().catch(false) });
const schema = z.object({
  title: str(() => t('w.steps.def.title'), 120),
  steps: z
    .array(step)
    .max(30)
    .transform((a) => a.map((s, i) => (s.id ? s : { ...s, id: `s${i}` })))
    .catch([]),
});
type Config = z.output<typeof schema>;

function StepsWidget({ config, update }: WidgetProps<Config>) {
  const [editing, setEditing] = useState(false);
  const done = config.steps.filter((s) => s.done).length;
  const patch = (id: string, p: Partial<Config['steps'][number]>) => update({ steps: config.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', padding: 24, boxSizing: 'border-box', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h2 style={{ margin: 0, flex: 1, fontSize: 'min(6cqw, 10cqh)', fontWeight: 800, overflowWrap: 'anywhere' }}>{config.title}</h2>
        <span className="wmuted" style={{ fontSize: 28, fontWeight: 700 }} data-testid="steps-progress">
          {done}/{config.steps.length}
        </span>
        <button type="button" data-no-drag className="wbtn" style={{ padding: '0 16px' }} aria-pressed={editing} aria-label={t('w.steps.edit')} onClick={() => setEditing(!editing)}>
          <Pencil size={26} aria-hidden />
        </button>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }} data-no-drag>
        {config.steps.length === 0 && <li className="wmuted" style={{ fontSize: 28 }}>{t('w.steps.empty')}</li>}
        {config.steps.map((s, i) => (
          <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {editing ? (
              <>
                <span style={{ fontSize: 28, fontWeight: 800, width: 40 }}>{i + 1}.</span>
                <input className="winput" value={s.text} maxLength={200} aria-label={t('w.steps.stepN', { n: i + 1 })} onChange={(e) => patch(s.id, { text: e.target.value })} />
                <button type="button" className="wbtn" style={{ padding: '0 16px' }} aria-label={t('common.delete')} onClick={() => update({ steps: config.steps.filter((x) => x.id !== s.id) })}>
                  <Trash2 size={26} aria-hidden />
                </button>
              </>
            ) : (
              <button
                type="button"
                role="checkbox"
                aria-checked={s.done}
                onClick={() => patch(s.id, { done: !s.done })}
                style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'inherit', font: 'inherit', fontSize: 'min(4.2cqw, 7cqh)', cursor: 'pointer', padding: '6px 0', minHeight: 56 }}
              >
                {s.done ? <CheckSquare size={44} color="#16a34a" aria-hidden style={{ flex: 'none' }} /> : <Square size={44} aria-hidden style={{ flex: 'none' }} />}
                <span style={{ textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.55 : 1, overflowWrap: 'anywhere' }}>
                  <strong>{i + 1}.</strong> {s.text}
                </span>
              </button>
            )}
          </li>
        ))}
      </ol>
      <div style={{ display: 'flex', gap: 12 }} data-no-drag>
        {editing && (
          <button type="button" className="wbtn" disabled={config.steps.length >= 30} onClick={() => update({ steps: [...config.steps, { id: uid().slice(0, 8), text: '', done: false }] })}>
            <Plus size={26} aria-hidden /> {t('w.steps.add')}
          </button>
        )}
        <button type="button" className="wbtn" disabled={done === 0} onClick={() => update({ steps: config.steps.map((s) => ({ ...s, done: false })) })}>
          {t('w.steps.reset')}
        </button>
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <TextField label={t('w.steps.title')} value={config.title} max={120} onChange={(title) => update({ title })} />
      <TextField
        label={t('w.steps.list')}
        value={config.steps.map((s) => s.text).join('\n')}
        multiline
        rows={8}
        max={6000}
        onChange={(v) => {
          const lines = v.split('\n').slice(0, 30);
          update({ steps: lines.map((text, i) => ({ id: config.steps[i]?.id ?? uid().slice(0, 8), text: text.slice(0, 200), done: config.steps[i]?.done ?? false })) });
        }}
      />
      <p className="text-sm text-muted">{t('w.steps.hint')}</p>
    </>
  );
}

export const stepsWidget: WidgetDefinition<Config> = {
  type: 'steps',
  label: 'w.steps.label',
  description: 'w.steps.desc',
  icon: CheckSquare,
  category: 'content',
  defaultSize: { w: 720, h: 520 },
  minSize: { w: 300, h: 220 },
  schema,
  Component: StepsWidget,
  Settings,
};
