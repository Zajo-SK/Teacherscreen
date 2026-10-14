import { expect, type Page, type Locator } from '@playwright/test';

export const widget = (page: Page, type: string, nth = 0): Locator => page.locator(`[data-widget-type="${type}"]`).nth(nth);

export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('new-screen')).toBeVisible();
}

/** Vytvorí novú obrazovku; panel vlastností je v editore predvolene zatvorený, testy ho zvyčajne otvoria. */
export async function newScreen(page: Page, openInspector = true) {
  await page.getByTestId('new-screen').click();
  await expect(page.getByTestId('stage')).toBeVisible();
  if (openInspector) await page.getByTestId('inspector-toggle').click();
}

/** Otvorí zbaliteľnú sekciu (ak je zbalená). */
export async function openSection(page: Page, id: string) {
  const header = page.getByTestId(`sec-${id}`);
  await expect(header).toBeVisible();
  if ((await header.getAttribute('aria-expanded')) === 'false') await header.click();
}

export async function addWidget(page: Page, type: string) {
  const n = await page.locator(`[data-widget-type="${type}"]`).count();
  const tile = page.getByTestId(`add-${type}`);
  const inMore = !(await tile.isVisible());
  if (inMore) await page.getByTestId('bar-more-btn').click();
  await tile.click();
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
