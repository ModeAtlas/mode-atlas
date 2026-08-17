const { test, expect } = require('@playwright/test');

const READING_SETTINGS = {
  focusWeak: false,
  dakuten: false,
  yoon: false,
  extendedKatakana: false,
  hint: false,
  srs: false,
  mobileMode: false,
  endless: false,
  timeTrial: false,
  speedRun: false,
  dailyChallenge: false,
  testMode: false,
  comboKana: false,
  comboMode: 'random',
  hiraganaRows: ['h_a'],
  katakanaRows: [],
  statsVisible: true,
  scoresVisible: true,
  activeBottomTab: null
};

const WRITING_SETTINGS = {
  ...READING_SETTINGS,
  keyboardMode: false,
  keyboardInputType: 'kana',
  choiceCount: 4
};

async function seedStableLocalState(page) {
  await page.addInitScript(({ readingSettings, writingSettings }) => {
    try {
      if (localStorage.getItem('modeAtlasSmokeSeeded') === '1') return;
      localStorage.clear();
      localStorage.setItem('modeAtlasSmokeSeeded', '1');
      localStorage.setItem('modeAtlasStarterSeen', 'true');
      localStorage.setItem('modeAtlasOnboardingComplete', 'true');
      localStorage.setItem('modeAtlasKanaSetupComplete', 'true');
      localStorage.setItem('modeAtlasLegalAccepted', 'true');
      localStorage.setItem('modeAtlasLegalAcceptedAt', String(Date.now()));
      localStorage.setItem('modeAtlasLegalVersion', '2026-05');
      localStorage.setItem('maWhatsNewSeen', 'smoke');
      localStorage.setItem('settings', JSON.stringify(readingSettings));
      localStorage.setItem('reverseSettings', JSON.stringify(writingSettings));
      localStorage.setItem('charStats', JSON.stringify({}));
      localStorage.setItem('reverseCharStats', JSON.stringify({}));
      localStorage.setItem('charTimes', JSON.stringify({}));
      localStorage.setItem('reverseCharTimes', JSON.stringify({}));
      localStorage.setItem('charSrs', JSON.stringify({}));
      localStorage.setItem('reverseCharSrs', JSON.stringify({}));
      localStorage.setItem('scoreHistory', JSON.stringify({ endlessBest: { total: 0, correct: 0, wrong: 0 }, speedRunTop3: [], comboKanaBest: { same_row: 0, random: 0 }, timeTrialTop3: [] }));
      localStorage.setItem('reverseScoreHistory', JSON.stringify({ endlessBest: { total: 0, correct: 0, wrong: 0 }, speedRunTop3: [], comboKanaBest: { same_row: 0, random: 0 }, timeTrialTop3: [] }));
      localStorage.setItem('dailyChallengeHistory', JSON.stringify({}));
      localStorage.setItem('reverseDailyChallengeHistory', JSON.stringify({}));
      localStorage.setItem('highScore', '0');
      localStorage.setItem('reverseHighScore', '0');
    } catch (error) {
      // Initial about:blank documents may not allow localStorage. The app-origin page will.
    }
  }, { readingSettings: READING_SETTINGS, writingSettings: WRITING_SETTINGS });
}

async function gotoApp(page, path) {
  await page.route(/https:\/\/(www\.)?gstatic\.com\/.*/, route => route.abort());
  await page.route(/https:\/\/(www\.)?googleapis\.com\/.*/, route => route.abort());
  await page.goto(path, { waitUntil: 'commit', timeout: 5000 });
  await page.waitForSelector('body', { timeout: 5000 });
  await page.waitForTimeout(1000);
}

async function expectNoSevereConsoleErrors(page, run) {
  const severe = [];
  page.on('pageerror', error => severe.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') severe.push(message.text());
  });

  await run();

  const ignored = severe.filter(text => {
    // Firebase/network errors should not fail local static smoke tests when no real auth is configured.
    return !/firebase|firestore|auth|network|Failed to load resource|ERR_/i.test(text);
  });

  expect(ignored, `Unexpected browser errors:\n${ignored.join('\n')}`).toEqual([]);
}

test.describe('Mode Atlas core smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await seedStableLocalState(page);
  });

  test('home, kana hub, and results pages load key UI', async ({ page }) => {
    await expectNoSevereConsoleErrors(page, async () => {
      await gotoApp(page, '/');
      await expect(page.locator('#profileOpenBtn')).toBeVisible();
      await expect(page.locator('#branches')).toBeVisible();

      await gotoApp(page, '/kana/');
      await expect(page.locator('#mainContent.kana-hub')).toBeVisible();
      await expect(page.locator('#kanaContinueAction')).toBeVisible();
      await expect(page.locator('#kanaMasteryGrid')).toBeVisible();

      await gotoApp(page, '/results/');
      await expect(page.locator('#testsGrid')).toBeVisible();
      await expect(page.locator('#testHeatmap')).toBeVisible();
    });
  });

  test('Atlas to Kana uses the real navigation button and keeps a clean URL', async ({ page }) => {
    await expectNoSevereConsoleErrors(page, async () => {
      await gotoApp(page, '/');
      await Promise.all([
        page.waitForURL(/\/kana\/$/, { timeout: 7500, waitUntil: 'commit' }),
        page.locator('a.atlas-product__action[href="/kana/"]').click({ noWaitAfter: true }),
      ]);
      await expect(page.locator('#mainContent.kana-hub')).toBeVisible({ timeout: 5000 });
      const url = new URL(page.url());
      expect(url.pathname).toBe('/kana/');
      expect(url.searchParams.has('build')).toBe(false);
      expect(url.searchParams.has('v')).toBe(false);
      expect(url.searchParams.has('reload')).toBe(false);
    });
  });

  test('Settings update check survives click bursts and tab switching does not blank the app', async ({ page, context }) => {
    await expectNoSevereConsoleErrors(page, async () => {
      await gotoApp(page, '/kana/');
      await expect(page.locator('#mainContent.kana-hub')).toBeVisible();

      const settingsButton = page.locator('[data-settings-open]:visible').first();
      const settingsDrawer = page.locator('#settingsDrawer');
      await expect(settingsDrawer).toBeAttached({ timeout: 5000 });
      await expect(settingsButton).toBeVisible();
      await expect(settingsButton).toHaveAttribute('data-settings-bound', 'shared', { timeout: 5000 });
      await settingsButton.click();
      await expect(settingsDrawer).toBeVisible();

      const updateButton = page.locator('#maCheckUpdatesBtn');
      const updateStatus = page.locator('#maUpdateStatus');
      await expect(updateButton).toBeVisible();
      await updateButton.click();
      await expect(updateStatus).toContainText('You are up to date', { timeout: 6000 });
      await expect(updateButton).toBeEnabled();

      await page.evaluate(() => {
        const button = document.getElementById('maCheckUpdatesBtn');
        for (let i = 0; i < 40; i += 1) button?.click();
      });
      await page.waitForTimeout(150);
      await expect(updateButton).toBeEnabled();
      await expect(updateStatus).toContainText('You are up to date');

      const otherTab = await context.newPage();
      await otherTab.goto('about:blank');
      await otherTab.bringToFront();
      await page.waitForTimeout(150);
      await page.bringToFront();
      await expect(page.locator('#mainContent.kana-hub')).toBeVisible();
      await otherTab.close();
    });
  });

  test('reading trainer starts, session controls work, and session can end', async ({ page }) => {
    await expectNoSevereConsoleErrors(page, async () => {
      await gotoApp(page, '/reading/');

      await expect(page.locator('#hiragana')).toBeVisible();
      await expect(page.locator('#heatmap .cell').first()).toBeVisible();
      await page.locator('#modifiersTab').click();
      await expect(page.locator('#modifiersContent')).toHaveClass(/open/);
      await page.locator('#modifiersTab').click();
      await expect(page.locator('#modifiersContent')).not.toHaveClass(/open/);
      await page.locator('#startBtn').click();

      await expect(page.locator('#sessionActions')).toBeVisible();
      await expect(page.locator('#skipKanaBtn')).toBeVisible();
      await expect(page.locator('#pauseSessionBtn')).toBeVisible();
      await expect(page.locator('#endSessionBtn')).toBeVisible();

      await page.locator('#pauseSessionBtn').click();
      await expect(page.locator('body')).toHaveClass(/ma-session-paused/);
      await expect(page.locator('#pauseSessionBtn [data-ma-pause-label]')).toHaveText('Resume');
      await expect(page.locator('#input')).toBeDisabled();

      await page.locator('#pauseSessionBtn').click();
      await expect(page.locator('body')).not.toHaveClass(/ma-session-paused/);

      await page.locator('#skipKanaBtn').click();
      await expect(page.locator('#hint')).toContainText('Answer:', { timeout: 3000 });

      await page.locator('#endSessionBtn').click();
      await expect(page.locator('.ma-dialog-layer.is-open .ma-session-dialog-content')).toBeVisible();
    });
  });

  test('writing trainer starts, choice buttons answer, and session can end', async ({ page }) => {
    await expectNoSevereConsoleErrors(page, async () => {
      await gotoApp(page, '/writing/');

      await expect(page.locator('#prompt')).toBeVisible();
      await page.locator('#startBtn').click();

      await expect(page.locator('#sessionActions')).toBeVisible();
      await expect(page.locator('#choiceGrid button')).toHaveCount(4);

      await page.locator('#choiceGrid button').first().click();
      await expect(page.locator('#choiceGrid')).toBeVisible();

      await page.locator('#endSessionBtn').click();
      await expect(page.locator('.ma-dialog-layer.is-open .ma-session-dialog-content')).toBeVisible();
    });
  });

  test('Word Bank Add stays on the page and persists a new kana entry', async ({ page }) => {
    await expectNoSevereConsoleErrors(page, async () => {
      await gotoApp(page, '/wordbank/');
      await page.locator('#wordBankAddJumpBtn').click();
      const input = page.locator('#kanaInput');
      const add = page.locator('#addWordBtn');
      await expect(input).toBeVisible();
      await expect(add).toBeEnabled();
      await input.fill('ねこ');
      await add.click();
      await expect(page).toHaveURL(/\/wordbank\/$/);
      await expect(page.locator('details.wordbank-entry[data-id]').filter({ hasText: 'ねこ' }).first()).toBeVisible();
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kanaWordBank') || '[]'));
      expect(stored.some(item => item && item.kana === 'ねこ')).toBe(true);
    });
  });

  test('Light appearance persists across fresh page documents', async ({ page }) => {
    await expectNoSevereConsoleErrors(page, async () => {
      await gotoApp(page, '/kana/');
      await page.locator('[data-settings-open]:visible').first().click();
      await page.locator('[data-ma-theme-choice="light"]').click();
      await expect(page.locator('html')).toHaveAttribute('data-ma-theme', 'light');

      await gotoApp(page, '/wordbank/');
      await expect(page.locator('html')).toHaveAttribute('data-ma-theme', 'light');
      await gotoApp(page, '/results/');
      await expect(page.locator('html')).toHaveAttribute('data-ma-theme', 'light');
    });
  });

  test('mobile profile and settings drawers open and close', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await expectNoSevereConsoleErrors(page, async () => {
      await gotoApp(page, '/kana/');

      const profileTrigger = page.locator('#profileOpenBtn');
      await profileTrigger.click();
      const profileDrawer = page.locator('#profileDrawer');
      await expect(profileDrawer).toBeVisible();
      await expect(page.locator('#profileCloseBtn')).toBeFocused();
      await page.locator('#profileCloseBtn').click();
      await expect(profileDrawer).toHaveAttribute('aria-hidden', 'true');
      await expect(profileDrawer).not.toHaveClass(/\bopen\b/);
      await expect(page.locator('body')).not.toHaveClass(/profile-open/);
      await expect(profileTrigger).toBeFocused();

      const settingsButton = page.locator('[data-settings-open]:visible').first();
      await settingsButton.click();
      const settingsDrawer = page.locator('#settingsDrawer');
      await expect(settingsDrawer).toBeVisible();
      await expect(page.locator('#settingsCloseBtn')).toBeFocused();

      await page.locator('#settingsCloseBtn').click();
      await expect(settingsDrawer).toHaveAttribute('aria-hidden', 'true');
      await expect(settingsDrawer).not.toHaveClass(/\bopen\b/);
      await expect(page.locator('body')).not.toHaveClass(/settings-open/);
      await expect(settingsButton).toBeFocused();
    });
  });

  test('phone navigation, idle trainer, and explicit Tablet drawers stay inside their layouts', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoSevereConsoleErrors(page, async () => {
      await gotoApp(page, '/wordbank/');
      await expect(page.locator('body')).toHaveAttribute('data-effective-display-mode', 'phone');

      const phoneNav = await page.evaluate(() => {
        const nav = document.querySelector('.ma-nav');
        const links = nav?.querySelector('.ma-nav__links');
        const actions = nav?.querySelector('.ma-nav__actions');
        if (!nav || !links || !actions) return null;
        const nr = nav.getBoundingClientRect();
        const lr = links.getBoundingClientRect();
        const ar = actions.getBoundingClientRect();
        const overlaps = lr.left < ar.right && lr.right > ar.left && lr.top < ar.bottom && lr.bottom > ar.top;
        const controls = [...links.children, ...actions.children].map(node => node.getBoundingClientRect());
        return {
          overlaps,
          contained: controls.every(rect => rect.left >= nr.left - 1 && rect.right <= nr.right + 1),
          linksBelowActions: lr.top >= ar.bottom - 1
        };
      });
      expect(phoneNav).not.toBeNull();
      expect(phoneNav.overlaps).toBe(false);
      expect(phoneNav.contained).toBe(true);
      expect(phoneNav.linksBelowActions).toBe(true);

      const phoneNavMetrics = await page.locator('.ma-nav').evaluate((nav) => {
        const rect = nav.getBoundingClientRect();
        const links = [...nav.querySelectorAll('.ma-nav__links > *')].map((node) => node.getBoundingClientRect().width);
        return { height: rect.height, linkWidths: links };
      });
      expect(phoneNavMetrics.height).toBeLessThanOrEqual(112);
      expect(phoneNavMetrics.linkWidths.every(width => width >= 54)).toBe(true);

      await gotoApp(page, '/');
      const homeFirstScreen = await page.evaluate(() => {
        const primary = document.querySelector('.atlas-primary-action');
        const readingPreview = document.querySelector('.atlas-preview--reading');
        const secondaryPreviews = [...document.querySelectorAll('.atlas-preview--words,.atlas-preview--writing')];
        return {
          primaryBottom: primary?.getBoundingClientRect().bottom || Infinity,
          readingPreviewDisplay: readingPreview ? getComputedStyle(readingPreview).display : 'none',
          secondaryHidden: secondaryPreviews.every(node => getComputedStyle(node).display === 'none'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      expect(homeFirstScreen.primaryBottom).toBeLessThan(844);
      expect(homeFirstScreen.readingPreviewDisplay).not.toBe('none');
      expect(homeFirstScreen.secondaryHidden).toBe(true);
      expect(homeFirstScreen.overflow).toBeLessThanOrEqual(1);

      await gotoApp(page, '/kana/');
      const kanaFirstScreen = await page.evaluate(() => {
        const action = document.querySelector('.kana-primary-action');
        const visual = document.querySelector('.kana-hero-visual');
        return {
          actionBottom: action?.getBoundingClientRect().bottom || Infinity,
          visualHidden: visual ? getComputedStyle(visual).display === 'none' : false,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      expect(kanaFirstScreen.actionBottom).toBeLessThan(844);
      expect(kanaFirstScreen.visualHidden).toBe(true);
      expect(kanaFirstScreen.overflow).toBeLessThanOrEqual(1);

      await gotoApp(page, '/reading/');
      const idleTrainer = await page.evaluate(() => {
        const card = document.querySelector('.ma-trainer-card');
        const style = card ? getComputedStyle(card) : null;
        const hud = document.querySelector('.ma-session-hud');
        const prompt = document.querySelector('.ma-trainer-prompt-wrap');
        const start = document.querySelector('#startBtn');
        return style ? {
          paddingBottom: parseFloat(style.paddingBottom),
          minHeight: parseFloat(style.minHeight) || 0,
          hudHidden: hud ? getComputedStyle(hud).display === 'none' : false,
          promptHidden: prompt ? getComputedStyle(prompt).display === 'none' : false,
          startBottom: start?.getBoundingClientRect().bottom || Infinity,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        } : null;
      });
      expect(idleTrainer).not.toBeNull();
      expect(idleTrainer.paddingBottom).toBeLessThanOrEqual(24);
      expect(idleTrainer.minHeight).toBe(0);
      expect(idleTrainer.hudHidden).toBe(true);
      expect(idleTrainer.promptHidden).toBe(true);
      expect(idleTrainer.startBottom).toBeLessThan(844);
      expect(idleTrainer.overflow).toBeLessThanOrEqual(1);
    });

    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.addInitScript(() => localStorage.setItem('modeAtlasDisplayMode', 'tablet'));
    await gotoApp(page, '/kana/');
    await expect(page.locator('body')).toHaveAttribute('data-effective-display-mode', 'tablet');

    await gotoApp(page, '/reading/');
    const tabletTrainer = await page.evaluate(() => {
      const card = document.querySelector('.ma-trainer-card');
      const records = document.querySelector('.ma-trainer-side-panel.left-panel');
      if (!card || !records) return null;
      const cardRect = card.getBoundingClientRect();
      const recordsRect = records.getBoundingClientRect();
      return {
        cardWidth: cardRect.width,
        recordsBesideCard: recordsRect.left >= cardRect.right - 1,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    expect(tabletTrainer).not.toBeNull();
    expect(tabletTrainer.cardWidth).toBeGreaterThanOrEqual(700);
    expect(tabletTrainer.recordsBesideCard).toBe(true);
    expect(tabletTrainer.overflow).toBeLessThanOrEqual(1);

    await gotoApp(page, '/kana/');
    const readDrawerMetrics = (selector) => page.locator(selector).evaluate((drawer) => {
      const rect = drawer.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        horizontalOverflow: drawer.scrollWidth - drawer.clientWidth
      };
    });

    const assertDrawerFits = async (selector) => {
      const drawer = page.locator(selector);
      await expect(drawer).toHaveClass(/\bopen\b/);
      // Visibility becomes true as soon as the off-canvas drawer starts its
      // transition. Wait for the shared drawer animation to finish inside the
      // viewport before validating its final geometry.
      await expect.poll(async () => {
        const metrics = await readDrawerMetrics(selector);
        return metrics.right <= metrics.viewportWidth + 1;
      }, { timeout: 1500 }).toBe(true);

      const metrics = await readDrawerMetrics(selector);
      expect(metrics.left).toBeGreaterThanOrEqual(0);
      expect(metrics.top).toBeGreaterThanOrEqual(0);
      expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
      expect(metrics.width).toBeLessThanOrEqual(620);
      expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
    };

    const settingsTrigger = page.locator('[data-settings-open]:visible').first();
    await settingsTrigger.click();
    await expect(page.locator('#settingsDrawer')).toBeVisible();
    await assertDrawerFits('#settingsDrawer');
    await page.locator('#settingsCloseBtn').click();

    const profileTrigger = page.locator('#profileOpenBtn');
    await profileTrigger.click();
    await expect(page.locator('#profileDrawer')).toBeVisible();
    await assertDrawerFits('#profileDrawer');
    await page.locator('#profileCloseBtn').click();
  });
});
