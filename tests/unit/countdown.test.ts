import { describe, expect, it } from 'vitest';
import {
  elapsedAt,
  formatCountdown,
  formatElapsed,
  initialCountdown,
  initialStopwatch,
  pauseCountdown,
  pauseStopwatch,
  remainingAt,
  resetCountdown,
  settleCountdown,
  startCountdown,
  startStopwatch,
} from '@/lib/countdown';

describe('časovač s absolútnym časom ukončenia', () => {
  const T0 = 1_000_000;
  it('zostávajúci čas závisí od hodín, nie od počtu tikov', () => {
    const s = startCountdown(initialCountdown(60_000), T0);
    expect(s.endsAt).toBe(T0 + 60_000);
    // prehliadač „zaspal“ – žiadny tik medzitým, a čas je aj tak presný
    expect(remainingAt(s, T0 + 37_250)).toBe(22_750);
    expect(remainingAt(s, T0 + 59_999)).toBe(1);
  });
  it('po uplynutí sa zastaví na nule a prejde do stavu done', () => {
    const s = startCountdown(initialCountdown(5_000), T0);
    expect(remainingAt(s, T0 + 99_000)).toBe(0);
    expect(settleCountdown(s, T0 + 5_000).status).toBe('done');
    expect(settleCountdown(s, T0 + 4_999)).toBe(s);
  });
  it('pozastavenie zachová zostávajúci čas a pokračovanie ho znova odmeria od nového štartu', () => {
    let s = startCountdown(initialCountdown(60_000), T0);
    s = pauseCountdown(s, T0 + 20_000);
    expect(s).toMatchObject({ status: 'paused', remainingMs: 40_000, endsAt: null });
    expect(remainingAt(s, T0 + 500_000)).toBe(40_000); // počas pauzy čas neplynie
    s = startCountdown(s, T0 + 100_000);
    expect(s.endsAt).toBe(T0 + 140_000);
  });
  it('reset vráti pôvodnú dĺžku', () => {
    const s = resetCountdown(pauseCountdown(startCountdown(initialCountdown(90_000), T0), T0 + 1000));
    expect(s).toMatchObject({ status: 'idle', remainingMs: 90_000 });
  });
  it('pauza po vypršaní nevráti záporný čas', () => {
    const s = pauseCountdown(startCountdown(initialCountdown(1000), T0), T0 + 5000);
    expect(s.status).toBe('done');
    expect(s.remainingMs).toBe(0);
  });
  it('formátuje mm:ss a zaokrúhľuje nahor', () => {
    expect(formatCountdown(61_000)).toBe('01:01');
    expect(formatCountdown(59_001)).toBe('01:00');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(3_600_000)).toBe('1:00:00');
  });
});

describe('stopky', () => {
  it('akumulujú čas cez pauzy', () => {
    let s = startStopwatch(initialStopwatch, 1000);
    expect(elapsedAt(s, 4500)).toBe(3500);
    s = pauseStopwatch(s, 4500);
    expect(elapsedAt(s, 99_999)).toBe(3500);
    s = startStopwatch(s, 10_000);
    expect(elapsedAt(s, 12_000)).toBe(5500);
  });
  it('formát s desatinami', () => {
    expect(formatElapsed(65_432)).toBe('01:05.4');
  });
});
