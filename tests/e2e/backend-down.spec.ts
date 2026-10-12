import { expect, test } from '@playwright/test';
import { addWidget, newScreen, waitSaved } from './helpers';

// Táto zostava je zostavená s nastaveným, ale NEDOSTUPNÝM backendom (http://127.0.0.1:9).
test.describe('11: nedostupný backend', () => {
  test('aplikácia ostáva plne použiteľná lokálne a nezobrazuje chyby bez zásahu používateľa', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByTestId('new-screen')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await newScreen(page);
    await addWidget(page, 'timer');
    await addWidget(page, 'picker');
    await waitSaved(page);
    await page.reload();
    await expect(page.locator('[data-widget-type]')).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test('prihlásenie ukáže zrozumiteľnú správu o nedostupnom serveri', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('account-btn').click();
    await page.getByLabel('E‑mail').fill('ucitel@skola.sk');
    await page.getByLabel('Heslo').fill('heslo12345');
    await page.getByRole('dialog').getByRole('button', { name: 'Prihlásiť sa' }).last().click();
    await expect(page.getByRole('alert')).toContainText('Server nie je dostupný', { timeout: 20_000 });
    await page.keyboard.press('Escape');
    await newScreen(page);
    await addWidget(page, 'clock');
    await waitSaved(page);
  });

  test('cloudové tlačidlá sa v editore nezobrazujú bez prihlásenia', async ({ page }) => {
    await page.goto('/');
    await newScreen(page);
    await expect(page.getByTestId('cloud-btn')).toHaveCount(0);
  });
});
