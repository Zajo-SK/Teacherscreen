import { Heart } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { Field, Toggle } from '@/components/forms';
import { bool, num } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

export const STICKER_DEFAULT = '⭐';
const SYMBOL_MAX = 8;

/** Skráti reťazec na `max` grafémov (emoji sekvencie sa nerozrežú). */
export function clipSymbol(s: string, max = SYMBOL_MAX): string {
  const v = s.slice(0, 64);
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  const parts = Seg ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(v), (x) => x.segment) : Array.from(v);
  return parts.slice(0, max).join('');
}

const schema = z.object({
  symbol: z
    .string()
    .transform((s) => clipSymbol(s))
    .catch(STICKER_DEFAULT),
  rotation: num(0, -15, 15),
  shadow: bool(false),
});
type Config = z.output<typeof schema>;

const CATEGORIES = [
  {
    key: 'w.sticker.cat.smileys',
    items: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😎 🤩 🥳 🤔 🤗 😮 😴 😢 😭 😡 🤯 👍 👎 👏 🙌 🙏 👋 💪 ✌️ 🤞 👌 👀 🧠 ❤️ 💖'.split(' '),
  },
  {
    key: 'w.sticker.cat.school',
    items: '📚 📖 📝 ✏️ 🖍️ 🖊️ 📏 📐 🎒 🏫 🎓 🧮 🔬 🔭 🧪 🧬 🌍 🗺️ 🎨 🎭 🎵 🎼 ⚽ 🏀 🏆 🥇 🥈 🥉 🏅 💡 ✅ ❌ ❓ ❗ 💯 🕐 📅 🔔 📢 🎯'.split(' '),
  },
  {
    key: 'w.sticker.cat.nature',
    items: '🌞 🌙 ⭐ 🌟 ✨ ☁️ 🌈 ⛅ 🌧️ ❄️ 🔥 💧 🌸 🌻 🌳 🌲 🍀 🍎 🍌 🍓 🍕 🐶 🐱 🐭 🐰 🦊 🐻 🐼 🦁 🐸 🐵 🐔 🦉 🦋 🐝 🐢 🐠 🐬 🦄 🌋'.split(' '),
  },
  {
    key: 'w.sticker.cat.symbols',
    items: '🚀 🎉 🎈 🎁 🔑 🔒 🔍 ⏰ ⌛ 🔧 🧩 🎲 🎮 💻 📱 📷 🎧 🔊 🤫 🚫 ⚠️ ➡️ ⬅️ ⬆️ ⬇️ 🔄 ➕ ➖ ✖️ ➗ 🟢 🔴 🟡 🔵 🟣 🏁 🚩 💬 📌 🧹'.split(' '),
  },
] as const;

function StickerWidget({ config }: WidgetProps<Config>) {
  return (
    <div className="widget-body" style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        data-testid="sticker-symbol"
        style={{
          fontSize: '78cqmin',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          transform: `rotate(${config.rotation}deg)`,
          filter: config.shadow ? 'drop-shadow(0 1.5cqmin 2cqmin rgba(0,0,0,.35))' : undefined,
          fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
        }}
      >
        {config.symbol || STICKER_DEFAULT}
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      {CATEGORIES.map((cat) => (
        <div key={cat.key} className="mb-3" role="group" aria-label={t(cat.key)}>
          <span className="label">{t(cat.key)}</span>
          <div className="flex flex-wrap gap-1">
            {cat.items.map((e) => (
              <button key={e} type="button" className="btn" style={{ fontSize: 22, padding: '2px 6px', minWidth: 40 }} aria-label={e} aria-pressed={config.symbol === e} onClick={() => update({ symbol: e })}>
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Field label={t('w.sticker.custom')} hint={t('w.sticker.customHint')}>
        <input className="input" value={config.symbol} aria-label={t('w.sticker.custom')} onChange={(e) => update({ symbol: clipSymbol(e.target.value) })} />
      </Field>
      <Field label={t('w.sticker.rotation', { n: config.rotation })}>
        <input type="range" min={-15} max={15} step={1} value={config.rotation} aria-label={t('w.sticker.rotation', { n: config.rotation })} onChange={(e) => update({ rotation: Number(e.target.value) })} style={{ width: '100%' }} />
      </Field>
      <Toggle label={t('w.sticker.shadow')} checked={config.shadow} onChange={(shadow) => update({ shadow })} />
    </>
  );
}

export const stickerWidget: WidgetDefinition<Config> = {
  type: 'sticker',
  label: 'w.sticker.label',
  description: 'w.sticker.desc',
  icon: Heart,
  category: 'content',
  defaultSize: { w: 300, h: 300 },
  minSize: { w: 80, h: 80 },
  frameless: true,
  schema,
  Component: StickerWidget,
  Settings,
};
