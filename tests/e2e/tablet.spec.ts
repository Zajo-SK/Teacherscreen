import { expect, test } from './fixtures';
import { addWidget, newScreen, openApp, widget } from './helpers';

test.describe('9: tablet a veľká obrazovka', () => {
  test('tablet (iPad, dotyk): editor je použiteľný bez vodorovného posúvania', async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await newScreen(page);
    if (!(await page.getByTestId('add-timer').isVisible())) await page.getByRole('button', { name: 'Widgety' }).click();
    await addWidget(page, 'timer');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const sb = (await page.getByTestId('stage').boundingBox())!;
    const vp = page.viewportSize()!;
    expect(sb.x).toBeGreaterThanOrEqual(0);
    expect(sb.x + sb.width).toBeLessThanOrEqual(vp.width + 1);

    // dotykové ovládanie tlačidla vo widgete
    await widget(page, 'timer').getByRole('button', { name: /štart/i }).tap();
    await page.waitForTimeout(1200);
    expect(await page.getByTestId('timer-display').textContent()).toMatch(/^04:5\d$/);

    // dotykové presunutie widgetu
    const w = widget(page, 'timer');
    const b = (await w.boundingBox())!;
    const before = await w.evaluate((e) => (e as HTMLElement).style.left);
    const cdp = await page.context().newCDPSession(page);
    const x = b.x + b.width * 0.8;
    const y = b.y + 14;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 15, y: y + i * 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await w.evaluate((e) => (e as HTMLElement).style.left)).not.toBe(before);

    // prezentácia na tablete
    await page.getByTestId('present-btn').click();
    await expect(page.getByTestId('present-root')).toBeVisible();
    const pb = (await page.getByTestId('stage').boundingBox())!;
    expect(pb.width).toBeGreaterThan(vp.width * 0.9);
  });

  test('veľká obrazovka 4K: prezentácia vyplní plochu a číslice sú veľké', async ({ page }) => {
    await page.setViewportSize({ width: 3840, height: 2160 });
    await openApp(page);
    await page.getByTestId('template-independent-work').getByRole('button', { name: /Použiť/ }).click();
    await page.getByTestId('present-btn').click();
    await expect(page.getByTestId('present-root')).toBeVisible();
    const sb = (await page.getByTestId('stage').boundingBox())!;
    expect(sb.width).toBeGreaterThan(3700);
    expect(sb.height).toBeGreaterThan(2000);
    const scale = parseFloat((await page.getByTestId('stage').getAttribute('data-scale'))!);
    expect(scale).toBeCloseTo(2, 1);
    const px = await widget(page, 'timer').getByTestId('timer-display').evaluate((e) => parseFloat(getComputedStyle(e).fontSize) * 2);
    expect(px).toBeGreaterThan(200);
  });
});
