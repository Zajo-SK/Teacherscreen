import { expect, test } from './fixtures';
import { addWidget, newScreen, openApp, widget } from './helpers';

const NEW = ['calendar', 'countdown', 'timetable', 'noise', 'symbols', 'sticker', 'link'] as const;

test.describe('nové widgety', () => {
  test('všetky sa dajú pridať z lišty „Viac“', async ({ page }) => {
    await openApp(page);
    await newScreen(page, false);
    for (const type of NEW) await addWidget(page, type);
    for (const type of NEW) await expect(widget(page, type)).toBeVisible();
    await page.screenshot({ path: 'test-results/new-widgets.png' });
  });

  test('odkaz: nebezpečná adresa sa odmietne, bezpečná sa otvorí cez https', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'link');
    const inspector = page.getByTestId('inspector');
    const url = inspector.getByLabel(/Adresa|URL/i).first();
    await url.fill('javascript:alert(1)');
    await expect(widget(page, 'link').getByRole('alert')).toBeVisible();
    await expect(widget(page, 'link').locator('a')).toHaveCount(0);
    await url.fill('example.org/trieda');
    await expect(widget(page, 'link').locator('a')).toHaveAttribute('href', 'https://example.org/trieda');
    await expect(widget(page, 'link').locator('a')).toHaveAttribute('rel', /noopener/);
  });

  test('odpočet ukáže počet dní do zvoleného dátumu', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'countdown');
    const d = new Date();
    d.setDate(d.getDate() + 10);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await page.getByTestId('inspector').locator('input[type=date], input[type=text]').filter({ hasNot: page.locator('[maxlength="80"]') }).last().fill(ymd);
    await expect(widget(page, 'countdown')).toContainText('10');
  });
});
