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
    const inspect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const s = getComputedStyle(node);
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height),
        display: s.display, position: s.position, flex: s.flex, flexDirection: s.flexDirection,
        width: s.width, heightCss: s.height, minHeight: s.minHeight, maxHeight: s.maxHeight,
        paddingTop: s.paddingTop, paddingBottom: s.paddingBottom,
        marginTop: s.marginTop, marginBottom: s.marginBottom,
        alignItems: s.alignItems, alignContent: s.alignContent, alignSelf: s.alignSelf,
        justifyItems: s.justifyItems, justifyContent: s.justifyContent, justifySelf: s.justifySelf,
        gridTemplateColumns: s.gridTemplateColumns, gridTemplateRows: s.gridTemplateRows,
        gridAutoRows: s.gridAutoRows, gridAutoFlow: s.gridAutoFlow,
        fontSize: s.fontSize, lineHeight: s.lineHeight, transform: s.transform
      };
    };
    const rulesFor = (selector) => {
      const target = document.querySelector(selector);
      const matches = [];
      if (!target) return matches;
      for (const sheet of [...document.styleSheets]) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        const walk = (list, media = '') => {
          for (const rule of [...list]) {
            if (rule.cssRules) {
              walk(rule.cssRules, rule.conditionText || rule.media?.mediaText || media);
              continue;
            }
            if (!rule.selectorText) continue;
            try {
              if (target.matches(rule.selectorText)) matches.push({ href: sheet.href, media, selector: rule.selectorText, css: rule.style.cssText });
            } catch {}
          }
        };
        walk(rules);
      }
      return matches;
    };
    return {
      viewport: [innerWidth, innerHeight],
      mode: document.body.dataset.effectiveDisplayMode,
      bodyClass: document.body.className,
      scrollY,
      bodyHeight: document.body.scrollHeight,
      nav: inspect('.ma-nav'),
      shell: inspect('.shell'),
      mainContent: inspect('#mainContent'),
      hero: inspect('.kana-hub-hero'),
      heroMain: inspect('.kana-hero-main'),
      action: inspect('.kana-primary-action'),
      visual: inspect('.kana-hero-visual'),
      shellRules: rulesFor('.shell'),
      mainRules: rulesFor('#mainContent'),
      heroRules: rulesFor('.kana-hub-hero')
    };
  });
  console.log('KANA_PHONE_GEOMETRY=' + JSON.stringify(metrics));
});
