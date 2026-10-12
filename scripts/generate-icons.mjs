// Vygeneruje PNG ikony PWA z public/favicon.svg pomocou Chromium (Playwright).
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
async function render(name, size, padding = 0) {
  const inner = size - padding * 2;
  const bg = padding ? '#2563eb' : 'transparent';
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`,
  );
  const buf = await page.screenshot({ omitBackground: !padding });
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), buf);
}
await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('icon-maskable-512.png', 512, 80);
await browser.close();
console.log('Ikony vygenerované.');
