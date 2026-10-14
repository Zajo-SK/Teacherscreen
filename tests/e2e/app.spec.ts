import { expect, test } from './fixtures';
import { readFileSync } from 'node:fs';
import { addWidget, dragBy, newScreen, openApp, openSection, PNG_2x1, rectOf, stageScale, waitSaved, widget } from './helpers';

test.describe('akceptačné scenáre', () => {
  test('1–4: otvorenie bez registrácie, nová obrazovka, 5 widgetov, presun, zmena veľkosti, nastavenia', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    await openApp(page);
    // žiadne prihlasovanie ani chybové hlásenia v lokálnom režime
    await expect(page.getByTestId('account-btn')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);

    await newScreen(page);
    for (const t of ['text', 'clock', 'timer', 'picker', 'scoreboard']) await addWidget(page, t);

    // presun myšou
    const text = widget(page, 'text');
    const before = await rectOf(text);
    const box = (await text.boundingBox())!;
    const scale = await stageScale(page);
    await dragBy(page, { x: box.x + box.width * 0.25, y: box.y + 12 }, 120, 70); // horný pruh – ďalšie widgety ho nezakrývajú
    const moved = await rectOf(text);
    expect(moved.x - before.x).toBeGreaterThan(120 / scale - 20);
    expect(moved.x - before.x).toBeLessThan(120 / scale + 20);
    expect(moved.y).toBeGreaterThan(before.y);

    // zmena veľkosti cez úchyt
    const handle = page.locator('[data-handle="se"]');
    await expect(handle).toBeVisible();
    const hb = (await handle.boundingBox())!;
    const beforeResize = await rectOf(text);
    await dragBy(page, { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, 80, 50);
    const resized = await rectOf(text);
    expect(resized.w).toBeGreaterThan(beforeResize.w + 40);
    expect(resized.h).toBeGreaterThan(beforeResize.h + 20);

    // nastavenia v paneli vlastností
    const inspector = page.getByTestId('inspector');
    await inspector.getByLabel('Nadpis', { exact: true }).fill('Dnešná úloha');
    await expect(text).toContainText('Dnešná úloha');
    await inspector.getByLabel('Veľkosť písma').fill('60');

    // zmena farby pozadia
    await openSection(page, 'w-colors');
    await inspector.getByRole('button', { name: '#fef08a' }).first().click();
    await expect(text).toHaveCSS('background-color', 'rgb(254, 240, 138)');

    await waitSaved(page);
    expect(errors).toEqual([]);
  });

  test('5–6: časovač meria správny čas (aj po prepnutí obrazovky) a po obnovení sa všetko zachová', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-03-02T09:00:00') });
    await openApp(page);
    await newScreen(page);
    await page.getByTestId('screen-name').fill('Prvá');
    await addWidget(page, 'timer');
    const display = page.getByTestId('timer-display');
    await expect(display).toHaveText('05:00');
    await widget(page, 'timer').getByRole('button', { name: /štart/i }).click();
    await page.clock.fastForward(30_000); // prehliadač „zaspal“ na 30 s – žiadne tiky medzitým
    await expect(display).toHaveText('04:30');

    // prepnutie na inú obrazovku a späť
    await page.getByRole('button', { name: /Pridať obrazovku/ }).click();
    await expect(page.locator('[data-widget-type]')).toHaveCount(0);
    await page.clock.fastForward(60_000);
    await page.getByRole('button', { name: /1\. Prvá/ }).click();
    await expect(page.getByTestId('timer-display')).toHaveText('03:30');

    // pauza zastaví čas
    await widget(page, 'timer').getByRole('button', { name: /pauza/i }).click();
    await page.clock.fastForward(20_000);
    await expect(page.getByTestId('timer-display')).toHaveText('03:30');
    await widget(page, 'timer').getByRole('button', { name: /pokračovať/i }).click();
    await page.clock.fastForward(210_000);
    await expect(page.getByText('Čas vypršal!')).toBeVisible();
    await expect(page.getByTestId('timer-display')).toHaveText('00:00');

    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId('stage')).toBeVisible();
    await expect(page.getByTestId('screen-name')).toHaveValue('Prvá');
    await expect(widget(page, 'timer')).toHaveCount(1);
    await expect(page.getByText('Čas vypršal!')).toBeVisible();
  });

  test('6: bežiaci časovač prežije obnovenie stránky a meria ďalej', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'timer');
    await widget(page, 'timer').getByRole('button', { name: /štart/i }).click();
    await page.waitForTimeout(2200);
    await waitSaved(page);
    await page.reload();
    const t = await page.getByTestId('timer-display').textContent();
    expect(t).toMatch(/^04:5\d$/);
  });

  test('7: rozdelenie žiakov do skupín – nikto nechýba ani sa neopakuje', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'groups');
    const names = Array.from({ length: 17 }, (_, i) => `Žiak${String(i + 1).padStart(2, '0')}`);
    const inspector = page.getByTestId('inspector');
    await inspector.getByLabel(/Vložiť zoznam/).fill(names.join('\n'));
    await inspector.getByRole('button', { name: 'Nahradiť zoznam' }).click();
    await inspector.getByLabel('Počet skupín').fill('4');
    for (let i = 0; i < 3; i++) {
      await widget(page, 'groups').getByRole('button', { name: /Rozdeliť/ }).click();
      const shown = await widget(page, 'groups').locator('li').allTextContents();
      expect(shown.slice().sort()).toEqual(names);
      await expect(widget(page, 'groups').locator('section')).toHaveCount(4);
    }
    await expect(widget(page, 'groups')).toContainText('Žiaci: 17 · Skupiny: 4');
  });

  test('8: export obrazovky do JSON a import späť', async ({ page }, testInfo) => {
    await openApp(page);
    await newScreen(page);
    await page.getByTestId('screen-name').fill('Na export');
    await addWidget(page, 'steps');
    await addWidget(page, 'qr');
    await waitSaved(page);
    await page.getByTestId('export-btn').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByRole('button', { name: 'Exportovať', exact: true }).click()]);
    const path = testInfo.outputPath('export.json');
    await download.saveAs(path);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    expect(json.app).toBe('teacherscreen');
    expect(json.screens[0].name).toBe('Na export');
    expect(json.screens[0].widgets).toHaveLength(2);
    expect(json.screens[0].schemaVersion).toBe(1);

    await page.getByRole('button', { name: 'Domov' }).click();
    await page.getByTestId('import-input').setInputFiles({ name: 'export.json', mimeType: 'application/json', buffer: readFileSync(path) });
    await expect(page.getByTestId('screen-card')).toHaveCount(2);
    await expect(page.getByText('Importované obrazovky: 1.')).toBeVisible();

    // poškodený súbor sa odmietne so zrozumiteľnou správou a nič sa nepokazí
    await page.getByTestId('import-input').setInputFiles({ name: 'zly.json', mimeType: 'application/json', buffer: Buffer.from('{toto nie je json') });
    await expect(page.getByText(/Súbor nie je platný JSON/)).toBeVisible();
    await page.getByTestId('import-input').setInputFiles({ name: 'cudzi.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"world"}') });
    await expect(page.getByText(/nie je v podporovanom formáte/)).toBeVisible();
    await expect(page.getByTestId('screen-card')).toHaveCount(2);
  });

  test('10: prezentačný režim – bez ovládacích prvkov editora, klávesnica a návrat do editora', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'clock');
    await page.getByRole('button', { name: /Pridať obrazovku/ }).click();
    await addWidget(page, 'timer');
    await page.getByRole('button', { name: /1\. / }).click();
    await page.getByTestId('present-btn').click();
    await expect(page.getByTestId('present-root')).toBeVisible();
    await expect(page.getByTestId('add-text')).toHaveCount(0);
    await expect(page.locator('[data-handle]')).toHaveCount(0);
    await expect(page.locator('[data-drag-handle]')).toHaveCount(0);
    await expect(widget(page, 'clock')).toBeVisible();

    // žiadne náhodné presúvanie počas prezentácie
    const before = await rectOf(widget(page, 'clock'));
    const box = (await widget(page, 'clock').boundingBox())!;
    await dragBy(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 150, 90);
    expect(await rectOf(widget(page, 'clock'))).toEqual(before);

    await page.keyboard.press('ArrowRight');
    await expect(widget(page, 'timer')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(widget(page, 'clock')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('stage')).toBeVisible();
    await expect(page.getByTestId('add-text')).toBeVisible();

    await page.getByTestId('present-btn').click();
    await page.getByTestId('back-to-editor').click();
    await expect(page.getByTestId('editor-root')).toBeVisible();
  });

  test('widgety: klávesové skratky, kopírovanie, odstránenie a obnovenie, uzamknutie, vrstvy', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'dice');
    await addWidget(page, 'traffic');
    await page.keyboard.press('Control+a');
    await expect(page.locator('[data-selected]')).toHaveCount(2);
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await expect(page.locator('[data-widget-type]')).toHaveCount(4);
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-widget-type]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Vrátiť', exact: true }).click();
    await expect(page.locator('[data-widget-type]')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-widget-type]')).toHaveCount(2);
    await page.keyboard.press('Control+y');
    await expect(page.locator('[data-widget-type]')).toHaveCount(4);

    // uzamknutie: widget sa nedá posunúť
    const dice = widget(page, 'dice', 0);
    await dice.click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Control+l');
    const locked = await rectOf(dice);
    const b = (await dice.boundingBox())!;
    await dragBy(page, { x: b.x + 15, y: b.y + 15 }, 100, 100);
    expect(await rectOf(dice)).toEqual(locked);
    await page.keyboard.press('ArrowRight');
    expect(await rectOf(dice)).toEqual(locked);
    await page.keyboard.press('Control+l');
    await page.keyboard.press('Shift+ArrowRight');
    expect((await rectOf(dice)).x).toBe(locked.x + 10);

    // poradie vrstiev
    const zBefore = await dice.evaluate((e) => Number((e as HTMLElement).style.zIndex));
    await page.getByRole('button', { name: 'Úplne dopredu' }).click();
    const zAfter = await dice.evaluate((e) => Number((e as HTMLElement).style.zIndex));
    expect(zAfter).toBeGreaterThan(zBefore);
  });

  test('zarovnanie a viacnásobný výber pomocou obdĺžnika', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'dice');
    await addWidget(page, 'traffic');
    const stage = page.getByTestId('stage');
    const sb = (await stage.boundingBox())!;
    await page.mouse.move(sb.x + 3, sb.y + 3);
    await page.mouse.down();
    await page.mouse.move(sb.x + sb.width - 3, sb.y + sb.height - 3, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('[data-selected]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Zarovnať doľava' }).click();
    const xs = await Promise.all([widget(page, 'dice'), widget(page, 'traffic')].map(async (w) => (await rectOf(w)).x));
    expect(xs[0]).toBe(xs[1]);
  });

  test('zmena okna ani pomeru strán neposúva ani nestráca widgety', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('template-morning-circle').getByRole('button', { name: /Použiť/ }).click();
    await expect(page.getByTestId('stage')).toBeVisible();
    const rects = async () => Promise.all((await page.locator('[data-widget-type]').all()).map(rectOf));
    const before = await rects();
    expect(before.length).toBeGreaterThanOrEqual(5);
    for (const vp of [{ width: 1024, height: 768 }, { width: 2560, height: 1440 }, { width: 800, height: 1000 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(150);
      expect(await rects()).toEqual(before);
      const sb = (await page.getByTestId('stage').boundingBox())!;
      for (const w of await page.locator('[data-widget-type]').all()) {
        const b = (await w.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(sb.x - 1);
        expect(b.x + b.width).toBeLessThanOrEqual(sb.x + sb.width + 1);
      }
    }
    // pomer strán
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-testid="stage"]').click({ position: { x: 4, y: 4 } });
    await page.getByLabel('Pomer strán').selectOption('4:3');
    const after = await rects();
    expect(after).toHaveLength(before.length);
    after.forEach((r) => {
      expect(r.x + r.w).toBeLessThanOrEqual(1600);
      expect(r.y + r.h).toBeLessThanOrEqual(1200);
    });
  });

  test('šablóny: všetkých 10 sa dá použiť a obsahuje widgety', async ({ page }) => {
    const ids = ['morning-circle', 'independent-work', 'group-work', 'workshop', 'technical-education', 'math-contest', 'reading', 'final-reflection', 'test', 'stations'];
    for (const id of ids) {
      await openApp(page);
      await page.getByTestId(`template-${id}`).getByRole('button', { name: /Použiť/ }).click();
      await expect(page.getByTestId('stage')).toBeVisible();
      expect(await page.locator('[data-widget-type]').count(), id).toBeGreaterThanOrEqual(4);
      await waitSaved(page);
    }
    await page.getByRole('button', { name: 'Domov' }).click();
    await expect(page.getByTestId('screen-card')).toHaveCount(10);
    await page.getByPlaceholder('Hľadať obrazovky…').fill('citanie');
    await expect(page.getByTestId('screen-card')).toHaveCount(1);
  });

  test('kreslenie, obrázok a QR kód', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'draw');
    const canvas = page.getByTestId('draw-canvas');
    const cb = (await canvas.boundingBox())!;
    await dragBy(page, { x: cb.x + 40, y: cb.y + 40 }, 120, 60);
    const hasInk = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
    expect(await canvas.evaluate(hasInk)).toBe(true);
    await widget(page, 'draw').getByRole('button', { name: 'Vymazať kresbu' }).click();
    expect(await canvas.evaluate(hasInk)).toBe(false);

    await addWidget(page, 'image');
    await page.getByTestId('image-input').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG_2x1 });
    await expect(widget(page, 'image').locator('img')).toBeVisible();
    await widget(page, 'image').click();
    const r0 = await rectOf(widget(page, 'image'));
    expect(Math.abs(r0.w / r0.h - 2)).toBeLessThan(0.05);
    const hb = (await page.locator('[data-handle="se"]').boundingBox())!;
    await dragBy(page, { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, 60, 10);
    const r1 = await rectOf(widget(page, 'image'));
    expect(r1.w).toBeGreaterThan(r0.w);
    expect(Math.abs(r1.w / r1.h - 2)).toBeLessThan(0.05);

    await addWidget(page, 'qr');
    const inspector = page.getByTestId('inspector');
    await inspector.getByLabel(/Webová adresa \(URL\)/).fill('javascript:alert(1)');
    await expect(widget(page, 'qr').getByRole('alert')).toContainText('Neplatná webová adresa');
    await inspector.getByLabel(/Webová adresa \(URL\)/).fill('https://example.org/trieda');
    await expect(widget(page, 'qr').getByRole('img')).toBeVisible();
  });

  test('offline: po prvom načítaní sa aplikácia otvorí aj bez internetu', async ({ page, context }) => {
    await openApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('new-screen')).toBeVisible();
    await newScreen(page);
    await addWidget(page, 'clock');
    await waitSaved(page);
    await context.setOffline(false);
  });

  test('triedy: uloženie zoznamu žiakov a použitie vo widgetoch, prežije obnovenie stránky', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('classes-btn').click();
    await page.getByTestId('new-class').click();
    await page.getByLabel('Názov triedy').fill('7.B');
    await page.getByLabel(/Vložiť zoznam/).fill('Adam, Berta, Cyril, Dana');
    await page.getByRole('button', { name: 'Nahradiť zoznam' }).click();
    await expect(page.getByTestId('class-list')).toContainText('7.B');
    await page.keyboard.press('Escape');
    await newScreen(page);
    await addWidget(page, 'groups');
    await page.getByTestId('inspector').getByLabel('Trieda').selectOption({ label: '7.B (4)' });
    await page.getByTestId('inspector').getByLabel('Počet skupín').fill('2');
    await widget(page, 'groups').getByRole('button', { name: /Rozdeliť/ }).click();
    expect((await widget(page, 'groups').locator('li').allTextContents()).sort()).toEqual(['Adam', 'Berta', 'Cyril', 'Dana']);
    await waitSaved(page);
    await page.reload();
    await expect(widget(page, 'groups')).toContainText('Skupina 1');
    // druhá trieda použitá v inom widgete tej istej obrazovky
    await addWidget(page, 'picker');
    await page.getByTestId('inspector').getByLabel('Trieda').selectOption({ label: '7.B (4)' });
    await expect(widget(page, 'picker')).toContainText('Zostáva 4 z 4');
  });

  test('téma: tmavý režim sa dá zapnúť a pretrvá', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Nastavenia' }).click();
    await page.getByRole('button', { name: 'Tmavý' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
