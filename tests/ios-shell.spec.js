const { test, expect } = require('@playwright/test');

test('bundled iOS runtime uses native lifecycle without web update or PWA ownership', async ({ page }) => {
  const versionChecks = [];
  page.on('request', request => {
    if (/mode-atlas-version\.js\?check=/.test(request.url())) versionChecks.push(request.url());
  });

  await page.addInitScript(() => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
      Plugins: {
        FirebaseAuthentication: {
          signInWithGoogle: async () => ({
            user: null,
            credential: {
              providerId: 'google.com',
              idToken: 'simulated-native-id-token',
              accessToken: 'simulated-native-access-token'
            }
          }),
          signOut: async () => {}
        }
      }
    };
  });

  await page.goto('/kana/');
  await expect(page.locator('html')).toHaveAttribute('data-ma-env', 'native-ios');
  await expect(page.locator('html')).toHaveAttribute('data-ma-runtime', 'ios');
  expect(await page.evaluate(() => window.ModeAtlasDevConsoleLoader?.isEligible())).toBe(false);
  await expect(page.locator('[aria-label="Developer diagnostics"]')).toHaveCount(0);

  const state = await page.evaluate(async () => ({
    native: window.ModeAtlasEnv?.isNativeApp,
    firebaseWebAuthEnabled: window.ModeAtlasEnv?.canUseFirebase,
    authTransport: window.ModeAtlasEnv?.firebaseAuthTransport,
    platform: window.AtlasPlatform?.environment,
    capabilities: window.AtlasPlatform?.getCapabilities?.(),
    hasManifest: !!document.querySelector('link[rel="manifest"]'),
    dailyCheck: await window.ModeAtlasVersionFile?.runDailyCheck?.(),
    widgetPublish: await window.AtlasPlatform?.publishWidgetSnapshot?.({ streak: 1 })
  }));

  expect(state.native).toBe(true);
  expect(state.firebaseWebAuthEnabled).toBe(true);
  expect(state.authTransport).toBe('native-provider-web-session');
  expect(state.platform).toBe('ios');
  expect(state.capabilities.authentication).toBe(true);
  expect(state.capabilities.authProviders).toEqual(['google.com']);
  expect(state.hasManifest).toBe(false);
  expect(state.dailyCheck?.skipped).toBe('native-bundle');
  expect(state.widgetPublish).toBe(false);
  expect(versionChecks).toHaveLength(0);
  await expect(page.locator('#maInstallPrompt')).toHaveCount(0);
});

test('native launch links reach shared practice setup and ignore foreign callbacks', async ({ page }) => {
  await page.addInitScript(() => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
      Plugins: {
        App: {
          addListener: (_name, callback) => { window.modeAtlasOpenUrl = callback; },
          getLaunchUrl: async () => ({ url: 'modeatlas://open/reading?mode=daily' })
        }
      }
    };
  });
  await page.goto('/kana/');
  await expect(page).toHaveURL(/\/reading\/?$/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('settings') || '{}').dailyChallenge)).toBe(true);

  await Promise.all([
    page.waitForEvent('framenavigated'),
    page.evaluate(() => window.modeAtlasOpenUrl({ url: 'modeatlas://open/reading?mode=review' }))
  ]);
  await page.waitForLoadState('domcontentloaded');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('settings') || '{}').focusWeak)).toBe(true);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('settings') || '{}').dailyChallenge)).toBe(false);

  const currentUrl = page.url();
  await page.evaluate(() => window.modeAtlasOpenUrl({ url: 'com.googleusercontent.apps.example:/oauth?mode=daily' }));
  expect(page.url()).toBe(currentUrl);
  expect(await page.evaluate(() => window.AtlasPlatform.destinationFromUrl('https://evil.example/reading/?mode=daily'))).toBe('');
  expect(await page.evaluate(() => window.AtlasPlatform.destinationFromUrl('modeatlas://open/wordbank'))).toBe('wordBank');
});

test('iOS study tabs navigate while the website keeps its original navigation', async ({ page }) => {
  await page.goto('/privacy/');
  await expect(page.locator('.ma-ios-tabs')).toHaveCount(0);
  await expect(page.locator('.ma-nav__links')).toBeVisible();
  expect(await page.evaluate(() => [...document.querySelectorAll('style')].some(style => style.textContent.includes('@view-transition{navigation:auto}')))).toBe(false);

  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} };
    localStorage.setItem('modeAtlasOnboardingComplete', 'true');
    localStorage.setItem('modeAtlasKanaSetupComplete', 'true');
  });
  await page.goto('/privacy/');
  await expect(page.locator('.ma-ios-tabs .ma-ios-tab')).toHaveCount(5);
  await expect(page.locator('.ma-ios-tab[href="/wordbank/"]')).toHaveCount(1);
  expect(await page.evaluate(() => [...document.querySelectorAll('style')].some(style => style.textContent.includes('@view-transition{navigation:auto}')))).toBe(true);
  await expect(page.locator('.ma-ios-tab[aria-current="page"]')).toHaveCount(0);
  await expect(page.locator('.ma-nav__links')).toBeHidden();
  await page.locator('.ma-ios-tab[href="/reading/"]').click();
  await expect(page).toHaveURL(/\/reading\/?$/);
  await expect(page.locator('.ma-ios-tab[aria-current="page"]')).toHaveText('読Reading');
  await expect(page.locator('.ma-ios-tabs')).toBeVisible();
  await expect(page.locator('.ma-nav')).toBeHidden();
  await expect(page.locator('.ma-ios-tabs #profileOpenBtn')).toHaveCount(1);
  await expect(page.locator('.ma-ios-tabs #profileOpenBtn')).toHaveAttribute('aria-label', 'Open profile');
  await expect(page.locator('.ma-ios-tabs [data-settings-open]')).toHaveCount(1);
  await expect(page.locator('.ma-ios-tabs #modifiersTab')).toBeVisible();
  await expect(page.locator('.ma-ios-tabs #modifiersTab')).toContainText('Practice setup');
  await expect(page.locator('.bottom-shell.ma-modifiers-only .tab-row')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-ma-native-warm', 'true');

  const layout = await page.evaluate(() => {
    const dock = document.querySelector('.ma-ios-tabs').getBoundingClientRect();
    const setup = document.querySelector('.bottom-shell.ma-modifiers-only').getBoundingClientRect();
    return { setupBottom:setup.bottom, dockTop:dock.top };
  });
  expect(layout.setupBottom).toBeLessThanOrEqual(layout.dockTop + 1);
  await page.locator('.ma-ios-tabs #modifiersTab').click();
  await expect(page.locator('#modifiersContent')).toBeVisible();
  await expect(page.locator('.ma-ios-tabs #modifiersTab')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.ma-ios-tabs #modifiersTab').click();
  await expect(page.locator('#modifiersContent')).toBeHidden();

  await page.evaluate(() => document.getElementById('studyNavHideBtn').click());
  await expect(page.locator('.ma-ios-tabs #studyNavShowBtn')).toBeVisible();
  await expect(page.locator('.ma-ios-tabs__links')).toBeHidden();
  await page.locator('.ma-ios-tabs #studyNavShowBtn').click();
  await page.locator('.ma-ios-tab[href="/"]').click();
  await expect(page.locator('.ma-ios-tabs__title')).toHaveText('Mode Atlas');
});
