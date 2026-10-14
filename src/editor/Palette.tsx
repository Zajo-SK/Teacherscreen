import { Collapsible } from '@/components/Collapsible';
import { t } from '@/i18n';
import { useApp } from '@/store/useApp';
import { widgetCategories, widgetDefinitions } from '@/widgets/registry';
import type { TKey } from '@/i18n';

const CAT_COLOR: Record<string, string> = { content: 'var(--coral)', time: 'var(--sky)', class: 'var(--mint)', tools: 'var(--lilac)' };

export function Palette({ screenId, onAdded }: { screenId: string; onAdded?: () => void }) {
  const addWidget = useApp((s) => s.addWidget);
  const toast = useApp((s) => s.toast);
  return (
    <nav aria-label={t('editor.palette')}>
      <p className="px-4 pb-2 pt-3 text-sm text-muted">{t('editor.palette.hint')}</p>
      {widgetCategories.map((cat) => {
        const defs = widgetDefinitions.filter((d) => d.category === cat);
        return (
          <Collapsible
            key={cat}
            id={`palette-${cat}`}
            title={t(`cat.${cat}` as TKey)}
            accent={CAT_COLOR[cat]}
            badge={defs.length}
            defaultOpen={cat === 'content'}
            preview={
              <span className="flex gap-1 text-muted" aria-hidden>
                {defs.slice(0, 4).map((d) => {
                  const Icon = d.icon;
                  return <Icon key={d.type} size={14} />;
                })}
              </span>
            }
          >
            <ul className="grid grid-cols-2 gap-2">
              {defs.map((d) => {
                const Icon = d.icon;
                return (
                  <li key={d.type}>
                    <button
                      type="button"
                      data-testid={`add-${d.type}`}
                      data-tip={t(d.description)}
                      className="flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] p-2 text-center text-sm font-semibold normal-case tracking-normal transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-95"
                      style={{ borderColor: `color-mix(in srgb, ${CAT_COLOR[cat]} 45%, transparent)`, background: `color-mix(in srgb, ${CAT_COLOR[cat]} 13%, var(--surface))` }}
                      onClick={() => {
                        if (addWidget(screenId, d.type)) {
                          toast(t('editor.widgetAdded', { name: t(d.label) }), { ms: 1500 });
                          onAdded?.();
                        }
                      }}
                    >
                      <Icon size={26} aria-hidden style={{ color: CAT_COLOR[cat] }} />
                      <span>{t(d.label)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Collapsible>
        );
      })}
    </nav>
  );
}
