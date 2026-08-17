const { test } = require('@playwright/test');

test('diagnose phone Kana hero geometry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('modeAtlasStarterSeen', 'true');
    localStorage.setItem('modeAtlasOnboardingComplete', 'true');
    localStorage.setItem('modeAtlasKanaSetupComplete', 'true');
    localStorage.setItem('modeAtlasLegalAccepted', 'true');
    localStorage.setItem('modeAtlasLegalAcceptedAt', String(Date.now()));
    localStorage.setItem('modeAtlasLegalVersion', '2026-05');
    localStorage.setItem('maWhatsNewSeen', 'smoke');
  });
  await page.goto('/kana/', { waitUntil: 'commit', timeout: 5000 });
  await page.waitForSelector('body');
  await page.waitForTimeout(1000);
  const result = await page.evaluate(() => {
    const info = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const s = getComputedStyle(node);
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width),
        display: s.display, position: s.position, minHeight: s.minHeight, heightCss: s.height,
        paddingTop: s.paddingTop, paddingBottom: s.paddingBottom, marginTop: s.marginTop, marginBottom: s.marginBottom,
        gridTemplateRows: s.gridTemplateRows, gridTemplateColumns: s.gridTemplateColumns,
        alignItems: s.alignItems, alignContent: s.alignContent, justifyContent: s.justifyContent
      };
    };
    return {
      scrollY: Math.round(scrollY), bodyHeight: document.body.scrollHeight,
      nav: info('.ma-nav'), shell: info('.shell'), hero: info('.kana-hub-hero'), main: info('.kana-hero-main'),
      tagline: info('.hero-tagline'), title: info('.kana-hero-main h1'), lead: info('.kana-hero-lead'),
      actions: info('.kana-hero-actions'), action: info('.kana-primary-action'), visual: info('.kana-hero-visual'),
      pathways: info('.kana-pathways'), progress: info('#mainContent')
    };
  });
  console.log('KANA_GEOMETRY=' + JSON.stringify(result));
});
