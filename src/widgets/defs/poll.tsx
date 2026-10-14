import { BarChart3, Minus, Plus } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { TextField, Toggle } from '@/components/forms';
import { uid } from '@/lib/id';
import { bool, int, str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const option = z.object({ id: str('', 40), text: str('', 100), votes: int(0, 0, 9999) });
const schema = z.object({
  question: str(() => t('w.poll.def.question'), 200),
  options: z
    .array(option)
    .min(2)
    .max(6)
    .transform((a) => a.map((o, i) => (o.id ? o : { ...o, id: `o${i}` })))
    .catch(() => [
      { id: 'a', text: t('w.poll.def.yes'), votes: 0 },
      { id: 'b', text: t('w.poll.def.no'), votes: 0 },
    ]),
  showPercent: bool(true),
});
type Config = z.output<typeof schema>;

function PollWidget({ config, update }: WidgetProps<Config>) {
  const total = config.options.reduce((a, o) => a + o.votes, 0);
  const max = Math.max(1, ...config.options.map((o) => o.votes));
  const vote = (id: string, d: number) => update({ options: config.options.map((o) => (o.id === id ? { ...o, votes: Math.max(0, Math.min(9999, o.votes + d)) } : o)) });
  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', padding: 24, boxSizing: 'border-box', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 'min(5.6cqw, 10cqh)', fontWeight: 800, overflowWrap: 'anywhere' }}>{config.question}</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
        {config.options.map((o) => (
          <li key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" data-no-drag className="wbtn" style={{ padding: '0 14px' }} aria-label={t('w.poll.minus', { name: o.text })} onClick={() => vote(o.id, -1)} disabled={o.votes === 0}>
              <Minus size={26} aria-hidden />
            </button>
            <div style={{ flex: 1, position: 'relative', minHeight: 84, borderRadius: 14, background: 'color-mix(in srgb, currentColor 8%, transparent)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${(o.votes / max) * 100}%`, background: '#6d5dfc', opacity: 0.35, transition: 'width .3s' }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%', padding: '0 20px', fontSize: 'min(4.6cqw, 8cqh)', fontWeight: 700, gap: 16 }}>
                <span style={{ overflowWrap: 'anywhere' }}>{o.text}</span>
                <span style={{ whiteSpace: 'nowrap' }} data-testid={`votes-${o.id}`}>
                  {o.votes}
                  {config.showPercent && total > 0 ? ` (${Math.round((o.votes / total) * 100)} %)` : ''}
                </span>
              </div>
            </div>
            <button type="button" data-no-drag className="wbtn wbtn-primary" style={{ padding: '0 14px' }} aria-label={t('w.poll.plus', { name: o.text })} onClick={() => vote(o.id, 1)}>
              <Plus size={26} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="wmuted" style={{ fontSize: 24, flex: 1 }}>
          {t('w.poll.note')} · {t('w.poll.total', { n: total })}
        </span>
        <button type="button" data-no-drag className="wbtn" disabled={total === 0} onClick={() => update({ options: config.options.map((o) => ({ ...o, votes: 0 })) })}>
          {t('w.poll.reset')}
        </button>
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <TextField label={t('w.poll.question')} value={config.question} max={200} onChange={(question) => update({ question })} />
      {config.options.map((o, i) => (
        <div key={o.id} className="mb-2 flex gap-2">
          <input
            className="input"
            value={o.text}
            maxLength={100}
            aria-label={t('w.poll.optionN', { n: i + 1 })}
            onChange={(e) => update({ options: config.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })}
          />
          <button type="button" className="btn" disabled={config.options.length <= 2} onClick={() => update({ options: config.options.filter((x) => x.id !== o.id) })}>
            {t('common.delete')}
          </button>
        </div>
      ))}
      <button type="button" className="btn mb-3" disabled={config.options.length >= 6} onClick={() => update({ options: [...config.options, { id: uid().slice(0, 8), text: '', votes: 0 }] })}>
        {t('w.poll.addOption')}
      </button>
      <Toggle label={t('w.poll.percent')} checked={config.showPercent} onChange={(showPercent) => update({ showPercent })} />
      <p className="text-sm text-muted">{t('w.poll.localOnly')}</p>
    </>
  );
}

export const pollWidget: WidgetDefinition<Config> = {
  type: 'poll',
  label: 'w.poll.label',
  description: 'w.poll.desc',
  icon: BarChart3,
  category: 'class',
  defaultSize: { w: 760, h: 520 },
  minSize: { w: 360, h: 260 },
  schema,
  Component: PollWidget,
  Settings,
};
