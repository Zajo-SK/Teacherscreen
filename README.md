# TeacherScreen

Webová aplikácia pre učiteľov – interaktívna tabuľa s modulárnymi widgetmi (časovač, náhodný výber žiaka, skupiny, semafor, bodovanie…). Beží v prehliadači, funguje **bez registrácie a bez servera**, obrazovky sa automaticky ukladajú do prehliadača (IndexedDB) a aplikáciu možno nainštalovať ako PWA a používať aj offline. Rozhranie je v slovenčine.

Technológie: React 19, TypeScript (strict), Vite, Tailwind CSS 4, zustand, zod, idb, Vitest + Testing Library, Playwright. Voliteľný backend: Supabase (PostgreSQL + RLS).

## Rýchly štart

```bash
npm install
npm run dev          # vývojový server na http://localhost:5173
```

## Príkazy

| Príkaz | Účel |
|---|---|
| `npm run dev` | vývojový server |
| `npm run build` | typová kontrola + produkčná zostava do `dist/` |
| `npm run preview` | lokálne spustenie produkčnej zostavy |
| `npm run typecheck` | kontrola TypeScript |
| `npm test` | unit/komponentové testy + test RLS politík (Vitest) |
| `npm run test:e2e` | end-to-end testy (Playwright, Chromium) |
| `npm run icons` | znovu vygeneruje PWA ikony z `public/favicon.svg` |

E2E testy si samy zostavia aplikáciu a spustia `vite preview` (port 4173; port 4174 pre zostavu s nedostupným backendom). Na počítači bez stiahnutého prehliadača spustite raz `npx playwright install chromium`; v prostredí s vlastným Chromium nastavte `CHROMIUM_PATH=/cesta/k/chromium`.

## Prehľad štruktúry

```
src/
  types.ts                 dátový model (Screen, WidgetInstance, Deck…), SCHEMA_VERSION
  lib/                     čistá logika: countdown (časovač), groups, random, screenOps (zarovnanie,
                           vrstvy…), schema (validácia a import/export), geometry, qr, image…
  widgets/                 registry.ts + defs/*.tsx – každý widget je samostatný súbor
  templates/               10 školských šablón s reálnym obsahom
  store/useApp.ts          stav aplikácie, história (späť/znova), schránka, akcie
  storage/                 IndexedDB adaptér, záložné úložisko v pamäti, automatické ukladanie
  components/Stage.tsx     pracovná plocha (škálovanie, presun, zmena veľkosti, výber)
  editor/                  paleta, panel vlastností, nástroje výberu, filmstrip, skratky
  pages/                   Home, Editor, Present
  backend/                 voliteľný Supabase klient, účty, zdieľanie, administrácia
  i18n/                    slovenčina + mechanizmus na doplnenie ďalších jazykov
supabase/migrations/       SQL schéma a RLS politiky
tests/unit, tests/e2e      automatizované testy
```

## Ako to funguje

* **Súradnicový systém.** Každá obrazovka má virtuálnu plochu (16:9 = 1920×1080, 16:10 = 1920×1200, 4:3 = 1600×1200). Widgety majú pozíciu a veľkosť v týchto jednotkách; plocha sa škáluje transformáciou, takže zmena veľkosti okna widgety nepresúva ani nestráca. Pri zmene pomeru strán sa rozloženie prepočíta pomerovo.
* **Časovače.** Zdrojom pravdy je absolútny čas ukončenia (`endsAt`) uložený v konfigurácii widgetu; zobrazenie sa len periodicky prepočítava z hodín. Presnosť nezávisí od frekvencie prekresľovania, časovač prežije prepnutie obrazovky aj obnovenie stránky.
* **Nový widget.** Súbor v `src/widgets/defs/` s definíciou (`schema`, `Component`, `Settings`) + jeden riadok v `registry.ts` + preklady. Editor sa nemení.
* **Ukladanie.** Zmeny sa po 300 ms ukladajú do IndexedDB (stav „Uložené“ v hornej lište), pri skrytí stránky sa ukladá okamžite. Každá obrazovka nesie `schemaVersion`; migrácie sa pridávajú do `MIGRATIONS` v `src/lib/schema.ts`.
* **Import/export.** JSON súbor s vlastnou validáciou (zod schémy widgetov): neznáme widgety sa vynechajú, súradnice sa opravia, pozadie povolí len bezpečné hodnoty (žiadne `url()`, SVG ani skripty), súbory z novšej verzie sa odmietnu. Export obrazovky štandardne **neobsahuje zoznamy žiakov**.
* **Súkromie.** Mená žiakov ostávajú v zariadení: pri nahrávaní do cloudu sa zo všetkých widgetov odstraňujú. Zoznam mien sa v widgetoch na obrazovke nezobrazuje (iba aktuálne vybraný/skupiny).

## Klávesové skratky (editor)

`Ctrl+Z` späť · `Ctrl+Y`/`Ctrl+Shift+Z` znova · `Ctrl+C/X/V` kopírovať/vystrihnúť/vložiť · `Ctrl+D` duplikovať · `Ctrl+A` vybrať všetko · `Ctrl+L` uzamknúť · `Delete` odstrániť (s tlačidlom „Vrátiť“) · šípky posun (Shift = 10) · `[` `]` vrstvy · `P`/`F5` prezentácia · `F` celá obrazovka.
Prezentácia: `←` `→` `PgUp` `PgDn` `Home` `End` prepínanie obrazoviek · `F` celá obrazovka · `Esc` späť do editora.

## Voliteľný backend (Supabase)

Bez konfigurácie sa žiadne cloudové prvky nezobrazujú a knižnica Supabase sa ani nestiahne.

1. Vytvorte projekt na supabase.com (alebo vlastnú inštanciu).
2. V SQL editore spustite `supabase/migrations/0001_init.sql` (alebo `supabase db push`).
3. Skopírujte `.env.example` na `.env` a vyplňte `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` (verejný anon kľúč; **nikdy** nevkladajte `service_role`).
4. V Supabase → Authentication nastavte povolené domény/e‑mailové potvrdenie podľa školy.
5. Prvého administrátora určíte v SQL: `update public.profiles set role = 'admin' where email = 'riaditel@skola.sk';` Ďalších už spravuje administrátor v aplikácii (`#/admin`).

Roly: **návštevník** (bez účtu – plná lokálna funkčnosť), **učiteľ** (vlastné obrazovky, kópie školských šablón, zdieľanie podľa oprávnenia), **administrátor školy** (školské šablóny, role a právo zdieľať, školské predvolené hodnoty).

Bezpečnosť: všetky tabuľky majú RLS. Súkromné obrazovky vidí iba vlastník (a príjemcovia zdieľania); ani administrátor ich nevidí. Zdieľanie s učiteľom má oprávnenie `view`/`edit`; odkazy sú náhodné tokeny s expiráciou 30 dní a dajú sa zrušiť. Politiky overuje `tests/unit/rls.test.ts` na skutočnej PostgreSQL (PGlite) – 21 scenárov vrátane prístupu k cudzím obrazovkám podľa ID. Požiadavky na server majú 10 s limit a pri výpadku sa zobrazí zrozumiteľná správa; lokálna práca nie je dotknutá.

## Nasadenie

**GitHub Pages (hotové):** workflow `.github/workflows/pages.yml` aplikáciu po každom pushi do `main` otestuje, zostaví a publikuje. Jednorazovo v repozitári zapnite *Settings → Pages → Source: GitHub Actions*. Adresa bude `https://<používateľ>.github.io/Teacherscreen/` (HTTPS, PWA a offline fungujú).

`npm run build` vytvorí statickú aplikáciu v `dist/` (hash routing – netreba prepisovanie URL). Nahrajte ju na ľubovoľný hosting alebo školský server **cez HTTPS** (service worker a inštalácia PWA vyžadujú HTTPS alebo `localhost`).

* **nginx:** `root /var/www/teacherscreen;` + `location / { try_files $uri /index.html; }`. Pre `sw.js` a `index.html` odporúčame `Cache-Control: no-cache`, pre `assets/` dlhú cache.
* **Apache:** skopírujte `dist/` do `DocumentRoot`.
* **Statické hostingy** (GitHub Pages, Netlify, Cloudflare Pages, …): publikujte `dist/`. Pri podadresári funguje predvolená relatívna základná cesta.
* **Rýchle sprístupnenie v škole:** `npm run build && npx vite preview --host 0.0.0.0 --port 8080` a učitelia otvoria `http://<adresa-servera>:8080` (pre inštaláciu PWA a offline režim je potrebné HTTPS, napr. reverzný proxy s certifikátom).

Aktualizácie: po nasadení novej verzie sa učiteľovi zobrazí oznámenie „Aktualizovať“ – aplikácia sa nikdy nereštartuje uprostred hodiny sama.

Offline: po prvom načítaní sa aplikácia aj dáta dajú používať bez internetu. Cloudové funkcie (prihlásenie, školské šablóny, zdieľanie) offline nefungujú a aplikácia to oznámi.

## Stav funkcií

Implementované a otestované: všetkých 15 widgetov (text, hodiny, časovač, stopky, semafor, náhodný výber, skupiny, bodovacia tabuľa, kocky, obrázok, QR kód, pracovné pokyny, anketa, kreslenie, vizuálny časovač); presun/zmena veľkosti/viacnásobný výber/zarovnanie/vrstvy/zámok/kopírovanie/duplikovanie/obnova odstráneného; späť/znova; automatické ukladanie; viac obrazoviek, zostavy, poradie, kopírovanie widgetov medzi obrazovkami; 10 šablón; export/import JSON a záloha všetkých dát; prezentačný režim; svetlý/tmavý režim; PWA + offline; voliteľný backend (účty, osobné obrazovky, školské šablóny, zdieľanie s učiteľom, zrušiteľné odkazy, administrácia).

Obmedzenia a nedokončené:
* **Hlasovanie z osobných zariadení žiakov nie je implementované.** Widget Anketa je lokálny (hlasy zapisuje učiteľ) a je tak aj označený; samostatný serverový modul by bol ďalšou etapou.
* Backend je overený na úrovni databázy (RLS testy v PGlite); klientska časť (prihlásenie, nahrávanie, zdieľanie) **nebola testovaná proti živej inštancii Supabase** – pred ostrým nasadením ju prejdite manuálne. Testovaný je výpadok servera (scenár 11).
* Rozhranie je len v slovenčine (mechanizmus pre ďalšie jazyky je pripravený v `src/i18n`).
* Cloudová synchronizácia je manuálna (nahrať/stiahnuť), nie priebežná; pri súčasnom úprave v dvoch oknách prehliadača platí „posledný zapísal vyhráva“.
* E2E testy bežia v Chromiu (vrátane emulácie iPadu a 4K); Firefox/Safari neboli v tomto prostredí k dispozícii.
* Škálovanie písma widgetov je v jednotkách virtuálnej plochy; na malých telefónoch je aplikácia použiteľná, ale určená je pre tablety, notebooky a veľké obrazovky.
