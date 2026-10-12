import { t } from '@/i18n';

export function relativeTime(ts: number, now = Date.now()): string {
  const min = Math.floor((now - ts) / 60000);
  if (min < 1) return t('time.justNow');
  if (min < 60) return t('time.minutesAgo', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('time.hoursAgo', { n: h });
  return t('time.daysAgo', { n: Math.floor(h / 24) });
}

/** Porovnávanie bez diakritiky a veľkosti písmen (vyhľadávanie „cital“ nájde „Čítanie“). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
