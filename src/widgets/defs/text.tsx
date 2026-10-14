import { useEffect, useRef, useState } from 'react';
import { Type } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { NumberField, Segmented, TextField, Toggle } from '@/components/forms';
import { bool, int, oneOf, str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  title: str(() => t('w.text.def.title'), 120),
  body: str(() => t('w.text.def.body'), 4000),
  fontSize: int(40, 14, 200),
  align: oneOf(['left', 'center', 'right'] as const, 'left'),
  bold: bool(false),
  highlight: oneOf(['none', 'info', 'warning', 'success'] as const, 'none'),
});
type Config = z.output<typeof schema>;

const HL: Record<Config['highlight'], string | null> = { none: null, info: '#2563eb', warning: '#f59e0b', success: '#16a34a' };

function TextWidget({ config, update, mode }: WidgetProps<Config>) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  const accent = HL[config.highlight];
  return (
    <div
      className="widget-body"
      style={{
        padding: 28,
        boxSizing: 'border-box',
        textAlign: config.align,
        borderLeft: accent ? `16px solid ${accent}` : undefined,
        background: accent ? `color-mix(in srgb, ${accent} 12%, transparent)` : undefined,
      }}
      onDoubleClick={() => mode === 'edit' && setEditing(true)}
    >
      {config.title && (
        <div style={{ fontSize: config.fontSize * 1.35, fontWeight: 800, lineHeight: 1.15, marginBottom: config.fontSize * 0.3, overflowWrap: 'anywhere' }}>
          {config.title}
        </div>
      )}
      {editing ? (
        <textarea
          ref={ref}
          data-no-drag
          className="winput"
          style={{ height: '70%', fontSize: config.fontSize, padding: 12, textAlign: config.align, lineHeight: 1.3 }}
          value={config.body}
          maxLength={4000}
          aria-label={t('w.text.body')}
          onChange={(e) => update({ body: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        />
      ) : (
        <div style={{ fontSize: config.fontSize, lineHeight: 1.3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontWeight: config.bold ? 700 : 400 }}>
          {config.body}
        </div>
      )}
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <TextField label={t('w.text.title')} value={config.title} max={120} onChange={(title) => update({ title })} />
      <TextField label={t('w.text.body')} value={config.body} max={4000} multiline rows={6} onChange={(body) => update({ body })} />
      <NumberField label={t('w.text.fontSize')} value={config.fontSize} min={14} max={200} step={2} onChange={(fontSize) => update({ fontSize })} />
      <Segmented
        label={t('w.text.align')}
        value={config.align}
        onChange={(align) => update({ align })}
        options={[
          { value: 'left', label: t('w.text.alignLeft') },
          { value: 'center', label: t('w.text.alignCenter') },
          { value: 'right', label: t('w.text.alignRight') },
        ]}
      />
      <Toggle label={t('w.text.bold')} checked={config.bold} onChange={(bold) => update({ bold })} />
      <Segmented
        label={t('w.text.highlight')}
        value={config.highlight}
        onChange={(highlight) => update({ highlight })}
        options={[
          { value: 'none', label: t('w.text.hl.none') },
          { value: 'info', label: t('w.text.hl.info') },
          { value: 'warning', label: t('w.text.hl.warning') },
          { value: 'success', label: t('w.text.hl.success') },
        ]}
      />
    </>
  );
}

export const textWidget: WidgetDefinition<Config> = {
  type: 'text',
  label: 'w.text.label',
  description: 'w.text.desc',
  icon: Type,
  category: 'content',
  defaultSize: { w: 640, h: 360 },
  minSize: { w: 200, h: 120 },
  schema,
  Component: TextWidget,
  Settings,
};
