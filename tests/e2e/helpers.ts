import { expect, type Page, type Locator } from '@playwright/test';

export const widget = (page: Page, type: string, nth = 0): Locator => page.locator(`[data-widget-type="${type}"]`).nth(nth);

export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('new-screen')).toBeVisible();
}

export async function newScreen(page: Page) {
  await page.getByTestId('new-screen').click();
  await expect(page.getByTestId('stage')).toBeVisible();
}

export async function addWidget(page: Page, type: string) {
  const n = await page.locator(`[data-widget-type="${type}"]`).count();
  await page.getByTestId(`add-${type}`).click();
  await expect(page.locator(`[data-widget-type="${type}"]`)).toHaveCount(n + 1);
}

export async function rectOf(w: Locator) {
  return w.evaluate((el) => {
    const s = (el as HTMLElement).style;
    return { x: parseFloat(s.left), y: parseFloat(s.top), w: parseFloat(s.width), h: parseFloat(s.height) };
  });
}

export async function stageScale(page: Page) {
  return parseFloat((await page.getByTestId('stage').getAttribute('data-scale')) ?? '1');
}

export async function dragBy(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
  await page.mouse.up();
}

export async function waitSaved(page: Page) {
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
}

/** Malý platný PNG (2×1 px) pre test nahrávania obrázka. */
export const PNG_2x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8Dwn+E/AAn9Av4b0/bBAAAAAElFTkSuQmCC', 'base64');
