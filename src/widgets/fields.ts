import { z } from 'zod';

/** Pomocné polia schémy – každé pole je odolné voči chybným/neznámym vstupom (`catch` na predvolenú hodnotu). */
/** `def` môže byť funkcia – predvolený text sa potom vyhodnotí pri každom parsovaní (podľa aktuálneho jazyka). */
export const str = (def: string | (() => string), max = 500) =>
  z
    .string()
    .transform((s) => s.slice(0, max))
    .catch(() => (typeof def === 'function' ? def() : def));

export const num = (def: number, min: number, max: number) =>
  z
    .number()
    .transform((n) => Math.min(max, Math.max(min, n)))
    .catch(def);

export const int = (def: number, min: number, max: number) =>
  z
    .number()
    .transform((n) => Math.min(max, Math.max(min, Math.round(n))))
    .catch(def);

export const bool = (def: boolean) => z.boolean().catch(def);

export const oneOf = <const T extends readonly [string, ...string[]]>(values: T, def: T[number]) => z.enum(values).catch(def);

export const strList = (maxItems: number, maxLen: number, def: string[] = []) =>
  z
    .array(z.string().transform((s) => s.slice(0, maxLen)))
    .transform((a) => a.slice(0, maxItems))
    .catch(def);

export const nullableNum = z.number().nullable().catch(null);
export const nullableStr = z.string().nullable().catch(null);
