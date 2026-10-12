import { useState } from 'react';
import { X } from 'lucide-react';
import { t } from '@/i18n';
import { parseNames } from '@/lib/names';

/** Editor zoznamu mien: pridanie jedného mena, import vložením zoznamu, odstránenie. */
export function NamesEditor({ names, onChange, max = 200 }: { names: string[]; onChange: (n: string[]) => void; max?: number }) {
  const [one, setOne] = useState('');
  const [bulk, setBulk] = useState('');
  const addOne = () => {
    const parsed = parseNames(one);
    if (parsed.length) onChange([...names, ...parsed].slice(0, max));
    setOne('');
  };
  return (
    <div className="mb-3">
      <span className="label">{t('names.title', { n: names.length })}</span>
      <div className="mb-2 flex gap-2">
        <input
          className="input"
          value={one}
          maxLength={60}
          placeholder={t('names.addPlaceholder')}
          aria-label={t('names.addPlaceholder')}
          onChange={(e) => setOne(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOne()}
        />
        <button type="button" className="btn" onClick={addOne}>
          {t('common.add')}
        </button>
      </div>
      <ul className="mb-2 max-h-40 overflow-auto rounded-xl border border-line">
        {names.length === 0 && <li className="p-2 text-sm text-muted">{t('names.none')}</li>}
        {names.map((n, i) => (
          <li key={i} className="flex items-center justify-between border-b border-line px-3 py-1 last:border-0">
            <span className="truncate">{n}</span>
            <button type="button" className="btn btn-ghost btn-icon min-h-9" aria-label={t('names.remove', { name: n })} onClick={() => onChange(names.filter((_, j) => j !== i))}>
              <X size={18} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <label className="label" htmlFor="names-bulk">
        {t('names.bulk')}
      </label>
      <textarea id="names-bulk" className="input" rows={4} value={bulk} placeholder={t('names.bulkPlaceholder')} onChange={(e) => setBulk(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn"
          disabled={!parseNames(bulk).length}
          onClick={() => {
            onChange([...names, ...parseNames(bulk)].slice(0, max));
            setBulk('');
          }}
        >
          {t('names.append')}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!parseNames(bulk).length}
          onClick={() => {
            onChange(parseNames(bulk, max));
            setBulk('');
          }}
        >
          {t('names.replace')}
        </button>
        {names.length > 0 && (
          <button type="button" className="btn btn-danger" onClick={() => onChange([])}>
            {t('names.clear')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Výber uloženej triedy + uloženie aktuálneho zoznamu ako novej triedy. */
export function ClassPicker({
  classes,
  classId,
  hasNames,
  onPick,
  onSave,
}: {
  classes: { id: string; name: string; names: string[] }[];
  classId: string | null;
  hasNames: boolean;
  onPick: (id: string | null) => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <div className="mb-4 rounded-xl border border-line p-3">
      <label className="label" htmlFor="class-pick">
        {t('classes.use')}
      </label>
      <select id="class-pick" className="input mb-2" value={classId ?? ''} onChange={(e) => onPick(e.target.value || null)}>
        <option value="">{t('classes.own')}</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.names.length})
          </option>
        ))}
      </select>
      {classId ? (
        <p className="text-xs text-muted">{t('classes.linkedHint')}</p>
      ) : (
        hasNames && (
          <div className="flex gap-2">
            <input className="input" value={name} maxLength={80} placeholder={t('classes.namePlaceholder')} aria-label={t('classes.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
            <button
              type="button"
              className="btn"
              disabled={!name.trim()}
              onClick={() => {
                onSave(name);
                setName('');
              }}
            >
              {t('classes.saveAs')}
            </button>
          </div>
        )
      )}
    </div>
  );
}
