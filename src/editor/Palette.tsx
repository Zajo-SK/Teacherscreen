import { t } from '@/i18n';
import { useApp } from '@/store/useApp';
import { widgetCategories, widgetDefinitions } from '@/widgets/registry';
import type { TKey } from '@/i18n';

export function Palette({ screenId, onAdded }: { screenId: string; onAdded?: () => void }) {
  const addWidget = useApp((s) => s.addWidget);
  const toast = useApp((s) => s.toast);
  return (
    <nav aria-label={t('editor.palette')} className="flex flex-col gap-4 p-3">
      <p className="text-sm text-muted">{t('editor.palette.hint')}</p>
      {widgetCategories.map((cat) => (
        <section key={cat} aria-label={t(`cat.${cat}` as TKey)}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t(`cat.${cat}` as TKey)}</h3>
          <ul className="grid grid-cols-2 gap-2">
            {widgetDefinitions
              .filter((d) => d.category === cat)
              .map((d) => {
                const Icon = d.icon;
                return (
                  <li key={d.type}>
                    <button
                      type="button"
                      data-testid={`add-${d.type}`}
                      title={t(d.description)}
                      className="flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface p-2 text-center text-sm font-medium transition-colors hover:bg-surface2"
                      onClick={() => {
                        if (addWidget(screenId, d.type)) {
                          toast(t('editor.widgetAdded', { name: t(d.label) }), { ms: 1500 });
                          onAdded?.();
                        }
                      }}
                    >
                      <Icon size={26} aria-hidden />
                      <span>{t(d.label)}</span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
