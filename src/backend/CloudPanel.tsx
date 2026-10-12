import { useCallback, useEffect, useState } from 'react';
import { Cloud, CloudOff, Copy, Link2, RefreshCw, Trash2, User } from 'lucide-react';
import { ConfirmDialog, Modal } from '@/components/ui';
import { Segmented } from '@/components/forms';
import { t, type TKey } from '@/i18n';
import { navigate } from '@/lib/router';
import { useApp } from '@/store/useApp';
import { api, BackendError, mergeStudentData, type LinkRow, type RemoteScreenRow, type ShareRow } from './api';
import { isBackendConfigured } from './client';
import { describeError, findLocalByRemote, getCloudLink, setCloudLink, useCloud } from './useCloud';
import type { Screen } from '@/types';

function useEnsureCloudInit() {
  const init = useCloud((s) => s.init);
  useEffect(() => {
    if (isBackendConfigured) void init();
  }, [init]);
}

export function AccountButton() {
  useEnsureCloudInit();
  const status = useCloud((s) => s.status);
  const email = useCloud((s) => s.email);
  const [open, setOpen] = useState(false);
  if (!isBackendConfigured) return null;
  return (
    <>
      <button type="button" className="btn" data-testid="account-btn" onClick={() => setOpen(true)}>
        {status === 'offline' ? <CloudOff size={18} aria-hidden /> : <User size={18} aria-hidden />}
        <span className="max-w-40 truncate">{status === 'signedIn' ? email : t('cloud.signIn')}</span>
      </button>
      <AccountDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { status, email, profile, error, signIn, signUp, signOut } = useCloud();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [mail, setMail] = useState('');
  const [pw, setPw] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const role = profile?.role === 'admin' ? t('cloud.role.admin') : status === 'signedIn' ? t('cloud.role.teacher') : t('cloud.role.guest');
  return (
    <Modal open={open} onClose={onClose} title={t('cloud.account')}>
      {status === 'signedIn' || (status === 'offline' && email) ? (
        <div>
          <p className="mb-1">{t('cloud.signedInAs', { email: email ?? '' })}</p>
          <p className="mb-4 text-sm text-muted">{role}</p>
          {error && <p className="mb-3 text-sm text-muted">{t(error as TKey)}</p>}
          <div className="flex flex-wrap gap-2">
            {profile?.role === 'admin' && (
              <button type="button" className="btn" onClick={() => { onClose(); navigate({ name: 'admin' }); }}>
                {t('cloud.admin')}
              </button>
            )}
            <button type="button" className="btn" onClick={() => void signOut()}>
              {t('cloud.signOut')}
            </button>
          </div>
        </div>
      ) : status === 'offline' ? (
        <p className="text-muted">{t('cloud.offline')}</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setInfo(null);
            if (mode === 'in') await signIn(mail.trim(), pw);
            else {
              const r = await signUp(mail.trim(), pw);
              if (r === 'confirm') setInfo(t('cloud.checkMail'));
            }
            setBusy(false);
          }}
        >
          <p className="mb-3 text-sm text-muted">{t('cloud.loginHint')}</p>
          <Segmented value={mode} label={t('cloud.account')} onChange={setMode} options={[{ value: 'in', label: t('cloud.signIn') }, { value: 'up', label: t('cloud.signUp') }]} />
          <label className="label" htmlFor="acc-mail">{t('cloud.email')}</label>
          <input id="acc-mail" className="input mb-3" type="email" autoComplete="email" required value={mail} onChange={(e) => setMail(e.target.value)} />
          <label className="label" htmlFor="acc-pw">{t('cloud.password')}</label>
          <input id="acc-pw" className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
          {mode === 'up' && <p className="mt-1 text-xs text-muted">{t('cloud.passwordHint')}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-danger">{t(error as TKey)}</p>}
          {info && <p role="status" className="mt-3 text-sm text-success">{info}</p>}
          <button type="submit" className="btn btn-primary mt-4" disabled={busy}>
            {mode === 'in' ? t('cloud.signIn') : t('cloud.signUp')}
          </button>
        </form>
      )}
    </Modal>
  );
}

type Tab = 'mine' | 'templates' | 'shared';

/** Cloudová knižnica na domovskej stránke – zobrazí sa len pri nakonfigurovanom backende. */
export function CloudLibrary() {
  const status = useCloud((s) => s.status);
  const userId = useCloud((s) => s.userId);
  const isAdmin = useCloud((s) => s.profile?.role === 'admin');
  const toast = useApp((s) => s.toast);
  const importParsed = useApp((s) => s.importParsed);
  const [tab, setTab] = useState<Tab>('templates');
  const [mine, setMine] = useState<RemoteScreenRow[]>([]);
  const [shared, setShared] = useState<RemoteScreenRow[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<RemoteScreenRow | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ kind: 'screen' | 'template'; id: string; name: string } | null>(null);
  const [overwrite, setOverwrite] = useState<{ row: RemoteScreenRow; localId: string } | null>(null);

  const refresh = useCallback(async () => {
    if (status !== 'signedIn' || !userId) return;
    setLoading(true);
    setErr(null);
    try {
      const [m, s, tp] = await Promise.all([api.listMine(), api.listShared(userId), api.listTemplates()]);
      setMine(m.filter((r) => r.owner_id === userId));
      setShared(s);
      setTemplates(tp);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [status, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isBackendConfigured || status === 'loading') return null;

  const fail = (e: unknown) => toast(t(describeError(e) as TKey), { tone: 'error' });

  const pull = async (row: RemoteScreenRow, forceOverwrite = false) => {
    try {
      const remote = await api.download(row.id);
      const localId = findLocalByRemote(row.id);
      const local = localId ? useApp.getState().screens[localId] : undefined;
      if (local && !forceOverwrite) return setOverwrite({ row, localId: local.id });
      if (local) {
        const merged = mergeStudentData({ ...remote, id: local.id }, local);
        importParsed({ screens: [{ ...merged, deckId: local.deckId, order: local.order, createdAt: local.createdAt }], decks: [], skippedWidgets: 0, skippedScreens: 0 });
        toast(t('cloud.pulled'), { tone: 'success' });
        navigate({ name: 'edit', id: local.id });
      } else {
        const [id] = importParsed({ screens: [{ ...remote, deckId: null }], decks: [], skippedWidgets: 0, skippedScreens: 0 });
        if (id) setCloudLink(id, row.id);
        toast(t('cloud.pulled'), { tone: 'success' });
      }
    } catch (e) {
      fail(e);
    }
  };

  const useTemplate = async (id: string) => {
    try {
      const s = await api.downloadTemplate(id);
      const [newId] = importParsed({ screens: [{ ...s, deckId: null }], decks: [], skippedWidgets: 0, skippedScreens: 0 });
      if (newId) navigate({ name: 'edit', id: newId });
    } catch (e) {
      fail(e);
    }
  };

  return (
    <section aria-label={t('cloud.account')} className="mb-10" data-testid="cloud-library">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
        <Cloud aria-hidden /> {t('cloud.account')}
      </h2>
      {status !== 'signedIn' ? (
        <p className="card flex items-center gap-2 p-4 text-sm text-muted">
          {status === 'offline' ? <CloudOff size={18} aria-hidden /> : null}
          {status === 'offline' ? t('cloud.offline') : t('cloud.loginHint')}
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{t('cloud.localNote')}</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented<Tab>
              label={t('cloud.account')}
              value={tab}
              onChange={setTab}
              options={[
                { value: 'templates', label: t('cloud.schoolTemplates') },
                { value: 'mine', label: t('cloud.myScreens') },
                { value: 'shared', label: t('cloud.sharedWithMe') },
              ]}
            />
            <button type="button" className="btn mb-3" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw size={16} aria-hidden /> {t('cloud.refresh')}
            </button>
          </div>
          {err && <p role="status" className="mb-3 text-sm text-muted">{t(err as TKey)}</p>}
          <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {tab === 'templates' &&
              templates.map((tp) => (
                <li key={tp.id} className="card flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{tp.name}</div>
                    <div className="truncate text-xs text-muted">{tp.description}</div>
                  </div>
                  <button type="button" className="btn" onClick={() => void useTemplate(tp.id)}>{t('cloud.useTemplate')}</button>
                  {isAdmin && (
                    <button type="button" className="btn btn-icon btn-danger" aria-label={`${t('common.delete')}: ${tp.name}`} onClick={() => setConfirmRemove({ kind: 'template', id: tp.id, name: tp.name })}>
                      <Trash2 size={16} aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            {tab === 'mine' &&
              mine.map((r) => (
                <li key={r.id} className="card flex items-center gap-2 p-3">
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                  <button type="button" className="btn" onClick={() => void pull(r)}>{t('cloud.pull')}</button>
                  <button type="button" className="btn" onClick={() => setShareFor(r)}>{t('cloud.share')}</button>
                  <button type="button" className="btn btn-icon btn-danger" aria-label={`${t('cloud.deleteRemote')}: ${r.name}`} onClick={() => setConfirmRemove({ kind: 'screen', id: r.id, name: r.name })}>
                    <Trash2 size={16} aria-hidden />
                  </button>
                </li>
              ))}
            {tab === 'shared' &&
              shared.map((r) => (
                <li key={r.id} className="card flex items-center gap-2 p-3">
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                  <button type="button" className="btn" onClick={() => void pull(r)}>{t('cloud.download')}</button>
                </li>
              ))}
          </ul>
          {((tab === 'templates' && !templates.length) || (tab === 'mine' && !mine.length) || (tab === 'shared' && !shared.length)) && !loading && <p className="text-sm text-muted">{t('cloud.empty')}</p>}
        </>
      )}
      {shareFor && <ShareDialog remoteId={shareFor.id} name={shareFor.name} open onClose={() => setShareFor(null)} />}
      <ConfirmDialog
        open={!!confirmRemove}
        title={confirmRemove ? `${t('cloud.deleteRemote')}: ${confirmRemove.name}` : ''}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={async () => {
          if (!confirmRemove) return;
          try {
            if (confirmRemove.kind === 'screen') await api.deleteRemote(confirmRemove.id);
            else await api.deleteTemplate(confirmRemove.id);
            toast(t('cloud.removed'));
            void refresh();
          } catch (e) {
            fail(e);
          }
        }}
        onClose={() => setConfirmRemove(null)}
      />
      <ConfirmDialog
        open={!!overwrite}
        title={t('cloud.pullOverwrite')}
        text={t('cloud.pullOverwriteText')}
        confirmLabel={t('cloud.pullOverwrite')}
        danger
        onConfirm={() => overwrite && void pull(overwrite.row, true)}
        onClose={() => setOverwrite(null)}
      />
    </section>
  );
}

function ShareDialog({ remoteId, name, open, onClose }: { remoteId: string; name: string; open: boolean; onClose: () => void }) {
  const toast = useApp((s) => s.toast);
  const canShare = useCloud((s) => s.profile?.can_share ?? false);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [mail, setMail] = useState('');
  const [perm, setPerm] = useState<'view' | 'edit'>('view');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([api.listShares(remoteId), api.listLinks(remoteId)]);
      setShares(s);
      setLinks(l);
    } catch (e) {
      setMsg(t(describeError(e) as TKey));
    }
  }, [remoteId]);
  useEffect(() => {
    void load();
  }, [load]);
  const url = (token: string) => `${location.origin}${location.pathname}#/shared/${token}`;
  return (
    <Modal open={open} onClose={onClose} title={`${t('cloud.share')}: ${name}`} wide>
      {!canShare && <p className="mb-3 text-sm text-danger">{t('cloud.noPermissionShare')}</p>}
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg(null);
          try {
            const u = await api.findUser(mail);
            if (!u) return setMsg(t('cloud.shareNoUser'));
            await api.share(remoteId, u.id, perm);
            toast(t('cloud.shared'), { tone: 'success' });
            setMail('');
            void load();
          } catch (err) {
            setMsg(t(describeError(err) as TKey));
          }
        }}
      >
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="share-mail">{t('cloud.shareWith')}</label>
          <input id="share-mail" type="email" required className="input" value={mail} onChange={(e) => setMail(e.target.value)} disabled={!canShare} />
        </div>
        <div>
          <label className="label" htmlFor="share-perm">{t('cloud.sharePermission')}</label>
          <select id="share-perm" className="input" value={perm} onChange={(e) => setPerm(e.target.value as 'view' | 'edit')}>
            <option value="view">{t('cloud.perm.view')}</option>
            <option value="edit">{t('cloud.perm.edit')}</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={!canShare}>{t('cloud.share')}</button>
      </form>
      {msg && <p role="alert" className="mb-3 text-sm text-danger">{msg}</p>}
      {shares.length > 0 && (
        <>
          <h3 className="mb-2 font-bold">{t('cloud.shareList')}</h3>
          <ul className="mb-4">
            {shares.map((s) => (
              <li key={s.id} className="flex items-center gap-2 border-b border-line py-1">
                <span className="flex-1 truncate text-sm">{s.grantee_id.slice(0, 8)}… · {s.permission === 'edit' ? t('cloud.perm.edit') : t('cloud.perm.view')}</span>
                <button type="button" className="btn" onClick={async () => { try { await api.revokeShare(s.id); void load(); } catch (e) { setMsg(t(describeError(e) as TKey)); } }}>{t('cloud.revoke')}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="mb-2 flex items-center gap-2 font-bold"><Link2 size={18} aria-hidden /> {t('cloud.shareLink')}</h3>
      <ul className="mb-2">
        {links.map((l) => (
          <li key={l.token} className="flex items-center gap-2 border-b border-line py-1 text-sm">
            <span className="flex-1 truncate">
              {l.revoked_at ? t('cloud.linkRevoked') : t('cloud.linkExpires', { date: new Date(l.expires_at).toLocaleDateString('sk-SK') })}
            </span>
            {!l.revoked_at && (
              <>
                <button type="button" className="btn btn-icon" aria-label={t('cloud.copyLink')} onClick={async () => { try { await navigator.clipboard.writeText(url(l.token)); toast(t('cloud.linkCopied')); } catch { setMsg(url(l.token)); } }}>
                  <Copy size={16} aria-hidden />
                </button>
                <button type="button" className="btn btn-danger" onClick={async () => { try { await api.revokeLink(l.token); void load(); } catch (e) { setMsg(t(describeError(e) as TKey)); } }}>{t('cloud.revokeLink')}</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="btn" disabled={!canShare} onClick={async () => { try { await api.createLink(remoteId); void load(); } catch (e) { setMsg(t(describeError(e) as TKey)); } }}>
        {t('cloud.createLink')}
      </button>
    </Modal>
  );
}

/** Tlačidlo v editore: nahranie do cloudu, zdieľanie a (pre administrátora) publikovanie ako školská šablóna. */
export function CloudScreenButton({ screenId }: { screenId: string }) {
  useEnsureCloudInit();
  const status = useCloud((s) => s.status);
  const isAdmin = useCloud((s) => s.profile?.role === 'admin');
  const screen = useApp((s) => s.screens[screenId]);
  const toast = useApp((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareFor, setShareFor] = useState<string | null>(null);
  if (!isBackendConfigured || status !== 'signedIn' || !screen) return null;

  const upload = async (s: Screen) => {
    setBusy(true);
    try {
      const rid = await api.upload(s, getCloudLink(s.id) ?? undefined);
      setCloudLink(s.id, rid);
      toast(t('cloud.uploaded'), { tone: 'success' });
      return rid;
    } catch (e) {
      toast(t(describeError(e) as TKey), { tone: 'error' });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className="btn" data-testid="cloud-btn" onClick={() => setOpen(true)}>
        <Cloud size={18} aria-hidden /> <span className="hidden xl:inline">Cloud</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Cloud: ${screen.name}`}>
        <p className="mb-4 text-sm text-muted">{t('cloud.studentsNote')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void upload(screen)}>{t('cloud.upload')}</button>
          <button type="button" className="btn" disabled={busy} onClick={async () => { const rid = await upload(screen); if (rid) { setOpen(false); setShareFor(rid); } }}>
            {t('cloud.share')}
          </button>
          {isAdmin && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={async () => {
                try {
                  await api.publishTemplate(screen);
                  toast(t('cloud.published'), { tone: 'success' });
                } catch (e) {
                  toast(t(describeError(e) as TKey), { tone: 'error' });
                }
              }}
            >
              {t('cloud.publishTemplate')}
            </button>
          )}
        </div>
      </Modal>
      {shareFor && <ShareDialog remoteId={shareFor} name={screen.name} open onClose={() => setShareFor(null)} />}
    </>
  );
}

export { BackendError };
