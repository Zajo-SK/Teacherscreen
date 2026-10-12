import { expect, test, type Browser, type Page } from '@playwright/test';
import { addWidget, newScreen, waitSaved } from './helpers';

// Zostava je prepojená s lokálnou náhradou Supabase (tests/e2e/fake-supabase.mjs) – testuje sa klientska logika
// registrácie, prihlásenia a synchronizácie dvoch „zariadení“ (dva nezávislé kontexty prehliadača).
const API = 'http://127.0.0.1:4177';
const NICK = `ucitel${Date.now() % 100000}`;
const PW = 'heslo12345';

async function device(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByTestId('new-screen')).toBeVisible();
  return page;
}
async function openAccount(page: Page) {
  await page.getByTestId('account-btn').click();
}
async function syncNow(page: Page) {
  await openAccount(page);
  await page.getByRole('button', { name: 'Synchronizovať teraz' }).click();
  await expect(page.getByRole('dialog').getByTestId('sync-status')).toHaveAttribute('data-status', 'ok');
  await page.keyboard.press('Escape');
}

test.describe('synchronizácia medzi zariadeniami', () => {
  test.describe.configure({ mode: 'serial' });

  test('registrácia nickom, nahratie plochy a tried z prvého zariadenia', async ({ browser }) => {
    const a = await device(browser);
    await openAccount(a);
    await a.getByRole('radio', { name: 'Vytvoriť účet' }).or(a.getByRole('button', { name: 'Vytvoriť účet' }).first()).click();
    // neplatná prezývka
    await a.getByLabel('Prezývka (nick)').fill('a b');
    await a.getByLabel('Heslo').fill(PW);
    await a.getByRole('dialog').getByRole('button', { name: 'Vytvoriť účet' }).last().click();
    await expect(a.getByRole('alert')).toContainText('Prezývka musí mať');
    await a.getByLabel('Prezývka (nick)').fill(NICK);
    await a.getByRole('dialog').getByRole('button', { name: 'Vytvoriť účet' }).last().click();
    await expect(a.getByText(`Prihlásený ako ${NICK}`)).toBeVisible();
    await a.keyboard.press('Escape');

    // trieda so žiakmi
    await a.getByTestId('classes-btn').click();
    await a.getByTestId('new-class').click();
    await a.getByLabel('Názov triedy').fill('5.A');
    await a.getByLabel(/Vložiť zoznam/).fill('Anna\nPeter\nEva');
    await a.getByRole('button', { name: 'Nahradiť zoznam' }).click();
    await a.keyboard.press('Escape');

    // plocha s widgetom Náhodný výber používajúcim triedu
    await newScreen(a);
    await a.getByTestId('screen-name').fill('Hodina A');
    await addWidget(a, 'picker');
    await a.getByTestId('inspector').getByLabel('Trieda').selectOption({ label: '5.A (3)' });
    await expect(a.locator('[data-widget-type="picker"]')).toContainText('Zostáva 3 z 3');
    await waitSaved(a);

    // zapnutie synchronizácie tried
    await a.getByRole('button', { name: 'Domov' }).click();
    await openAccount(a);
    await a.getByLabel(/Synchronizovať zoznamy tried/).check();
    await expect(a.getByRole('dialog').getByTestId('sync-status')).toHaveAttribute('data-status', 'ok');
    await a.keyboard.press('Escape');

    const db = await (await fetch(`${API}/__db`)).json();
    expect(db.screens).toHaveLength(1);
    expect(db.screens[0].name).toBe('Hodina A');
    expect(db.class_lists).toHaveLength(1);
    expect(db.class_lists[0].names).toEqual(['Anna', 'Peter', 'Eva']);
    // mená žiakov nie sú v nahratej ploche, iba odkaz na triedu
    expect(JSON.stringify(db.screens[0].data)).not.toMatch(/Anna|Peter|Eva/);
    expect(JSON.stringify(db.screens[0].data)).toContain(db.class_lists[0].id);
    await a.context().close();
  });

  test('druhé zariadenie: prihlásenie nickom načíta plochy aj triedy; zmeny a mazanie sa prenášajú', async ({ browser }) => {
    const b = await device(browser);
    await expect(b.getByTestId('screen-card')).toHaveCount(0);
    // zlé heslo
    await openAccount(b);
    await b.getByLabel('Prezývka (nick)').fill(NICK.toUpperCase()); // veľkosť písmen sa ignoruje
    await b.getByLabel('Heslo').fill('zle-heslo-1');
    await b.getByRole('dialog').getByRole('button', { name: 'Prihlásiť sa', exact: true }).last().click();
    await expect(b.getByRole('alert')).toContainText('Nesprávny');
    await b.getByLabel('Heslo').fill(PW);
    await b.getByRole('dialog').getByRole('button', { name: 'Prihlásiť sa', exact: true }).last().click();
    await expect(b.getByText(`Prihlásený ako ${NICK}`)).toBeVisible();
    await b.getByLabel(/Synchronizovať zoznamy tried/).check();
    await expect(b.getByRole('dialog').getByTestId('sync-status')).toHaveAttribute('data-status', 'ok');
    await b.keyboard.press('Escape');

    await expect(b.getByTestId('screen-card')).toHaveCount(1);
    await expect(b.getByTestId('screen-card')).toContainText('Hodina A');
    await b.getByTestId('classes-btn').click();
    await expect(b.getByTestId('class-list')).toContainText('5.A');
    await b.keyboard.press('Escape');

    // plocha sa otvorí a widget vidí mená z triedy
    await b.getByRole('button', { name: /Upraviť: Hodina A/ }).first().click();
    await expect(b.locator('[data-widget-type="picker"]')).toContainText('Zostáva 3 z 3');

    // zmena na druhom zariadení → prvé ju dostane
    await b.getByTestId('screen-name').fill('Hodina A – upravená');
    await waitSaved(b);
    await b.getByRole('button', { name: 'Domov' }).click();
    await syncNow(b);
    const db = await (await fetch(`${API}/__db`)).json();
    expect(db.screens[0].name).toBe('Hodina A – upravená');

    const a2 = await device(browser);
    await openAccount(a2);
    await a2.getByLabel('Prezývka (nick)').fill(NICK);
    await a2.getByLabel('Heslo').fill(PW);
    await a2.getByRole('dialog').getByRole('button', { name: 'Prihlásiť sa', exact: true }).last().click();
    await expect(a2.getByText(`Prihlásený ako ${NICK}`)).toBeVisible();
    await a2.keyboard.press('Escape');
    await expect(a2.getByTestId('screen-card')).toContainText('Hodina A – upravená');

    // zmazanie na zariadení B sa prenesie na A2
    await b.getByRole('button', { name: /Odstrániť: Hodina A/ }).click();
    await b.getByRole('dialog').getByRole('button', { name: 'Odstrániť', exact: true }).click();
    await syncNow(b);
    expect((await (await fetch(`${API}/__db`)).json()).screens).toHaveLength(0);
    await syncNow(a2);
    await expect(a2.getByTestId('screen-card')).toHaveCount(0);
    await b.context().close();
    await a2.context().close();
  });

  test('odhlásenie s odstránením dát vymaže zariadenie', async ({ browser }) => {
    const p = await device(browser);
    await p.getByTestId('new-screen').click();
    await p.getByRole('button', { name: 'Domov' }).click();
    await openAccount(p);
    await p.getByLabel('Prezývka (nick)').fill(NICK);
    await p.getByLabel('Heslo').fill(PW);
    await p.getByRole('dialog').getByRole('button', { name: 'Prihlásiť sa', exact: true }).last().click();
    await expect(p.getByText(`Prihlásený ako ${NICK}`)).toBeVisible();
    await expect(p.getByRole('dialog').getByTestId('sync-status')).toHaveAttribute('data-status', 'ok');
    await p.getByRole('button', { name: 'Odhlásiť a odstrániť dáta z tohto zariadenia' }).click();
    await p.getByRole('dialog').last().getByRole('button', { name: 'Odhlásiť a odstrániť dáta z tohto zariadenia' }).click();
    await p.keyboard.press('Escape');
    await expect(p.getByTestId('screen-card')).toHaveCount(0);
    await p.context().close();
  });
});

test.describe('správa účtov administrátorom', () => {
  test('admin vidí učiteľov, upraví triedu, resetuje heslo, zmaže účet; učiteľ si heslo zmení', async ({ browser }) => {
    const teacher = `uc${Date.now() % 100000}`;
    const boss = `riaditel${Date.now() % 100000}`;
    const register = async (page: Page, nick: string) => {
      await openAccount(page);
      await page.getByRole('button', { name: 'Vytvoriť účet' }).first().click();
      await page.getByLabel('Prezývka (nick)').fill(nick);
      await page.getByLabel('Heslo').fill(PW);
      await page.getByRole('dialog').getByRole('button', { name: 'Vytvoriť účet' }).last().click();
      await expect(page.getByText(`Prihlásený ako ${nick}`)).toBeVisible();
    };

    // učiteľ s triedou na serveri
    const t = await device(browser);
    await register(t, teacher);
    await t.getByLabel(/Synchronizovať zoznamy tried/).check();
    await t.keyboard.press('Escape');
    await t.getByTestId('classes-btn').click();
    await t.getByTestId('new-class').click();
    await t.getByLabel('Názov triedy').fill('9.C');
    await t.getByLabel(/Vložiť zoznam/).fill('Ela\nFero');
    await t.getByRole('button', { name: 'Nahradiť zoznam' }).click();
    await t.keyboard.press('Escape');
    await syncNow(t);

    // administrátor
    const a = await device(browser);
    await register(a, boss);
    await a.keyboard.press('Escape');
    await fetch(`${API}/__makeadmin?nick=${boss}`);
    await a.reload();
    await a.getByTestId('account-btn').click();
    await a.getByRole('button', { name: 'Správa školy' }).click();
    await expect(a.getByTestId(`user-${teacher}`)).toBeVisible();
    await expect(a.getByTestId(`user-${teacher}`)).toContainText('Triedy: 1');

    // správa triedy cudzieho učiteľa
    await a.getByRole('button', { name: `Triedy: ${teacher}` }).click();
    await a.getByTestId('admin-class-list').getByRole('button', { name: /9\.C/ }).click();
    await a.getByLabel('Názov triedy').fill('9.C (opravená)');
    await a.getByRole('dialog').getByRole('button', { name: 'Uložiť', exact: true }).click();
    await a.keyboard.press('Escape');

    // reset hesla
    await a.getByRole('button', { name: `Reset hesla: ${teacher}` }).click();
    await a.getByRole('dialog').getByRole('button', { name: 'Reset hesla' }).click();
    const newPw = (await a.getByTestId('new-password').textContent())!.trim();
    expect(newPw.length).toBeGreaterThanOrEqual(8);
    await a.getByRole('dialog').getByRole('button', { name: 'Zavrieť' }).last().click();
    await expect(a.getByTestId('admin-audit')).toContainText('Reset hesla');

    // učiteľ sa prihlási novým heslom a zmení si ho
    const t2 = await device(browser);
    await openAccount(t2);
    await t2.getByLabel('Prezývka (nick)').fill(teacher);
    await t2.getByLabel('Heslo').fill(PW);
    await t2.getByRole('dialog').getByRole('button', { name: 'Prihlásiť sa', exact: true }).last().click();
    await expect(t2.getByRole('alert')).toContainText('Nesprávny');
    await t2.getByLabel('Heslo').fill(newPw);
    await t2.getByRole('dialog').getByRole('button', { name: 'Prihlásiť sa', exact: true }).last().click();
    await expect(t2.getByText(`Prihlásený ako ${teacher}`)).toBeVisible();
    await t2.getByLabel('Nové heslo').fill('uplne-nove-heslo');
    await t2.getByRole('button', { name: 'Zmeniť heslo' }).click();
    await expect(t2.getByText('Heslo bolo zmenené.')).toBeVisible();
    await t2.context().close();

    // zmazanie účtu vyžaduje potvrdenie prezývkou
    await a.getByRole('button', { name: `Zmazať účet: ${teacher}` }).click();
    const del = a.getByRole('dialog').getByRole('button', { name: 'Zmazať účet' });
    await expect(del).toBeDisabled();
    await a.getByLabel(/Na potvrdenie napíšte/).fill(teacher);
    await del.click();
    await expect(a.getByTestId(`user-${teacher}`)).toHaveCount(0);
    const db = await (await fetch(`${API}/__db`)).json();
    expect(db.class_lists.filter((c: { name: string }) => c.name.startsWith('9.C'))).toHaveLength(0);
    // seba nemožno zmazať ani resetovať
    await expect(a.getByRole('button', { name: `Zmazať účet: ${boss}` })).toBeDisabled();
    await t.context().close();
    await a.context().close();
  });
});
