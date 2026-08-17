const { test } = require('@playwright/test');

test('diagnose phone Kana hero stylesheet owner', async ({ page }) => {
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
    const target = document.querySelector('#mainContent');
    const matches = [];
    for (const sheet of [...document.styleSheets]) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of [...rules]) {
        if (!rule.selectorText) continue;
        try {
          if (target?.matches(rule.selectorText) && (rule.selectorText === 'main' || rule.selectorText.includes('.shell'))) {
            matches.push({
              href: sheet.href,
              selector: rule.selectorText,
              css: rule.style.cssText,
              owner: sheet.ownerNode?.outerHTML || null
            });
          }
        } catch {}
      }
    }
    return matches;
  });
  console.log('KANA_STYLE_OWNERS=' + JSON.stringify(result));
});
