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
      const label = document.querySelector('#studyNavHideBtn .ma-nav__action-label');
      return {
        focusContained: button.left >= nav.left - 1 && button.right <= nav.right + 1 && button.top >= nav.top - 1 && button.bottom <= nav.bottom + 1,
        firstRowClear: brand.right <= actions.left + 1,
        focusContentFits: document.getElementById('studyNavHideBtn').scrollWidth <= document.getElementById('studyNavHideBtn').clientWidth + 1,
        focusLabelHidden: label ? getComputedStyle(label).display === 'none' : true
      };
    });
    expect(navGeometry.focusContained).toBe(true);
    expect(navGeometry.firstRowClear).toBe(true);
    expect(navGeometry.focusContentFits).toBe(true);
    expect(navGeometry.focusLabelHidden).toBe(true);

    await focus.click();
    await expect(page.locator('body')).toHaveClass(/study-nav-hidden/);
    await expect(focus).toBeVisible();
    await expect(focus).toHaveAttribute('aria-label', 'Exit focus mode');
    await expect(page.locator('#studyNavShowBtn')).toBeVisible();
    await focus.click();
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

  test('Phone navigation reserves the top cleanly, hides downward, and requires deliberate upward travel to return', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, '/kana/');
    await expect(page.locator('body')).toHaveAttribute('data-effective-display-mode', 'phone');
    const nav = page.locator('.ma-nav');
    await expect(nav).toBeVisible();

    const topLayout = await page.evaluate(() => {
      const nav = document.querySelector('.ma-nav').getBoundingClientRect();
      const spacer = document.querySelector('[data-ma-nav-spacer]').getBoundingClientRect();
      const hero = document.querySelector('.kana-hub-hero').getBoundingClientRect();
      return {
        navTop: nav.top,
        navBottom: nav.bottom,
        spacerHeight: spacer.height,
        heroTop: hero.top
      };
    });
    expect(topLayout.navTop).toBeGreaterThanOrEqual(0);
    expect(topLayout.spacerHeight).toBeGreaterThanOrEqual(topLayout.navBottom + 8);
    expect(topLayout.heroTop).toBeGreaterThanOrEqual(topLayout.navBottom + 8);

    await page.evaluate(async () => {
      for (let y = 0; y <= 420; y += 6) {
        window.scrollTo(0, y);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    });
    await page.waitForTimeout(80);
    await expect(nav).toHaveClass(/ma-nav--scroll-hidden/);

    await page.evaluate(async () => {
      for (let y = 420; y >= 400; y -= 4) {
        window.scrollTo(0, y);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    });
    await page.waitForTimeout(80);
    await expect(nav).toHaveClass(/ma-nav--scroll-hidden/);

    await page.evaluate(async () => {
      for (let y = 400; y >= 348; y -= 4) {
        window.scrollTo(0, y);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    });
    await page.waitForTimeout(80);
    await expect(nav).not.toHaveClass(/ma-nav--scroll-hidden/);

    const visibleAtCurrentViewport = await nav.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        scrollY: window.scrollY
      };
    });
    expect(visibleAtCurrentViewport.scrollY).toBeGreaterThan(300);
    expect(visibleAtCurrentViewport.top).toBeGreaterThanOrEqual(0);
    expect(visibleAtCurrentViewport.top).toBeLessThan(24);

    await page.evaluate(async () => {
      for (let y = 348; y <= 372; y += 4) {
        window.scrollTo(0, y);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    });
    await page.waitForTimeout(80);
    await expect(nav).toHaveClass(/ma-nav--scroll-hidden/);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(nav).not.toHaveClass(/ma-nav--scroll-hidden/);
    await expect.poll(
      () => nav.evaluate((element) => element.getBoundingClientRect().top),
      { timeout: 1200 }
    ).toBeGreaterThanOrEqual(0);

    const returnedTop = await page.evaluate(() => {
      const nav = document.querySelector('.ma-nav').getBoundingClientRect();
      const hero = document.querySelector('.kana-hub-hero').getBoundingClientRect();
      return { navTop: nav.top, navBottom: nav.bottom, heroTop: hero.top };
    });
    expect(returnedTop.navTop).toBeGreaterThanOrEqual(0);
    expect(returnedTop.heroTop).toBeGreaterThanOrEqual(returnedTop.navBottom + 8);
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
      const controlMetrics = buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          text: button.textContent.trim().replace(/\s+/g, ' '),
          width: rect.width,
          height: rect.height,
          clientWidth: button.clientWidth,
          scrollWidth: button.scrollWidth,
          clientHeight: button.clientHeight,
          scrollHeight: button.scrollHeight
        };
      });
      return {
        rootFound: !!root,
        stillGenericGrid: root?.classList.contains('button-grid') || false,
        columns: root ? getComputedStyle(root).gridTemplateColumns : '',
        controlsFit: controlMetrics.every((control) =>
          control.scrollWidth <= control.clientWidth + 1 && control.width >= 100 && control.height >= 48
        ),
        controlMetrics,
        groupsFit: groups.every((group) => group.scrollWidth <= group.clientWidth + 1)
      };
    });
    expect(setup.rootFound).toBe(true);
    expect(setup.stillGenericGrid).toBe(false);
    expect(columnCount(setup.columns)).toBe(1);
    expect(setup.controlsFit, JSON.stringify(setup.controlMetrics.filter((control) =>
      control.scrollWidth > control.clientWidth + 1 || control.width < 100 || control.height < 48
    ), null, 2)).toBe(true);
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
      const hud = document.querySelector('.ma-session-hud').getBoundingClientRect();
      const prompt = document.querySelector('.ma-trainer-prompt-wrap').getBoundingClientRect();
      const kana = document.getElementById('hiragana').getBoundingClientRect();
      const input = document.getElementById('input').getBoundingClientRect();
      const viewportTop = Number(window.visualViewport?.offsetTop || 0);
      const viewportHeight = Number(window.visualViewport?.height || window.innerHeight);
      return {
        hudTop: hud.top,
        promptTop: prompt.top,
        kanaTop: kana.top,
        inputBottom: input.bottom,
        viewportTop,
        viewportBottom: viewportTop + viewportHeight
      };
    });
    expect(frame.hudTop).toBeGreaterThanOrEqual(frame.viewportTop - 3);
    expect(frame.promptTop).toBeGreaterThanOrEqual(frame.viewportTop - 3);
    expect(frame.kanaTop).toBeGreaterThanOrEqual(frame.viewportTop - 3);
    expect(frame.inputBottom).toBeLessThanOrEqual(frame.viewportBottom + 3);
  });

  test('Achievement detail uses the dialog close control as Back before dismissing', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoApp(page, '/kana/');
    await page.evaluate(() => window.ModeAtlasFeatures.openAchievements());
    const dialog = page.locator('[data-ma-dialog-layer]');
    await expect(dialog).toBeVisible();
    await page.locator('[data-ma-ach-id]').first().click();
    await expect(page.locator('.ma-ach-info-body')).toBeVisible();
    await expect(page.locator('[data-ma-feature-back]')).toHaveCount(0);
    await expect(page.getByText(/^Back$/)).toHaveCount(0);

    await page.locator('.ma-dialog__close').click();
    await expect(dialog).toBeVisible();
    await expect(page.locator('.ma-achievement-layout')).toBeVisible();

    await page.locator('.ma-dialog__close').click();
    await expect(dialog).toBeHidden();
  });

  test('Phone Mastery Map reveals the kana grid without an initial scroll hunt', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, '/kana/');
    await page.evaluate(() => window.ModeAtlasFeatures.openMasteryMap());
    await expect(page.locator('[data-ma-dialog-layer]')).toBeVisible();
    await expect(page.locator('[data-ma-dialog-message]')).toBeHidden();
    await expect(page.locator('[data-ma-feature-back]')).toHaveCount(0);
    const geometry = await page.evaluate(() => {
      const panel = document.querySelector('[data-ma-dialog-panel]').getBoundingClientRect();
      const firstGroup = document.querySelector('.ma-mastery-group').getBoundingClientRect();
      const overview = document.querySelector('.ma-mastery-overview').getBoundingClientRect();
      return {
        firstGroupVisible: firstGroup.top < panel.bottom - 12,
        overviewHeight: overview.height
      };
    });
    expect(geometry.firstGroupVisible).toBe(true);
    expect(geometry.overviewHeight).toBeLessThan(190);
  });

  test('Phone loss state keeps the correct answer and Try again action in the visible trainer frame', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, '/reading/');
    await page.locator('#startBtn').click();
    await page.locator('#input').fill('zz');
    await expect(page.locator('#gameOver')).toBeVisible();
    await expect(page.locator('#retryBtn')).toBeVisible();
    await expect(page.locator('#endSessionBtn')).toBeVisible();
    await expect(page.locator('#pauseSessionBtn')).toBeHidden();
    await expect(page.locator('#skipKanaBtn')).toBeHidden();
    const frame = await page.evaluate(() => {
      const answer = document.getElementById('gameOverAnswer').getBoundingClientRect();
      const retry = document.getElementById('retryBtn').getBoundingClientRect();
      const viewportBottom = Number(window.visualViewport?.height || window.innerHeight) + Number(window.visualViewport?.offsetTop || 0);
      return {
        answerVisible: answer.top >= -2 && answer.bottom <= viewportBottom + 2,
        retryVisible: retry.top >= -2 && retry.bottom <= viewportBottom + 2
      };
    });
    expect(frame.answerVisible).toBe(true);
    expect(frame.retryVisible).toBe(true);

    await page.locator('#retryBtn').click();
    await expect(page.locator('#gameOver')).toBeHidden();
    await expect(page.locator('#skipKanaBtn')).toBeVisible();
    await expect(page.locator('#pauseSessionBtn')).toBeVisible();
    await expect(page.locator('#endSessionBtn')).toBeVisible();
  });

  test('iPad Results summary and row charts use the full assessment width', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(() => localStorage.setItem('modeAtlasDisplayMode', 'tablet'));
    await gotoApp(page, '/results/');
    const actualSummary = await page.evaluate(() => {
      const grid = document.querySelector('.summary-grid')?.getBoundingClientRect();
      const left = document.querySelector('.summary-left')?.getBoundingClientRect();
      return {
        widthRatio: grid && left ? left.width / grid.width : 0,
        columns: grid ? getComputedStyle(document.querySelector('.summary-grid')).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length : 0
      };
    });
    expect(actualSummary.columns).toBe(1);
    expect(actualSummary.widthRatio).toBeGreaterThan(0.98);

    const masterDetail = await page.evaluate(() => {
      const layout = document.querySelector('.results-layout');
      const list = document.querySelector('.results-list-card');
      const detail = document.querySelector('.results-detail-card');
      const layoutRect = layout?.getBoundingClientRect();
      const listRect = list?.getBoundingClientRect();
      const detailRect = detail?.getBoundingClientRect();
      return {
        columns: layout ? getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length : 0,
        sideBySide: !!(listRect && detailRect && Math.abs(listRect.top - detailRect.top) < 4),
        detailWider: !!(listRect && detailRect && detailRect.width > listRect.width),
        fillsLayout: !!(layoutRect && detailRect && detailRect.right >= layoutRect.right - 2)
      };
    });
    expect(masterDetail.columns).toBe(2);
    expect(masterDetail.sideBySide).toBe(true);
    expect(masterDetail.detailWider).toBe(true);
    expect(masterDetail.fillsLayout).toBe(true);

    const heatmapDensity = await page.evaluate(() => {
      const row = document.createElement('div');
      row.className = 'heatmap-row-cells';
      for (let i = 0; i < 5; i += 1) {
        const cell = document.createElement('button');
        cell.className = 'cell';
        cell.innerHTML = '<div class="cell-char">あ</div><div class="cell-time">1.00s</div>';
        row.append(cell);
      }
      document.querySelector('.results-detail-card .detail-panel')?.append(row);
      const first = row.firstElementChild?.getBoundingClientRect();
      const bounds = row.getBoundingClientRect();
      row.remove();
      return { cellHeight: first?.height || 0, rowWidth: bounds.width };
    });
    expect(heatmapDensity.cellHeight).toBeLessThanOrEqual(60);
    expect(heatmapDensity.rowWidth).toBeGreaterThan(400);

    const geometry = await page.evaluate(() => {
      const host = document.createElement('div');
      host.style.width = '960px';
      host.style.maxWidth = 'calc(100vw - 40px)';
      const strip = document.createElement('div');
      strip.className = 'row-doughnut-strip';
      for (let i = 0; i < 10; i += 1) {
        const card = document.createElement('button');
        card.className = 'row-doughnut-card';
        card.textContent = String(i);
        strip.append(card);
      }
      host.append(strip);
      document.body.append(host);
      const cols = getComputedStyle(strip).gridTemplateColumns.trim().split(/\s+/).filter(Boolean);
      const first = strip.firstElementChild.getBoundingClientRect();
      const last = strip.lastElementChild.getBoundingClientRect();
      const bounds = strip.getBoundingClientRect();
      host.remove();
      return {
        columns: cols.length,
        fillsWidth: last.right >= bounds.right - 4,
        cardWidth: first.width
      };
    });
    expect(geometry.columns).toBe(10);
    expect(geometry.fillsWidth).toBe(true);
    expect(geometry.cardWidth).toBeGreaterThan(76);
  });

  test('Phone Results keeps history compact and heatmap cells dense', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('modeAtlasDisplayMode', 'phone'));
    await gotoApp(page, '/results/');
    const metrics = await page.evaluate(() => {
      const layout = document.querySelector('.results-layout');
      const tests = document.querySelector('.results-list-card .tests-grid');
      const row = document.createElement('div');
      row.className = 'heatmap-row-cells';
      for (let i = 0; i < 5; i += 1) {
        const cell = document.createElement('button');
        cell.className = 'cell';
        cell.innerHTML = '<div class="cell-char">あ</div><div class="cell-time">1.00s</div>';
        row.append(cell);
      }
      document.querySelector('.results-detail-card .detail-panel')?.append(row);
      const first = row.firstElementChild?.getBoundingClientRect();
      const columns = layout ? getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length : 0;
      const display = tests ? getComputedStyle(tests).display : '';
      const overflowX = tests ? getComputedStyle(tests).overflowX : '';
      row.remove();
      return { columns, display, overflowX, cellHeight: first?.height || 0 };
    });
    expect(metrics.columns).toBe(1);
    expect(metrics.display).toBe('flex');
    expect(metrics.overflowX).toBe('auto');
    expect(metrics.cellHeight).toBeLessThanOrEqual(52);
  });

  test('Tablet Practice Setup uses two comfortable columns and keeps Focus Mode available', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(() => localStorage.setItem('modeAtlasDisplayMode', 'tablet'));
    await gotoApp(page, '/reading/');
    await expect(page.locator('body')).toHaveAttribute('data-effective-display-mode', 'tablet');
    await expect(page.locator('#studyNavHideBtn')).toBeVisible();
    const focusGeometry = await page.locator('#studyNavHideBtn').evaluate((button) => ({
      fits: button.scrollWidth <= button.clientWidth + 1,
      labelVisible: getComputedStyle(button.querySelector('.ma-nav__action-label')).display !== 'none'
    }));
    expect(focusGeometry.fits).toBe(true);
    expect(focusGeometry.labelVisible).toBe(true);

    await page.locator('#studyNavHideBtn').click();
    await expect(page.locator('body')).toHaveClass(/study-nav-hidden/);
    await expect(page.locator('#studyNavHideBtn')).toBeVisible();
    await expect(page.locator('#studyNavShowBtn')).toBeHidden();
    await page.locator('#studyNavHideBtn').click();
    await expect(page.locator('body')).not.toHaveClass(/study-nav-hidden/);

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
