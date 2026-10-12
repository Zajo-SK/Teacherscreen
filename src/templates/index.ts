import type { AspectId, Background, Screen, WidgetInstance, WidgetType } from '@/types';
import { DEFAULT_BACKGROUND, SCHEMA_VERSION } from '@/types';
import { uid } from '@/lib/id';
import { createWidget } from '@/widgets/registry';

export interface ScreenTemplate {
  id: string;
  name: string;
  description: string;
  aspect: AspectId;
  background: Background;
  build: () => WidgetInstance[];
}

type Cfg = Record<string, unknown>;
const cd = (minutes: number): Cfg => ({ durationMs: minutes * 60_000, remainingMs: minutes * 60_000 });
const grad = (a: string, b: string): Background => ({ kind: 'gradient', value: `linear-gradient(135deg,${a} 0%,${b} 100%)` });

/** Pomocník na skladanie widgetov – z-poradie sa nastaví podľa poradia v zozname. */
function layout(items: { type: WidgetType; x: number; y: number; w: number; h: number; config?: Cfg; colors?: WidgetInstance['colors'] }[]): WidgetInstance[] {
  return items.map((it, i) => createWidget(it.type, { ...it, z: i }));
}

const SAMPLE_NAMES = ['Anna', 'Peter', 'Mária', 'Jakub', 'Eva', 'Tomáš', 'Lucia', 'Martin', 'Katarína', 'Samuel', 'Nina', 'Adam'];

export const TEMPLATES: ScreenTemplate[] = [
  {
    id: 'morning-circle',
    name: 'Ranný kruh',
    description: 'Privítanie, plán dňa, nálada triedy a výber žiaka, ktorý otvorí kruh.',
    aspect: '16:9',
    background: grad('#fef3c7', '#fde68a'),
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1040, h: 270, colors: { bg: '#ffffff', fg: '#0f172a' }, config: { title: 'Dobré ráno! 🌞', body: 'Sadnite si do kruhu, pozdravte svojho suseda a povedzte mu niečo milé.', fontSize: 46, align: 'left', highlight: 'warning' } },
        { type: 'clock', x: 1120, y: 40, w: 760, h: 270, config: { showSeconds: false, showDate: true, look: 'card' } },
        { type: 'steps', x: 40, y: 340, w: 720, h: 690, config: { title: 'Ranný program', steps: ['Privítanie a pozdrav', 'Ako sa dnes cítime?', 'Dátum, počasie, kalendár', 'Plán dňa', 'Dôležité oznamy'].map((text, i) => ({ id: `m${i}`, text, done: false })) } },
        { type: 'poll', x: 790, y: 340, w: 680, h: 690, config: { question: 'Ako sa dnes cítiš?', options: [{ id: 'a', text: '😀 Skvele', votes: 0 }, { id: 'b', text: '🙂 Dobre', votes: 0 }, { id: 'c', text: '😐 Ušlo to', votes: 0 }, { id: 'd', text: '😟 Nie veľmi', votes: 0 }] } },
        { type: 'picker', x: 1500, y: 340, w: 380, h: 340, config: { names: SAMPLE_NAMES, excludePicked: true, animate: true } },
        { type: 'dice', x: 1500, y: 710, w: 380, h: 320, config: { count: 1, sides: 6 } },
      ]),
  },
  {
    id: 'independent-work',
    name: 'Samostatná práca',
    description: 'Zadanie úlohy, postup, časovač a semafor hluku pre tichú samostatnú prácu.',
    aspect: '16:9',
    background: grad('#dbeafe', '#e0e7ff'),
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1200, h: 440, config: { title: 'Úloha', body: 'Vyriešte úlohy 1 až 5 na strane 42 v pracovnom zošite.\nVýsledky si zapíšte do zošita.\nAk skončíte skôr, pokračujte úlohou so hviezdičkou ★.', fontSize: 44, highlight: 'info' } },
        { type: 'timer', x: 1280, y: 40, w: 600, h: 440, config: cd(20) },
        { type: 'steps', x: 40, y: 510, w: 760, h: 520, config: { title: 'Postup', steps: ['Prečítaj si zadanie', 'Vypracuj úlohy', 'Skontroluj výsledky', 'Zdvihni ruku, ak potrebuješ pomoc'].map((text, i) => ({ id: `i${i}`, text, done: false })) } },
        { type: 'traffic', x: 830, y: 510, w: 560, h: 520, config: { active: 'red', redLabel: 'Ticho – pracujem sám', yellowLabel: 'Šepkám – pýtam sa suseda', greenLabel: 'Môžem diskutovať' } },
        { type: 'clock', x: 1420, y: 510, w: 460, h: 250, config: { showSeconds: false, showDate: false, look: 'plain' } },
        { type: 'stopwatch', x: 1420, y: 780, w: 460, h: 250 },
      ]),
  },
  {
    id: 'group-work',
    name: 'Skupinová práca',
    description: 'Náhodné skupiny, zadanie, úlohy v skupine a časovač.',
    aspect: '16:9',
    background: grad('#dcfce7', '#cffafe'),
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1100, h: 300, config: { title: 'Skupinová úloha', body: 'Spoločne vytvorte plagát na tému „Ako šetriť vodou“. Každý člen skupiny prispeje aspoň jedným nápadom.', fontSize: 40, highlight: 'success' } },
        { type: 'timer', x: 1180, y: 40, w: 700, h: 300, config: cd(15) },
        { type: 'groups', x: 40, y: 370, w: 1100, h: 660, config: { names: SAMPLE_NAMES, mode: 'count', value: 3 } },
        { type: 'steps', x: 1180, y: 370, w: 700, h: 380, config: { title: 'Role v skupine', steps: ['Vedúci – pozerá na čas', 'Zapisovateľ – píše nápady', 'Kreslič – robí plagát', 'Hovorca – prezentuje'].map((text, i) => ({ id: `g${i}`, text, done: false })) } },
        { type: 'traffic', x: 1180, y: 770, w: 700, h: 260, config: { active: 'yellow', yellowLabel: 'Šepkáme v skupine' } },
      ]),
  },
  {
    id: 'workshop',
    name: 'Práca v dielni',
    description: 'Bezpečnosť, postup práce, časovač a pomocník dňa.',
    aspect: '16:9',
    background: grad('#fed7aa', '#fecaca'),
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1180, h: 330, config: { title: '⚠ Bezpečnosť pri práci', body: 'Používaj ochranné pomôcky. Náradie odkladaj na určené miesto. Pri poranení okamžite zavolaj učiteľa.', fontSize: 42, highlight: 'warning', bold: true } },
        { type: 'timer', x: 1260, y: 40, w: 620, h: 330, config: cd(30) },
        { type: 'steps', x: 40, y: 400, w: 820, h: 630, config: { title: 'Postup práce', steps: ['Obleč si pracovný odev', 'Priprav si pracovisko a náradie', 'Prečítaj si technologický postup', 'Zhotov výrobok', 'Upratať pracovisko', 'Odovzdaj výrobok'].map((text, i) => ({ id: `w${i}`, text, done: false })) } },
        { type: 'picker', x: 890, y: 400, w: 470, h: 330, config: { names: SAMPLE_NAMES, excludePicked: true } },
        { type: 'qr', x: 1390, y: 400, w: 490, h: 630, config: { kind: 'url', text: 'https://example.org/bezpecnost', caption: 'Pravidlá bezpečnosti (upravte adresu)' } },
        { type: 'clock', x: 890, y: 760, w: 470, h: 270, config: { showSeconds: true, showDate: false, look: 'led' } },
      ]),
  },
  {
    id: 'technical-education',
    name: 'Technická výchova',
    description: 'Téma hodiny, náčrt na kreslenie, zoznam materiálu a meranie času operácií.',
    aspect: '16:9',
    background: grad('#e2e8f0', '#cbd5e1'),
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 760, h: 420, config: { title: 'Téma: Vlastnosti materiálov', body: 'Dnes porovnáme drevo, kov a plast.\n• ktorý materiál je najtvrdší?\n• ktorý sa najlepšie opracúva?\n• kde ich nájdeme v škole?', fontSize: 36, highlight: 'info' } },
        { type: 'draw', x: 830, y: 40, w: 1050, h: 660 },
        { type: 'steps', x: 40, y: 490, w: 760, h: 540, config: { title: 'Pomôcky a materiál', steps: ['Technický zošit a ceruzka', 'Pravítko a uhlomer', 'Vzorky materiálov', 'Pracovný list'].map((text, i) => ({ id: `t${i}`, text, done: false })) } },
        { type: 'visual-timer', x: 830, y: 730, w: 400, h: 300, config: { ...cd(10), look: 'bar' } },
        { type: 'stopwatch', x: 1260, y: 730, w: 620, h: 300 },
      ]),
  },
  {
    id: 'math-contest',
    name: 'Matematická súťaž',
    description: 'Tímy s bodovaním, príklad na tabuli, kocky a časovač na odpoveď.',
    aspect: '16:9',
    background: grad('#ede9fe', '#fae8ff'),
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1180, h: 340, colors: { bg: '#312e81', fg: '#ffffff' }, config: { title: 'Príklad č. 1', body: '24 × 3 + 8 = ?', fontSize: 96, align: 'center', bold: true } },
        { type: 'visual-timer', x: 1260, y: 40, w: 620, h: 560, config: { ...cd(1), look: 'ring' } },
        { type: 'scoreboard', x: 40, y: 410, w: 1180, h: 620, config: { teamCount: 3, step: 1, teams: [{ name: 'Tím Slnko', score: 0 }, { name: 'Tím Mesiac', score: 0 }, { name: 'Tím Hviezda', score: 0 }, { name: 'Tím 4', score: 0 }] } },
        { type: 'dice', x: 1260, y: 630, w: 620, h: 400, config: { count: 2, sides: 6 } },
      ]),
  },
  {
    id: 'reading',
    name: 'Čítanie s porozumením',
    description: 'Text na čítanie, otázky, meranie času čítania a poznámky.',
    aspect: '16:9',
    background: grad('#fef9c3', '#ecfccb'),
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1160, h: 560, config: { title: 'Včely', body: 'Včely žijú v úľoch a pracujú spoločne. Jedna včela donesie za svoj život asi lyžičku medu. Včelár sa o úle stará celý rok. Bez včiel by sme mali oveľa menej ovocia a zeleniny, pretože opeľujú kvety.', fontSize: 44, highlight: 'none' } },
        { type: 'text', x: 40, y: 630, w: 1160, h: 400, config: { title: 'Otázky', body: '1. Kde žijú včely?\n2. Koľko medu donesie jedna včela za život?\n3. Prečo sú včely dôležité pre ľudí?', fontSize: 38, highlight: 'info' } },
        { type: 'stopwatch', x: 1240, y: 40, w: 640, h: 300 },
        { type: 'steps', x: 1240, y: 370, w: 640, h: 390, config: { title: 'Ako čítať', steps: ['Prečítaj text potichu', 'Podčiarkni nové slová', 'Odpovedz na otázky', 'Porovnaj s vedľajším'].map((text, i) => ({ id: `r${i}`, text, done: false })) } },
        { type: 'timer', x: 1240, y: 790, w: 640, h: 240, config: cd(8) },
      ]),
  },
  {
    id: 'final-reflection',
    name: 'Záverečná reflexia',
    description: 'Tri reflexné otázky, anketa spokojnosti a výber žiaka na zhrnutie.',
    aspect: '16:9',
    background: grad('#fce7f3', '#e0f2fe'),
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1100, h: 480, config: { title: 'Na záver hodiny', body: '1. Čo nové som sa dnes naučil/a?\n2. Čo mi robilo problém?\n3. Čo by som chcel/a ešte vedieť?', fontSize: 46, highlight: 'info' } },
        { type: 'poll', x: 1180, y: 40, w: 700, h: 640, config: { question: 'Ako sa vám dnes pracovalo?', options: [{ id: 'a', text: '👍 Výborne', votes: 0 }, { id: 'b', text: '👌 Dobre', votes: 0 }, { id: 'c', text: '👎 Ťažko', votes: 0 }] } },
        { type: 'picker', x: 40, y: 550, w: 620, h: 480, config: { names: SAMPLE_NAMES, excludePicked: true } },
        { type: 'steps', x: 690, y: 550, w: 450, h: 480, config: { title: 'Kontrola', steps: ['Upratať lavicu', 'Zapísať domácu úlohu', 'Poďakovať si'].map((text, i) => ({ id: `f${i}`, text, done: false })) } },
        { type: 'clock', x: 1180, y: 710, w: 700, h: 320, config: { showSeconds: false, showDate: true, look: 'plain' } },
      ]),
  },
  {
    id: 'test',
    name: 'Test alebo opakovanie',
    description: 'Časovač na celú obrazovku, pravidlá písomky a kontrola pred odovzdaním.',
    aspect: '16:9',
    background: grad('#f1f5f9', '#e2e8f0'),
    build: () =>
      layout([
        { type: 'visual-timer', x: 40, y: 40, w: 760, h: 760, config: { ...cd(30), look: 'ring' } },
        { type: 'text', x: 830, y: 40, w: 1050, h: 420, config: { title: 'Pravidlá písomky', body: 'Pracujete samostatne a potichu.\nPíšte čitateľne, modrou alebo čiernou fixkou.\nNa pomôcky sa nepýtajte spolužiakov.', fontSize: 42, highlight: 'warning' } },
        { type: 'steps', x: 830, y: 490, w: 640, h: 540, config: { title: 'Pred odovzdaním', steps: ['Podpísaný list', 'Všetky úlohy prečítané', 'Skontrolované výpočty', 'Odpovede čitateľné'].map((text, i) => ({ id: `x${i}`, text, done: false })) } },
        { type: 'traffic', x: 1500, y: 490, w: 380, h: 540, config: { active: 'red', redLabel: 'Ticho – píšeme test' } },
        { type: 'clock', x: 40, y: 830, w: 760, h: 200, config: { showSeconds: false, showDate: false, look: 'led' } },
      ]),
  },
  {
    id: 'stations',
    name: 'Stanovištia a rotácia skupín',
    description: 'Štyri stanovištia, časovač na rotáciu a rozdelenie žiakov do štyroch skupín.',
    aspect: '16:9',
    background: grad('#cffafe', '#dbeafe'),
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1180, h: 400, config: { title: 'Stanovištia', body: '1 – Čítanie a otázky\n2 – Pokus s vodou\n3 – Práca s počítačom\n4 – Kreslenie a tvorba\n\nPo zvonení sa skupina posunie na ďalšie stanovište →', fontSize: 38, highlight: 'info' } },
        { type: 'visual-timer', x: 1260, y: 40, w: 620, h: 640, config: { ...cd(6), look: 'ring' } },
        { type: 'groups', x: 40, y: 470, w: 1180, h: 560, config: { names: SAMPLE_NAMES, mode: 'count', value: 4 } },
        { type: 'traffic', x: 1260, y: 710, w: 620, h: 320, config: { active: 'yellow', yellowLabel: 'Šepkáme pri stanovišti' } },
      ]),
  },
];

export function getTemplate(id: string): ScreenTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function buildScreen(opts: { name: string; description?: string; templateId?: string | null; aspect?: AspectId; background?: Background; widgets?: WidgetInstance[]; deckId?: string | null; order?: number }): Screen {
  const now = Date.now();
  return {
    id: uid(),
    schemaVersion: SCHEMA_VERSION,
    name: opts.name,
    description: opts.description ?? '',
    aspect: opts.aspect ?? '16:9',
    background: opts.background ?? DEFAULT_BACKGROUND,
    widgets: opts.widgets ?? [],
    deckId: opts.deckId ?? null,
    order: opts.order ?? now,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    templateId: opts.templateId ?? null,
  };
}

export function screenFromTemplate(tpl: ScreenTemplate, opts: { deckId?: string | null } = {}): Screen {
  return buildScreen({ name: tpl.name, description: tpl.description, templateId: tpl.id, aspect: tpl.aspect, background: tpl.background, widgets: tpl.build(), deckId: opts.deckId });
}
