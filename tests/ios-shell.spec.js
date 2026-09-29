const { test, expect } = require('@playwright/test');

test('Atlas home is compact on iOS and retains the website layout in the browser', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.atlas-hero')).toBeVisible();
  await expect(page.locator('.atlas-ios-home')).toBeHidden();
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} };
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ma-runtime', 'ios');
  await expect(page.locator('.atlas-ios-home')).toBeVisible();
  await expect(page.locator('.atlas-hero')).toBeHidden();
  await expect(page.locator('#iosHomeContinue')).toHaveAttribute('href', '/reading/');
  await expect(page.locator('.atlas-ios-home__choices a')).toHaveCount(2);
});

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
    localStorage.setItem('modeAtlasStarterSeen', 'true');
    localStorage.setItem('modeAtlasOnboardingComplete', 'true');
    localStorage.setItem('modeAtlasKanaSetupComplete', 'true');
    localStorage.setItem('modeAtlasLegalAccepted', 'true');
    localStorage.setItem('modeAtlasLegalAcceptedAt', String(Date.now()));
    localStorage.setItem('modeAtlasLegalVersion', '2026-05');
  });
  await page.goto('/privacy/');
  await expect(page.locator('.ma-ios-tabs__links .ma-ios-tab')).toHaveCount(3);
  await expect(page.locator('.ma-ios-tab[href="/wordbank/"]')).toHaveCount(1);
  expect(await page.evaluate(() => [...document.querySelectorAll('style')].some(style => style.textContent.includes('@view-transition{navigation:auto}')))).toBe(true);
  await expect(page.locator('.ma-ios-tab[aria-current="page"]')).toHaveCount(0);
  await expect(page.locator('.ma-nav__links')).toBeHidden();
  await page.locator('.ma-ios-tab[href="/kana/"]').click();
  await expect(page).toHaveURL(/\/kana\/?$/);
  await page.locator('.ma-dialog-layer.is-open').waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
  if (await page.locator('.ma-dialog-layer.is-open').isVisible()) {
    await page.locator('.ma-dialog__close').click();
    await expect(page.locator('.ma-ios-tab[href="/kana/"]')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('.ma-ios-tab[href="/kana/"]').click();
  }
  await expect(page.locator('.ma-ios-tab[href="/kana/"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.ma-ios-kana-menu .ma-ios-tab[href]')).toHaveCount(3);
  await expect(page.locator('.ma-ios-tabs__rail')).toHaveClass(/is-kana-open/);
  await page.locator('.ma-ios-kana-back').click();
  await expect(page.locator('.ma-ios-tabs__rail')).not.toHaveClass(/is-kana-open/);
  await page.locator('.ma-ios-tab[href="/kana/"]').click();
  await page.locator('.ma-ios-kana-menu .ma-ios-tab[href="/reading/"]').click();
  await expect(page).toHaveURL(/\/reading\/?$/);
  await expect(page.locator('.ma-ios-kana-menu .ma-ios-tab[aria-current="page"]')).toContainText('Reading');
  await expect(page.locator('.ma-ios-tabs__links .ma-ios-tab.is-active')).toContainText('Kana');
  await expect(page.locator('.ma-ios-tabs')).toBeVisible();
  await expect(page.locator('.ma-nav')).toBeHidden();
  await expect(page.locator('.ma-ios-tabs #profileOpenBtn')).toHaveCount(1);
  await expect(page.locator('.ma-ios-tabs #profileOpenBtn')).toHaveAttribute('aria-label', /^Open profile/);
  await expect(page.locator('.ma-ios-tabs [data-settings-open]')).toHaveCount(1);
  await page.locator('.ma-ios-tabs #profileOpenBtn').click();
  await expect(page.locator('#profileDrawer')).toHaveClass(/open/);
  await page.locator('.ma-ios-tabs #profileOpenBtn').click();
  await expect(page.locator('#profileDrawer')).not.toHaveClass(/open/);
  await page.locator('.ma-ios-tabs [data-settings-open]').click();
  await expect(page.locator('#settingsDrawer')).toHaveClass(/open/);
  await page.locator('.ma-ios-tabs [data-settings-open]').click();
  await expect(page.locator('#settingsDrawer')).not.toHaveClass(/open/);
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
  await page.locator('.ma-ios-kana-back').click();
  await page.locator('.ma-ios-tabs__links .ma-ios-tab[href="/"]').click();
  await expect(page.locator('.ma-ios-tabs__title')).toHaveText('Mode Atlas');
});

test('native Reading uses a compact answer keyboard while the website keeps text entry', async ({ page }) => {
  await page.goto('/reading/');
  await expect(page.locator('.ma-ios-reading-keyboard')).toHaveCount(0);
  await page.addInitScript(() => {
    window.modeAtlasHapticCalls = [];
    window.Capacitor = {
      isNativePlatform: () => true, getPlatform: () => 'ios',
      Plugins: { Haptics: { impact: async options => { window.modeAtlasHapticCalls.push(options.style); } } }
    };
    localStorage.setItem('modeAtlasStarterSeen', 'true');
    localStorage.setItem('modeAtlasOnboardingComplete', 'true');
    localStorage.setItem('modeAtlasKanaSetupComplete', 'true');
    localStorage.setItem('modeAtlasLegalAccepted', 'true');
    localStorage.setItem('modeAtlasLegalAcceptedAt', String(Date.now()));
    localStorage.setItem('modeAtlasLegalVersion', '2026-05');
  });
  await page.goto('/reading/');
  await expect(page.locator('#input')).toHaveJSProperty('readOnly', true);
  await page.locator('#startBtn').click();
  await expect(page.locator('.ma-ios-reading-keyboard')).toBeVisible();
  await expect(page.locator('.ma-ios-tabs')).toBeHidden();
  await expect(page.locator('.ma-ios-reading-keyboard__key')).toHaveCount(27);
  const answer = await page.evaluate(() => getAnswerForCurrentChar());
  expect(answer).toMatch(/^[a-z]+$/);
  for (const letter of answer) await page.locator(`.ma-ios-reading-keyboard__key[data-key="${letter}"]`).click();
  await expect(page.locator('#streak')).toHaveText('1');
  expect(await page.locator('.ma-ios-reading-keyboard__key').first().evaluate(key => key.getBoundingClientRect().height)).toBeGreaterThanOrEqual(58);
  expect(await page.evaluate(() => window.modeAtlasHapticCalls)).toEqual(Array(answer.length).fill('LIGHT'));
});

test('native trainer page background follows the app theme after the splash', async ({ page }) => {
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} };
  });
  for (const route of ['/reading/', '/writing/']) {
    await page.goto(route);
    const colors = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--ma-app-bg)';
      document.body.appendChild(probe);
      const result = {
        document: getComputedStyle(document.documentElement).backgroundColor,
        theme: getComputedStyle(probe).backgroundColor
      };
      probe.remove();
      return result;
    });
    expect(colors.document).toBe(colors.theme);
  }
});
