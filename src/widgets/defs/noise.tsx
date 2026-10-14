import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Mic, MicOff } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { NumberField, Toggle } from '@/components/forms';
import { playAlarm, primeAudio } from '@/lib/audio';
import { bool, int } from '../fields';
import { useRuntime } from '../runtime';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  sensitivity: int(5, 1, 10),
  soundAlert: bool(false),
});
type Config = z.output<typeof schema>;

export type NoiseZone = 'calm' | 'mid' | 'loud';

/** RMS (0..1 amplitúda) -> hladina 0..1 na dB škále (-70 dB .. -10 dB). */
export function rmsToLevel(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db + 70) / 60));
}

/** Hranice zón podľa citlivosti: vyššia citlivosť = nižšie hranice. */
export function zoneThresholds(sensitivity: number): { warn: number; loud: number } {
  const s = Math.min(10, Math.max(1, Math.round(Number.isFinite(sensitivity) ? sensitivity : 5)));
  const warn = 0.75 - (s - 1) * 0.035;
  return { warn, loud: Math.min(0.98, warn + 0.15) };
}

export function levelToZone(level: number, sensitivity: number): NoiseZone {
  const { warn, loud } = zoneThresholds(sensitivity);
  if (level >= loud) return 'loud';
  if (level >= warn) return 'mid';
  return 'calm';
}

/** Vyhladenie: rýchly nábeh (attack), pomalý dozvuk (decay). */
export function smoothLevel(prev: number, target: number, dtMs: number, attackMs = 80, decayMs = 600): number {
  const tau = target > prev ? attackMs : decayMs;
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tau);
  return prev + (target - prev) * k;
}

const ZONE_COLOR: Record<NoiseZone, string> = { calm: '#16a34a', mid: '#eab308', loud: '#dc2626' };
const ZONE_KEY = { calm: 'w.noise.zone.calm', mid: 'w.noise.zone.mid', loud: 'w.noise.zone.loud' } as const;

type Status = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

function NoiseWidget({ config }: WidgetProps<Config>) {
  const rt = useRuntime();
  const [status, setStatus] = useState<Status>('off');
  const [level, setLevel] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);
  const aliveRef = useRef(true);
  const reqRef = useRef(0);

  const stop = useCallback(() => {
    reqRef.current++;
    stopRef.current?.();
    stopRef.current = null;
    setLevel(0);
    setStatus('off');
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      reqRef.current++;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    primeAudio();
    const req = ++reqRef.current;
    setStatus('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      if (!aliveRef.current || req !== reqRef.current) return;
      const name = (e as { name?: string } | null)?.name;
      setStatus(name === 'NotFoundError' || name === 'NotSupportedError' ? 'unavailable' : 'denied');
      return;
    }
    const cleanupStream = () => stream.getTracks().forEach((tr) => tr.stop());
    if (!aliveRef.current || req !== reqRef.current) {
      cleanupStream();
      return;
    }
    let ac: AudioContext | null = null;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('no audio');
      ac = new Ctor();
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      ac.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let smooth = 0;
      let last = Date.now();
      const timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
        const now = Date.now();
        smooth = smoothLevel(smooth, rmsToLevel(Math.sqrt(sum / buf.length)), now - last);
        last = now;
        setLevel(smooth);
      }, 50);
      const ctxToClose = ac;
      stopRef.current = () => {
        window.clearInterval(timer);
        cleanupStream();
        void ctxToClose.close().catch(() => undefined);
      };
      setStatus('on');
    } catch {
      cleanupStream();
      void ac?.close().catch(() => undefined);
      setStatus('unavailable');
    }
  };

  const zone = levelToZone(level, config.sensitivity);
  const { warn, loud } = zoneThresholds(config.sensitivity);

  // zvukové upozornenie pri vstupe do červenej zóny (najviac raz za 5 s)
  const lastBeep = useRef(0);
  const prevZone = useRef<NoiseZone>('calm');
  useEffect(() => {
    if (status === 'on' && zone === 'loud' && prevZone.current !== 'loud' && rt.sound && config.soundAlert && Date.now() - lastBeep.current > 5000) {
      lastBeep.current = Date.now();
      playAlarm();
    }
    prevZone.current = zone;
  }, [zone, status, rt.sound, config.soundAlert]);

  const live = status === 'on';
  const pct = (n: number) => `${n * 100}%`;
  const segs = [
    { color: ZONE_COLOR.calm, from: 0, to: warn },
    { color: ZONE_COLOR.mid, from: warn, to: loud },
    { color: ZONE_COLOR.loud, from: loud, to: 1 },
  ];
  const segStyle = (s: (typeof segs)[number]) => ({ position: 'absolute' as const, top: 0, bottom: 0, left: pct(s.from), width: pct(s.to - s.from), background: s.color });
  const message =
    status === 'denied' ? t('w.noise.denied') : status === 'unavailable' ? t('w.noise.unavailable') : status === 'starting' ? t('w.noise.starting') : status === 'off' ? t('w.noise.idle') : null;

  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', gap: '3cqh' }}>
      <div
        role="meter"
        aria-label={t('w.noise.meterAria', { zone: live ? t(ZONE_KEY[zone]) : t('w.noise.idle') })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        data-testid="noise-meter"
        style={{ position: 'relative', width: '100%', height: 'min(26cqh, 12cqw)', borderRadius: 999, overflow: 'hidden', border: '2px solid color-mix(in srgb, currentColor 25%, transparent)' }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.25 }}>
          {segs.map((s) => (
            <div key={s.color} style={segStyle(s)} />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${pct(1 - level)} 0 0)` }}>
          {segs.map((s) => (
            <div key={s.color} style={segStyle(s)} />
          ))}
        </div>
      </div>
      {live ? (
        <div data-testid="noise-zone" data-zone={zone} style={{ fontSize: 'min(11cqw, 22cqh)', fontWeight: 800, lineHeight: 1.1, textAlign: 'center', color: ZONE_COLOR[zone] }}>
          {t(ZONE_KEY[zone])}
        </div>
      ) : (
        <div role={status === 'denied' || status === 'unavailable' ? 'alert' : 'status'} className="wmuted" style={{ fontSize: 'min(4.5cqw, 9cqh)', fontWeight: 600, textAlign: 'center' }}>
          {message}
        </div>
      )}
      <button
        type="button"
        data-no-drag
        className={live ? 'wbtn' : 'wbtn wbtn-primary'}
        disabled={status === 'starting'}
        onClick={live ? stop : () => void start()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        {live ? <MicOff size={22} aria-hidden /> : <Mic size={22} aria-hidden />}
        {live ? t('w.noise.stop') : t('w.noise.start')}
      </button>
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  return (
    <>
      <NumberField label={t('w.noise.sensitivity')} value={config.sensitivity} min={1} max={10} onChange={(sensitivity) => update({ sensitivity })} />
      <Toggle label={t('w.noise.soundAlert')} checked={config.soundAlert} onChange={(soundAlert) => update({ soundAlert })} />
      <p className="text-sm text-muted">{t('w.noise.privacy')}</p>
    </>
  );
}

export const noiseWidget: WidgetDefinition<Config> = {
  type: 'noise',
  label: 'w.noise.label',
  description: 'w.noise.desc',
  icon: AudioLines,
  category: 'class',
  defaultSize: { w: 400, h: 300 },
  minSize: { w: 200, h: 140 },
  schema,
  Component: NoiseWidget,
  Settings,
};
