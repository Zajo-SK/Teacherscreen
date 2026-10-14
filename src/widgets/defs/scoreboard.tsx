import { Minus, Plus, Trophy } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { NumberField, Segmented, TextField } from '@/components/forms';
import { int, str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const TEAM_COLORS = ['#6d5dfc', '#ff4d6d', '#12b886', '#f59f00'];
const teamSchema = (i: number) =>
  z.object({ name: str(() => t('w.scoreboard.def.team', { n: i + 1 }), 30), score: int(0, -9999, 99999) }).catch(() => ({ name: t('w.scoreboard.def.team', { n: i + 1 }), score: 0 }));

type Team = { name: string; score: number };
const schema = z.object({
  teamCount: int(2, 2, 4),
  step: int(1, 1, 1000),
  teams: z.tuple([teamSchema(0), teamSchema(1), teamSchema(2), teamSchema(3)]).catch((): [Team, Team, Team, Team] => [
    { name: t('w.scoreboard.def.team', { n: 1 }), score: 0 },
    { name: t('w.scoreboard.def.team', { n: 2 }), score: 0 },
    { name: t('w.scoreboard.def.team', { n: 3 }), score: 0 },
    { name: t('w.scoreboard.def.team', { n: 4 }), score: 0 },
  ]),
});
type Config = z.output<typeof schema>;

function ScoreboardWidget({ config, update }: WidgetProps<Config>) {
  const teams = config.teams.slice(0, config.teamCount);
  const setScore = (i: number, delta: number) =>
    update({ teams: config.teams.map((tm, j) => (j === i ? { ...tm, score: Math.max(-9999, Math.min(99999, tm.score + delta)) } : tm)) as Config['teams'] });
  const best = Math.max(...teams.map((x) => x.score));
  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', padding: 16, boxSizing: 'border-box', gap: 12 }}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${teams.length}, 1fr)`, gap: 14 }}>
        {teams.map((tm, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', borderRadius: 20, border: `6px solid ${TEAM_COLORS[i]}`, padding: '2cqh 1cqw', minWidth: 0, background: `color-mix(in srgb, ${TEAM_COLORS[i]} 10%, transparent)` }}>
            <div style={{ fontSize: 'min(4.2cqw, 9cqh)', fontWeight: 800, color: TEAM_COLORS[i], maxWidth: '100%', textAlign: 'center', overflowWrap: 'anywhere' }}>{tm.name}</div>
            <div
              data-testid={`score-${i}`}
              aria-label={t('w.score.aria', { name: tm.name, n: tm.score })}
              style={{ fontSize: `min(${teams.length === 2 ? 22 : teams.length === 3 ? 15 : 11}cqw, 42cqh)`, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
            >
              {tm.score}
              {tm.score === best && best > 0 && teams.filter((x) => x.score === best).length === 1 && <span className="sr-only"> {t('w.score.leading')}</span>}
            </div>
            <div style={{ display: 'flex', gap: 10 }} data-no-drag>
              <button type="button" className="wbtn" style={{ padding: '0 18px' }} aria-label={t('w.score.minus', { name: tm.name })} onClick={() => setScore(i, -config.step)}>
                <Minus size={32} aria-hidden />
              </button>
              <button type="button" className="wbtn wbtn-primary" style={{ padding: '0 18px' }} aria-label={t('w.score.plus', { name: tm.name })} onClick={() => setScore(i, config.step)}>
                <Plus size={32} aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }} data-no-drag>
        <button type="button" className="wbtn" onClick={() => update({ teams: config.teams.map((tm) => ({ ...tm, score: 0 })) as Config['teams'] })}>
          {t('w.score.reset')}
        </button>
      </div>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <Segmented
        label={t('w.score.teamCount')}
        value={config.teamCount}
        onChange={(teamCount) => update({ teamCount })}
        options={[2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
      />
      <NumberField label={t('w.score.step')} value={config.step} min={1} max={1000} onChange={(step) => update({ step })} />
      {config.teams.slice(0, config.teamCount).map((tm, i) => (
        <TextField
          key={i}
          label={t('w.score.teamName', { n: i + 1 })}
          value={tm.name}
          max={30}
          onChange={(name) => update({ teams: config.teams.map((x, j) => (j === i ? { ...x, name } : x)) as Config['teams'] })}
        />
      ))}
    </>
  );
}

export const scoreboardWidget: WidgetDefinition<Config> = {
  type: 'scoreboard',
  label: 'w.score.label',
  description: 'w.score.desc',
  icon: Trophy,
  category: 'class',
  defaultSize: { w: 900, h: 460 },
  minSize: { w: 360, h: 260 },
  schema,
  Component: ScoreboardWidget,
  Settings,
};
