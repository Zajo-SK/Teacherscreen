import { useEffect, useState } from 'react';
import { Stage } from '@/components/Stage';
import { t, type TKey } from '@/i18n';
import { navigate } from '@/lib/router';
import { useApp } from '@/store/useApp';
import { api } from './api';
import { describeError } from './useCloud';
import type { Screen } from '@/types';

/** Náhľad zdieľanej obrazovky podľa odkazu (token). Stiahnutie vytvorí lokálnu kópiu. */
export function SharedPage({ token }: { token: string }) {
  const importParsed = useApp((s) => s.importParsed);
  const [screen, setScreen] = useState<Screen | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.getSharedByToken(token).then(setScreen, (e) => {
      setErr(describeError(e));
      setScreen(null);
    });
  }, [token]);

  // Náhľad sa vykresľuje cez dočasný záznam v store, ktorý sa neukladá na disk (id s prefixom).
  const previewId = `shared-${token.slice(0, 12)}`;
  useEffect(() => {
    if (!screen) return;
    useApp.setState((st) => ({ screens: { ...st.screens, [previewId]: { ...screen, id: previewId } } }));
    return () => useApp.setState((st) => {
      const { [previewId]: _x, ...rest } = st.screens;
      void _x;
      return { screens: rest };
    });
  }, [screen, previewId]);

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-surface p-3">
        <h1 className="flex-1 truncate text-lg font-bold">{t('cloud.sharedPage')}{screen ? `: ${screen.name}` : ''}</h1>
        <button type="button" className="btn" onClick={() => navigate({ name: 'home' })}>{t('editor.toHome')}</button>
        {screen && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const [id] = importParsed({ screens: [{ ...screen, deckId: null }], decks: [], skippedWidgets: 0, skippedScreens: 0 });
              if (id) navigate({ name: 'edit', id });
            }}
          >
            {t('cloud.saveCopy')}
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 bg-bg">
        {screen === undefined ? (
          <p className="p-6">{t('common.loading')}</p>
        ) : screen === null ? (
          <p role="alert" className="p-6">{err ? t(err as TKey) : t('cloud.sharedInvalid')}</p>
        ) : (
          <Stage screenId={previewId} mode="present" />
        )}
      </div>
    </main>
  );
}
