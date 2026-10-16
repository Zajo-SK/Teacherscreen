import { CANVAS_SIZES, type AspectId } from '@/types';
export const ASPECTS: AspectId[] = ['16:9', '16:10', '4:3'];

/** Pomer strán plochy, ktorý je najbližšie tvaru okna – nová obrazovka tak zaplní celé okno bez prázdnych pásov. */
export function bestAspect(width = typeof window !== 'undefined' ? window.innerWidth : 0, height = typeof window !== 'undefined' ? window.innerHeight : 0): AspectId {
  if (!(width > 0) || !(height > 0)) return '16:9';
  const r = Math.log(width / height);
  return ASPECTS.reduce((best, a) => {
    const d = (id: AspectId) => Math.abs(Math.log(CANVAS_SIZES[id].w / CANVAS_SIZES[id].h) - r);
    return d(a) < d(best) ? a : best;
  }, '16:9' as AspectId);
}
