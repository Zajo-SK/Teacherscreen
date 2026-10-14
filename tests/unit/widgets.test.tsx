import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetHarness } from './harness';

describe('widget Časovač', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  it('odpočítava podľa absolútneho času aj keď tiky medzitým vypadli', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WidgetHarness type="timer" config={{ durationMs: 120_000, remainingMs: 120_000 }} />);
    expect(screen.getByTestId('timer-display')).toHaveTextContent('02:00');
    await user.click(screen.getByRole('button', { name: /štart/i }));
    // 45 s uplynie „naraz“ (prehliadač pozastavil JS), potom príde jeden tik
    act(() => {
      vi.setSystemTime(Date.now() + 45_000);
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('timer-display')).toHaveTextContent('01:15');
  });

  it('pauza zastaví čas, reset ho vráti, vypršanie zobrazí upozornenie', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WidgetHarness type="timer" config={{ durationMs: 10_000, remainingMs: 10_000 }} />);
    await user.click(screen.getByRole('button', { name: /štart/i }));
    act(() => void vi.advanceTimersByTime(3000));
    await user.click(screen.getByRole('button', { name: /pauza/i }));
    const frozen = screen.getByTestId('timer-display').textContent;
    act(() => void vi.advanceTimersByTime(20_000));
    expect(screen.getByTestId('timer-display').textContent).toBe(frozen);
    expect(frozen).toBe('00:07');
    await user.click(screen.getByRole('button', { name: /pokračovať/i }));
    act(() => void vi.advanceTimersByTime(8000));
    expect(screen.getByText(/čas vypršal/i)).toBeInTheDocument();
    expect(screen.getByTestId('timer-display')).toHaveTextContent('00:00');
    await user.click(screen.getByRole('button', { name: /^reset/i }));
    expect(screen.getByTestId('timer-display')).toHaveTextContent('00:10');
  });

  it('po opätovnom pripojení komponentu (napr. návrat na obrazovku) ukazuje správny čas', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let saved: Record<string, unknown> = {};
    const first = render(<WidgetHarness type="timer" config={{ durationMs: 60_000, remainingMs: 60_000 }} onConfig={(c) => (saved = c as Record<string, unknown>)} />);
    await user.click(screen.getByRole('button', { name: /štart/i }));
    first.unmount(); // prepnutie na inú obrazovku
    act(() => void vi.advanceTimersByTime(25_000));
    render(<WidgetHarness type="timer" config={saved} />); // návrat
    expect(screen.getByTestId('timer-display')).toHaveTextContent('00:35');
  });
});

describe('widget Stopky', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());
  it('merajú, pozastavia a vynulujú', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WidgetHarness type="stopwatch" />);
    await user.click(screen.getByRole('button', { name: /štart/i }));
    act(() => void vi.advanceTimersByTime(2500));
    await user.click(screen.getByRole('button', { name: /pauza/i }));
    expect(screen.getByTestId('stopwatch-display')).toHaveTextContent('00:02.5');
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByTestId('stopwatch-display')).toHaveTextContent('00:00.0');
  });
});

describe('widget Náhodný výber žiaka', () => {
  const names = ['Anna', 'Peter', 'Mária', 'Jakub'];
  it('vyberie meno zo zoznamu a pri vylúčení vyberie každého práve raz', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="picker" config={{ names, excludePicked: true, animate: false }} />);
    const seen: string[] = [];
    for (let i = 0; i < names.length; i++) {
      await user.click(screen.getByRole('button', { name: /vybrať žiaka/i }));
      seen.push(screen.getByTestId('picker-result').textContent!);
    }
    expect(seen.slice().sort()).toEqual(names.slice().sort());
    expect(screen.getByText(/všetci už boli vybraní/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vybrať žiaka/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /nový výber/i }));
    expect(screen.getByRole('button', { name: /vybrať žiaka/i })).toBeEnabled();
  });
  it('bez vylúčenia môže vybrať toho istého, zoznam sa nezobrazuje', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="picker" config={{ names: ['Anna', 'Peter'], excludePicked: false, animate: false }} />);
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: /vybrať žiaka/i }));
    expect(screen.getByRole('button', { name: /vybrať žiaka/i })).toBeEnabled();
    expect(screen.queryByText('Peter') ?? screen.queryByText('Anna')).not.toBeNull(); // iba aktuálny výsledok
  });
  it('s animáciou nakoniec zobrazí platný výsledok', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WidgetHarness type="picker" config={{ names, animate: true }} runtime={{ animations: true }} />);
    await user.click(screen.getByRole('button', { name: /vybrať žiaka/i }));
    expect(screen.getByRole('button', { name: /vybrať žiaka/i })).toBeDisabled();
    act(() => void vi.advanceTimersByTime(8000));
    expect(names).toContain(screen.getByTestId('picker-result').textContent);
    vi.useRealTimers();
  });
  it('zobrazí pokyn, keď je zoznam prázdny', () => {
    render(<WidgetHarness type="picker" config={{ names: [] }} />);
    expect(screen.getByRole('button', { name: /vybrať žiaka/i })).toBeDisabled();
  });
});

describe('widget Rozdeľovač skupín', () => {
  it('rozdelí všetkých žiakov bez duplicít a bez vynechaných mien, a umožní zopakovať', async () => {
    const user = userEvent.setup();
    const list = Array.from({ length: 23 }, (_, i) => `Žiak${i + 1}`);
    render(<WidgetHarness type="groups" config={{ names: list, mode: 'count', value: 5 }} />);
    for (let round = 0; round < 3; round++) {
      await user.click(screen.getByRole('button', { name: round === 0 ? /rozdeliť do skupín/i : /rozdeliť znova/i }));
      const groups = screen.getAllByRole('region');
      expect(groups).toHaveLength(5);
      const shown = groups.flatMap((g) => within(g).getAllByRole('listitem').map((li) => li.textContent!));
      expect(shown.slice().sort()).toEqual(list.slice().sort());
      expect(screen.getByText(/Žiaci: 23 · Skupiny: 5/)).toBeInTheDocument();
    }
  });
  it('režim podľa veľkosti skupiny', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="groups" config={{ names: Array.from({ length: 10 }, (_, i) => `N${i}`), mode: 'size', value: 4 }} />);
    await user.click(screen.getByRole('button', { name: /rozdeliť do skupín/i }));
    expect(screen.getAllByRole('region')).toHaveLength(3);
  });
});

describe('ďalšie widgety', () => {
  it('Bodovacia tabuľa: pridáva, odoberá a nuluje body', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="scoreboard" config={{ teamCount: 3, step: 2 }} />);
    expect(screen.getAllByRole('button', { name: /pridať bod tímu/i })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: /pridať bod tímu tím 1/i }));
    await user.click(screen.getByRole('button', { name: /pridať bod tímu tím 1/i }));
    await user.click(screen.getByRole('button', { name: /odobrať bod tímu tím 2/i }));
    expect(screen.getByTestId('score-0')).toHaveTextContent('4');
    expect(screen.getByTestId('score-1')).toHaveTextContent('-2');
    await user.click(screen.getByRole('button', { name: /vynulovať skóre/i }));
    expect(screen.getByTestId('score-0')).toHaveTextContent('0');
  });
  it('Semafor: prepína stavy s textovým označením', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="traffic" config={{ greenLabel: 'Diskutujte' }} />);
    expect(screen.getByRole('radio', { name: /červená/i })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /zelená/i }));
    expect(screen.getByRole('radio', { name: /zelená/i })).toBeChecked();
    expect(screen.getByText('Diskutujte')).toBeInTheDocument();
    expect(screen.getByText('ZELENÁ')).toBeInTheDocument();
  });
  it('Kocky: výsledok je v rozsahu a súčet sedí', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="dice" config={{ count: 3, sides: 6 }} />);
    for (let i = 0; i < 20; i++) {
      await user.click(screen.getByRole('button', { name: /hodiť/i }));
      const vals = within(screen.getByTestId('dice-values')).getAllByRole('img').map((d) => Number(d.getAttribute('aria-label')));
      expect(vals).toHaveLength(3);
      vals.forEach((v) => expect(v >= 1 && v <= 6).toBe(true));
      expect(screen.getByTestId('dice-sum')).toHaveTextContent(String(vals.reduce((a, b) => a + b, 0)));
    }
  });
  it('QR kód: zobrazí kód pre platnú adresu a chybu pre neplatnú', () => {
    const { unmount } = render(<WidgetHarness type="qr" config={{ text: 'skola.sk', kind: 'url', caption: 'Naša škola' }} />);
    expect(screen.getByRole('img', { name: /https:\/\/skola\.sk/ })).toBeInTheDocument();
    expect(screen.getByText('Naša škola')).toBeInTheDocument();
    unmount();
    render(<WidgetHarness type="qr" config={{ text: 'javascript:alert(1)', kind: 'url' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/neplatná/i);
  });
  it('Pracovné pokyny: zaškrtávanie, počítadlo a reset', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="steps" config={{ steps: [{ id: 'a', text: 'Prvý' }, { id: 'b', text: 'Druhý' }] }} />);
    await user.click(screen.getByRole('checkbox', { name: /prvý/i }));
    expect(screen.getByRole('checkbox', { name: /prvý/i })).toBeChecked();
    expect(screen.getByTestId('steps-progress')).toHaveTextContent('1/2');
    await user.click(screen.getByRole('button', { name: /zrušiť zaškrtnutia/i }));
    expect(screen.getByTestId('steps-progress')).toHaveTextContent('0/2');
  });
  it('Pracovné pokyny: úprava a pridanie bodu', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="steps" config={{ steps: [{ id: 'a', text: 'Prvý' }] }} />);
    await user.click(screen.getByRole('button', { name: /upraviť body/i }));
    await user.click(screen.getByRole('button', { name: /pridať bod/i }));
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    await user.type(inputs[1]!, 'Tretí krok');
    await user.clear(inputs[0]!);
    await user.type(inputs[0]!, 'Upravený');
    await user.click(screen.getByRole('button', { name: /upraviť body/i }));
    expect(screen.getByText(/Upravený/)).toBeInTheDocument();
    expect(screen.getByText(/Tretí krok/)).toBeInTheDocument();
  });
  it('Anketa: hlasovanie, percentá a reset', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="poll" config={{ options: [{ id: 'a', text: 'Áno', votes: 0 }, { id: 'b', text: 'Nie', votes: 0 }] }} />);
    await user.click(screen.getByRole('button', { name: /pridať hlas pre áno/i }));
    await user.click(screen.getByRole('button', { name: /pridať hlas pre áno/i }));
    await user.click(screen.getByRole('button', { name: /pridať hlas pre nie/i }));
    expect(screen.getByTestId('votes-a')).toHaveTextContent('2 (67 %)');
    expect(screen.getByTestId('votes-b')).toHaveTextContent('1 (33 %)');
    await user.click(screen.getByRole('button', { name: /odobrať hlas pre áno/i }));
    expect(screen.getByTestId('votes-a')).toHaveTextContent('1 (50 %)');
    await user.click(screen.getByRole('button', { name: /vynulovať hlasy/i }));
    expect(screen.getByTestId('votes-a')).toHaveTextContent('0');
  });
  it('Digitálne hodiny: 24-hodinový formát', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 15, 4, 9));
    render(<WidgetHarness type="clock" config={{ showSeconds: true }} />);
    expect(screen.getByLabelText('15:04:09')).toBeInTheDocument();
    vi.useRealTimers();
  });
  it('Textové pole zobrazí nadpis a text', () => {
    render(<WidgetHarness type="text" config={{ title: 'Úloha', body: 'Vypočítaj príklady' }} />);
    expect(screen.getByText('Úloha')).toBeInTheDocument();
    expect(screen.getByText('Vypočítaj príklady')).toBeInTheDocument();
  });
  it('Obrázok bez nahraného súboru ponúka nahratie', () => {
    render(<WidgetHarness type="image" />);
    expect(screen.getByRole('button', { name: /nahrať obrázok/i })).toBeInTheDocument();
  });
  it('Vizuálny časovač: zobrazuje zostávajúci čas a mení farbu pri konci', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WidgetHarness type="visual-timer" config={{ durationMs: 100_000, remainingMs: 100_000 }} />);
    const ring = () => document.querySelector('circle[stroke-dasharray]')!.getAttribute('stroke');
    expect(screen.getByTestId('vtimer-display')).toHaveTextContent('01:40');
    await user.click(screen.getByRole('button', { name: /štart/i }));
    expect(ring()).toBe('#16a34a');
    act(() => void vi.advanceTimersByTime(70_000));
    expect(screen.getByTestId('vtimer-display')).toHaveTextContent('00:30');
    expect(ring()).toBe('#f59e0b');
    act(() => void vi.advanceTimersByTime(20_000));
    expect(ring()).toBe('#dc2626');
    vi.useRealTimers();
  });
});

describe('triedy vo widgetoch', () => {
  const classes = [{ id: 'c1', name: '5.A', names: ['Jana', 'Karol', 'Ľuboš'], updatedAt: 1 }];
  it('Náhodný výber berie mená z vybranej triedy', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="picker" config={{ classId: 'c1', names: [], animate: false, excludePicked: true }} runtime={{ classes }} />);
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: /vybrať žiaka/i }));
      seen.push(screen.getByTestId('picker-result').textContent!);
    }
    expect(seen.slice().sort()).toEqual(['Jana', 'Karol', 'Ľuboš'].sort());
  });
  it('Rozdeľovač skupín použije triedu a nezobrazí cudzie mená', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="groups" config={{ classId: 'c1', names: ['Iný'], mode: 'count', value: 2 }} runtime={{ classes }} />);
    await user.click(screen.getByRole('button', { name: /rozdeliť do skupín/i }));
    const shown = screen.getAllByRole('listitem').map((l) => l.textContent);
    expect(shown.sort()).toEqual(['Jana', 'Karol', 'Ľuboš'].sort());
  });
});

describe('neprítomní žiaci vo widgetoch', () => {
  it('Náhodný výber nikdy nevyberie neprítomného a počítadlo ráta len prítomných', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="picker" config={{ names: ['Anna', 'Peter', 'Eva', 'Jakub'], absent: ['Peter', 'Jakub'], animate: false, excludePicked: true }} />);
    expect(screen.getByText(/Zostáva 2 z 2/)).toBeInTheDocument();
    const seen: string[] = [];
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: /vybrať žiaka/i }));
      seen.push(screen.getByTestId('picker-result').textContent!);
    }
    expect(seen.sort()).toEqual(['Anna', 'Eva']);
    expect(screen.getByText(/všetci už boli vybraní/i)).toBeInTheDocument();
  });
  it('panel „Kto je dnes tu“ prepína prítomnosť a mení zostatok', async () => {
    const user = userEvent.setup();
    render(<WidgetHarness type="picker" config={{ names: ['Anna', 'Peter', 'Eva'], animate: false }} />);
    await user.click(screen.getByTestId('attendance-open'));
    expect(screen.getByTestId('attendance-count')).toHaveTextContent('prítomní 3 z 3');
    await user.click(screen.getByRole('switch', { name: 'Peter: prítomný' }));
    expect(screen.getByTestId('attendance-count')).toHaveTextContent('prítomní 2 z 3');
    expect(screen.getByRole('switch', { name: 'Peter: neprítomný' })).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('button', { name: 'Všetci prítomní' }));
    expect(screen.getByTestId('attendance-count')).toHaveTextContent('prítomní 3 z 3');
    await user.click(screen.getByRole('button', { name: 'Hotovo' }));
    expect(screen.queryByTestId('attendance-panel')).toBeNull();
  });
  it('Rozdeľovač skupín rozdelí iba prítomných', async () => {
    const user = userEvent.setup();
    const list = Array.from({ length: 10 }, (_, i) => `N${i + 1}`);
    render(<WidgetHarness type="groups" config={{ names: list, absent: ['N2', 'N5', 'N9'], mode: 'count', value: 2 }} />);
    await user.click(screen.getByRole('button', { name: /rozdeliť do skupín/i }));
    const shown = screen.getAllByRole('listitem').map((l) => l.textContent!.replace(' ⚠', ''));
    expect(shown.sort()).toEqual(list.filter((n) => !['N2', 'N5', 'N9'].includes(n)).sort());
    expect(screen.getByText(/Žiaci: 7 · Skupiny: 2/)).toBeInTheDocument();
  });
  it('keď sú všetci neprítomní, nedá sa losovať ani deliť', () => {
    const { unmount } = render(<WidgetHarness type="picker" config={{ names: ['A', 'B'], absent: ['A', 'B'] }} />);
    expect(screen.getByRole('button', { name: /vybrať žiaka/i })).toBeDisabled();
    expect(screen.getByText(/označení ako neprítomní/i)).toBeInTheDocument();
    unmount();
    render(<WidgetHarness type="groups" config={{ names: ['A', 'B'], absent: ['A', 'B'] }} />);
    expect(screen.getByRole('button', { name: /rozdeliť do skupín/i })).toBeDisabled();
  });
});
