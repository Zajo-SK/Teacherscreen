import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetHarness } from './harness';
import { getWeekInfo, isoWeek, monthGrid } from '@/widgets/defs/calendar';

describe('kalendár – logika', () => {
  it('mriežka má 6 týždňov a začína správnym dňom', () => {
    const mon = monthGrid(2026, 9, 1); // október 2026 začína vo štvrtok
    expect(mon).toHaveLength(6);
    expect(mon[0]![0]!.date.getDate()).toBe(28); // pondelok 28. 9.
    expect(mon[0]![3]!.date.getDate()).toBe(1);
    expect(mon[0]![3]!.inMonth).toBe(true);
    expect(mon[0]![0]!.inMonth).toBe(false);
    const sun = monthGrid(2026, 9, 7);
    expect(sun[0]![0]!.date.getDate()).toBe(27);
    expect(sun[0]![0]!.date.getDay()).toBe(0);
  });
  it('mesiac začínajúci prvým dňom týždňa nemá vedúce dni', () => {
    const g = monthGrid(2026, 5, 1); // jún 2026 začína v pondelok
    expect(g[0]![0]!.date.getDate()).toBe(1);
    expect(g[0]![0]!.inMonth).toBe(true);
  });
  it('ISO číslo týždňa', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2021, 0, 3))).toBe(53);
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1);
    expect(isoWeek(new Date(2026, 9, 14))).toBe(42);
  });
  it('prvý deň týždňa podľa jazyka, inak pondelok', () => {
    expect(getWeekInfo('sk-SK').firstDay).toBe(1);
    expect(getWeekInfo('xx-invalid-!!').firstDay).toBe(1);
    const us = getWeekInfo('en-US').firstDay;
    expect([1, 7]).toContain(us);
  });
});

describe('widget Kalendár', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('zvýrazní dnešok a navigácia mení mesiac, Dnes sa vráti', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WidgetHarness type="calendar" />);
    expect(screen.getByTestId('calendar-today')).toHaveTextContent('14');
    const title = screen.getByTestId('calendar-title').textContent!;
    expect(title).toMatch(/2026/);
    await user.click(screen.getByRole('button', { name: /nasledujúci mesiac/i }));
    expect(screen.getByTestId('calendar-title').textContent).not.toBe(title);
    expect(screen.queryByTestId('calendar-today')).toBeNull();
    await user.click(screen.getByRole('button', { name: /aktuálny mesiac/i }));
    expect(screen.getByTestId('calendar-title').textContent).toBe(title);
  });

  it('o polnoci sa dnešok posunie', () => {
    render(<WidgetHarness type="calendar" />);
    expect(screen.getByTestId('calendar-today')).toHaveTextContent('14');
    act(() => {
      vi.setSystemTime(new Date(2026, 9, 15, 0, 1));
      vi.advanceTimersByTime(31_000);
    });
    expect(screen.getByTestId('calendar-today')).toHaveTextContent('15');
  });

  it('čísla týždňov sa zobrazia podľa nastavenia', () => {
    render(<WidgetHarness type="calendar" config={{ showWeekNumbers: true }} />);
    expect(screen.getByLabelText('Týždeň 42')).toBeInTheDocument();
  });
  it('poškodená konfigurácia nezhodí widget', () => {
    render(<WidgetHarness type="calendar" config={{ showWeekNumbers: 'x', highlightWeekends: 5 } as never} />);
    expect(screen.getByTestId('calendar-today')).toBeInTheDocument();
  });
});
