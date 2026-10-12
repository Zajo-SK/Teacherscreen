// Minimálna náhrada Supabase (GoTrue + PostgREST) pre e2e testy synchronizácie. NIE je to bezpečnostná implementácia –
// bezpečnosť politík overuje tests/unit/rls.test.ts na skutočnej PostgreSQL. Tu sa testuje klientska logika.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 4177);
const users = new Map(); // email -> {id,email,password,meta}
const tables = { screens: [], class_lists: [], profiles: [], school_templates: [], screen_shares: [], share_links: [], school_settings: [], admin_audit: [] };
let lastTs = 0;
const nowIso = () => new Date((lastTs = Math.max(Date.now(), lastTs + 1))).toISOString();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const makeSession = (u) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: u.id, exp, role: 'authenticated', email: u.email })}.sig`,
    token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: randomUUID(),
    user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: u.meta ?? {}, app_metadata: {}, created_at: nowIso() },
  };
};
const uidFrom = (req) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  if (!m) return null;
  try { return JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString()).sub ?? null; } catch { return null; }
};
const cors = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
};
const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d ? JSON.parse(d) : {})); });

function filterRows(rows, params) {
  let out = rows;
  for (const [k, v] of params) {
    if (['select', 'order', 'on_conflict', 'limit'].includes(k)) continue;
    const m = /^(eq|neq)\.(.*)$/.exec(v);
    if (!m) continue;
    out = out.filter((r) => (m[1] === 'eq' ? String(r[k]) === m[2] : String(r[k]) !== m[2]));
  }
  return out;
}

http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    if (path === '/__db') return send(res, 200, tables);
    if (path === '/__reset') { Object.values(tables).forEach((t) => (t.length = 0)); users.clear(); return send(res, 200, {}); }

    if (path === '/auth/v1/signup') {
      const { email, password, data } = await readBody(req);
      if (users.has(email)) return send(res, 422, { code: 'user_already_exists', msg: 'User already registered' });
      const u = { id: randomUUID(), email, password, meta: data };
      users.set(email, u);
      tables.profiles.push({ id: u.id, email, display_name: data?.display_name ?? '', role: 'teacher', can_share: true });
      return send(res, 200, makeSession(u));
    }
    if (path === '/auth/v1/token') {
      const { email, password } = await readBody(req);
      const u = users.get(email);
      if (!u || u.password !== password) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      return send(res, 200, makeSession(u));
    }
    if (path === '/auth/v1/logout') return send(res, 204);
    if (path === '/auth/v1/user' && req.method === 'PUT') {
      const uid = uidFrom(req);
      const u = [...users.values()].find((x) => x.id === uid);
      if (!u) return send(res, 401, { msg: 'no user' });
      const { password } = await readBody(req);
      if (password) u.password = password;
      return send(res, 200, { id: u.id, email: u.email });
    }
    if (path === '/__makeadmin') {
      const p = tables.profiles.find((x) => x.display_name === url.searchParams.get('nick'));
      if (p) p.role = 'admin';
      return send(res, 200, { ok: !!p });
    }

    if (path.startsWith('/rest/v1/')) {
      const uid = uidFrom(req);
      if (!uid) return send(res, 401, { code: 'PGRST301', message: 'JWT required' });
      const name = path.slice('/rest/v1/'.length);
      const me = tables.profiles.find((x) => x.id === uid);
      const isAdmin = me?.role === 'admin';
      if (name.startsWith('rpc/')) {
        const fn = name.slice(4);
        const args = await readBody(req);
        if (!fn.startsWith('admin_')) return send(res, 404, { message: 'unknown rpc' });
        if (!isAdmin) return send(res, 403, { code: '42501', message: 'forbidden' });
        if (fn === 'admin_user_overview') {
          return send(res, 200, tables.profiles.map((p) => ({ ...p, created_at: nowIso(), screens_count: tables.screens.filter((s) => s.owner_id === p.id).length, classes_count: tables.class_lists.filter((c) => c.owner_id === p.id).length })));
        }
        const target = tables.profiles.find((p) => p.id === args.target);
        if (!target) return send(res, 400, { code: 'P0002', message: 'user not found' });
        if (fn === 'admin_reset_password') {
          if ((args.new_password ?? '').length < 8) return send(res, 400, { code: '22023', message: 'password length' });
          users.get(target.email).password = args.new_password;
          tables.admin_audit.push({ id: tables.admin_audit.length + 1, action: 'reset_password', target_nick: target.display_name, detail: '', created_at: nowIso() });
          return send(res, 204);
        }
        if (fn === 'admin_delete_user') {
          if (target.id === uid) return send(res, 403, { code: '42501', message: 'cannot delete self' });
          tables.admin_audit.push({ id: tables.admin_audit.length + 1, action: 'delete_user', target_nick: target.display_name, detail: '', created_at: nowIso() });
          users.delete(target.email);
          for (const t of ['profiles', 'screens', 'class_lists']) tables[t] = tables[t].filter((r) => (t === 'profiles' ? r.id : r.owner_id) !== target.id);
          return send(res, 204);
        }
        return send(res, 404, { message: 'unknown rpc' });
      }
      const table = tables[name];
      if (!table) return send(res, 404, { message: 'unknown table' });
      const owned = name === 'screens' || name === 'class_lists';
      const params = [...url.searchParams.entries()];
      if (req.method === 'GET') {
        let rows = filterRows(table, params);
        if (name === 'profiles') rows = rows.filter((r) => r.id === uid);
        if (name === 'screens') rows = rows.filter((r) => r.owner_id === uid); // bez zdieľania v tejto náhrade
        if (name === 'class_lists' && !isAdmin) rows = rows.filter((r) => r.owner_id === uid);
        if (name === 'admin_audit' && !isAdmin) rows = [];
        return send(res, 200, rows);
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const items = Array.isArray(body) ? body : [body];
        const saved = [];
        for (const it of items) {
          const row = { ...it };
          if (owned) {
            row.id ??= randomUUID();
            const ex = table.find((r) => r.id === row.id);
            if (ex && ex.owner_id !== uid) return send(res, 403, { code: '42501', message: 'row-level security' });
            row.owner_id = uid;
            row.updated_at = nowIso();
            row.created_at = ex?.created_at ?? row.updated_at;
            if (ex) Object.assign(ex, row); else table.push(row);
            saved.push(ex ?? row);
          } else { table.push(row); saved.push(row); }
        }
        return send(res, 201, saved);
      }
      if (req.method === 'DELETE') {
        const del = filterRows(table, params).filter((r) => !owned || r.owner_id === uid || (name === 'class_lists' && isAdmin));
        del.forEach((r) => table.splice(table.indexOf(r), 1));
        return send(res, 200, del);
      }
      if (req.method === 'PATCH' && name === 'class_lists' && isAdmin) {
        const body = await readBody(req);
        const rows = filterRows(table, params);
        rows.forEach((r) => Object.assign(r, body, { updated_at: nowIso() }));
        return send(res, 200, rows);
      }
      return send(res, 200, []);
    }
    send(res, 404, { message: 'nenájdené' });
  } catch (e) {
    send(res, 500, { message: String(e) });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`fake supabase na ${PORT}`));
