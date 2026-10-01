const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const publishedWebRoot = process.env.MODE_ATLAS_WEB_ROOT;

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

const reporters = [['list'], ['html', { open: 'never' }]];
if (process.env.GITHUB_ACTIONS === 'true') reporters.splice(1, 0, ['github']);
if (process.env.MODE_ATLAS_TEST_REPORT) reporters.push(['json', { outputFile: process.env.MODE_ATLAS_TEST_REPORT }]);

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
    cwd: publishedWebRoot || __dirname,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !publishedWebRoot,
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
