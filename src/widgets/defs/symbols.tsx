import { Ear, Handshake, Hand, MessageCircle, MessagesSquare, PenLine, UsersRound, Volume1, VolumeX, type LucideIcon } from 'lucide-react';
import { z } from 'zod';
import { t, type TKey } from '@/i18n';
import { Segmented, Toggle } from '@/components/forms';
import { oneOf } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

export const SYMBOL_IDS = ['silent', 'whisper', 'pair', 'group', 'help', 'free', 'solo', 'listen'] as const;
export type SymbolId = (typeof SYMBOL_IDS)[number];

const SYMBOLS: Record<SymbolId, { icon: LucideIcon; label: TKey; color: string }> = {
  silent: { icon: VolumeX, label: 'w.symbols.silent', color: '#dc2626' },
  whisper: { icon: Volume1, label: 'w.symbols.whisper', color: '#7c3aed' },
  pair: { icon: Handshake, label: 'w.symbols.pair', color: '#2563eb' },
  group: { icon: UsersRound, label: 'w.symbols.group', color: '#0e7490' },
  help: { icon: Hand, label: 'w.symbols.help', color: '#b45309' },
  free: { icon: MessagesSquare, label: 'w.symbols.free', color: '#15803d' },
  solo: { icon: PenLine, label: 'w.symbols.solo', color: '#be185d' },
  listen: { icon: Ear, label: 'w.symbols.listen', color: '#475569' },
};

const idEnum = z.enum(SYMBOL_IDS);
const schema = z.object({
  items: z
    .array(z.string())
    .transform((a) => SYMBOL_IDS.filter((id) => a.includes(id)))
    .catch(() => [...SYMBOL_IDS]),
  active: idEnum.nullable().catch(null),
  layout: oneOf(['grid', 'single'] as const, 'grid'),
});
type Config = z.output<typeof schema>;

function Card({ id, active, big, onClick }: { id: SymbolId; active: boolean; big?: boolean; onClick: () => void }) {
  const s = SYMBOLS[id];
  const Icon = s.icon;
  const name = t(s.label);
  return (
    <button
      type="button"
      data-no-drag
      aria-pressed={active}
      aria-label={t('w.symbols.cardAria', { name })}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.3em',
        minWidth: 0,
        minHeight: 0,
        padding: 8,
        borderRadius: 18,
        cursor: 'pointer',
        font: 'inherit',
        fontWeight: 800,
        fontSize: big ? 'min(9cqw, 13cqh)' : 'min(3.2cqw, 6cqh)',
        textAlign: 'center',
        overflowWrap: 'anywhere',
        lineHeight: 1.1,
        border: `4px solid ${s.color}`,
        background: active ? s.color : `color-mix(in srgb, ${s.color} 14%, transparent)`,
        color: active ? '#fff' : 'inherit',
        boxShadow: active ? `0 0 0 4px color-mix(in srgb, ${s.color} 40%, transparent)` : 'none',
        opacity: active ? 1 : 0.85,
        transform: active && !big ? 'scale(1.04)' : undefined,
        transition: 'transform .15s, background .15s',
      }}
    >
      <Icon aria-hidden style={{ width: big ? '2.2em' : '2.4em', height: big ? '2.2em' : '2.4em', color: active ? '#fff' : s.color, flexShrink: 0 }} />
      <span>{name}</span>
    </button>
  );
}

function SymbolsWidget({ config, update }: WidgetProps<Config>) {
  const items = config.items;
  const active = config.active && items.includes(config.active) ? config.active : null;
  const toggle = (id: SymbolId) => update({ active: active === id ? null : id });
  const single = config.layout === 'single' && active;
  const n = items.length;
  const cols = n <= 2 ? Math.max(1, n) : n <= 4 ? 2 : n <= 6 ? 3 : 4;
  return (
    <div className="widget-body" style={{ padding: 12, boxSizing: 'border-box', display: 'flex' }}>
      {single ? (
        <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Card id={active} active big onClick={() => toggle(active)} />
            </div>
          </div>
        </div>
      ) : n === 0 ? (
        <div className="wmuted" style={{ margin: 'auto', fontSize: 'min(4cqw, 8cqh)' }}>
          <MessageCircle aria-hidden />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '1fr', gap: 'min(1.5cqw, 3cqh)', minHeight: 0 }}>
          {items.map((id) => (
            <Card key={id} id={id} active={active === id} onClick={() => toggle(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <Segmented
        label={t('w.symbols.layout')}
        value={config.layout}
        onChange={(layout) => update({ layout })}
        options={[
          { value: 'grid', label: t('w.symbols.layout.grid') },
          { value: 'single', label: t('w.symbols.layout.single') },
        ]}
      />
      <span className="label">{t('w.symbols.shown')}</span>
      {SYMBOL_IDS.map((id) => {
        const on = config.items.includes(id);
        return (
          <Toggle
            key={id}
            label={t(SYMBOLS[id].label)}
            checked={on}
            onChange={(v) => {
              const items = SYMBOL_IDS.filter((x) => (x === id ? v : config.items.includes(x)));
              if (items.length === 0) return;
              update({ items, active: config.active && items.includes(config.active) ? config.active : null });
            }}
          />
        );
      })}
      <p className="text-sm text-muted">{t('w.symbols.hint')}</p>
    </>
  );
}

export const symbolsWidget: WidgetDefinition<Config> = {
  type: 'symbols',
  label: 'w.symbols.label',
  description: 'w.symbols.desc',
  icon: MessageCircle,
  category: 'class',
  defaultSize: { w: 600, h: 400 },
  minSize: { w: 240, h: 160 },
  schema,
  Component: SymbolsWidget,
  Settings,
};
