import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Trash2, Users } from 'lucide-react';
import { ConfirmDialog, Modal } from '@/components/ui';
import { Segmented } from '@/components/forms';
import { NamesEditor } from '@/widgets/NamesEditor';
import { ASPECTS } from '@/editor/aspects';
import { t, getLocale, type TKey } from '@/i18n';
import { navigate } from '@/lib/router';
import { useApp } from '@/store/useApp';
import { api, BackendError, type AdminUser, type AuditRow, type RemoteClassRow, type Role } from './api';
import { emailToNick } from './nick';
import { describeError, useCloud } from './useCloud';
import type { AspectId, ThemeMode } from '@/types';

const nickOf = (u: { display_name: string; email: string }) => u.display_name || emailToNick(u.email);

function generatePassword(len = 10): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY346789'; // bez zameniteľných znakov (0/O, 1/l/I…)
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (v) => alphabet[v % alphabet.length]).join('');
}

function ResetPasswordDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const toast = useApp((s) => s.toast);
  const [pw, setPw] = useState(() => generatePassword());
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={`${t('admin.resetPassword')}: ${nickOf(user)}`}>
      {done ? (
        <div role="status">
          <p className="mb-2">{t('admin.passwordSet')}</p>
          <p className="mb-3 rounded-xl border border-line bg-surface2 p-3 text-center font-mono text-xl" data-testid="new-password">{pw}</p>
          <p className="mb-4 text-sm text-muted">{t('admin.passwordHandover')}</p>
          <button type="button" className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api.adminResetPassword(user.id, pw);
              setDone(true);
            } catch (er) {
              toast(t(describeError(er) as TKey), { tone: 'error' });
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="label" htmlFor="admin-new-pw">{t('admin.newPassword')}</label>
          <div className="mb-2 flex gap-2">
            <input id="admin-new-pw" className="input font-mono" value={pw} minLength={8} maxLength={72} required onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="btn" onClick={() => setPw(generatePassword())}>{t('admin.generate')}</button>
          </div>
          <p className="mb-4 text-xs text-muted">{t('admin.resetNote')}</p>
          <button type="submit" className="btn btn-primary" disabled={busy || pw.length < 8}>{t('admin.resetPassword')}</button>
        </form>
      )}
    </Modal>
  );
}

function DeleteUserDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const toast = useApp((s) => s.toast);
  const [typed, setTyped] = useState('');
  const nick = nickOf(user);
  return (
    <Modal open onClose={onClose} title={`${t('admin.deleteAccount')}: ${nick}`}>
      <p className="mb-2 text-sm">{t('admin.deleteText', { s: user.screens_count, c: user.classes_count })}</p>
      <label className="label" htmlFor="admin-del-confirm">{t('admin.typeNick', { nick })}</label>
      <input id="admin-del-confirm" className="input mb-4" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={typed.trim().toLowerCase() !== nick.toLowerCase()}
          onClick={async () => {
            try {
              await api.adminDeleteUser(user.id);
              toast(t('admin.deleted'), { tone: 'success' });
              onDone();
              onClose();
            } catch (er) {
              toast(t(describeError(er) as TKey), { tone: 'error' });
            }
          }}
        >
          {t('admin.deleteAccount')}
        </button>
      </div>
    </Modal>
  );
}

function UserClassesDialog({ user, onClose, onChanged }: { user: AdminUser; onClose: () => void; onChanged: () => void }) {
  const toast = useApp((s) => s.toast);
  const [classes, setClasses] = useState<RemoteClassRow[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; names: string[] } | null>(null);
  const [confirm, setConfirm] = useState<RemoteClassRow | null>(null);
  const load = useCallback(async () => {
    try {
      setClasses(await api.adminClasses(user.id));
    } catch (e) {
      toast(t(describeError(e) as TKey), { tone: 'error' });
    }
  }, [user.id, toast]);
  useEffect(() => {
    void load();
  }, [load]);
  const cur = classes.find((c) => c.id === sel);
  return (
    <Modal open onClose={onClose} title={`${t('admin.classesOf')}: ${nickOf(user)}`} wide>
      <p className="mb-3 text-sm text-muted">{t('admin.classesNote')}</p>
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <ul className="max-h-72 overflow-auto rounded-xl border border-line" data-testid="admin-class-list">
          {classes.length === 0 && <li className="p-3 text-sm text-muted">{t('classes.none')}</li>}
          {classes.map((c) => (
            <li key={c.id}>
              <button type="button" aria-pressed={sel === c.id} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface2 aria-pressed:bg-primary/15" onClick={() => { setSel(c.id); setDraft({ name: c.name, names: c.names }); }}>
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-xs text-muted">{c.names.length}</span>
              </button>
            </li>
          ))}
        </ul>
        <div>
          {cur && draft ? (
            <>
              <label className="label" htmlFor="admin-class-name">{t('classes.name')}</label>
              <input id="admin-class-name" className="input mb-3" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <NamesEditor names={draft.names} onChange={(names) => setDraft({ ...draft, names })} />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      await api.adminUpdateClass(cur.id, draft.name.trim() || cur.name, draft.names);
                      toast(t('cloud.saved'), { tone: 'success' });
                      void load();
                    } catch (e) {
                      toast(t(describeError(e) as TKey), { tone: 'error' });
                    }
                  }}
                >
                  {t('common.save')}
                </button>
                <button type="button" className="btn btn-danger" onClick={() => setConfirm(cur)}>
                  <Trash2 size={16} aria-hidden /> {t('common.delete')}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">{t('classes.select')}</p>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={t('classes.confirmDelete', { name: confirm?.name ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={async () => {
          if (!confirm) return;
          try {
            await api.deleteClass(confirm.id);
            setSel(null);
            setDraft(null);
            await load();
            onChanged();
          } catch (e) {
            toast(t(describeError(e) as TKey), { tone: 'error' });
          }
        }}
        onClose={() => setConfirm(null)}
      />
    </Modal>
  );
}

export function AdminPage() {
  const status = useCloud((s) => s.status);
  const profile = useCloud((s) => s.profile);
  const userId = useCloud((s) => s.userId);
  const toast = useApp((s) => s.toast);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [defaults, setDefaults] = useState<{ aspect?: AspectId; theme?: ThemeMode }>({});
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<string>('');
  const [reset, setReset] = useState<AdminUser | null>(null);
  const [del, setDel] = useState<AdminUser | null>(null);
  const [classesOf, setClassesOf] = useState<AdminUser | null>(null);
  const isAdmin = profile?.role === 'admin';

  const load = useCallback(async () => {
    try {
      const [u, a, d] = await Promise.all([api.adminOverview(), api.adminAudit(), api.getSchoolDefaults()]);
      setUsers(u);
      setAudit(a);
      setDefaults(d as typeof defaults);
      setErr(null);
      setDetail('');
    } catch (e) {
      const msg = e instanceof BackendError ? e.message : String(e);
      setDetail(msg);
      setErr(/admin_user_overview|admin_audit|schema cache|PGRST20\d|42883|42P01/i.test(msg) ? 'admin.migrationMissing' : describeError(e));
    }
  }, []);
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-6">
      <button type="button" className="btn mb-4" onClick={() => navigate({ name: 'home' })}>
        <ArrowLeft size={18} aria-hidden /> {t('editor.toHome')}
      </button>
      <h1 className="mb-4 text-2xl font-extrabold">{t('cloud.adminTitle')}</h1>
      {status === 'loading' ? (
        <p className="card p-4">{t('common.loading')}</p>
      ) : status !== 'signedIn' || !isAdmin ? (
        <div className="card p-4" role="alert" data-testid="admin-denied">
          <p>{status !== 'signedIn' ? t('admin.needSignIn') : t('cloud.adminOnly')}</p>
          {status === 'signedIn' && <p className="mt-2 text-sm text-muted">{t('admin.howToBecome', { nick: nickOf({ display_name: profile?.display_name ?? '', email: profile?.email ?? '' }) || '…' })}</p>}
        </div>
      ) : (
        <>
          {err && (
            <div role="alert" className="mb-3 rounded-xl border border-danger p-3 text-danger">
              <p>{t(err as TKey)}</p>
              {detail && <p className="mt-1 break-all font-mono text-xs">{detail}</p>}
            </div>
          )}
          <section className="card mb-6 p-4" aria-label={t('cloud.users')}>
            <h2 className="mb-1 text-lg font-bold">{t('cloud.users')} ({users.length})</h2>
            <p className="mb-3 text-sm text-muted">{t('admin.privacyNote')}</p>
            <ul data-testid="admin-users">
              {users.map((u) => {
                const self = u.id === userId;
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2" data-testid={`user-${nickOf(u)}`}>
                    <div className="min-w-40 flex-1">
                      <div className="truncate font-semibold">{nickOf(u)} {self && <span className="text-xs text-muted">({t('admin.you')})</span>}</div>
                      <div className="text-xs text-muted">{t('admin.counts', { s: u.screens_count, c: u.classes_count })}</div>
                    </div>
                    <select
                      className="input w-auto"
                      aria-label={`${t('cloud.setRole')}: ${nickOf(u)}`}
                      value={u.role}
                      disabled={self}
                      onChange={async (e) => {
                        try {
                          await api.setRole(u.id, e.target.value as Role);
                          void load();
                        } catch (er) {
                          toast(t(describeError(er) as TKey), { tone: 'error' });
                        }
                      }}
                    >
                      <option value="teacher">{t('cloud.role.teacher')}</option>
                      <option value="admin">{t('cloud.role.admin')}</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        checked={u.can_share}
                        onChange={async (e) => {
                          try {
                            await api.setCanShare(u.id, e.target.checked);
                            void load();
                          } catch (er) {
                            toast(t(describeError(er) as TKey), { tone: 'error' });
                          }
                        }}
                      />
                      {t('cloud.canShare')}
                    </label>
                    <button type="button" className="btn" onClick={() => setClassesOf(u)} aria-label={`${t('admin.classes')}: ${nickOf(u)}`}>
                      <Users size={16} aria-hidden /> {t('admin.classes')}
                    </button>
                    <button type="button" className="btn" disabled={self} onClick={() => setReset(u)} aria-label={`${t('admin.resetPassword')}: ${nickOf(u)}`}>
                      <KeyRound size={16} aria-hidden /> {t('admin.resetPassword')}
                    </button>
                    <button type="button" className="btn btn-danger" disabled={self} onClick={() => setDel(u)} aria-label={`${t('admin.deleteAccount')}: ${nickOf(u)}`}>
                      <Trash2 size={16} aria-hidden /> {t('admin.deleteAccount')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card mb-6 p-4" aria-label={t('cloud.schoolDefaults')}>
            <h2 className="mb-3 text-lg font-bold">{t('cloud.schoolDefaults')}</h2>
            <Segmented<AspectId> label={t('cloud.defaultAspect')} value={defaults.aspect ?? '16:9'} onChange={(aspect) => setDefaults({ ...defaults, aspect })} options={ASPECTS.map((a) => ({ value: a, label: a }))} />
            <Segmented<ThemeMode>
              label={t('cloud.defaultTheme')}
              value={defaults.theme ?? 'system'}
              onChange={(theme) => setDefaults({ ...defaults, theme })}
              options={[
                { value: 'light', label: t('settings.theme.light') },
                { value: 'dark', label: t('settings.theme.dark') },
                { value: 'system', label: t('settings.theme.system') },
              ]}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await api.setSchoolDefaults(defaults);
                  toast(t('cloud.saved'), { tone: 'success' });
                } catch (er) {
                  toast(t(describeError(er) as TKey), { tone: 'error' });
                }
              }}
            >
              {t('common.save')}
            </button>
            <p className="mt-3 text-sm text-muted">{t('cloud.templateTip')}</p>
          </section>

          <section className="card p-4" aria-label={t('admin.audit')}>
            <h2 className="mb-3 text-lg font-bold">{t('admin.audit')}</h2>
            <ul className="text-sm" data-testid="admin-audit">
              {audit.length === 0 && <li className="text-muted">{t('cloud.empty')}</li>}
              {audit.map((a) => (
                <li key={a.id} className="border-b border-line py-1">
                  {new Date(a.created_at).toLocaleString(getLocale())} · {t(`admin.action.${a.action}` as TKey)} · <strong>{a.target_nick}</strong>
                  {a.detail ? ` (${a.detail})` : ''}
                </li>
              ))}
            </ul>
          </section>
          {reset && <ResetPasswordDialog user={reset} onClose={() => { setReset(null); void load(); }} />}
          {del && <DeleteUserDialog user={del} onClose={() => setDel(null)} onDone={() => void load()} />}
          {classesOf && <UserClassesDialog user={classesOf} onClose={() => setClassesOf(null)} onChanged={() => void load()} />}
        </>
      )}
    </main>
  );
}
