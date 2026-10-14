import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetHarness } from './harness';
import { cellAt, currentLesson, parseRange, setCell, todayColumn, STRIDE } from '@/widgets/defs/timetable';
import { createWidget, sanitizeConfig } from '@/widgets/registry';

describe('rozvrh – logika', () => {
  it('parseRange', () => {
    expect(parseRange('8:00–8:45')).toEqual({ start: 480, end: 525 });
    expect(parseRange(' 08.50 - 9:35 ')).toEqual({ start: 530, end: 575 });
    for (const s of ['', '8:00', '9:00–8:00', '25:00–26:00', 'abc', '8:60–9:00']) expect(parseRange(s)).toBeNull();
  });
  it('currentLesson ignoruje neplatné riadky a koniec je exkluzívny', () => {
    const times = ['8:00–8:45', 'x', '9:00–9:45'];
    expect(currentLesson(times, 3, 8 * 60)).toBe(0);
    expect(currentLesson(times, 3, 8 * 60 + 45)).toBe(-1);
    expect(currentLesson(times, 3, 9 * 60 + 10)).toBe(2);
    expect(currentLesson(times, 2, 9 * 60 + 10)).toBe(-1);
  });
  it('todayColumn: víkend mimo 5-dňového rozvrhu', () => {
    expect(todayColumn(new Date(2026, 9, 12), 5)).toBe(0); // pondelok
    expect(todayColumn(new Date(2026, 9, 17), 5)).toBe(-1); // sobota
    expect(todayColumn(new Date(2026, 9, 17), 6)).toBe(5);
    expect(todayColumn(new Date(2026, 9, 18), 6)).toBe(-1);
  });
  it('setCell zachová dáta pri zmene rozmerov a orezáva koniec', () => {
    let c: string[] = [];
    c = setCell(c, 2, 1, 'Mat');
    expect(cellAt(c, 2, 1)).toBe('Mat');
    expect(c.length).toBe(2 * STRIDE + 2);
    c = setCell(c, 2, 1, '');
    expect(c).toEqual([]);
    expect(setCell([], 0, 0, 'x'.repeat(100))[0]).toHaveLength(40);
  });
  it('schéma opraví poškodené vstupy a zachová dáta pri zmene počtu hodín/dní', () => {
    const bad = sanitizeConfig('timetable', { lessons: 99, days: 'x', cells: 5, times: [1] }) as Record<string, unknown>;
    expect(bad.lessons).toBe(10);
    expect(bad.days).toBe(5);
    expect(bad.cells).toEqual([]);
    const cells = setCell([], 3, 4, 'Fyz');
    const small = sanitizeConfig('timetable', { ...(createWidget('timetable').config as object), cells, lessons: 2, days: 5 }) as { cells: string[] };
    const big = sanitizeConfig('timetable', { ...(small as object), lessons: 6, days: 6 }) as { cells: string[] };
    expect(cellAt(big.cells, 3, 4)).toBe('Fyz');
  });
});

describe('widget Rozvrh', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 8, 20)); // streda
  });
  afterEach(() => vi.useRealTimers());

  it('zobrazí text buniek, čísla hodín a časy; zvýrazní aktuálnu hodinu a dnešok', () => {
    const cells = setCell([], 0, 2, 'Matematika');
    render(<WidgetHarness type="timetable" config={{ cells, times: ['8:00–8:45', '8:55–9:40'], lessons: 3 }} />);
    expect(screen.getByText('Matematika')).toBeInTheDocument();
    expect(screen.getByText('8:00–8:45')).toBeInTheDocument();
    expect(screen.getByLabelText('1. hodina')).toHaveAttribute('data-current', 'true');
    expect(screen.getByLabelText('2. hodina')).not.toHaveAttribute('data-current');
    expect(screen.getByLabelText(/streda/i)).toHaveAttribute('data-today', 'true');
    expect(screen.queryByRole('textbox')).toBeNull(); // prezentácia je len na čítanie
  });
  it('počet hodín a dní podľa konfigurácie', () => {
    render(<WidgetHarness type="timetable" config={{ lessons: 4, days: 6 }} />);
    expect(screen.getByLabelText(/sobota/i)).toBeInTheDocument();
    expect(screen.getByLabelText('4. hodina')).toBeInTheDocument();
    expect(screen.queryByLabelText('5. hodina')).toBeNull();
  });
  it('v editore sa dá písať do buniek', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { getWidgetDefinition } = await import('@/widgets/registry');
    const def = getWidgetDefinition('timetable');
    let saved: unknown;
    const Wrapper = () => {
      const cfg = createWidget('timetable').config;
      return <def.Component widget={{ ...createWidget('timetable'), id: 'a' }} config={cfg} mode="edit" update={(p: unknown) => (saved = p)} />;
    };
    render(<Wrapper />);
    await user.type(screen.getByLabelText(/pondelok, 1\. hodina/i), 'M');
    expect((saved as { cells: string[] }).cells[0]).toBe('M');
  });
});
