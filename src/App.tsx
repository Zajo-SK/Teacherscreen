import { useEffect, useState } from 'react';
import { Toasts } from '@/components/ui';
import { t } from '@/i18n';
import { useRoute } from '@/lib/router';
import { useApp } from '@/store/useApp';
import { AdminPage } from '@/backend/AdminPage';
import { SharedPage } from '@/backend/SharedPage';
import { Editor } from '@/pages/Editor';
import { HomePage } from '@/pages/Home';
import { Present } from '@/pages/Present';

function useTheme() {
  const theme = useApp((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function Loading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="grid h-dvh place-items-center p-6 text-center text-muted">
      <div>
        <p>{t('common.loading')}</p>
        {slow && (
          <>
            <p className="mt-3 max-w-md text-sm">{t('common.loadingSlow')}</p>
            <button type="button" className="btn mt-3" onClick={() => location.reload()}>
              {t('common.reload')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function App() {
  const ready = useApp((s) => s.ready);
  const route = useRoute();
  useTheme();

  useEffect(() => {
    const flush = () => void useApp.getState().flush();
    const onVis = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (!ready) return <Loading />;
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-surface focus:p-2">
        {t('a11y.skip')}
      </a>
      <div id="main">
        {route.name === 'home' && <HomePage />}
        {route.name === 'edit' && <Editor key={route.id} id={route.id} />}
        {route.name === 'present' && <Present id={route.id} />}
        {route.name === 'admin' && <AdminPage />}
        {route.name === 'shared' && <SharedPage token={route.token} />}
      </div>
      <Toasts />
    </>
  );
}
