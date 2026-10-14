import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { t } from '@/i18n';
import { useApp } from '@/store/useApp';
import { importPhoto, PHOTO_TOPICS, searchPhotos, type Photo, type PhotoStats } from '@/lib/photos';

/** Fotky z Wikimedia Commons (voľné licencie). Vyžaduje internet; vybraná fotka sa uloží do obrazovky. */
export function PhotoBrowser({ screenId }: { screenId: string }) {
  const setBackground = useApp((s) => s.setBackground);
  const toast = useApp((s) => s.toast);
  const [topic, setTopic] = useState(PHOTO_TOPICS[0]!.id);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async (topicId: string, offset: number, append: boolean) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setError(false);
    try {
      const q = PHOTO_TOPICS.find((x) => x.id === topicId)!.query;
      // Ak prvá strana neobsahuje vhodné fotky, automaticky sa načíta ďalšia (najviac 5 strán).
      let found: Photo[] = [];
      let off: number | null = offset;
      let last: PhotoStats | null = null;
      for (let i = 0; i < 5 && off !== null && found.length < 9; i++) {
        const page = await searchPhotos(q, off, ctrl.signal);
        found = [...found, ...page.photos];
        last = page.stats;
        off = page.next;
      }
      if (found.length === 0) console.info('Fotky: žiadne vhodné výsledky', last);
      setStats(last);
      setPhotos((cur) => (append ? [...cur, ...found] : found));
      setNext(off);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(true);
    } finally {
      if (abort.current === ctrl) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(topic, 0, false);
    return () => abort.current?.abort();
  }, [topic, load]);

  const choose = async (p: Photo) => {
    setApplying(p.title);
    try {
      const { dataUrl, credit } = await importPhoto(p);
      setBackground(screenId, { kind: 'image', value: dataUrl, credit });
      toast(t('bg.photoSet'), { tone: 'success', ms: 2000 });
    } catch (e) {
      console.error('Import fotky zlyhal', e);
      toast(t('bg.photoFailed'), { tone: 'error' });
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="mb-4" data-testid="photo-browser">
      {(
        <div>
          <p className="mb-2 text-xs text-muted">{t('bg.photosNote')}</p>
          <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label={t('bg.photos')}>
            {PHOTO_TOPICS.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={topic === x.id} className="rounded-full border border-line px-3 py-1 text-xs font-semibold aria-selected:border-transparent aria-selected:bg-primary aria-selected:text-primary-fg" onClick={() => setTopic(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="mb-2 text-sm text-danger" data-testid="photo-error">
              {t('bg.photosOffline')}{' '}
              <button type="button" className="underline" onClick={() => void load(topic, 0, false)}>
                {t('bg.retry')}
              </button>
            </p>
          )}
          <div className="grid grid-cols-3 gap-2" data-testid="photo-grid">
            {photos.map((p) => (
              <button
                key={p.title}
                type="button"
                data-testid="photo-item"
                aria-label={`${p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '')} – ${p.author}`}
                data-tip={`${p.author} · ${p.license}`}
                disabled={!!applying}
                onClick={() => void choose(p)}
                className="relative aspect-video overflow-hidden rounded-xl border-2 border-line transition-transform hover:scale-105 disabled:opacity-60"
              >
                <img src={p.thumb} alt="" loading="lazy" className="size-full object-cover" />
                {applying === p.title && (
                  <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                    <Loader2 className="animate-spin" aria-hidden />
                  </span>
                )}
              </button>
            ))}
          </div>
          {loading && <p className="mt-2 text-sm text-muted">{t('common.loading')}</p>}
          {!loading && !error && photos.length === 0 && (
            <p className="mt-2 text-sm text-muted" data-testid="photo-none">
              {t('bg.photosNone')}
              {stats && <span className="mt-1 block break-all font-mono text-[10px]">{t('bg.photosDiag', { total: stats.total, lic: stats.license, size: stats.size, ratio: stats.ratio, info: stats.noInfo + stats.mime + stats.url, sample: stats.sampleLicenses.join(', ') })}</span>}
            </p>
          )}
          {next !== null && !loading && (
            <button type="button" className="btn mt-2 w-full" onClick={() => void load(topic, next, true)}>
              {t('bg.more')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
