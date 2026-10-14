import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { clipSymbol } from '@/widgets/defs/sticker';
import { getWidgetDefinition } from '@/widgets/registry';
import { WidgetHarness } from './harness';

describe('widget Nálepka', () => {
  it('je bez karty (frameless)', () => {
    expect(getWidgetDefinition('sticker').frameless).toBe(true);
  });
  it('vykreslí symbol a natočenie', () => {
    render(<WidgetHarness type="sticker" config={{ symbol: '🚀', rotation: 10, shadow: true }} />);
    const el = screen.getByTestId('sticker-symbol');
    expect(el).toHaveTextContent('🚀');
    expect(el.style.transform).toBe('rotate(10deg)');
    expect(el.style.filter).toContain('drop-shadow');
  });
  it('obmedzí natočenie a opraví poškodený vstup', () => {
    const def = getWidgetDefinition('sticker');
    expect(def.schema.parse({ symbol: 'x', rotation: 99 }).rotation).toBe(15);
    expect(def.schema.parse({ symbol: 7, rotation: 'a', shadow: 1 })).toEqual({ symbol: '⭐', rotation: 0, shadow: false });
  });
  it('clipSymbol skracuje na 8 grafémov bez rozrezania emoji', () => {
    expect(clipSymbol('😀😀😀😀😀😀😀😀😀😀')).toBe('😀'.repeat(8));
    expect(Array.from(clipSymbol('👨‍👩‍👧👍')).length).toBeGreaterThan(0);
  });
  it('prázdny symbol vykreslí predvolený', () => {
    render(<WidgetHarness type="sticker" config={{ symbol: '' }} />);
    expect(screen.getByTestId('sticker-symbol')).toHaveTextContent('⭐');
  });
});
