import { useCallback, useEffect, useState } from 'react';
import { Cloud, CloudOff, Link2, Copy, RefreshCw, Trash2, User } from 'lucide-react';
import { ConfirmDialog, Modal } from '@/components/ui';
import { Segmented, Toggle } from '@/components/forms';
import { t, type TKey } from '@/i18n';
import { navigate } from '@/lib/router';
import { useApp } from '@/store/useApp';
import { api, type LinkRow, type RemoteScreenRow, type ShareRow } from './api';
import { isBackendConfigured } from './client';
import { describeError, useCloud } from './useCloud';
import { runSync } from './sync';

function useEnsureCloudInit() {
  const init = useCloud((s) => s.init);
  useEffect(() => {
    if (isBackendConfigured) void init();
  }, [init]);
}

function SyncBadge() {
  const status = useCloud((s) => s.syncStatus);
  const map: Record<string, TKey> = { syncing: 'sync.syncing', ok: 'sync.ok', offline: 'sync.offline', error: 'sync.error', needsChoice: 'sync.needsChoice', idle: 'sync.idle' };
  return <span role="status" data-testid="sync-status" data-status={status} className="text-xs text-muted">{t(map[status] ?? 'sync.idle')}</span>;
}

export function AccountButton() {
  useEnsureCloudInit();
  const status = useCloud((s) => s.status);
  const nick = useCloud((s) => s.nick);
  const syncStatus = useCloud((s) => s.syncStatus);
  const [open, setOpen] = useState(false);
  if (!isBackendConfigured) return null;
  return (
    <>
      <button type="button" className="btn" data-tour="account" data-testid="account-btn" onClick={() => setOpen(true)}>
        {status === 'offline' || syncStatus === 'offline' ? <CloudOff size={18} aria-hidden /> : <User size={18} aria-hidden />}
        <span className="max-w-40 truncate">{status === 'signedIn' ? nick : t('cloud.signIn')}</span>
        {syncStatus === 'needsChoice' && <span className="size-2 rounded-full bg-danger" aria-label={t('sync.needsChoice')} />}
      </button>
      <AccountDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ChangePassword() {
  const toast = useApp((s) => s.toast);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="mb-2 rounded-xl border border-line p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        try {
          await api.changeOwnPassword(pw);
          setPw('');
          toast(t('cloud.passwordChanged'), { tone: 'success' });
        } catch (er) {
          setMsg(t(describeError(er) as TKey));
        }
      }}
    >
      <label className="label" htmlFor="chg-pw">{t('cloud.newPassword')}</label>
      <div className="flex gap-2">
        <input id="chg-pw" type="password" className="input" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
        <button type="submit" className="btn" disabled={pw.length < 8}>{t('cloud.changePassword')}</button>
      </div>
      {msg && <p role="alert" className="mt-1 text-sm text-danger">{msg}</p>}
    </form>
  );
}

function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { status, nick, profile, error, syncStatus, userId, signIn, signUp, signOut, resolveOwnerChoice } = useCloud();
  const syncClasses = useApp((s) => s.settings.syncClasses);
  const updateSettings = useApp((s) => s.updateSettings);
  const toast = useApp((s) => s.toast);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmDeleteClasses, setConfirmDeleteClasses] = useState(false);
  const role = profile?.role === 'admin' ? t('cloud.role.admin') : t('cloud.role.teacher');
  const signedIn = status === 'signedIn';

  return (
    <Modal open={open} onClose={onClose} title={t('cloud.account')}>
      {signedIn ? (
        <div>
          <p className="mb-1">{t('cloud.signedInAs', { email: nick ?? '' })}</p>
          <p className="mb-3 text-sm text-muted">
            {role} · <SyncBadge />
          </p>
          {syncStatus === 'needsChoice' && (
            <div role="alert" className="mb-4 rounded-xl border border-danger p-3 text-sm">
              <p className="mb-2">{t('sync.ownerConflict')}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn" onClick={() => void resolveOwnerChoice('merge')}>{t('sync.merge')}</button>
                <button type="button" className="btn btn-danger" onClick={() => void resolveOwnerChoice('wipe')}>{t('sync.wipe')}</button>
              </div>
            </div>
          )}
          <button type="button" className="btn mb-4" onClick={() => void runSync()} disabled={syncStatus === 'syncing'}>
            <RefreshCw size={16} aria-hidden /> {t('sync.now')}
          </button>
          <p className="mb-2 text-sm text-muted">{t('sync.screensNote')}</p>
          <div className="mb-2 rounded-xl border border-line p-3">
            <Toggle label={t('sync.classesToggle')} checked={syncClasses} onChange={(v) => { updateSettings({ syncClasses: v }); void runSync(); }} />
            <p className="text-xs text-muted">{t('sync.classesPrivacy')}</p>
            <button type="button" className="btn btn-danger mt-2" onClick={() => setConfirmDeleteClasses(true)}>
              <Trash2 size={16} aria-hidden /> {t('sync.deleteClasses')}
            </button>
          </div>
          <ChangePassword />
          {error && <p className="my-2 text-sm text-muted">{t(error as TKey)}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {profile?.role === 'admin' && (
              <button type="button" className="btn" onClick={() => { onClose(); navigate({ name: 'admin' }); }}>{t('cloud.admin')}</button>
            )}
            <button type="button" className="btn" onClick={() => void signOut()}>{t('cloud.signOut')}</button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmWipe(true)}>{t('sync.signOutWipe')}</button>
          </div>
          <ConfirmDialog
            open={confirmWipe}
            title={t('sync.signOutWipe')}
            text={t('sync.signOutWipeText')}
            confirmLabel={t('sync.signOutWipe')}
            danger
            onConfirm={async () => {
              await runSync();
              await signOut({ wipeLocal: true });
            }}
            onClose={() => setConfirmWipe(false)}
          />
          <ConfirmDialog
            open={confirmDeleteClasses}
            title={t('sync.deleteClasses')}
            text={t('sync.deleteClassesText')}
            confirmLabel={t('common.delete')}
            danger
            onConfirm={async () => {
              try {
                if (userId) await api.deleteAllClasses(userId);
                updateSettings({ syncClasses: false });
                toast(t('cloud.removed'));
              } catch (e) {
                toast(t(describeError(e) as TKey), { tone: 'error' });
              }
            }}
            onClose={() => setConfirmDeleteClasses(false)}
          />
        </div>
      ) : status === 'offline' ? (
        <p className="text-muted">{t('cloud.offline')}</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            if (mode === 'in') await signIn(name, pw);
            else await signUp(name, pw);
            setBusy(false);
          }}
        >
          <p className="mb-3 text-sm text-muted">{t('cloud.loginHint')}</p>
          <Segmented value={mode} label={t('cloud.account')} onChange={setMode} options={[{ value: 'in', label: t('cloud.signIn') }, { value: 'up', label: t('cloud.signUp') }]} />
          <label className="label" htmlFor="acc-nick">{t('cloud.nick')}</label>
          <input id="acc-nick" className="input mb-1" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={name} onChange={(e) => setName(e.target.value)} />
          {mode === 'up' && <p className="mb-3 text-xs text-muted">{t('cloud.nickHint')}</p>}
          <label className="label mt-3" htmlFor="acc-pw">{t('cloud.password')}</label>
          <input id="acc-pw" className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={mode === 'up' ? 8 : undefined} value={pw} onChange={(e) => setPw(e.target.value)} />
          {mode === 'up' && <p className="mt-1 text-xs text-muted">{t('cloud.passwordHint')} {t('cloud.noRecovery')}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-danger">{t(error as TKey)}</p>}
          <button type="submit" className="btn btn-primary mt-4" disabled={busy}>
            {mode === 'in' ? t('cloud.signIn') : t('cloud.signUp')}
          </button>
        </form>
      )}
    </Modal>
  );
}

type Tab = 'templates' | 'shared';

/** Školské šablóny a obrazovky zdieľané so mnou. Vlastné obrazovky sa synchronizujú automaticky. */
export function CloudLibrary() {
  const status = useCloud((s) => s.status);
  const userId = useCloud((s) => s.userId);
  const isAdmin = useCloud((s) => s.profile?.role === 'admin');
  const toast = useApp((s) => s.toast);
  const importParsed = useApp((s) => s.importParsed);
  const [tab, setTab] = useState<Tab>('templates');
  const [shared, setShared] = useState<RemoteScreenRow[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const refresh = useCallback(async () => {
    if (status !== 'signedIn' || !userId) return;
    setLoading(true);
    setErr(null);
    try {
      const [s, tp] = await Promise.all([api.listShared(userId), api.listTemplates()]);
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

  if (!isBackendConfigured || status !== 'signedIn') return null;
  const fail = (e: unknown) => toast(t(describeError(e) as TKey), { tone: 'error' });

  const takeCopy = async (load: () => Promise<import('@/types').Screen>) => {
    try {
      const s = await load();
      const [id] = importParsed({ screens: [{ ...s, deckId: null }], decks: [], classes: [], skippedWidgets: 0, skippedScreens: 0 });
      toast(t('cloud.pulled'), { tone: 'success' });
      if (id) navigate({ name: 'edit', id });
    } catch (e) {
      fail(e);
    }
  };

  return (
    <section aria-label={t('cloud.schoolTemplates')} className="mb-10" data-testid="cloud-library">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
        <Cloud aria-hidden /> {t('cloud.schoolTemplates')}
      </h2>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented<Tab>
          label={t('cloud.schoolTemplates')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'templates', label: t('cloud.schoolTemplates') },
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
              <button type="button" className="btn" onClick={() => void takeCopy(() => api.downloadTemplate(tp.id))}>{t('cloud.useTemplate')}</button>
              {isAdmin && (
                <button type="button" className="btn btn-icon btn-danger" aria-label={`${t('common.delete')}: ${tp.name}`} onClick={() => setConfirmRemove({ id: tp.id, name: tp.name })}>
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </li>
          ))}
        {tab === 'shared' &&
          shared.map((r) => (
            <li key={r.id} className="card flex items-center gap-2 p-3">
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <button type="button" className="btn" onClick={() => void takeCopy(() => api.downloadCopy(r.id))}>{t('cloud.download')}</button>
            </li>
          ))}
      </ul>
      {((tab === 'templates' && !templates.length) || (tab === 'shared' && !shared.length)) && !loading && <p className="text-sm text-muted">{t('cloud.empty')}</p>}
      <ConfirmDialog
        open={!!confirmRemove}
        title={confirmRemove ? `${t('cloud.deleteRemote')}: ${confirmRemove.name}` : ''}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={async () => {
          if (!confirmRemove) return;
          try {
            await api.deleteTemplate(confirmRemove.id);
            toast(t('cloud.removed'));
            void refresh();
          } catch (e) {
            fail(e);
          }
        }}
        onClose={() => setConfirmRemove(null)}
      />
    </section>
  );
}

function ShareDialog({ remoteId, name, open, onClose }: { remoteId: string; name: string; open: boolean; onClose: () => void }) {
  const toast = useApp((s) => s.toast);
  const canShare = useCloud((s) => s.profile?.can_share ?? false);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [nickInput, setNickInput] = useState('');
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
            const u = await api.findUser(nickInput);
            if (!u) return setMsg(t('cloud.shareNoUser'));
            await api.share(remoteId, u.id, perm);
            toast(t('cloud.shared'), { tone: 'success' });
            setNickInput('');
            void load();
          } catch (err) {
            setMsg(t(describeError(err) as TKey));
          }
        }}
      >
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="share-nick">{t('cloud.shareWith')}</label>
          <input id="share-nick" required className="input" autoCapitalize="none" value={nickInput} onChange={(e) => setNickInput(e.target.value)} disabled={!canShare} />
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
            <span className="flex-1 truncate">{l.revoked_at ? t('cloud.linkRevoked') : t('cloud.linkExpires', { date: new Date(l.expires_at).toLocaleDateString('sk-SK') })}</span>
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

/** Tlačidlo v editore: zdieľanie a (pre administrátora) publikovanie ako školská šablóna. Samotné ukladanie je automatické. */
export function CloudScreenButton({ screenId }: { screenId: string }) {
  useEnsureCloudInit();
  const status = useCloud((s) => s.status);
  const isAdmin = useCloud((s) => s.profile?.role === 'admin');
  const screen = useApp((s) => s.screens[screenId]);
  const toast = useApp((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  if (!isBackendConfigured || status !== 'signedIn' || !screen) return null;
  return (
    <>
      <button type="button" className="btn" data-testid="cloud-btn" onClick={() => setOpen(true)}>
        <Cloud size={18} aria-hidden /> <span className="hidden xl:inline">Cloud</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Cloud: ${screen.name}`}>
        <p className="mb-2 text-sm text-muted">{t('sync.screensNote')}</p>
        <p className="mb-4 text-sm text-muted"><SyncBadge /> · {t('cloud.studentsNote')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await runSync(); // zdieľať sa dá len obrazovka, ktorá je už na serveri
              setBusy(false);
              if (useCloud.getState().syncStatus === 'ok') {
                setOpen(false);
                setShareOpen(true);
              } else toast(t('cloud.uploadFirst'), { tone: 'error' });
            }}
          >
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
      {shareOpen && <ShareDialog remoteId={screen.id} name={screen.name} open onClose={() => setShareOpen(false)} />}
    </>
  );
}
