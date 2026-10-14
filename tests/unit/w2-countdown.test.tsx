import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetHarness } from './harness';
import { daysBetween, hoursUntil, parseYmd, pluralCategory } from '@/widgets/defs/countdown';

describe('daysBetween', () => {
  it('rovnaký deň, zajtra, včera', () => {
    const today = new Date(2026, 9, 14, 23, 59);
    expect(daysBetween(today, '2026-10-14')).toBe(0);
    expect(daysBetween(today, '2026-10-15')).toBe(1);
    expect(daysBetween(today, '2026-10-13')).toBe(-1);
  });
  it('koniec mesiaca a roka, priestupný rok', () => {
    expect(daysBetween(new Date(2026, 0, 31, 8), '2026-03-01')).toBe(29);
    expect(daysBetween(new Date(2024, 0, 31, 8), '2024-03-01')).toBe(30);
    expect(daysBetween(new Date(2026, 11, 31, 8), '2027-01-01')).toBe(1);
    expect(daysBetween(new Date(2026, 1, 28, 8), '2026-03-01')).toBe(1);
  });
  it('prechod na letný/zimný čas nemení počet dní', () => {
    expect(daysBetween(new Date(2026, 2, 28, 23, 30), '2026-03-30')).toBe(2);
    expect(daysBetween(new Date(2026, 2, 29, 0, 30), '2026-03-30')).toBe(1);
    expect(daysBetween(new Date(2026, 9, 24, 23, 30), '2026-10-26')).toBe(2);
    expect(daysBetween(new Date(2026, 9, 25, 0, 30), '2026-10-26')).toBe(1);
    expect(daysBetween(new Date(2026, 2, 1), '2026-11-01')).toBe(245);
  });
  it('neplatný dátum → null', () => {
    const d = new Date(2026, 0, 1);
    for (const s of ['', 'abc', '2026-02-30', '2026-13-01', '2026-1-1', '2026-10-14T10:00']) expect(daysBetween(d, s)).toBeNull();
    expect(parseYmd('2024-02-29')).not.toBeNull();
    expect(parseYmd('2025-02-29')).toBeNull();
  });
  it('hoursUntil', () => {
    expect(hoursUntil(new Date(2026, 9, 14, 14, 0), '2026-10-15')).toBe(10);
    expect(hoursUntil(new Date(2026, 9, 16), '2026-10-15')).toBe(0);
  });
  it('množné číslo slovenčiny', () => {
    expect(pluralCategory(1, 'sk-SK')).toBe('one');
    expect(pluralCategory(3, 'sk-SK')).toBe('few');
    expect(pluralCategory(5, 'sk-SK')).toBe('other');
    expect(pluralCategory(1, 'xx-bad!!')).toMatch(/one|other/);
  });
});

describe('widget Odpočet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('bez dátumu vyzve na nastavenie', () => {
    render(<WidgetHarness type="countdown" />);
    expect(screen.getByText(/nastavte dátum udalosti/i)).toBeInTheDocument();
    expect(screen.getByText(/otvorte nastavenia/i)).toBeInTheDocument();
  });
  it.each([
    ['2026-10-15', '1', 'deň'],
    ['2026-10-17', '3', 'dni'],
    ['2026-10-19', '5', 'dní'],
  ])('zostáva %s → %s %s', (date, n, unit) => {
    render(<WidgetHarness type="countdown" config={{ date }} />);
    expect(screen.getByTestId('countdown-value')).toHaveTextContent(n);
    expect(screen.getByTestId('countdown-unit')).toHaveTextContent(new RegExp(`^${unit}$`));
  });
  it('dnes a už prebehlo', () => {
    const a = render(<WidgetHarness type="countdown" config={{ date: '2026-10-14' }} />);
    expect(screen.getByTestId('countdown-value')).toHaveTextContent('Dnes!');
    a.unmount();
    render(<WidgetHarness type="countdown" config={{ date: '2026-10-11' }} />);
    expect(screen.getByTestId('countdown-value')).toHaveTextContent('Už prebehlo');
    expect(screen.getByTestId('countdown-unit')).toHaveTextContent('pred 3 dňami');
  });
  it('showHours a neplatný dátum', () => {
    const a = render(<WidgetHarness type="countdown" config={{ date: '2026-10-15', showHours: true }} />);
    expect(screen.getByText(/spolu 14 hodín/)).toBeInTheDocument();
    a.unmount();
    render(<WidgetHarness type="countdown" config={{ date: '2026-02-31', title: 5 } as never} />);
    expect(screen.getByText(/nastavte dátum udalosti/i)).toBeInTheDocument();
  });
});
