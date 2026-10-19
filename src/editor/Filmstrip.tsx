import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { useApp, screensInDeck } from '@/store/useApp';
import { ScreenThumb } from '@/components/Stage';

export function Filmstrip({ screenId }: { screenId: string }) {
  const screens = useApp((s) => s.screens);
  const decks = useApp((s) => s.decks);
  const createScreen = useApp((s) => s.createScreen);
  const moveScreen = useApp((s) => s.moveScreen);
  const current = screens[screenId];
  if (!current) return null;
  const list = screensInDeck(screens, current.deckId);
  const idx = list.findIndex((s) => s.id === screenId);
  const deckName = current.deckId ? decks[current.deckId]?.name : null;
  return (
    <nav data-tour="screens" aria-label={t('editor.screens')} className="flex items-center gap-2 border-t border-line bg-surface px-2 py-2">
      <span className="hidden max-w-32 truncate text-sm font-semibold text-muted md:block" title={deckName ?? t('home.noDeck')}>
        {deckName ?? t('editor.screens')}
      </span>
      <ol className="flex flex-1 gap-2 overflow-x-auto py-1">
        {list.map((s, i) => (
          <li key={s.id} className="w-32 flex-none">
            <button
              type="button"
              aria-current={s.id === screenId ? 'page' : undefined}
              onClick={() => navigate({ name: 'edit', id: s.id })}
              className="block w-full rounded-lg border-2 border-line p-0.5 text-left aria-[current=page]:border-primary"
            >
              <ScreenThumb widgets={s.widgets} aspect={s.aspect} zoom={s.zoom} background={s.background} />
              <span className="block truncate px-1 text-xs font-medium">
                {i + 1}. {s.name}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-icon" aria-label={t('common.moveUp')} title={t('common.moveUp')} disabled={idx <= 0} onClick={() => moveScreen(screenId, -1)}>
        <ArrowLeft size={20} aria-hidden />
      </button>
      <button type="button" className="btn btn-icon" aria-label={t('common.moveDown')} title={t('common.moveDown')} disabled={idx < 0 || idx >= list.length - 1} onClick={() => moveScreen(screenId, 1)}>
        <ArrowRight size={20} aria-hidden />
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          const id = createScreen({ deckId: current.deckId });
          navigate({ name: 'edit', id });
        }}
      >
        <Plus size={20} aria-hidden /> <span className="hidden sm:inline">{t('editor.addScreen')}</span>
      </button>
    </nav>
  );
}
