import { expect, test } from './fixtures';
import { addWidget, newScreen, openApp, openSection, waitSaved, widget } from './helpers';

const NAMES = Array.from({ length: 12 }, (_, i) => `Žiak${String(i + 1).padStart(2, '0')}`);

async function setupGroups(page: import('@playwright/test').Page, groupCount = 3) {
  await openApp(page);
  await newScreen(page);
  await addWidget(page, 'groups');
  const inspector = page.getByTestId('inspector');
  await inspector.getByLabel(/Vložiť zoznam/).fill(NAMES.join('\n'));
  await inspector.getByRole('button', { name: 'Nahradiť zoznam' }).click();
  await inspector.getByLabel('Počet skupín').fill(String(groupCount));
  return inspector;
}
const groupsOf = async (page: import('@playwright/test').Page) =>
  Promise.all((await widget(page, 'groups').locator('section').all()).map(async (s) => (await s.getByTestId('group-student').allTextContents()).map((x) => x.replace(' ⚠', '').trim())));

test.describe('roll-up menu', () => {
  test('kategórie widgetov aj sekcie panelu sa dajú zbaliť a rozbaliť a stav sa pamätá', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    const content = page.getByTestId('sec-palette-content');
    const time = page.getByTestId('sec-palette-time');
    await expect(content).toHaveAttribute('aria-expanded', 'true');
    await expect(time).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('add-text')).toBeVisible();
    await expect(page.getByTestId('add-timer')).toHaveCount(0);
    await time.click();
    await expect(page.getByTestId('add-timer')).toBeVisible();
    await content.click();
    await expect(page.getByTestId('add-text')).toHaveCount(0);
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId('sec-palette-time')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('sec-palette-content')).toHaveAttribute('aria-expanded', 'false');

    // pravý panel: obrazovka → sekcie; widget → nastavenia / farby / poloha
    await expect(page.getByTestId('sec-screen-bg')).toHaveAttribute('aria-expanded', 'true');
    await page.getByTestId('sec-screen-bg').click();
    await expect(page.getByTestId('bg-picker')).toHaveCount(0);
    await addWidget(page, 'timer');
    await expect(page.getByTestId('sec-w-settings')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('sec-w-colors')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('inspector').getByLabel('Minúty')).toBeVisible();
    await openSection(page, 'w-geometry');
    await expect(page.getByTestId('inspector').getByLabel('Šírka')).toBeVisible();
    await page.getByTestId('sec-w-settings').click();
    await expect(page.getByTestId('inspector').getByLabel('Minúty')).toHaveCount(0);
  });
});

test.describe('Tvorca skupín – pravidlá a presúvanie', () => {
  test('pravidlá „nesmú byť spolu“ a „musia byť spolu“ platia pri každom rozdelení', async ({ page }) => {
    const inspector = await setupGroups(page, 3);
    const apart = inspector.getByTestId('rules-apart');
    const together = inspector.getByTestId('rules-together');
    await apart.getByLabel('Prvý žiak').selectOption('Žiak01');
    await apart.getByLabel('Druhý žiak').selectOption('Žiak02');
    await apart.getByRole('button', { name: 'Pridať' }).click();
    await apart.getByLabel('Prvý žiak').selectOption('Žiak01');
    await apart.getByLabel('Druhý žiak').selectOption('Žiak03');
    await apart.getByRole('button', { name: 'Pridať' }).click();
    await together.getByLabel('Prvý žiak').selectOption('Žiak05');
    await together.getByLabel('Druhý žiak').selectOption('Žiak06');
    await together.getByRole('button', { name: 'Pridať' }).click();
    await expect(apart).toContainText('Žiak01 ≠ Žiak02');
    await expect(together).toContainText('Žiak05 = Žiak06');
    for (let i = 0; i < 12; i++) {
      await widget(page, 'groups').getByRole('button', { name: /Rozdeliť/ }).click();
      const g = await groupsOf(page);
      expect(g.flat().sort()).toEqual(NAMES);
      const where = (n: string) => g.findIndex((x) => x.includes(n));
      expect(where('Žiak01')).not.toBe(where('Žiak02'));
      expect(where('Žiak01')).not.toBe(where('Žiak03'));
      expect(where('Žiak05')).toBe(where('Žiak06'));
    }
    // pravidlo sa dá odstrániť
    await apart.getByRole('button', { name: 'Odstrániť pravidlo Žiak01 – Žiak02' }).click();
    await expect(apart).not.toContainText('Žiak01 ≠ Žiak02');
  });

  test('rozporné pravidlá sa nahlásia a rozdelenie sa nevykoná', async ({ page }) => {
    const inspector = await setupGroups(page, 2);
    const add = async (kind: string, a: string, b: string) => {
      const box = inspector.getByTestId(`rules-${kind}`);
      await box.getByLabel('Prvý žiak').selectOption(a);
      await box.getByLabel('Druhý žiak').selectOption(b);
      await box.getByRole('button', { name: 'Pridať' }).click();
    };
    await add('together', 'Žiak01', 'Žiak02');
    await add('together', 'Žiak02', 'Žiak03');
    await add('apart', 'Žiak01', 'Žiak03');
    await expect(inspector.getByRole('alert')).toContainText('Pravidlá si odporujú');
    await widget(page, 'groups').getByRole('button', { name: /Rozdeliť/ }).click();
    await expect(page.getByTestId('groups-notice')).toContainText('Pravidlá si odporujú');
    await expect(widget(page, 'groups').locator('section')).toHaveCount(0);
  });

  test('žiaka možno presunúť do inej skupiny ťahaním; každý je stále práve raz; porušenie pravidla sa zvýrazní', async ({ page }) => {
    const inspector = await setupGroups(page, 3);
    const apart = inspector.getByTestId('rules-apart');
    await apart.getByLabel('Prvý žiak').selectOption('Žiak01');
    await apart.getByLabel('Druhý žiak').selectOption('Žiak02');
    await apart.getByRole('button', { name: 'Pridať' }).click();
    await widget(page, 'groups').getByRole('button', { name: /Rozdeliť/ }).click();

    const before = await groupsOf(page);
    const from = before.findIndex((g) => g.includes('Žiak01'));
    const to = before.findIndex((g) => g.includes('Žiak02')); // presun k žiakovi, s ktorým nesmie byť
    expect(from).not.toBe(to);
    const chip = widget(page, 'groups').locator('section').nth(from).getByRole('button', { name: 'Žiak01' });
    const target = widget(page, 'groups').locator('section').nth(to);
    const cb = (await chip.boundingBox())!;
    const tb = (await target.boundingBox())!;
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.mouse.down();
    await page.mouse.move(cb.x + 30, cb.y + 30, { steps: 4 });
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => (await groupsOf(page))[to]).toContain('Žiak01');
    const after = await groupsOf(page);
    expect(after.flat().sort()).toEqual(NAMES);
    expect(after[from]).not.toContain('Žiak01');
    await expect(widget(page, 'groups').getByRole('button', { name: 'Žiak01' })).toContainText('⚠');
    await expect(page.getByTestId('groups-status')).toContainText('každý práve raz');

    // klávesnicou: šípka vpravo presunie do nasledujúcej skupiny
    const idx = after.findIndex((g) => g.includes('Žiak01'));
    const k = widget(page, 'groups').getByRole('button', { name: 'Žiak01' });
    await k.focus();
    await page.keyboard.press(idx === after.length - 1 ? 'ArrowLeft' : 'ArrowRight');
    const expected = idx === after.length - 1 ? idx - 1 : idx + 1;
    await expect.poll(async () => (await groupsOf(page)).findIndex((g) => g.includes('Žiak01'))).toBe(expected);
    const kb = await groupsOf(page);
    expect(kb.flat().sort()).toEqual(NAMES);

    // úpravy prežijú obnovenie stránky
    await waitSaved(page);
    await page.reload();
    expect(await groupsOf(page)).toEqual(kb);
  });

  test('pravidlá patria triede: uložia sa do triedy a platia vo všetkých widgetoch', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('classes-btn').click();
    await page.getByTestId('new-class').click();
    await page.getByLabel('Názov triedy').fill('8.A');
    await page.getByLabel(/Vložiť zoznam/).fill(NAMES.join('\n'));
    await page.getByRole('button', { name: 'Nahradiť zoznam' }).click();
    const apart = page.getByTestId('rules-apart');
    await apart.getByLabel('Prvý žiak').selectOption('Žiak01');
    await apart.getByLabel('Druhý žiak').selectOption('Žiak02');
    await apart.getByRole('button', { name: 'Pridať' }).click();
    await page.keyboard.press('Escape');
    await newScreen(page);
    await addWidget(page, 'groups');
    const inspector = page.getByTestId('inspector');
    await inspector.getByLabel('Trieda').selectOption({ label: '8.A (12)' });
    await expect(inspector.getByTestId('rules-apart')).toContainText('Žiak01 ≠ Žiak02');
    await inspector.getByLabel('Počet skupín').fill('2');
    for (let i = 0; i < 8; i++) {
      await widget(page, 'groups').getByRole('button', { name: /Rozdeliť/ }).click();
      const g = await groupsOf(page);
      expect(g.findIndex((x) => x.includes('Žiak01'))).not.toBe(g.findIndex((x) => x.includes('Žiak02')));
    }
  });
});

test.describe('Náhodné číslo', () => {
  test('losuje čísla z rozsahu bez opakovania, ukáže zostatok a po vyčerpaní ponúkne reset', async ({ page }) => {
    await openApp(page);
    await newScreen(page);
    await addWidget(page, 'number');
    const inspector = page.getByTestId('inspector');
    await inspector.getByLabel('Najmenšie číslo').fill('1');
    await inspector.getByLabel('Najväčšie číslo').fill('6');
    await inspector.getByLabel('Koľko čísel vylosovať naraz').fill('3');
    const w = widget(page, 'number');
    await expect(w).toContainText('od 1 do 6');
    await w.getByRole('button', { name: 'Vylosovať' }).click();
    await expect(w.getByRole('button', { name: 'Vylosovať znova' })).toBeEnabled(); // animácia skončila
    const first = (await w.getByTestId('number-result').locator('span').allTextContents()).map(Number);
    expect(first).toHaveLength(3);
    await expect(w).toContainText('zostáva 3');
    await w.getByRole('button', { name: 'Vylosovať znova' }).click();
    await expect(w).toContainText('Všetky čísla už boli vylosované.');
    const second = (await w.getByTestId('number-result').locator('span').allTextContents()).map(Number);
    expect([...first, ...second].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    await expect(w).toContainText('Všetky čísla už boli vylosované.');
    await expect(w.getByRole('button', { name: 'Vylosovať znova' })).toBeDisabled();
    await w.getByRole('button', { name: 'Začať od začiatku' }).click();
    await expect(w.getByRole('button', { name: /Vylosovať/ })).toBeEnabled();
    // režim s opakovaním
    await inspector.getByLabel('Čísla sa nemajú opakovať').uncheck();
    await expect(w).not.toContainText('zostáva');
  });
});
