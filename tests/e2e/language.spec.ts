import { test, expect } from '@playwright/test';

test('jazyk sa dá prepnúť v nastaveniach a zostane po obnovení', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nastavenia' }).first().click();
  await page.getByTestId('settings-language').selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.getByRole('button', { name: 'Einstellungen' }).first().click();
  await page.getByTestId('settings-language').selectOption('sk');
  await expect(page.locator('html')).toHaveAttribute('lang', 'sk');
});
