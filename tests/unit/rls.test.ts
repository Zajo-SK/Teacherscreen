// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Overenie Row Level Security (scenár 12): migrácia sa spustí v skutočnej (WASM) PostgreSQL databáze
 * so zjednodušenou náhradou Supabase schémy `auth`. Používateľ „prihlásený“ = SET ROLE authenticated + JWT claim.
 */
const A = '00000000-0000-0000-0000-00000000000a'; // učiteľ A
const B = '00000000-0000-0000-0000-00000000000b'; // učiteľ B
const C = '00000000-0000-0000-0000-00000000000c'; // učiteľ C (cudzí)
const ADMIN = '00000000-0000-0000-0000-0000000000ad';

let db: PGlite;

async function as(user: string | null, fn: () => Promise<unknown>) {
  await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);` : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}
const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const denied = async (user: string | null, sql: string, params: unknown[] = []) => {
  try {
    await as(user, () => db.query(sql, params));
    return false;
  } catch {
    return true;
  }
};

let screenA = '';

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(readFileSync('supabase/migrations/0001_init.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/0002_class_lists.sql', 'utf8'));
  for (const [id, mail] of [[A, 'a@skola.sk'], [B, 'b@skola.sk'], [C, 'c@skola.sk'], [ADMIN, 'admin@skola.sk']]) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, mail]);
  }
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  const rows = await as(A, () => db.query<{ id: string }>(`insert into public.screens (name, data) values ('Súkromná A', '{"secret":"A"}') returning id`));
  screenA = (rows as { rows: { id: string }[] }).rows[0]!.id;
});

describe('RLS: osobné obrazovky', () => {
  it('vlastník vidí svoju obrazovku', async () => {
    const r = (await as(A, () => db.query('select name from public.screens'))) as { rows: unknown[] };
    expect(r.rows).toHaveLength(1);
  });
  it('iný učiteľ nevidí cudziu obrazovku ani pri priamom dopyte podľa ID (zmena ID v URL nepomôže)', async () => {
    const list = (await as(B, () => db.query('select * from public.screens'))) as { rows: unknown[] };
    expect(list.rows).toHaveLength(0);
    const byId = (await as(B, () => db.query('select * from public.screens where id = $1', [screenA]))) as { rows: unknown[] };
    expect(byId.rows).toHaveLength(0);
  });
  it('iný učiteľ ju nemôže upraviť ani zmazať (0 zasiahnutých riadkov)', async () => {
    const u = (await as(B, () => db.query(`update public.screens set name = 'hack' where id = $1`, [screenA]))) as { affectedRows: number };
    expect(u.affectedRows).toBe(0);
    const d = (await as(B, () => db.query('delete from public.screens where id = $1', [screenA]))) as { affectedRows: number };
    expect(d.affectedRows).toBe(0);
    expect((await q('select name from public.screens where id = $1', [screenA]))[0]).toEqual({ name: 'Súkromná A' });
  });
  it('nemožno vložiť obrazovku s cudzím vlastníkom', async () => {
    expect(await denied(B, `insert into public.screens (owner_id, name, data) values ($1, 'podvrh', '{}')`, [A])).toBe(true);
  });
  it('anonymný používateľ nemá prístup k tabuľkám', async () => {
    expect(await denied(null, 'select * from public.screens')).toBe(true);
    expect(await denied(null, 'select * from public.profiles')).toBe(true);
  });
  it('ani administrátor školy nevidí súkromné obrazovky učiteľov', async () => {
    const r = (await as(ADMIN, () => db.query('select * from public.screens'))) as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });
  it('vlastníka obrazovky nemožno zmeniť', async () => {
    expect(await denied(A, `update public.screens set owner_id = $1 where id = $2`, [B, screenA])).toBe(true);
  });
});

describe('RLS: zdieľanie', () => {
  it('po zdieľaní „view“ vidí obrazovku príjemca, ale nemôže ju meniť; tretia osoba stále nič', async () => {
    await as(A, () => db.query(`insert into public.screen_shares (screen_id, grantee_id, permission) values ($1, $2, 'view')`, [screenA, B]));
    const seen = (await as(B, () => db.query('select name from public.screens'))) as { rows: unknown[] };
    expect(seen.rows).toHaveLength(1);
    const u = (await as(B, () => db.query(`update public.screens set name = 'x' where id = $1`, [screenA]))) as { affectedRows: number };
    expect(u.affectedRows).toBe(0);
    const c = (await as(C, () => db.query('select 1 from public.screens'))) as { rows: unknown[] };
    expect(c.rows).toHaveLength(0);
  });
  it('s oprávnením „edit“ môže príjemca upravovať, ale nie mazať', async () => {
    await as(A, () => db.query(`update public.screen_shares set permission = 'edit' where screen_id = $1 and grantee_id = $2`, [screenA, B]));
    const u = (await as(B, () => db.query(`update public.screens set name = 'Upravil B' where id = $1`, [screenA]))) as { affectedRows: number };
    expect(u.affectedRows).toBe(1);
    const d = (await as(B, () => db.query('delete from public.screens where id = $1', [screenA]))) as { affectedRows: number };
    expect(d.affectedRows).toBe(0);
  });
  it('príjemca nemôže zdieľať ďalej ani si sám pridať prístup', async () => {
    expect(await denied(B, `insert into public.screen_shares (screen_id, grantee_id) values ($1, $2)`, [screenA, C])).toBe(true);
    expect(await denied(C, `insert into public.screen_shares (screen_id, grantee_id) values ($1, $2)`, [screenA, C])).toBe(true);
  });
  it('zrušenie zdieľania odoberie prístup', async () => {
    await as(A, () => db.query('delete from public.screen_shares where screen_id = $1 and grantee_id = $2', [screenA, B]));
    const r = (await as(B, () => db.query('select 1 from public.screens'))) as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
  });
  it('administrátor môže zakázať učiteľovi zdieľanie', async () => {
    await as(ADMIN, () => db.query('select public.set_user_can_share($1, false)', [A]));
    expect(await denied(A, `insert into public.screen_shares (screen_id, grantee_id) values ($1, $2)`, [screenA, C])).toBe(true);
    await as(ADMIN, () => db.query('select public.set_user_can_share($1, true)', [A]));
  });
});

describe('RLS: odkazy na zdieľanie', () => {
  let token = '';
  it('vlastník vytvorí odkaz; anonym s tokenom obrazovku prečíta, bez tokenu nie', async () => {
    const r = (await as(A, () => db.query<{ token: string }>('insert into public.share_links (screen_id) values ($1) returning token', [screenA]))) as { rows: { token: string }[] };
    token = r.rows[0]!.token;
    expect(token.length).toBeGreaterThanOrEqual(64);
    const ok = (await as(null, () => db.query('select name from public.get_shared_screen($1)', [token]))) as { rows: unknown[] };
    expect(ok.rows).toHaveLength(1);
    const bad = (await as(null, () => db.query('select name from public.get_shared_screen($1)', ['0'.repeat(64)]))) as { rows: unknown[] };
    expect(bad.rows).toHaveLength(0);
  });
  it('cudzí učiteľ nevidí cudzie odkazy a nemôže vytvoriť odkaz na cudziu obrazovku', async () => {
    const r = (await as(C, () => db.query('select * from public.share_links'))) as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
    expect(await denied(C, 'insert into public.share_links (screen_id) values ($1)', [screenA])).toBe(true);
  });
  it('zrušený alebo expirovaný odkaz prestane fungovať', async () => {
    await as(A, () => db.query(`update public.share_links set revoked_at = now() where token = $1`, [token]));
    const r = (await as(null, () => db.query('select name from public.get_shared_screen($1)', [token]))) as { rows: unknown[] };
    expect(r.rows).toHaveLength(0);
    const t2 = ((await as(A, () => db.query<{ token: string }>(`insert into public.share_links (screen_id, expires_at) values ($1, now() - interval '1 minute') returning token`, [screenA]))) as { rows: { token: string }[] }).rows[0]!.token;
    const r2 = (await as(null, () => db.query('select name from public.get_shared_screen($1)', [t2]))) as { rows: unknown[] };
    expect(r2.rows).toHaveLength(0);
  });
});

describe('RLS: roly, školské šablóny a nastavenia', () => {
  it('učiteľ si nemôže zmeniť rolu na admin (priamo ani cez RPC)', async () => {
    expect(await denied(A, `update public.profiles set role = 'admin' where id = $1`, [A])).toBe(true);
    expect(await denied(A, `select public.set_user_role($1, 'admin')`, [A])).toBe(true);
    expect((await q('select role from public.profiles where id = $1', [A]))[0]).toEqual({ role: 'teacher' });
  });
  it('učiteľ vidí iba svoj profil, admin všetky', async () => {
    expect(((await as(A, () => db.query('select * from public.profiles'))) as { rows: unknown[] }).rows).toHaveLength(1);
    expect(((await as(ADMIN, () => db.query('select * from public.profiles'))) as { rows: unknown[] }).rows).toHaveLength(4);
  });
  it('admin mení roly iných, nie svoju vlastnú', async () => {
    await as(ADMIN, () => db.query(`select public.set_user_role($1, 'admin')`, [C]));
    expect((await q('select role from public.profiles where id = $1', [C]))[0]).toEqual({ role: 'admin' });
    await as(ADMIN, () => db.query(`select public.set_user_role($1, 'teacher')`, [C]));
    expect(await denied(ADMIN, `select public.set_user_role($1, 'teacher')`, [ADMIN])).toBe(true);
  });
  it('školské šablóny: čítajú všetci prihlásení, píše iba admin', async () => {
    await as(ADMIN, () => db.query(`insert into public.school_templates (name, data) values ('Šablóna školy', '{}')`));
    expect(((await as(A, () => db.query('select * from public.school_templates'))) as { rows: unknown[] }).rows).toHaveLength(1);
    expect(await denied(A, `insert into public.school_templates (name, data) values ('x', '{}')`)).toBe(true);
    const u = (await as(A, () => db.query(`update public.school_templates set name = 'hack'`))) as { affectedRows: number };
    expect(u.affectedRows).toBe(0);
    const d = (await as(A, () => db.query('delete from public.school_templates'))) as { affectedRows: number };
    expect(d.affectedRows).toBe(0);
    expect(await denied(null, 'select * from public.school_templates')).toBe(true);
  });
  it('školské nastavenia upravuje iba admin', async () => {
    const u = (await as(A, () => db.query(`update public.school_settings set defaults = '{"x":1}'`))) as { affectedRows: number };
    expect(u.affectedRows).toBe(0);
    const ok = (await as(ADMIN, () => db.query(`update public.school_settings set defaults = '{"aspect":"4:3"}'`))) as { affectedRows: number };
    expect(ok.affectedRows).toBe(1);
  });
  it('vyhľadanie používateľa podľa e‑mailu vráti iba ID a meno a len prihlásenému', async () => {
    const r = (await as(A, () => db.query('select * from public.find_user_by_email($1)', ['b@skola.sk']))) as { rows: Record<string, unknown>[] };
    expect(Object.keys(r.rows[0]!).sort()).toEqual(['display_name', 'id']);
    expect(await denied(null, `select * from public.find_user_by_email('b@skola.sk')`)).toBe(true);
  });
});

describe('RLS: triedy (zoznamy žiakov)', () => {
  let classId = '';
  it('učiteľ vloží a číta svoju triedu', async () => {
    const r = (await as(A, () => db.query<{ id: string }>(`insert into public.class_lists (name, names) values ('5.A', '["Anna","Peter"]') returning id`))) as { rows: { id: string }[] };
    classId = r.rows[0]!.id;
    expect(((await as(A, () => db.query('select * from public.class_lists'))) as { rows: unknown[] }).rows).toHaveLength(1);
  });
  it('iný učiteľ, administrátor ani anonym zoznam nevidia', async () => {
    for (const u of [B, ADMIN]) {
      expect(((await as(u, () => db.query('select * from public.class_lists where id = $1', [classId]))) as { rows: unknown[] }).rows).toHaveLength(0);
    }
    expect(await denied(null, 'select * from public.class_lists')).toBe(true);
  });
  it('cudzí učiteľ ho nemôže zmeniť, zmazať ani prepísať cez upsert s rovnakým ID', async () => {
    const u = (await as(B, () => db.query(`update public.class_lists set names = '[]' where id = $1`, [classId]))) as { affectedRows: number };
    expect(u.affectedRows).toBe(0);
    const d = (await as(B, () => db.query('delete from public.class_lists where id = $1', [classId]))) as { affectedRows: number };
    expect(d.affectedRows).toBe(0);
    expect(await denied(B, `insert into public.class_lists (id, name, names) values ($1, 'hack', '[]') on conflict (id) do update set name = 'hack'`, [classId])).toBe(true);
    expect(await denied(B, `insert into public.class_lists (owner_id, name) values ($1, 'podvrh')`, [A])).toBe(true);
    expect((await q('select name from public.class_lists where id = $1', [classId]))[0]).toEqual({ name: '5.A' });
  });
  it('zdieľanie obrazovky nesprístupní triedy príjemcovi', async () => {
    await as(A, () => db.query(`insert into public.screen_shares (screen_id, grantee_id) values ($1, $2)`, [screenA, B]));
    expect(((await as(B, () => db.query('select * from public.class_lists'))) as { rows: unknown[] }).rows).toHaveLength(0);
  });
  it('triedu nemožno previesť na iného vlastníka a zoznam je obmedzený na 200 mien', async () => {
    expect(await denied(A, 'update public.class_lists set owner_id = $1 where id = $2', [B, classId])).toBe(true);
    expect(await denied(A, `insert into public.class_lists (name, names) values ('x', $1::jsonb)`, [JSON.stringify(Array.from({ length: 201 }, (_, i) => `m${i}`))])).toBe(true);
  });
  it('vlastník môže triedu zmazať', async () => {
    const d = (await as(A, () => db.query('delete from public.class_lists where id = $1', [classId]))) as { affectedRows: number };
    expect(d.affectedRows).toBe(1);
  });
});
