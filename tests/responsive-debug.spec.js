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
  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const s = getComputedStyle(node);
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height),
        display: s.display, position: s.position, paddingTop: s.paddingTop,
        paddingBottom: s.paddingBottom, marginTop: s.marginTop, marginBottom: s.marginBottom,
        fontSize: s.fontSize, lineHeight: s.lineHeight, transform: s.transform
      };
    };
    return {
      viewport: [innerWidth, innerHeight],
      mode: document.body.dataset.effectiveDisplayMode,
      scrollY,
      bodyHeight: document.body.scrollHeight,
      nav: rect('.ma-nav'),
      hero: rect('.kana-hub-hero'),
      heroMain: rect('.kana-hero-main'),
      tagline: rect('.hero-tagline'),
      title: rect('.kana-hero-main h1'),
      lead: rect('.kana-hero-lead'),
      actions: rect('.kana-hero-actions'),
      action: rect('.kana-primary-action'),
      visual: rect('.kana-hero-visual')
    };
  });
  console.log('KANA_PHONE_GEOMETRY=' + JSON.stringify(metrics));
});
