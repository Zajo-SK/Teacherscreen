import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { levelToZone, rmsToLevel, smoothLevel, zoneThresholds } from '@/widgets/defs/noise';
import { WidgetHarness } from './harness';

describe('noise – matematika', () => {
  it('rms -> hladina je orezaná do 0..1 a monotónna', () => {
    expect(rmsToLevel(0)).toBe(0);
    expect(rmsToLevel(NaN)).toBe(0);
    expect(rmsToLevel(1)).toBe(1);
    expect(rmsToLevel(0.01)).toBeGreaterThan(rmsToLevel(0.001));
  });
  it('vyššia citlivosť znižuje hranice', () => {
    expect(zoneThresholds(10).warn).toBeLessThan(zoneThresholds(1).warn);
    expect(zoneThresholds(99).warn).toBe(zoneThresholds(10).warn);
  });
  it('zóny', () => {
    const { warn, loud } = zoneThresholds(5);
    expect(levelToZone(0, 5)).toBe('calm');
    expect(levelToZone(warn, 5)).toBe('mid');
    expect(levelToZone(loud, 5)).toBe('loud');
  });
  it('nábeh je rýchlejší ako dozvuk', () => {
    const up = smoothLevel(0, 1, 100);
    const down = 1 - smoothLevel(1, 0, 100);
    expect(up).toBeGreaterThan(down);
    expect(smoothLevel(0.3, 0.3, 100)).toBeCloseTo(0.3);
  });
});

describe('noise – komponent', () => {
  const stop = vi.fn();
  const close = vi.fn(() => Promise.resolve());
  let amp = 0;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    stop.mockClear();
    close.mockClear();
    amp = 0.5;
    class FakeCtx {
      state = 'running';
      createAnalyser() {
        return { fftSize: 0, getFloatTimeDomainData: (b: Float32Array) => b.fill(amp) };
      }
      createMediaStreamSource() {
        return { connect: () => undefined };
      }
      resume() {
        return Promise.resolve();
      }
      close = close;
    }
    vi.stubGlobal('AudioContext', FakeCtx);
    Object.defineProperty(window, 'AudioContext', { value: FakeCtx, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const mockMic = (impl: () => Promise<unknown>) =>
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn(impl) }, configurable: true });

  it('nespustí mikrofón automaticky', () => {
    mockMic(() => Promise.resolve({ getTracks: () => [{ stop }] }));
    render(<WidgetHarness type="noise" />);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /zapnúť mikrofón/i })).toBeInTheDocument();
  });

  it('po kliknutí meria, ukáže červenú zónu a pri vypnutí uvoľní zdroje', async () => {
    mockMic(() => Promise.resolve({ getTracks: () => [{ stop }] }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WidgetHarness type="noise" />);
    await user.click(screen.getByRole('button', { name: /zapnúť mikrofón/i }));
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByTestId('noise-zone')).toHaveAttribute('data-zone', 'loud');
    await user.click(screen.getByRole('button', { name: /vypnúť mikrofón/i }));
    expect(stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(screen.queryByTestId('noise-zone')).toBeNull();
  });

  it('odmietnutý mikrofón ukáže hlásenie', async () => {
    mockMic(() => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WidgetHarness type="noise" />);
    await user.click(screen.getByRole('button', { name: /zapnúť mikrofón/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/zamietnut/i);
  });

  it('chýbajúce API ukáže nedostupný mikrofón; unmount zastaví stopy', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const r = render(<WidgetHarness type="noise" />);
    await user.click(screen.getByRole('button', { name: /zapnúť mikrofón/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/nie je dostupný/i);
    r.unmount();

    mockMic(() => Promise.resolve({ getTracks: () => [{ stop }] }));
    const r2 = render(<WidgetHarness type="noise" />);
    await user.click(screen.getByRole('button', { name: /zapnúť mikrofón/i }));
    r2.unmount();
    expect(stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
