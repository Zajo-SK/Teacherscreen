import { useState } from 'react';
import { X } from 'lucide-react';
import { t, getLocale } from '@/i18n';
import { splitWithRules } from '@/lib/groups';
import type { GroupRules } from '@/types';

type Kind = 'apart' | 'together';

function PairList({ kind, names, rules, onChange }: { kind: Kind; names: string[]; rules: GroupRules; onChange: (r: GroupRules) => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const unique = Array.from(new Set(names)).sort((x, y) => x.localeCompare(y, getLocale()));
  const list = rules[kind];
  const exists = list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const can = a && b && a !== b && !exists;
  return (
    <section className="mb-3 rounded-xl border border-line p-3" aria-label={t(kind === 'apart' ? 'rules.apart' : 'rules.together')} data-testid={`rules-${kind}`}>
      <h4 className="mb-1 text-sm font-bold">{kind === 'apart' ? '🚫 ' : '🤝 '}{t(kind === 'apart' ? 'rules.apart' : 'rules.together')}</h4>
      <p className="mb-2 text-xs text-muted">{t(kind === 'apart' ? 'rules.apartHint' : 'rules.togetherHint')}</p>
      <ul className="mb-2">
        {list.length === 0 && <li className="text-xs text-muted">{t('rules.none')}</li>}
        {list.map(([x, y], i) => (
          <li key={`${x}|${y}|${i}`} className="flex items-center justify-between rounded-lg px-2 py-1 text-sm odd:bg-surface2">
            <span className="truncate">
              {x} <span aria-hidden className="text-muted">{kind === 'apart' ? '≠' : '='}</span> {y}
            </span>
            <button type="button" className="btn btn-ghost btn-icon min-h-8 min-w-8" aria-label={t('rules.remove', { a: x, b: y })} onClick={() => onChange({ ...rules, [kind]: list.filter((_, j) => j !== i) })}>
              <X size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input min-w-0 flex-1" aria-label={t('rules.studentA')} value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">{t('rules.pick')}</option>
          {unique.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select className="input min-w-0 flex-1" aria-label={t('rules.studentB')} value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">{t('rules.pick')}</option>
          {unique.filter((n) => n !== a).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          disabled={!can}
          onClick={() => {
            onChange({ ...rules, [kind]: [...list, [a, b]] });
            setB('');
          }}
        >
          {t('common.add')}
        </button>
      </div>
    </section>
  );
}

/** Pravidlá pre rozdeľovač skupín: kto nesmie / musí byť spolu. */
export function RulesEditor({ names, rules, onChange }: { names: string[]; rules: GroupRules; onChange: (r: GroupRules) => void }) {
  const probe = splitWithRules(names, 'count', 2, rules);
  const stale = [...rules.apart, ...rules.together].filter(([x, y]) => !names.includes(x) || !names.includes(y)).length;
  return (
    <div className="mb-3">
      <span className="label">{t('rules.title')}</span>
      {names.length < 2 && <p className="mb-2 text-xs text-muted">{t('rules.needNames')}</p>}
      {!probe.ok && probe.reason === 'conflict' && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {t('rules.conflict', { pair: probe.detail ?? '' })}
        </p>
      )}
      {stale > 0 && <p className="mb-2 text-xs text-muted">{t('rules.stale', { n: stale })}</p>}
      <PairList kind="apart" names={names} rules={rules} onChange={onChange} />
      <PairList kind="together" names={names} rules={rules} onChange={onChange} />
    </div>
  );
}
