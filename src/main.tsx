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
      onNeedRefresh() {
        useApp.getState().toast(t('settings.updateAvailable'), { action: { label: t('settings.update'), run: () => void update(true) }, ms: 15000 });
      },
      onOfflineReady() {
        useApp.getState().toast(t('settings.offlineReady'), { tone: 'success' });
      },
    });
  });
}
