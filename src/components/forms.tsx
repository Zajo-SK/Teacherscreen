import { useId, type ReactNode } from 'react';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  max = 200,
  multiline,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="mb-3">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="input"
          rows={rows}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input id={id} className="input" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const id = useId();
  return (
    <div className="mb-3">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="input"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="mb-3 flex min-h-11 items-center gap-3">
      <input id={id} type="checkbox" className="size-6 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="text-base">
        {label}
      </label>
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-3" role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={String(o.value)} type="button" className="btn" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  presets,
  autoLabel,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  presets: string[];
  autoLabel: string;
}) {
  return (
    <div className="mb-3" role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn text-sm" aria-pressed={value === undefined} onClick={() => onChange(undefined)}>
          {autoLabel}
        </button>
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value === c}
            className="size-9 rounded-full border-2 border-line aria-pressed:ring-4 aria-pressed:ring-primary"
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
        <input
          type="color"
          aria-label={label}
          className="size-9 cursor-pointer rounded-full border-2 border-line bg-transparent p-0"
          value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export const COLOR_PRESETS = ['#ffffff', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#1e293b', '#000000', '#dc2626', '#16a34a', '#2563eb', '#9333ea'];
