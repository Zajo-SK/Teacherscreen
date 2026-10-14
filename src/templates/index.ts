import type { AspectId, Background, Screen, WidgetInstance, WidgetType } from '@/types';
import { DEFAULT_BACKGROUND, SCHEMA_VERSION } from '@/types';
import { uid } from '@/lib/id';
import { t } from '@/i18n';
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

/** Pomocník na skladanie widgetov – z-poradie sa nastaví podľa poradia v zozname. */
function layout(items: { type: WidgetType; x: number; y: number; w: number; h: number; config?: Cfg; colors?: WidgetInstance['colors'] }[]): WidgetInstance[] {
  return items.map((it, i) => createWidget(it.type, { ...it, z: i }));
}

const sampleNames = (): string[] => [t('tpl.sampleName1'), t('tpl.sampleName2'), t('tpl.sampleName3'), t('tpl.sampleName4'), t('tpl.sampleName5'), t('tpl.sampleName6'), t('tpl.sampleName7'), t('tpl.sampleName8'), t('tpl.sampleName9'), t('tpl.sampleName10'), t('tpl.sampleName11'), t('tpl.sampleName12')];

export const TEMPLATES: ScreenTemplate[] = [
  {
    id: 'morning-circle',
    get name() {
      return t('tpl.morning-circle.name');
    },
    get description() {
      return t('tpl.morning-circle.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'mesh-sunrise' },
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1040, h: 270, colors: { bg: '#ffffff', fg: '#0f172a' }, config: { title: t('tpl.morning-circle.title'), body: t('tpl.morning-circle.body'), fontSize: 46, align: 'left', highlight: 'warning' } },
        { type: 'clock', x: 1120, y: 40, w: 760, h: 270, config: { showSeconds: false, showDate: true, look: 'card' } },
        { type: 'steps', x: 40, y: 340, w: 720, h: 690, config: { title: t('tpl.morning-circle.title2'), steps: [t('tpl.morning-circle.step1'), t('tpl.morning-circle.step2'), t('tpl.morning-circle.step3'), t('tpl.morning-circle.step4'), t('tpl.morning-circle.step5')].map((text, i) => ({ id: `m${i}`, text, done: false })) } },
        { type: 'poll', x: 790, y: 340, w: 680, h: 690, config: { question: t('tpl.morning-circle.question'), options: [{ id: 'a', text: t('tpl.morning-circle.opt1'), votes: 0 }, { id: 'b', text: t('tpl.morning-circle.opt2'), votes: 0 }, { id: 'c', text: t('tpl.morning-circle.opt3'), votes: 0 }, { id: 'd', text: t('tpl.morning-circle.opt4'), votes: 0 }] } },
        { type: 'picker', x: 1500, y: 340, w: 380, h: 340, config: { names: sampleNames(), excludePicked: true, animate: true } },
        { type: 'dice', x: 1500, y: 710, w: 380, h: 320, config: { count: 1, sides: 6 } },
      ]),
  },
  {
    id: 'independent-work',
    get name() {
      return t('tpl.independent-work.name');
    },
    get description() {
      return t('tpl.independent-work.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'mesh-ocean' },
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1200, h: 440, config: { title: t('tpl.independent-work.title'), body: t('tpl.independent-work.body'), fontSize: 44, highlight: 'info' } },
        { type: 'timer', x: 1280, y: 40, w: 600, h: 440, config: cd(20) },
        { type: 'steps', x: 40, y: 510, w: 760, h: 520, config: { title: t('tpl.independent-work.title2'), steps: [t('tpl.independent-work.step1'), t('tpl.independent-work.step2'), t('tpl.independent-work.step3'), t('tpl.independent-work.step4')].map((text, i) => ({ id: `i${i}`, text, done: false })) } },
        { type: 'traffic', x: 830, y: 510, w: 560, h: 520, config: { active: 'red', redLabel: t('tpl.independent-work.redLabel'), yellowLabel: t('tpl.independent-work.yellowLabel'), greenLabel: t('tpl.independent-work.greenLabel') } },
        { type: 'clock', x: 1420, y: 510, w: 460, h: 250, config: { showSeconds: false, showDate: false, look: 'plain' } },
        { type: 'stopwatch', x: 1420, y: 780, w: 460, h: 250 },
      ]),
  },
  {
    id: 'group-work',
    get name() {
      return t('tpl.group-work.name');
    },
    get description() {
      return t('tpl.group-work.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'mesh-mint' },
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1100, h: 300, config: { title: t('tpl.group-work.title'), body: t('tpl.group-work.body'), fontSize: 40, highlight: 'success' } },
        { type: 'timer', x: 1180, y: 40, w: 700, h: 300, config: cd(15) },
        { type: 'groups', x: 40, y: 370, w: 1100, h: 660, config: { names: sampleNames(), mode: 'count', value: 3 } },
        { type: 'steps', x: 1180, y: 370, w: 700, h: 380, config: { title: t('tpl.group-work.title2'), steps: [t('tpl.group-work.step1'), t('tpl.group-work.step2'), t('tpl.group-work.step3'), t('tpl.group-work.step4')].map((text, i) => ({ id: `g${i}`, text, done: false })) } },
        { type: 'traffic', x: 1180, y: 770, w: 700, h: 260, config: { active: 'yellow', yellowLabel: t('tpl.group-work.yellowLabel') } },
      ]),
  },
  {
    id: 'workshop',
    get name() {
      return t('tpl.workshop.name');
    },
    get description() {
      return t('tpl.workshop.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'waves-sunset' },
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1180, h: 330, config: { title: t('tpl.workshop.title'), body: t('tpl.workshop.body'), fontSize: 42, highlight: 'warning', bold: true } },
        { type: 'timer', x: 1260, y: 40, w: 620, h: 330, config: cd(30) },
        { type: 'steps', x: 40, y: 400, w: 820, h: 630, config: { title: t('tpl.workshop.title2'), steps: [t('tpl.workshop.step1'), t('tpl.workshop.step2'), t('tpl.workshop.step3'), t('tpl.workshop.step4'), t('tpl.workshop.step5'), t('tpl.workshop.step6')].map((text, i) => ({ id: `w${i}`, text, done: false })) } },
        { type: 'picker', x: 890, y: 400, w: 470, h: 330, config: { names: sampleNames(), excludePicked: true } },
        { type: 'qr', x: 1390, y: 400, w: 490, h: 630, config: { kind: 'url', text: 'https://example.org/bezpecnost', caption: t('tpl.workshop.caption') } },
        { type: 'clock', x: 890, y: 760, w: 470, h: 270, config: { showSeconds: true, showDate: false, look: 'led' } },
      ]),
  },
  {
    id: 'technical-education',
    get name() {
      return t('tpl.technical-education.name');
    },
    get description() {
      return t('tpl.technical-education.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'school-blueprint' },
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 760, h: 420, config: { title: t('tpl.technical-education.title'), body: t('tpl.technical-education.body'), fontSize: 36, highlight: 'info' } },
        { type: 'draw', x: 830, y: 40, w: 1050, h: 660 },
        { type: 'steps', x: 40, y: 490, w: 760, h: 540, config: { title: t('tpl.technical-education.title2'), steps: [t('tpl.technical-education.step1'), t('tpl.technical-education.step2'), t('tpl.technical-education.step3'), t('tpl.technical-education.step4')].map((text, i) => ({ id: `t${i}`, text, done: false })) } },
        { type: 'visual-timer', x: 830, y: 730, w: 400, h: 300, config: { ...cd(10), look: 'bar' } },
        { type: 'stopwatch', x: 1260, y: 730, w: 620, h: 300 },
      ]),
  },
  {
    id: 'math-contest',
    get name() {
      return t('tpl.math-contest.name');
    },
    get description() {
      return t('tpl.math-contest.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'mesh-grape' },
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1180, h: 340, colors: { bg: '#312e81', fg: '#ffffff' }, config: { title: t('tpl.math-contest.title'), body: t('tpl.math-contest.body'), fontSize: 96, align: 'center', bold: true } },
        { type: 'visual-timer', x: 1260, y: 40, w: 620, h: 560, config: { ...cd(1), look: 'ring' } },
        { type: 'scoreboard', x: 40, y: 410, w: 1180, h: 620, config: { teamCount: 3, step: 1, teams: [{ name: t('tpl.math-contest.team1'), score: 0 }, { name: t('tpl.math-contest.team2'), score: 0 }, { name: t('tpl.math-contest.team3'), score: 0 }, { name: t('tpl.math-contest.team4'), score: 0 }] } },
        { type: 'dice', x: 1260, y: 630, w: 620, h: 400, config: { count: 2, sides: 6 } },
      ]),
  },
  {
    id: 'reading',
    get name() {
      return t('tpl.reading.name');
    },
    get description() {
      return t('tpl.reading.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'school-notebook' },
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1160, h: 560, config: { title: t('tpl.reading.title'), body: t('tpl.reading.body'), fontSize: 44, highlight: 'none' } },
        { type: 'text', x: 40, y: 630, w: 1160, h: 400, config: { title: t('tpl.reading.title2'), body: t('tpl.reading.body2'), fontSize: 38, highlight: 'info' } },
        { type: 'stopwatch', x: 1240, y: 40, w: 640, h: 300 },
        { type: 'steps', x: 1240, y: 370, w: 640, h: 390, config: { title: t('tpl.reading.title3'), steps: [t('tpl.reading.step1'), t('tpl.reading.step2'), t('tpl.reading.step3'), t('tpl.reading.step4')].map((text, i) => ({ id: `r${i}`, text, done: false })) } },
        { type: 'timer', x: 1240, y: 790, w: 640, h: 240, config: cd(8) },
      ]),
  },
  {
    id: 'final-reflection',
    get name() {
      return t('tpl.final-reflection.name');
    },
    get description() {
      return t('tpl.final-reflection.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'mesh-candy' },
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1100, h: 480, config: { title: t('tpl.final-reflection.title'), body: t('tpl.final-reflection.body'), fontSize: 46, highlight: 'info' } },
        { type: 'poll', x: 1180, y: 40, w: 700, h: 640, config: { question: t('tpl.final-reflection.question'), options: [{ id: 'a', text: t('tpl.final-reflection.opt1'), votes: 0 }, { id: 'b', text: t('tpl.final-reflection.opt2'), votes: 0 }, { id: 'c', text: t('tpl.final-reflection.opt3'), votes: 0 }] } },
        { type: 'picker', x: 40, y: 550, w: 620, h: 480, config: { names: sampleNames(), excludePicked: true } },
        { type: 'steps', x: 690, y: 550, w: 450, h: 480, config: { title: t('tpl.final-reflection.title2'), steps: [t('tpl.final-reflection.step1'), t('tpl.final-reflection.step2'), t('tpl.final-reflection.step3')].map((text, i) => ({ id: `f${i}`, text, done: false })) } },
        { type: 'clock', x: 1180, y: 710, w: 700, h: 320, config: { showSeconds: false, showDate: true, look: 'plain' } },
      ]),
  },
  {
    id: 'test',
    get name() {
      return t('tpl.test.name');
    },
    get description() {
      return t('tpl.test.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'pat-grid' },
    build: () =>
      layout([
        { type: 'visual-timer', x: 40, y: 40, w: 760, h: 760, config: { ...cd(30), look: 'ring' } },
        { type: 'text', x: 830, y: 40, w: 1050, h: 420, config: { title: t('tpl.test.title'), body: t('tpl.test.body'), fontSize: 42, highlight: 'warning' } },
        { type: 'steps', x: 830, y: 490, w: 640, h: 540, config: { title: t('tpl.test.title2'), steps: [t('tpl.test.step1'), t('tpl.test.step2'), t('tpl.test.step3'), t('tpl.test.step4')].map((text, i) => ({ id: `x${i}`, text, done: false })) } },
        { type: 'traffic', x: 1500, y: 490, w: 380, h: 540, config: { active: 'red', redLabel: t('tpl.test.redLabel') } },
        { type: 'clock', x: 40, y: 830, w: 760, h: 200, config: { showSeconds: false, showDate: false, look: 'led' } },
      ]),
  },
  {
    id: 'stations',
    get name() {
      return t('tpl.stations.name');
    },
    get description() {
      return t('tpl.stations.desc');
    },
    aspect: '16:9',
    background: { kind: 'preset', value: 'waves-blue' },
    build: () =>
      layout([
        { type: 'text', x: 40, y: 40, w: 1180, h: 400, config: { title: t('tpl.stations.title'), body: t('tpl.stations.body'), fontSize: 38, highlight: 'info' } },
        { type: 'visual-timer', x: 1260, y: 40, w: 620, h: 640, config: { ...cd(6), look: 'ring' } },
        { type: 'groups', x: 40, y: 470, w: 1180, h: 560, config: { names: sampleNames(), mode: 'count', value: 4 } },
        { type: 'traffic', x: 1260, y: 710, w: 620, h: 320, config: { active: 'yellow', yellowLabel: t('tpl.stations.yellowLabel') } },
      ]),
  },
];

export function getTemplate(id: string): ScreenTemplate | undefined {
  return TEMPLATES.find((x) => x.id === id);
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
