// Minimálna náhrada Supabase (GoTrue + PostgREST) pre e2e testy synchronizácie. NIE je to bezpečnostná implementácia –
// bezpečnosť politík overuje tests/unit/rls.test.ts na skutočnej PostgreSQL. Tu sa testuje klientska logika.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 4177);
const users = new Map(); // email -> {id,email,password,meta}
const tables = { screens: [], class_lists: [], profiles: [], school_templates: [], screen_shares: [], share_links: [], school_settings: [] };
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
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

    if (path.startsWith('/rest/v1/')) {
      const uid = uidFrom(req);
      if (!uid) return send(res, 401, { code: 'PGRST301', message: 'JWT required' });
      const name = path.slice('/rest/v1/'.length);
      const table = tables[name];
      if (!table) return send(res, 404, { message: 'unknown table' });
      const owned = name === 'screens' || name === 'class_lists';
      const params = [...url.searchParams.entries()];
      if (req.method === 'GET') {
        let rows = filterRows(table, params);
        if (name === 'profiles') rows = rows.filter((r) => r.id === uid);
        if (name === 'screens') rows = rows.filter((r) => r.owner_id === uid); // bez zdieľania v tejto náhrade
        if (name === 'class_lists') rows = rows.filter((r) => r.owner_id === uid);
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
        const del = filterRows(table, params).filter((r) => !owned || r.owner_id === uid);
        del.forEach((r) => table.splice(table.indexOf(r), 1));
        return send(res, 200, del);
      }
      return send(res, 200, []);
    }
    send(res, 404, { message: 'nenájdené' });
  } catch (e) {
    send(res, 500, { message: String(e) });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`fake supabase na ${PORT}`));
