import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getWidgetDefinition } from '@/widgets/registry';
import { WidgetHarness } from './harness';

describe('symbols', () => {
  it('predvolene zobrazí všetkých 8 kariet bez aktívnej', () => {
    render(<WidgetHarness type="symbols" />);
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(8);
    cards.forEach((c) => expect(c).toHaveAttribute('aria-pressed', 'false'));
  });

  it('klik vyberie kartu, ďalší klik ju zruší', async () => {
    const user = userEvent.setup();
    let cfg: any;
    render(<WidgetHarness type="symbols" onConfig={(c) => (cfg = c)} />);
    await user.click(screen.getByRole('button', { name: /ticho/i }));
    expect(cfg.active).toBe('silent');
    expect(screen.getByRole('button', { name: /ticho/i })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /ticho/i }));
    expect(cfg.active).toBeNull();
  });

  it('single rozloženie ukáže len aktívnu kartu', () => {
    render(<WidgetHarness type="symbols" config={{ layout: 'single', active: 'pair' }} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /dvojiciach/i })).toBeInTheDocument();
  });

  it('single bez aktívnej karty ponúkne výber', () => {
    render(<WidgetHarness type="symbols" config={{ layout: 'single' }} />);
    expect(screen.getAllByRole('button')).toHaveLength(8);
  });

  it('schéma opraví poškodené hodnoty', () => {
    const s = getWidgetDefinition('symbols').schema;
    expect(s.parse({ items: ['solo', 'bogus', 'silent', 'solo'], active: 'x', layout: 5 })).toEqual({ items: ['silent', 'solo'], active: null, layout: 'grid' });
    expect(s.parse({ items: 7 }).items).toHaveLength(8);
    expect(s.parse(undefined === 0 ? {} : {}).active).toBeNull();
  });

  it('aktívna karta mimo zobrazených sa neukáže ako aktívna', () => {
    render(<WidgetHarness type="symbols" config={{ items: ['silent', 'help'], active: 'pair' }} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    screen.getAllByRole('button').forEach((c) => expect(c).toHaveAttribute('aria-pressed', 'false'));
  });
});
