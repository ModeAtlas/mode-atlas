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

async function seedStableState(page) {
  await page.addInitScript((readingSettings) => {
    localStorage.clear();
    localStorage.setItem('modeAtlasStarterSeen', 'true');
    localStorage.setItem('modeAtlasOnboardingComplete', 'true');
    localStorage.setItem('modeAtlasKanaSetupComplete', 'true');
    localStorage.setItem('modeAtlasLegalAccepted', 'true');
    localStorage.setItem('modeAtlasLegalAcceptedAt', String(Date.now()));
    localStorage.setItem('modeAtlasLegalVersion', '2026-05');
    localStorage.setItem('maWhatsNewSeen', 'smoke');
    localStorage.setItem('settings', JSON.stringify(readingSettings));
    localStorage.setItem('reverseSettings', JSON.stringify({
      ...readingSettings,
      keyboardMode: false,
      keyboardInputType: 'kana',
      choiceCount: 4
    }));
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
  }, READING_SETTINGS);
}

async function gotoApp(page, path) {
  await page.route(/https:\/\/(www\.)?gstatic\.com\/.*/, route => route.abort());
  await page.route(/https:\/\/(www\.)?googleapis\.com\/.*/, route => route.abort());
  await page.goto(path, { waitUntil: 'commit', timeout: 5000 });
  await page.waitForSelector('body', { timeout: 5000 });
  await page.waitForTimeout(700);
}

function columnCount(template) {
  return String(template || '').trim().split(/\s+/).filter(Boolean).length;
}

test.describe('Phone and Tablet study UX', () => {
  test.beforeEach(async ({ page }) => {
    await seedStableState(page);
  });

  test('Phone navigation exposes Focus Mode and Kana Trainer opens as a disclosure before navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, '/reading/');
    await expect(page.locator('body')).toHaveAttribute('data-effective-display-mode', 'phone');

    const focus = page.locator('#studyNavHideBtn');
    await expect(focus).toBeVisible();
    const navGeometry = await page.evaluate(() => {
      const nav = document.querySelector('.ma-nav').getBoundingClientRect();
      const brand = document.querySelector('.ma-nav__brand').getBoundingClientRect();
      const actions = document.querySelector('.ma-nav__actions').getBoundingClientRect();
      const button = document.getElementById('studyNavHideBtn').getBoundingClientRect();
      return {
        focusContained: button.left >= nav.left - 1 && button.right <= nav.right + 1 && button.top >= nav.top - 1 && button.bottom <= nav.bottom + 1,
        firstRowClear: brand.right <= actions.left + 1
      };
    });
    expect(navGeometry.focusContained).toBe(true);
    expect(navGeometry.firstRowClear).toBe(true);

    await focus.click();
    await expect(page.locator('body')).toHaveClass(/study-nav-hidden/);
    await expect(page.locator('#studyNavShowBtn')).toBeVisible();
    await page.locator('#studyNavShowBtn').click();
    await expect(page.locator('body')).not.toHaveClass(/study-nav-hidden/);

    const trigger = page.locator('[data-ma-kana-menu-trigger]');
    await trigger.click({ noWaitAfter: true });
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#maKanaMenu')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/reading/');

    await Promise.all([
      page.waitForURL(/\/writing\/$/, { timeout: 5000, waitUntil: 'commit' }),
      page.locator('[data-ma-kana-nav-item="writing"]').click({ noWaitAfter: true })
    ]);
    expect(new URL(page.url()).pathname).toBe('/writing/');
  });

  test('Phone Practice Setup stacks groups, sizes controls safely, and clears the fixed setup bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, '/reading/');
    await page.locator('#modifiersTab').click();
    await expect(page.locator('#modifiersContent')).toHaveClass(/open/);

    const setup = await page.evaluate(() => {
      const root = document.querySelector('#modifierOptions.ma-structured-modifiers');
      const buttons = root ? [...root.querySelectorAll('button')] : [];
      const groups = root ? [...root.querySelectorAll('.ma-modifier-group')] : [];
      return {
        rootFound: !!root,
        stillGenericGrid: root?.classList.contains('button-grid') || false,
        columns: root ? getComputedStyle(root).gridTemplateColumns : '',
        controlsFit: buttons.every((button) => {
          const rect = button.getBoundingClientRect();
          return button.scrollWidth <= button.clientWidth + 1 && rect.width >= 100 && rect.height >= 48;
        }),
        groupsFit: groups.every((group) => group.scrollWidth <= group.clientWidth + 1)
      };
    });
    expect(setup.rootFound).toBe(true);
    expect(setup.stillGenericGrid).toBe(false);
    expect(columnCount(setup.columns)).toBe(1);
    expect(setup.controlsFit).toBe(true);
    expect(setup.groupsFit).toBe(true);

    await page.locator('#modifiersTab').click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(100);
    const clearance = await page.evaluate(() => {
      const bar = document.querySelector('.bottom-shell.ma-modifiers-only .tab-row');
      const panels = [...document.querySelectorAll('.ma-trainer-side-panel')];
      const panelBottom = Math.max(...panels.map(panel => panel.getBoundingClientRect().bottom));
      return bar.getBoundingClientRect().top - panelBottom;
    });
    expect(clearance).toBeGreaterThanOrEqual(6);
  });

  test('Phone Reading session reframes the kana and input after a keyboard-sized viewport change', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, '/reading/');
    await page.locator('#startBtn').click();
    await expect(page.locator('body')).toHaveClass(/trainer-session-active/);
    await expect(page.locator('#input')).toBeFocused();

    // Chromium cannot summon an iOS software keyboard in CI. Shrinking the visual
    // viewport exercises the same resize/reframe path used when Safari opens it.
    await page.setViewportSize({ width: 390, height: 520 });
    await page.waitForTimeout(350);

    const frame = await page.evaluate(() => {
      const prompt = document.querySelector('.ma-trainer-prompt-wrap').getBoundingClientRect();
      const kana = document.getElementById('hiragana').getBoundingClientRect();
      const input = document.getElementById('input').getBoundingClientRect();
      const viewportTop = Number(window.visualViewport?.offsetTop || 0);
      const viewportHeight = Number(window.visualViewport?.height || window.innerHeight);
      return {
        promptTop: prompt.top,
        kanaTop: kana.top,
        inputBottom: input.bottom,
        viewportTop,
        viewportBottom: viewportTop + viewportHeight
      };
    });
    expect(frame.promptTop).toBeGreaterThanOrEqual(frame.viewportTop - 3);
    expect(frame.kanaTop).toBeGreaterThanOrEqual(frame.viewportTop - 3);
    expect(frame.inputBottom).toBeLessThanOrEqual(frame.viewportBottom + 3);
  });

  test('Tablet Practice Setup uses two comfortable columns and keeps Focus Mode available', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(() => localStorage.setItem('modeAtlasDisplayMode', 'tablet'));
    await gotoApp(page, '/reading/');
    await expect(page.locator('body')).toHaveAttribute('data-effective-display-mode', 'tablet');
    await expect(page.locator('#studyNavHideBtn')).toBeVisible();

    await page.locator('#modifiersTab').click();
    const setup = await page.evaluate(() => {
      const root = document.querySelector('#modifierOptions.ma-structured-modifiers');
      const buttons = root ? [...root.querySelectorAll('button')] : [];
      return {
        columns: root ? getComputedStyle(root).gridTemplateColumns : '',
        controlsFit: buttons.every((button) => button.scrollWidth <= button.clientWidth + 1)
      };
    });
    expect(columnCount(setup.columns)).toBe(2);
    expect(setup.controlsFit).toBe(true);
  });
});
