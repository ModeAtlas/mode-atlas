const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

const reporters = [['list'], ['html', { open: 'never' }]];
if (process.env.GITHUB_ACTIONS === 'true') reporters.splice(1, 0, ['github']);

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: false,
  retries: 0,
  reporter: reporters,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...(systemChromium ? { launchOptions: { executablePath: systemChromium } } : {}),
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 10_000
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] }
    }
  ]
});
