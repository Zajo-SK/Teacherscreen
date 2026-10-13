import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { useApp } from './store/useApp';
import { t } from './i18n';
import { useCloud } from './backend/useCloud';

void useApp.getState().init();
void useCloud.getState().init(); // obnoví prihlásenie hneď pri štarte (aj keď sa stránka otvorí priamo na #/admin)

// Požiadavka na trvalé úložisko (prehliadač tak dáta samovoľne nevymaže pri nedostatku miesta).
void navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker (offline podpora). Nová verzia sa nainštaluje až po potvrdení používateľa, nie uprostred hodiny.
if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      // Nová verzia sa kontroluje pri štarte, pri návrate na kartu a každú hodinu; oznámenie ostane, kým ho učiteľ nepotvrdí.
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        const check = () => void reg.update().catch(() => undefined);
        setInterval(check, 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      },
      onNeedRefresh() {
        useApp.getState().toast(t('settings.updateAvailable'), { action: { label: t('settings.update'), run: () => void update(true) }, ms: 24 * 3600 * 1000 });
      },
      onOfflineReady() {
        useApp.getState().toast(t('settings.offlineReady'), { tone: 'success' });
      },
    });
  });
}
