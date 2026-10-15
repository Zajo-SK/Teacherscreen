import { expect, test } from './fixtures';
import { addWidget, newScreen, openApp, widget } from './helpers';

const NEW = ['calendar', 'countdown', 'timetable', 'noise', 'symbols', 'sticker', 'link', 'video'] as const;

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

  test('video: YouTube odkaz sa načíta až po kliknutí a vloží sa bez cookies; cudzí odkaz sa odmietne', async ({ page }) => {
    await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>video</body></html>' }));
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'video');
    const url = page.getByTestId('inspector').getByLabel('Odkaz na YouTube');
    await url.fill('https://evil.example/watch?v=dQw4w9WgXcQ');
    await expect(widget(page, 'video').getByRole('alert')).toBeVisible();
    await url.fill('https://youtu.be/dQw4w9WgXcQ?t=30');
    await expect(widget(page, 'video').locator('iframe')).toHaveCount(0); // pred kliknutím sa nič nesťahuje
    await widget(page, 'video').getByTestId('video-load').click();
    await expect(widget(page, 'video').locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*start=30/);
  });

  test('pdf: nový widget ukáže prázdny stav s výzvou na výber súboru', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'pdf');
    await expect(widget(page, 'pdf')).toContainText('Vyberte súbor PDF v nastaveniach widgetu.');
  });

  test('PDF: nahratý súbor sa vykreslí a dá sa listovať', async ({ page }) => {
    const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R 5 0 R]/Count 2>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 300]/Contents 4 0 R/Resources<</Font<</F1 7 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 36 Tf 40 150 Td (Jedna) Tj ET
endstream
endobj
5 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 300]/Contents 6 0 R/Resources<</Font<</F1 7 0 R>>>>>>endobj
6 0 obj<</Length 44>>stream
BT /F1 36 Tf 40 150 Td (Dva) Tj ET
endstream
endobj
7 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R/Size 8>>
%%EOF`;
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'pdf');
    await page.getByTestId('inspector').locator('input[type=file]').setInputFiles({ name: 't.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
    const w = widget(page, 'pdf');
    await expect(w).toContainText('1 / 2');
    await expect(w.getByRole('alert')).toHaveCount(0);
    await expect
      .poll(() => w.locator('canvas').evaluate((c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0)))
      .toBe(true);
    await w.getByRole('button', { name: /Nasledujúca/ }).click();
    await expect(w).toContainText('2 / 2');
  });
  test('myšlienková mapa: Tab pridá vetvu, text sa zapíše do SVG a Delete na vetve nezmaže widget', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'mindmap');
    const w = widget(page, 'mindmap');
    const root = w.getByRole('treeitem').first();
    await root.click();
    await page.keyboard.press('Tab');
    await page.keyboard.type('Vetva A');
    await page.keyboard.press('Enter');
    await expect(w.getByTestId('mindmap-svg')).toContainText('Vetva A');
    await expect(w.getByRole('treeitem', { name: /Vetva A/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Delete');
    await expect(w.getByRole('treeitem')).toHaveCount(1);
    await expect(widget(page, 'mindmap')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/mindmap.png' });
  });
});
