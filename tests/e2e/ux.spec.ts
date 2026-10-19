import { expect, test } from '@playwright/test';
import { addWidget, newScreen, openApp, openSection, waitSaved, widget } from './helpers';

test.describe('používateľský zážitok', () => {
  test('úvodná prehliadka sa ukáže pri prvom otvorení, dá sa prejsť a už sa nevracia', async ({ page }) => {
    await page.goto('/');
    const tour = page.getByTestId('tour');
    await expect(tour).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('dialog', { name: 'Prehliadka aplikáciou' })).toContainText('Krok 1 z');
    await expect(tour).toContainText('Začnite tu');
    let guard = 0;
    while ((await page.getByTestId('tour-next').textContent())?.trim() !== 'Hotovo' && guard++ < 10) await page.getByTestId('tour-next').click();
    await page.getByTestId('tour-next').click();
    await expect(tour).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('new-screen')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('tour')).toHaveCount(0);

    // editor má vlastnú prehliadku
    await newScreen(page);
    await expect(page.getByTestId('tour')).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape'); // Esc ju preskočí
    await expect(page.getByTestId('tour')).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('tour')).toHaveCount(0);

    // zo Nastavení sa dá spustiť znova
    await page.getByRole('button', { name: 'Domov' }).click();
    await page.getByRole('button', { name: 'Nastavenia' }).click();
    await page.getByTestId('restart-tour').click();
    await expect(page.getByTestId('tour')).toBeVisible();
  });

  test('popisky ikon: pri nabehnutí myšou sa zobrazí, čo ikona robí', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ts.notour', '1'));
    await openApp(page);
    await newScreen(page);
    await page.getByTestId('undo').hover();
    await expect(page.getByRole('tooltip')).toContainText('Späť');
    await page.mouse.move(5, 400);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.getByTestId('add-timer').hover();
    await expect(page.getByRole('tooltip')).toContainText('Odpočítavanie');
    await page.getByTestId('add-timer').click();
    await widget(page, 'timer').hover();
    await page.getByTestId('widget-gear').hover();
    await expect(page.getByRole('tooltip')).toContainText('Otvoriť nastavenia');
    // popisok funguje aj v modálnom okne
    await page.getByRole('button', { name: 'Exportovať' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Zavrieť' }).hover();
    await expect(page.getByRole('tooltip')).toContainText('Zavrieť');
  });

  test('nastavenia widgetu sa dajú nájsť cez koliesko na widgete (aj na užšej obrazovke); nad plochou nie je lišta úprav', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ts.notour', '1'));
    await page.setViewportSize({ width: 900, height: 768 });
    await openApp(page);
    await newScreen(page, false);
    await addWidget(page, 'timer');
    await expect(page.getByTestId('inspector')).toHaveCount(0); // panel je predvolene skrytý obrazovke je panel skrytý…
    await page.getByTestId('widget-gear').click(); // …otvorí ho koliesko na widgete
    await expect(page.getByTestId('inspector').getByLabel('Minúty')).toBeVisible();
    await page.getByTestId('inspector-toggle').click();
    await expect(page.getByTestId('inspector')).toHaveCount(0);
    await page.getByTestId('widget-gear').click(); // …a znova ho otvorí
    await expect(page.getByRole('toolbar', { name: 'Zarovnanie' })).toHaveCount(0); // zarovnanie je v zbalenej sekcii panela
    await expect(page.getByTestId('inspector').getByLabel('Minúty')).toBeVisible();
    await page.getByTestId('inspector').getByLabel('Minúty').fill('7');
    await expect(page.getByTestId('timer-display')).toHaveText('07:00');
  });

  test('knižnica pozadí: aspoň 30 obrázkov, výber sa prejaví a uloží', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ts.notour', '1'));
    await openApp(page);
    await newScreen(page);
    await page.locator('[data-testid="stage"]').click({ position: { x: 4, y: 4 } });
    const picker = page.getByTestId('bg-picker');
    await expect(picker).toBeVisible();
    let total = 0;
    for (const cat of ['Prelievanie', 'Vlny', 'Tvary', 'Krajina', 'Vzory', 'Škola']) {
      await picker.getByRole('tab', { name: cat }).click();
      total += await page.getByTestId('bg-presets').getByRole('button').count();
    }
    expect(total).toBeGreaterThanOrEqual(30);
    await picker.getByRole('tab', { name: 'Škola' }).click();
    await page.getByTestId('bg-school-chalk').click();
    const host = page.locator('main[data-tour=stage]');
    await expect(host).toHaveCSS('background-image', /data:image\/svg\+xml/);
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.locator('main[data-tour=stage]')).toHaveCSS('background-image', /data:image\/svg\+xml/);
  });
});

test.describe('fotky z internetu (Wikimedia Commons – sieť je nahradená)', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8Dwn+E/AAn9Av4b0/bBAAAAAElFTkSuQmCC', 'base64');
  const thumb = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Hora.jpg/480px-Hora.jpg';
  const mkPage = (title: string, license = 'CC BY-SA 4.0') => ({
    title,
    index: 1,
    imageinfo: [{ thumburl: thumb, url: thumb, width: 4000, height: 2400, mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: license }, Artist: { value: '<a>Peter Fotograf</a>' } } }],
  });

  test('výber fotky nastaví pozadie, zobrazí autora a prežije obnovenie; pri výpadku ukáže chybu', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ts.notour', '1'));
    let online = true;
    await page.route('https://commons.wikimedia.org/w/api.php**', (route) => {
      if (!online) return route.abort();
      const url = new URL(route.request().url());
      const body = url.searchParams.get('generator') === 'search' ? { query: { pages: [mkPage('File:Hora.jpg'), mkPage('File:Zakazana.jpg', 'CC BY-NC 4.0')] } } : { query: { pages: [{ title: 'File:Hora.jpg', imageinfo: [{ thumburl: thumb, url: thumb }] }] } };
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    });
    await page.route('https://upload.wikimedia.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));

    await openApp(page);
    await newScreen(page, false);
    await page.getByTestId('bar-background').click();
    await openSection(page, 'bg-photos');
    await expect(page.getByTestId('photo-item')).toHaveCount(1); // fotka s NC licenciou je vyradená
    await page.getByTestId('photo-item').click();
    await expect(page.getByTestId('bg-credit')).toContainText('Peter Fotograf · CC BY-SA 4.0 · Wikimedia Commons');
    await expect(page.locator('main[data-tour=stage]')).toHaveCSS('background-image', /data:image\/jpeg/);
    await page.waitForTimeout(700);
    await page.reload();
    await page.getByTestId('bar-background').click();
    await expect(page.getByTestId('bg-credit')).toBeVisible();

    // výpadok siete
    online = false;
    await openSection(page, 'bg-photos');
    await page.getByRole('tab', { name: 'Hory' }).click();
    await expect(page.getByTestId('photo-error')).toBeVisible();
  });
});

test.describe('drobné vylepšenia ovládania', () => {
  test('panel nastavení sa dá zavrieť krížikom', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await expect(page.getByTestId('inspector')).toBeVisible();
    await page.getByTestId('inspector-close').click();
    await expect(page.getByTestId('inspector')).toHaveCount(0);
  });

  test('názov triedy sa dá celý vymazať a napísať nový (bez vracania predvoleného textu)', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Triedy' }).click();
    await page.getByTestId('new-class').click();
    const name = page.locator('#class-name');
    await name.fill('');
    await expect(name).toHaveValue('');
    await name.pressSequentially('7. A');
    await expect(name).toHaveValue('7. A');
    await expect(page.getByTestId('class-list')).toContainText('7. A');
  });
  test('veľkosť obsahu plochy: „−“ zmenší widgety na obrazovke, nastavenie sa uloží a „+“ ho vráti', async ({ page }) => {
    await openApp(page);
    await newScreen(page, false);
    await addWidget(page, 'timer');
    const w = widget(page, 'timer');
    const before = (await w.boundingBox())!;
    await expect(page.getByTestId('zoom-value')).toHaveText('100 %');
    await expect(page.getByTestId('zoom-in')).toBeDisabled();
    await page.getByTestId('zoom-out').click();
    await page.getByTestId('zoom-out').click();
    await expect(page.getByTestId('zoom-value')).toHaveText('80 %');
    const after = (await w.boundingBox())!;
    expect(after.width / before.width).toBeCloseTo(0.8, 1);
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId('zoom-value')).toHaveText('80 %');
    await page.getByTestId('zoom-in').click();
    await page.getByTestId('zoom-in').click();
    await expect(page.getByTestId('zoom-value')).toHaveText('100 %');
    expect((await widget(page, 'timer').boundingBox())!.width).toBeCloseTo(before.width, 0);
  });
});
