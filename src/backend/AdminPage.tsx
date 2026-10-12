import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { t, type TKey } from '@/i18n';
import { navigate } from '@/lib/router';
import { useApp } from '@/store/useApp';
import { api, type Profile, type Role } from './api';
import { describeError, useCloud } from './useCloud';
import { emailToNick } from './nick';
import { Segmented } from '@/components/forms';
import { ASPECTS } from '@/editor/aspects';
import type { AspectId, ThemeMode } from '@/types';

export function AdminPage() {
  const status = useCloud((s) => s.status);
  const profile = useCloud((s) => s.profile);
  const userId = useCloud((s) => s.userId);
  const toast = useApp((s) => s.toast);
  const [users, setUsers] = useState<Profile[]>([]);
  const [defaults, setDefaults] = useState<{ aspect?: AspectId; theme?: ThemeMode }>({});
  const [err, setErr] = useState<string | null>(null);
  const isAdmin = profile?.role === 'admin';

  const load = useCallback(async () => {
    try {
      const [u, d] = await Promise.all([api.listUsers(), api.getSchoolDefaults()]);
      setUsers(u);
      setDefaults(d as typeof defaults);
    } catch (e) {
      setErr(describeError(e));
    }
  }, []);
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-4 py-6">
      <button type="button" className="btn mb-4" onClick={() => navigate({ name: 'home' })}>
        <ArrowLeft size={18} aria-hidden /> {t('editor.toHome')}
      </button>
      <h1 className="mb-4 text-2xl font-extrabold">{t('cloud.adminTitle')}</h1>
      {status !== 'signedIn' || !isAdmin ? (
        <p className="card p-4" role="alert">{t('cloud.adminOnly')}</p>
      ) : (
        <>
          {err && <p role="alert" className="mb-3 text-danger">{t(err as TKey)}</p>}
          <section className="card mb-6 p-4" aria-label={t('cloud.users')}>
            <h2 className="mb-3 text-lg font-bold">{t('cloud.users')}</h2>
            <ul>
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2">
                  <span className="min-w-0 flex-1 truncate">{u.display_name || emailToNick(u.email)}</span>
                  <select
                    className="input w-auto"
                    aria-label={`${t('cloud.setRole')}: ${u.display_name || emailToNick(u.email)}`}
                    value={u.role}
                    disabled={u.id === userId}
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
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-4" aria-label={t('cloud.schoolDefaults')}>
            <h2 className="mb-3 text-lg font-bold">{t('cloud.schoolDefaults')}</h2>
            <Segmented<AspectId>
              label={t('cloud.defaultAspect')}
              value={defaults.aspect ?? '16:9'}
              onChange={(aspect) => setDefaults({ ...defaults, aspect })}
              options={ASPECTS.map((a) => ({ value: a, label: a }))}
            />
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
        </>
      )}
    </main>
  );
}
