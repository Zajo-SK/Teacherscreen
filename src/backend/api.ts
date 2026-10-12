import type { Screen } from '@/types';
import { SCHEMA_VERSION } from '@/types';
import { sanitizeScreen, stripStudentData } from '@/lib/schema';
import { getWidgetDefinition } from '@/widgets/registry';
import { getSupabase } from './client';

export type Role = 'teacher' | 'admin';
export interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  can_share: boolean;
}
export interface RemoteScreenRow {
  id: string;
  name: string;
  updated_at: string;
  owner_id: string;
  permission?: 'owner' | 'view' | 'edit';
}
export interface ShareRow {
  id: string;
  grantee_id: string;
  permission: 'view' | 'edit';
  email?: string;
}
export interface LinkRow {
  token: string;
  expires_at: string;
  revoked_at: string | null;
}

export class BackendError extends Error {
  constructor(
    public kind: 'offline' | 'denied' | 'other',
    message: string,
  ) {
    super(message);
  }
}

function wrap(e: unknown): never {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/abort|network|fetch|failed to fetch|load failed/i.test(msg)) throw new BackendError('offline', msg);
  if (typeof e === 'object' && e && 'code' in e && ['42501', 'PGRST301', '401', '403'].includes(String((e as { code: unknown }).code))) throw new BackendError('denied', msg);
  throw new BackendError('other', msg);
}

async function run<T>(fn: (sb: Awaited<ReturnType<typeof getSupabase>>) => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  try {
    const sb = await getSupabase();
    const { data, error } = await fn(sb);
    if (error) throw error;
    return data as T;
  } catch (e) {
    return wrap(e);
  }
}

/** Dáta pre server: bez zoznamov žiakov (ochrana osobných údajov). */
export function toRemoteData(screen: Screen): Record<string, unknown> {
  const { deckId: _d, lastOpenedAt: _l, ...rest } = stripStudentData(screen);
  void _d;
  void _l;
  return rest;
}

/** Pri stiahnutí do už existujúcej lokálnej kópie zachová lokálne zoznamy žiakov (na serveri nie sú). */
export function mergeStudentData(remote: Screen, local: Screen): Screen {
  return {
    ...remote,
    widgets: remote.widgets.map((w) => {
      const lw = local.widgets.find((x) => x.id === w.id && x.type === w.type);
      return lw && getWidgetDefinition(w.type).hasStudentData ? { ...w, config: lw.config } : w;
    }),
  };
}

export const api = {
  async getProfile(userId: string): Promise<Profile | null> {
    const rows = await run<Profile[]>((sb) => sb.from('profiles').select('id,email,display_name,role,can_share').eq('id', userId).limit(1));
    return rows[0] ?? null;
  },

  // ---- moje a zdieľané obrazovky
  async listMine(): Promise<RemoteScreenRow[]> {
    const rows = await run<RemoteScreenRow[]>((sb) => sb.from('screens').select('id,name,updated_at,owner_id').order('updated_at', { ascending: false }));
    return rows;
  },
  async listShared(userId: string): Promise<RemoteScreenRow[]> {
    const rows = await run<(RemoteScreenRow & { _p?: string })[]>((sb) => sb.from('screens').select('id,name,updated_at,owner_id').neq('owner_id', userId).order('updated_at', { ascending: false }));
    return rows;
  },
  async upload(screen: Screen, remoteId?: string): Promise<string> {
    const payload = { name: screen.name.slice(0, 120) || 'Bez názvu', data: toRemoteData(screen), schema_version: SCHEMA_VERSION };
    if (remoteId) {
      const rows = await run<{ id: string }[]>((sb) => sb.from('screens').update(payload).eq('id', remoteId).select('id'));
      if (rows.length) return rows[0]!.id;
    }
    const rows = await run<{ id: string }[]>((sb) => sb.from('screens').insert(payload).select('id'));
    return rows[0]!.id;
  },
  async download(remoteId: string): Promise<Screen> {
    const rows = await run<{ data: unknown }[]>((sb) => sb.from('screens').select('data').eq('id', remoteId).limit(1));
    if (!rows[0]) throw new BackendError('denied', 'not found');
    return sanitizeScreen(rows[0].data).screen;
  },
  async deleteRemote(remoteId: string): Promise<void> {
    await run((sb) => sb.from('screens').delete().eq('id', remoteId));
  },

  // ---- zdieľanie
  async findUser(email: string): Promise<{ id: string; display_name: string } | null> {
    const rows = await run<{ id: string; display_name: string }[]>((sb) => sb.rpc('find_user_by_email', { p_email: email.trim() }));
    return rows[0] ?? null;
  },
  async listShares(remoteId: string): Promise<ShareRow[]> {
    return run<ShareRow[]>((sb) => sb.from('screen_shares').select('id,grantee_id,permission').eq('screen_id', remoteId));
  },
  async share(remoteId: string, granteeId: string, permission: 'view' | 'edit'): Promise<void> {
    await run((sb) => sb.from('screen_shares').upsert({ screen_id: remoteId, grantee_id: granteeId, permission }, { onConflict: 'screen_id,grantee_id' }));
  },
  async revokeShare(shareId: string): Promise<void> {
    await run((sb) => sb.from('screen_shares').delete().eq('id', shareId));
  },
  async listLinks(remoteId: string): Promise<LinkRow[]> {
    return run<LinkRow[]>((sb) => sb.from('share_links').select('token,expires_at,revoked_at').eq('screen_id', remoteId).order('created_at', { ascending: false }));
  },
  async createLink(remoteId: string): Promise<LinkRow> {
    const rows = await run<LinkRow[]>((sb) => sb.from('share_links').insert({ screen_id: remoteId }).select('token,expires_at,revoked_at'));
    return rows[0]!;
  },
  async revokeLink(token: string): Promise<void> {
    await run((sb) => sb.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('token', token));
  },
  async getSharedByToken(token: string): Promise<Screen | null> {
    const rows = await run<{ data: unknown }[]>((sb) => sb.rpc('get_shared_screen', { p_token: token }));
    return rows[0] ? sanitizeScreen(rows[0].data).screen : null;
  },

  // ---- školské šablóny
  async listTemplates(): Promise<{ id: string; name: string; description: string; updated_at: string }[]> {
    return run((sb) => sb.from('school_templates').select('id,name,description,updated_at').order('name'));
  },
  async downloadTemplate(id: string): Promise<Screen> {
    const rows = await run<{ data: unknown }[]>((sb) => sb.from('school_templates').select('data').eq('id', id).limit(1));
    if (!rows[0]) throw new BackendError('denied', 'not found');
    return sanitizeScreen(rows[0].data).screen;
  },
  async publishTemplate(screen: Screen): Promise<void> {
    await run((sb) => sb.from('school_templates').insert({ name: screen.name.slice(0, 120) || 'Šablóna', description: screen.description, data: toRemoteData(screen), schema_version: SCHEMA_VERSION }));
  },
  async deleteTemplate(id: string): Promise<void> {
    await run((sb) => sb.from('school_templates').delete().eq('id', id));
  },

  // ---- administrácia
  async listUsers(): Promise<Profile[]> {
    return run<Profile[]>((sb) => sb.from('profiles').select('id,email,display_name,role,can_share').order('email'));
  },
  async setRole(userId: string, role: Role): Promise<void> {
    await run((sb) => sb.rpc('set_user_role', { target: userId, new_role: role }));
  },
  async setCanShare(userId: string, allowed: boolean): Promise<void> {
    await run((sb) => sb.rpc('set_user_can_share', { target: userId, allowed }));
  },
  async getSchoolDefaults(): Promise<Record<string, unknown>> {
    const rows = await run<{ defaults: Record<string, unknown> }[]>((sb) => sb.from('school_settings').select('defaults').limit(1));
    return rows[0]?.defaults ?? {};
  },
  async setSchoolDefaults(defaults: Record<string, unknown>): Promise<void> {
    await run((sb) => sb.from('school_settings').update({ defaults }).eq('id', true));
  },
};
