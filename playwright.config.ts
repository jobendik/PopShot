import { defineConfig } from '@playwright/test';

/**
 * Smoke-test config. `npm test` builds nothing itself — it serves the
 * production build via `vite preview`, so run `npm run build` first (the
 * `test` npm script chains it). Keeping the suite on the prod bundle means
 * it exercises exactly what CrazyGames would host.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 960, height: 540 },
    // Honor a pre-provisioned Chromium (e.g. containers that set
    // PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD and symlink /opt/pw-browsers/chromium)
    // instead of requiring `playwright install` to fetch a matching build.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
