# TeacherScreen – pokyny pre Claude

Slovenská webová aplikácia pre učiteľov: interaktívna tabuľa s widgetmi. Nasadená na GitHub Pages
(https://zajo-sk.github.io/Teacherscreen/) z vetvy `main` (workflow `.github/workflows/pages.yml`).
Používateľ (učiteľ) komunikuje po slovensky – odpovedaj po slovensky, stručne a zrozumiteľne pre neprogramátora.

## Stack
React 19, TypeScript strict, Vite, Tailwind 4, zustand (`src/store/useApp.ts`), zod, idb (IndexedDB), vite-plugin-pwa,
lucide-react, pdfjs-dist (legacy build, lazy), voliteľný Supabase backend (`src/backend/`, migrácie `supabase/migrations/`).

## Príkazy
- `npm run dev` – vývojový server (http://localhost:5173)
- `npx tsc --noEmit -p .` – typová kontrola (musí byť čistá)
- `npx vitest run` – unit testy (vrátane `tests/unit/i18n.test.ts`, ktorý stráži úplnosť prekladov)
- `npm run test:e2e` – Playwright (sám zostaví app a spustí preview na portoch 4173/4174/4176/4177).
  Na novom PC raz: `npx playwright install chromium`. Na Linuxe s vlastným Chromiom: `CHROMIUM_PATH=...`.
- Pred každým pushom: typecheck + vitest + e2e musia prejsť.

## Architektúra
- Virtuálne plátno (`CANVAS_SIZES` v `src/types.ts`: 16:9, 16:10, 4:3), widgety v jednotkách plátna, `Stage.tsx` škáluje.
  Pozadie kreslí rodič na celé okno (`Stage bleed`), nové obrazovky dostanú pomer podľa okna (`bestAspect`).
- Widget = súbor `src/widgets/defs/<typ>.tsx` (schema zod s `.catch` predvolbami, Component, Settings) + riadok
  v `src/widgets/registry.ts` + typ v `WidgetType` (`src/types.ts`). Interaktívne prvky vo widgete: `data-no-drag`.
  Rozmery vo widgetoch cez container query jednotky (`cqw/cqh/cqmin`) v `.widget-body`.
- Editor: `src/pages/Editor.tsx` (plávajúce horné menu, `WidgetBar` dole, `ScreenSwitcher`, `Inspector` vpravo).
- Náhľady obrazoviek (`ScreenThumb`) vykresľujú skutočné widgety (inert, len keď sú vo výhľade).

## Preklady (dôležité)
- Zdroj je slovenčina: `src/i18n/sk/*.ts`. Všetok viditeľný text ide cez `t('kľúč')`, žiadne natvrdo písané reťazce.
- Ďalšie jazyky: `src/i18n/langs/{en,de,cs,hu,pl,ru}.ts` (+ `*.w2.ts` pre novšie widgety). Každý nový kľúč treba
  doplniť do VŠETKÝCH jazykov, inak padne tsc aj i18n test. Zachovať `{premenné}`.
- Predvolené texty v schémach vyhodnocovať lenivo: `str(() => t('...'))`.

## Git a nasadenie
- Práca na vetve, potom PR do `main` (squash merge) → GitHub Pages nasadí automaticky.
- Commity a PR po anglicky/slovensky, README je po slovensky a má sa udržiavať aktuálne.

## Bezpečnosť
- Do frontendu patrí len verejný Supabase anon kľúč (`.env.local`, viď `.env.example`), nikdy service_role.
- Externé URL (odkaz, video, webstránka) prechádzajú validáciou (`src/lib/link.ts`, `src/lib/youtube.ts`), iframy v sandboxe.
