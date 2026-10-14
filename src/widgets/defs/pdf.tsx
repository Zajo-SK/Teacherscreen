import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Trash2, Upload } from 'lucide-react';
import { z } from 'zod';
import { t } from '@/i18n';
import { clampPage, dataUrlToBytes, formatBytes, isSafePdfDataUrl, PdfFileError, readPdfFile } from '@/lib/pdf';
import { int, str } from '../fields';
import type { SettingsProps, WidgetDefinition, WidgetProps } from '../types';

const schema = z.object({
  src: z.string().refine((v) => v === '' || isSafePdfDataUrl(v)).catch(''),
  name: str('', 120),
  size: int(0, 0, 50_000_000),
  page: int(1, 1, 100000),
});
type Config = z.output<typeof schema>;

// Minimálne rozhranie pdfjs, ktoré používame (celá knižnica sa načíta až pri prvom zobrazení).
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}
interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: unknown }): { promise: Promise<void>; cancel(): void };
  cleanup(): void;
}

/** Lazy načítanie pdfjs a jeho workera (samostatné chunky, nie sú v hlavnom balíku). */
async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

const ERR_KEY = {
  unsupported: 'w.pdf.err.unsupported',
  'too-large': 'w.pdf.err.tooLarge',
  empty: 'w.pdf.err.empty',
  read: 'w.pdf.err.read',
} as const;

function useUpload(update: (p: Partial<Config>) => void) {
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const r = await readPdfFile(file);
      update({ src: r.dataUrl, name: r.name, size: r.size, page: 1 });
    } catch (e) {
      setError(t(ERR_KEY[e instanceof PdfFileError ? e.code : 'read']));
    }
  };
  return { upload, error };
}

function PdfWidget({ widget, config, update }: WidgetProps<Config>) {
  const { src, name } = config;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'render-error'>('idle');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const total = doc?.numPages ?? 0;
  const page = doc ? clampPage(config.page, total) : config.page;

  // Načítanie dokumentu.
  useEffect(() => {
    setDoc(null);
    if (!src) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    let task: { promise: Promise<PdfDoc>; destroy(): Promise<void> } | null = null;
    setStatus('loading');
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        // isEvalSupported/enableScripting nie sú vo všetkých verziách typov, ale runtime ich rešpektuje.
        const opts = { data: dataUrlToBytes(src), isEvalSupported: false, enableScripting: false, disableAutoFetch: true, disableStream: true, disableRange: true };
        task = pdfjs.getDocument(opts) as unknown as typeof task;
        const d = await task!.promise;
        if (cancelled) return void d.destroy();
        setDoc(d);
        setStatus('idle');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy().catch(() => undefined);
    };
  }, [src]);

  // Uloží orezanú stránku, ak je mimo rozsahu.
  useEffect(() => {
    if (doc && page !== config.page) update({ page });
  }, [doc, page, config.page, update]);

  // Sledovanie veľkosti (s oneskorením pri zmene veľkosti widgetu).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    });
    ro.observe(el);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [doc, src]);

  // Vykreslenie stránky; pri zmene stránky/veľkosti sa predchádzajúce vykresľovanie zruší.
  useEffect(() => {
    const cv = canvas.current;
    if (!doc || !cv || size.w < 4 || size.h < 4) return;
    let cancelled = false;
    let rendering: { promise: Promise<void>; cancel(): void } | null = null;
    (async () => {
      try {
        const p = await doc.getPage(page);
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const fit = Math.min(size.w / base.width, size.h / base.height);
        const dpr = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: fit * dpr });
        const ctx = cv.getContext('2d');
        if (!ctx) throw new Error('canvas');
        cv.width = Math.max(1, Math.floor(viewport.width));
        cv.height = Math.max(1, Math.floor(viewport.height));
        cv.style.width = `${Math.floor(viewport.width / dpr)}px`;
        cv.style.height = `${Math.floor(viewport.height / dpr)}px`;
        rendering = p.render({ canvasContext: ctx, canvas: cv, viewport });
        await rendering.promise;
        if (!cancelled) setStatus('idle');
      } catch (e) {
        if (!cancelled && (e as { name?: string })?.name !== 'RenderingCancelledException') {
          console.warn('PDF: vykreslenie zlyhalo', e);
          setStatus('render-error');
        }
      }
    })();
    return () => {
      cancelled = true;
      rendering?.cancel();
    };
  }, [doc, page, size]);

  const go = (d: number) => update({ page: clampPage(page + d, total) });
  const center = { display: 'grid', placeItems: 'center', padding: '4cqmin', boxSizing: 'border-box', textAlign: 'center' } as const;

  if (!src) {
    return (
      <div className="widget-body" style={center}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2cqmin' }}>
          <FileText aria-hidden style={{ width: '14cqmin', height: '14cqmin', opacity: 0.5 }} />
          <div style={{ fontSize: 'min(4cqw, 8cqh)', fontWeight: 700 }}>{t('w.pdf.empty')}</div>
        </div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="widget-body" style={center}>
        <div role="alert" style={{ fontSize: 'min(4cqw, 8cqh)', fontWeight: 700, color: '#dc2626' }}>
          {t('w.pdf.err.load')}
        </div>
      </div>
    );
  }

  const btn = { border: 0, borderRadius: 999, background: 'rgb(0 0 0 / 0.65)', color: '#fff', width: 40, height: 40, display: 'grid', placeItems: 'center', cursor: 'pointer' } as const;
  return (
    <div className="widget-body" style={{ display: 'flex', flexDirection: 'column' }} data-widget-id={widget.id}>
      <div ref={box} role="img" aria-label={t('w.pdf.aria', { name: name || t('w.pdf.label') })} style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        <canvas ref={canvas} data-testid="pdf-canvas" style={{ display: doc && status !== 'render-error' ? 'block' : 'none', background: '#fff' }} />
        {status === 'loading' && <div role="status">{t('w.pdf.loading')}</div>}
        {status === 'render-error' && <div role="alert">{t('w.pdf.err.render')}</div>}
      </div>
      {doc && (
        <div data-no-drag style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 6 }}>
          <button type="button" data-no-drag aria-label={t('w.pdf.prev')} disabled={page <= 1} onClick={() => go(-1)} style={{ ...btn, opacity: page <= 1 ? 0.4 : 1 }}>
            <ChevronLeft size={22} aria-hidden />
          </button>
          <span data-testid="pdf-page" aria-live="polite" aria-label={t('w.pdf.pageOf', { page, total })} style={{ fontWeight: 700, fontSize: 'min(3.5cqw, 7cqh)', minWidth: '4em', textAlign: 'center' }}>
            {page} / {total}
          </span>
          <button type="button" data-no-drag aria-label={t('w.pdf.next')} disabled={page >= total} onClick={() => go(1)} style={{ ...btn, opacity: page >= total ? 0.4 : 1 }}>
            <ChevronRight size={22} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

function Settings({ config, update }: SettingsProps<Config>) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, error } = useUpload(update);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => input.current?.click()}>
          <Upload size={18} aria-hidden /> {config.src ? t('w.pdf.replace') : t('w.pdf.choose')}
        </button>
        {config.src && (
          <button type="button" className="btn btn-danger" onClick={() => update({ src: '', name: '', size: 0, page: 1 })}>
            <Trash2 size={18} aria-hidden /> {t('w.pdf.remove')}
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          data-testid="pdf-input"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {config.src && (
        <p className="mb-3 text-sm" data-testid="pdf-file">
          {t('w.pdf.file', { name: config.name || 'PDF', size: formatBytes(config.size) })}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">{t('w.pdf.note')}</p>
    </>
  );
}

export const pdfWidget: WidgetDefinition<Config> = {
  type: 'pdf',
  label: 'w.pdf.label',
  description: 'w.pdf.desc',
  icon: FileText,
  category: 'content',
  defaultSize: { w: 560, h: 700 },
  minSize: { w: 240, h: 240 },
  schema,
  Component: PdfWidget,
  Settings,
};
