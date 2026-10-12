import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.CHROMIUM_PATH || undefined;
const launchOptions = { executablePath, args: ['--no-sandbox'] };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', launchOptions },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions, viewport: { width: 1440, height: 900 } }, testIgnore: /tablet|backend/ },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], defaultBrowserType: 'chromium', launchOptions }, testMatch: /tablet/ },
    { name: 'backend-down', use: { ...devices['Desktop Chrome'], launchOptions, baseURL: 'http://127.0.0.1:4174' }, testMatch: /backend/ },
  ],
  webServer: [
    { command: 'npm run build && npx vite preview --port 4173 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 180_000 },
    {
      command: 'VITE_SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_ANON_KEY=test-anon-key npx vite build --outDir dist-backend-down && npx vite preview --outDir dist-backend-down --port 4174 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
