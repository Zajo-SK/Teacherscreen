/**
 * Prihlásenie používa prezývku (nick) a heslo. Supabase Auth vyžaduje e‑mail, preto sa z nicku vyrobí
 * interná adresa; žiadna pošta sa na ňu neodosiela (v Supabase musí byť vypnuté potvrdzovanie e‑mailu).
 */
export const NICK_DOMAIN = 'teacherscreen.example.com';

export function normalizeNick(raw: string): string {
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export type NickCheck = { ok: true; nick: string } | { ok: false };

export function validateNick(raw: string): NickCheck {
  const nick = normalizeNick(raw);
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(nick) || /[._-]$/.test(nick) || /[._-]{2}/.test(nick)) return { ok: false };
  return { ok: true, nick };
}

export const nickToEmail = (nick: string): string => `${nick}@${NICK_DOMAIN}`;

export function emailToNick(email: string | null | undefined): string {
  return (email ?? '').replace(new RegExp(`@${NICK_DOMAIN.replace(/\./g, '\\.')}$`), '');
}
