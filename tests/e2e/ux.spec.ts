import { expect, test } from '@playwright/test';
import { addWidget, newScreen, openApp, widget } from './helpers';

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

  test('nastavenia widgetu sa dajú nájsť: tlačidlo „Nastavenia“ aj koliesko na widgete (aj na užšej obrazovke)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ts.notour', '1'));
    await page.setViewportSize({ width: 900, height: 768 });
    await openApp(page);
    await newScreen(page);
    await page.getByRole('button', { name: 'Widgety' }).click();
    await addWidget(page, 'timer');
    await expect(page.getByTestId('inspector')).toHaveCount(0); // na užšej obrazovke je panel skrytý…
    await page.getByTestId('widget-settings-btn').click(); // …otvorí ho tlačidlo v lište
    await expect(page.getByTestId('inspector').getByLabel('Minúty')).toBeVisible();
    await page.getByTestId('inspector-toggle').click();
    await expect(page.getByTestId('inspector')).toHaveCount(0);
    await page.getByTestId('widget-gear').click(); // …alebo koliesko priamo na widgete
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
    const host = page.getByTestId('stage').locator('xpath=..');
    await expect(host).toHaveCSS('background-image', /data:image\/svg\+xml/);
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.getByTestId('stage').locator('xpath=..')).toHaveCSS('background-image', /data:image\/svg\+xml/);
  });
});
