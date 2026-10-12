import { useMemo, useRef, useState } from 'react';
import { Archive, Copy, Users, FolderPlus, LayoutTemplate, Pencil, Play, Plus, Search, Settings, Share, Trash2, Upload } from 'lucide-react';
import { ScreenThumb } from '@/components/Stage';
import { ConfirmDialog, Modal } from '@/components/ui';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ClassesDialog } from '@/components/ClassesDialog';
import { t } from '@/i18n';
import { navigate } from '@/lib/router';
import { fold, relativeTime } from '@/lib/time';
import { buildExport, ImportError, parseImport } from '@/lib/schema';
import { downloadText, readFileAsText, safeFilename } from '@/lib/download';
import { screensInDeck, useApp } from '@/store/useApp';
import { TEMPLATES } from '@/templates';
import type { Deck, Screen } from '@/types';
import { AccountButton, CloudLibrary } from '@/backend/CloudPanel';

function ScreenCard({ screen }: { screen: Screen }) {
  const decks = useApp((s) => s.decks);
  const duplicate = useApp((s) => s.duplicateScreen);
  const del = useApp((s) => s.deleteScreen);
  const setDeck = useApp((s) => s.setScreenDeck);
  const update = useApp((s) => s.updateScreenMeta);
  const toast = useApp((s) => s.toast);
  const [confirm, setConfirm] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  return (
    <article className="card flex flex-col overflow-hidden" data-testid="screen-card" aria-label={screen.name}>
      <button type="button" className="block p-2 pb-0 text-left" onClick={() => navigate({ name: 'edit', id: screen.id })} aria-label={`${t('home.edit')}: ${screen.name}`}>
        <ScreenThumb widgets={screen.widgets} aspect={screen.aspect} background={screen.background} />
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="truncate text-base font-bold" title={screen.name}>
          {screen.name || t('home.untitled')}
        </h3>
        <p className="text-xs text-muted">
          {t('home.widgetsCount', { n: screen.widgets.length })} · {t('home.updated', { when: relativeTime(screen.updatedAt) })}
        </p>
        <div className="mt-auto flex flex-wrap gap-1">
          <button type="button" className="btn btn-primary min-h-10 flex-1" onClick={() => navigate({ name: 'present', id: screen.id })}>
            <Play size={16} aria-hidden /> {t('home.present')}
          </button>
          <button type="button" className="btn btn-icon min-h-10" title={t('home.edit')} aria-label={`${t('home.edit')}: ${screen.name}`} onClick={() => navigate({ name: 'edit', id: screen.id })}>
            <Pencil size={16} aria-hidden />
          </button>
          <button type="button" className="btn btn-icon min-h-10" title={t('common.rename')} aria-label={`${t('common.rename')}: ${screen.name}`} onClick={() => setRename(screen.name)}>
            <span aria-hidden className="text-xs font-bold">Aa</span>
          </button>
          <button type="button" className="btn btn-icon min-h-10" title={t('common.duplicate')} aria-label={`${t('common.duplicate')}: ${screen.name}`} onClick={() => duplicate(screen.id)}>
            <Copy size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-icon min-h-10"
            title={t('common.export')}
            aria-label={`${t('common.export')}: ${screen.name}`}
            onClick={() => {
              downloadText(`${safeFilename(screen.name)}.teacherscreen.json`, JSON.stringify(buildExport([screen], { kind: 'screen', includeStudents: false }), null, 2));
              toast(t('io.exportDone'), { tone: 'success' });
            }}
          >
            <Share size={16} aria-hidden />
          </button>
          <button type="button" className="btn btn-icon btn-danger min-h-10" title={t('common.delete')} aria-label={`${t('common.delete')}: ${screen.name}`} onClick={() => setConfirm(true)}>
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
        {Object.keys(decks).length > 0 && (
          <select className="input min-h-9 text-sm" aria-label={t('home.moveToDeck')} value={screen.deckId ?? ''} onChange={(e) => setDeck(screen.id, e.target.value || null)}>
            <option value="">{t('home.noDeck')}</option>
            {Object.values(decks).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <ConfirmDialog open={confirm} title={t('home.confirmDelete', { name: screen.name })} text={t('home.confirmDeleteText')} confirmLabel={t('common.delete')} danger onConfirm={() => del(screen.id)} onClose={() => setConfirm(false)} />
      <Modal open={rename !== null} onClose={() => setRename(null)} title={t('common.rename')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update(screen.id, { name: rename ?? screen.name });
            setRename(null);
          }}
        >
          <input className="input mb-4" aria-label={t('editor.screenName')} value={rename ?? ''} maxLength={120} autoFocus onChange={(e) => setRename(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setRename(null)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </article>
  );
}

function DeckSection({ deck, screens }: { deck: Deck; screens: Screen[] }) {
  const renameDeck = useApp((s) => s.renameDeck);
  const deleteDeck = useApp((s) => s.deleteDeck);
  const createScreen = useApp((s) => s.createScreen);
  const [confirm, setConfirm] = useState(false);
  return (
    <section aria-label={deck.name} className="mb-8 rounded-2xl border border-dashed border-line p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs font-bold" aria-label={t('home.deckName')} value={deck.name} maxLength={120} onChange={(e) => renameDeck(deck.id, e.target.value)} />
        <button type="button" className="btn" disabled={!screens.length} onClick={() => screens[0] && navigate({ name: 'present', id: screens[0].id })}>
          <Play size={16} aria-hidden /> {t('home.present')}
        </button>
        <button type="button" className="btn" onClick={() => navigate({ name: 'edit', id: createScreen({ deckId: deck.id }) })}>
          <Plus size={16} aria-hidden /> {t('home.new')}
        </button>
        <button type="button" className="btn btn-danger btn-icon" aria-label={`${t('common.delete')}: ${deck.name}`} onClick={() => setConfirm(true)}>
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
        {screens.map((s) => (
          <ScreenCard key={s.id} screen={s} />
        ))}
      </div>
      <ConfirmDialog open={confirm} title={t('home.confirmDeleteDeck', { name: deck.name })} confirmLabel={t('common.delete')} danger onConfirm={() => deleteDeck(deck.id)} onClose={() => setConfirm(false)} />
    </section>
  );
}

export function HomePage() {
  const screens = useApp((s) => s.screens);
  const decks = useApp((s) => s.decks);
  const createScreen = useApp((s) => s.createScreen);
  const createFromTemplate = useApp((s) => s.createFromTemplate);
  const createDeck = useApp((s) => s.createDeck);
  const importParsed = useApp((s) => s.importParsed);
  const toast = useApp((s) => s.toast);
  const corrupted = useApp((s) => s.corrupted);
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [classesOpen, setClassesOpen] = useState(false);
  const classes = useApp((s) => s.classes);
  const fileRef = useRef<HTMLInputElement>(null);

  const q = fold(query.trim());
  const matches = (s: Screen) => !q || fold(s.name).includes(q) || fold(s.description).includes(q);
  const loose = screensInDeck(screens, null).filter(matches);
  const recent = useMemo(
    () => Object.values(screens).filter((s) => s.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)).slice(0, 4),
    [screens],
  );
  const total = Object.keys(screens).length;
  const deckList = Object.values(decks).sort((a, b) => a.createdAt - b.createdAt);

  const importFile = async (file: File) => {
    try {
      const text = await readFileAsText(file, 40 * 1024 * 1024);
      const parsed = parseImport(text);
      const ids = importParsed(parsed);
      toast(t('io.importDone', { n: ids.length }), { tone: 'success' });
      if (parsed.skippedWidgets) toast(t('io.skippedWidgets', { n: parsed.skippedWidgets }));
    } catch (e) {
      const reason =
        e instanceof ImportError
          ? { json: t('io.invalidJson'), format: t('io.invalidFormat'), 'too-new': t('io.tooNew', { v: e.detail ?? '?' }), 'too-large': t('io.tooLarge'), empty: t('io.noScreens') }[e.code]
          : e instanceof Error && e.message === 'too-large'
            ? t('io.tooLarge')
            : t('common.error');
      toast(t('io.importFailed', { reason }), { tone: 'error' });
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-7xl px-4 pb-16 pt-4">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <img src="favicon.svg" alt="" className="size-10" />
        <div className="mr-auto">
          <h1 className="text-2xl font-extrabold leading-tight">{t('app.name')}</h1>
          <p className="text-sm text-muted">{t('app.tagline')}</p>
        </div>
        <button type="button" className="btn" data-testid="classes-btn" onClick={() => setClassesOpen(true)}>
          <Users size={18} aria-hidden /> {t('classes.open')}
        </button>
        <AccountButton />
        <button type="button" className="btn btn-icon" aria-label={t('settings.title')} title={t('settings.title')} onClick={() => setSettingsOpen(true)}>
          <Settings size={20} aria-hidden />
        </button>
      </header>

      {corrupted > 0 && <p role="alert" className="mb-4 rounded-xl border border-danger p-3 text-danger">{t('home.corrupted', { n: corrupted })}</p>}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" data-testid="new-screen" className="btn btn-primary min-h-12 px-5 text-lg" onClick={() => navigate({ name: 'edit', id: createScreen() })}>
          <Plus aria-hidden /> {t('home.new')}
        </button>
        <div className="relative min-w-60 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} aria-hidden />
          <input type="search" className="input pl-10" placeholder={t('home.search')} aria-label={t('home.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button type="button" className="btn" onClick={() => createDeck(t('home.newDeck'))}>
          <FolderPlus size={18} aria-hidden /> {t('home.newDeck')}
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          <Upload size={18} aria-hidden /> {t('home.importScreen')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="import-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importFile(f);
          }}
        />
      </div>

      {recent.length > 0 && !q && (
        <section className="mb-8" aria-label={t('home.recent')}>
          <h2 className="mb-3 text-xl font-bold">{t('home.recent')}</h2>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]" data-testid="recent">
            {recent.map((s) => (
              <button key={s.id} type="button" className="card p-2 text-left hover:bg-surface2" onClick={() => navigate({ name: 'edit', id: s.id })}>
                <ScreenThumb widgets={s.widgets} aspect={s.aspect} background={s.background} />
                <span className="mt-2 block truncate px-1 font-semibold">{s.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {deckList.length > 0 && (
        <section aria-label={t('home.decks')} className="mb-2">
          <h2 className="mb-1 text-xl font-bold">{t('home.decks')}</h2>
          <p className="mb-3 text-sm text-muted">{t('home.decks.hint')}</p>
          {deckList.map((d) => (
            <DeckSection key={d.id} deck={d} screens={screensInDeck(screens, d.id).filter(matches)} />
          ))}
        </section>
      )}

      <section aria-label={t('home.title')} className="mb-10">
        <h2 className="mb-3 text-xl font-bold">{t('home.title')}</h2>
        {total === 0 ? (
          <p className="card p-6 text-muted">{t('home.empty')}</p>
        ) : loose.length === 0 && q ? (
          <p className="text-muted">{t('home.noResults')}</p>
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]" data-testid="screen-list">
            {loose.map((s) => (
              <ScreenCard key={s.id} screen={s} />
            ))}
          </div>
        )}
      </section>

      <CloudLibrary />

      <section aria-label={t('home.templates')} className="mb-10">
        <h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
          <LayoutTemplate aria-hidden /> {t('home.templates')}
        </h2>
        <p className="mb-3 text-sm text-muted">{t('home.templates.hint')}</p>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {TEMPLATES.map((tpl) => (
            <TemplateCard key={tpl.id} id={tpl.id} onUse={(id) => navigate({ name: 'edit', id })} createFromTemplate={createFromTemplate} />
          ))}
        </div>
      </section>

      <section aria-label={t('home.backup')} className="card p-4">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
          <Archive aria-hidden /> {t('home.backup')}
        </h2>
        <p className="mb-3 text-sm text-muted">{t('home.storageNote')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            disabled={total === 0 && Object.keys(classes).length === 0}
            data-testid="backup-export"
            onClick={() => {
              downloadText(`teacherscreen-zaloha-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildExport(Object.values(screens), { kind: 'backup', decks: Object.values(decks), classes: Object.values(classes), includeStudents: true }), null, 2));
              toast(t('io.exportDone'), { tone: 'success' });
            }}
          >
            {t('home.backup.export')}
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            {t('home.backup.import')}
          </button>
        </div>
      </section>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ClassesDialog open={classesOpen} onClose={() => setClassesOpen(false)} />
    </div>
  );
}

function TemplateCard({ id, onUse, createFromTemplate }: { id: string; onUse: (screenId: string) => void; createFromTemplate: (id: string) => string | null }) {
  const tpl = TEMPLATES.find((x) => x.id === id)!;
  const widgets = useMemo(() => tpl.build(), [tpl]);
  return (
    <article className="card flex flex-col p-2" data-testid={`template-${id}`}>
      <ScreenThumb widgets={widgets} aspect={tpl.aspect} background={tpl.background} />
      <div className="flex flex-1 flex-col gap-1 p-2">
        <h3 className="font-bold">{tpl.name}</h3>
        <p className="mb-2 text-sm text-muted">{tpl.description}</p>
        <button
          type="button"
          className="btn mt-auto"
          aria-label={`${t('home.useTemplate')}: ${tpl.name}`}
          onClick={() => {
            const sid = createFromTemplate(id);
            if (sid) onUse(sid);
          }}
        >
          {t('home.useTemplate')}
        </button>
      </div>
    </article>
  );
}
