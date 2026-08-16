from pathlib import Path


def replace_count(path, old, new, expected=1):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} matches, found {count}')
    p.write_text(text.replace(old, new), encoding='utf-8')


# Atlas Level colours begin on the milestone level itself.
replace_count(
    'assets/ui/mode-atlas-profile-drawer-bindings.js',
    """  function atlasLevelRank(level){
    if (level >= 76) return 'teal';
    if (level >= 51) return 'violet';
    if (level >= 26) return 'gold';
    if (level >= 11) return 'silver';
    return 'bronze';
  }
""",
    """  function atlasLevelRank(level){
    if (level >= 75) return 'teal';
    if (level >= 50) return 'violet';
    if (level >= 25) return 'gold';
    if (level >= 10) return 'silver';
    return 'bronze';
  }
"""
)

# Phone navigation: account actions live beside the brand while the three
# product destinations own a full row below.
navigation = 'assets/css/mode-atlas-navigation.css'
replace_count(
    navigation,
    """@media(max-width:520px){
  .ma-nav__kicker{display:none;}
  .ma-nav__title{font-size:.84rem;}
  .ma-nav__primary{grid-template-columns:minmax(0,1fr) auto;}
  .ma-nav__link{padding:0 8px;font-size:.75rem;}
  .ma-nav__flyout{left:0;width:min(268px,calc(100vw - 28px));transform:translateY(-5px);}
  .ma-nav__menu:hover .ma-nav__flyout,.ma-nav__menu:focus-within .ma-nav__flyout,.ma-nav__menu.is-open .ma-nav__flyout{transform:translateY(0);}
  .ma-nav__action--quiet{display:none;}
}
""",
    """@media(max-width:520px){
  .ma-nav__kicker{display:none;}
  .ma-nav__title{font-size:.84rem;}
  .ma-nav__content,.ma-nav__primary{display:contents;}
  .ma-nav__links{grid-column:1 / -1;grid-row:2;width:100%;justify-content:space-between;gap:4px;}
  .ma-nav__actions{grid-column:2;grid-row:1;justify-self:end;gap:5px;}
  .ma-nav__link{padding:0 8px;font-size:.75rem;}
  .ma-nav__flyout{left:0;width:min(268px,calc(100vw - 28px));transform:translateY(-5px);}
  .ma-nav__menu:hover .ma-nav__flyout,.ma-nav__menu:focus-within .ma-nav__flyout,.ma-nav__menu.is-open .ma-nav__flyout{transform:translateY(0);}
  .ma-nav__action--quiet{display:none;}
}
"""
)
replace_count(
    navigation,
    '\nhtml[data-ma-theme="light"] .ma-nav__action{',
    '''
/* Explicit Phone mode uses the same compact composition even when it is
   selected on a wider physical viewport. */
body[data-effective-display-mode="phone"] .ma-nav{
  position:relative;
  top:auto;
  width:calc(100% - 20px);
  margin:10px auto 16px;
  padding:10px;
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  gap:10px;
  border-radius:22px;
}
body[data-effective-display-mode="phone"] .ma-nav__brand{grid-column:1;max-width:none;}
body[data-effective-display-mode="phone"] .ma-nav__mark{width:40px;height:40px;flex-basis:40px;border-radius:13px;}
body[data-effective-display-mode="phone"] .ma-nav__kicker{display:none;}
body[data-effective-display-mode="phone"] .ma-nav__title{font-size:.84rem;}
body[data-effective-display-mode="phone"] .ma-nav__content,
body[data-effective-display-mode="phone"] .ma-nav__primary{display:contents;}
body[data-effective-display-mode="phone"] .ma-nav__links{
  grid-column:1 / -1;
  grid-row:2;
  width:100%;
  justify-content:space-between;
  gap:4px;
}
body[data-effective-display-mode="phone"] .ma-nav__actions{
  grid-column:2;
  grid-row:1;
  justify-self:end;
  gap:5px;
}
body[data-effective-display-mode="phone"] .ma-nav__link{min-height:40px;padding:0 8px;font-size:.75rem;}
body[data-effective-display-mode="phone"] .ma-nav__profile{width:auto;min-width:0;min-height:42px;padding:0 7px 0 5px;}
body[data-effective-display-mode="phone"] .ma-nav__profile .ma-nav__action-label{display:inline-flex;}
body[data-effective-display-mode="phone"] .ma-nav__settings{width:42px;min-width:42px;min-height:42px;padding:0;}
body[data-effective-display-mode="phone"] .ma-nav__flyout{left:0;width:min(268px,calc(100vw - 28px));transform:translateY(-5px);}
body[data-effective-display-mode="phone"] .ma-nav__menu:hover .ma-nav__flyout,
body[data-effective-display-mode="phone"] .ma-nav__menu:focus-within .ma-nav__flyout,
body[data-effective-display-mode="phone"] .ma-nav__menu.is-open .ma-nav__flyout{transform:translateY(0);}
body[data-effective-display-mode="phone"] .ma-nav__focus{display:none;}

html[data-ma-theme="light"] .ma-nav__action{'''
)

# Drawers consume explicit Tablet/Phone modes directly. The old Tablet rule
# depended on physical width and lost to the later coarse-pointer fallback.
profile_css = 'assets/css/mode-atlas-profile-settings.css'
replace_count(
    profile_css,
    'width:min(500px,calc(100vw - 36px));max-height:calc(100vh - 36px);overflow-y:auto;',
    'width:min(500px,calc(100vw - 36px));max-height:calc(100vh - 36px);overflow-x:hidden;overflow-y:auto;'
)
replace_count(
    profile_css,
    '.ma-account-email,.ma-sync-detail{color:var(--ma-muted);font-size:13px;line-height:1.45;overflow-wrap:anywhere;}\n',
    '''.ma-account-email,.ma-sync-detail{color:var(--ma-muted);font-size:13px;line-height:1.45;overflow-wrap:anywhere;}
.ma-drawer .ma-card,.ma-drawer .ma-setting-list,.ma-drawer .ma-setting-row,
.ma-account-copy,.ma-profile-card-head>div{min-width:0;max-width:100%;}
.ma-sync-detail{width:100%;max-width:100%;white-space:normal;}
'''
)
replace_count(
    profile_css,
    '.ma-level-activity>div{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:2px 10px;padding:10px 12px;border-radius:var(--ma-radius-md);background:var(--ma-surface-inset);border:1px solid var(--ma-border);}',
    '.ma-level-activity>div{min-width:0;display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:2px 10px;padding:10px 12px;border-radius:var(--ma-radius-md);background:var(--ma-surface-inset);border:1px solid var(--ma-border);}'
)
replace_count(
    profile_css,
    '.ma-progression-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid var(--ma-border);}',
    '.ma-progression-footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid var(--ma-border);}'
)
replace_count(
    profile_css,
    '''@media(max-width:1180px){
  body[data-effective-display-mode="tablet"] .ma-drawer{width:min(620px,calc(100vw - 32px));max-height:calc(100dvh - 32px);}
}
''',
    ''
)
replace_count(
    profile_css,
    '@media(max-width:560px){',
    '''/* Explicit display modes win over pointer capability. */
body[data-effective-display-mode="tablet"] .ma-drawer{
  top:max(16px,env(safe-area-inset-top,0px));
  right:16px;
  bottom:auto;
  left:auto;
  width:min(620px,calc(100vw - 32px));
  max-width:calc(100vw - 32px);
  max-height:calc(100dvh - 32px);
  padding:18px;
  border-radius:var(--ma-radius-lg);
}
body[data-effective-display-mode="phone"] .ma-drawer{
  top:calc(env(safe-area-inset-top,0px) + 12px);
  right:10px;
  bottom:calc(env(safe-area-inset-bottom,0px) + 12px);
  left:10px;
  width:auto;
  max-width:none;
  max-height:none;
  padding:14px;
  border-radius:var(--ma-page-card-radius-phone);
}

@media(max-width:560px){'''
)

# Remove obsolete viewport-filling geometry from idle phone trainers. Active
# sessions have their own focused sizing later in the same owner.
study = 'assets/css/mode-atlas-study-shared.css'
replace_count(
    study,
    'padding:20px 14px 130px;\n    min-height:calc(100svh - 230px);',
    'padding:20px 14px 28px;\n    min-height:auto;',
    expected=2
)
replace_count(
    study,
    'padding:18px 12px 126px;',
    'padding:18px 12px 28px;',
    expected=2
)
replace_count(
    study,
    '''body[data-effective-display-mode="phone"] {
  display: block;
  padding: 10px;
  min-height: 100dvh;
''',
    '''body[data-effective-display-mode="phone"] {
  display: block;
  padding: max(10px, env(safe-area-inset-top, 0px)) 10px max(10px, env(safe-area-inset-bottom, 0px));
  min-height: 100dvh;
'''
)
replace_count(
    study,
    '''body.ma-reading-page,
  body.ma-writing-page{display:block;padding:10px;min-height:100svh;overflow-x:hidden;}
''',
    '''body.ma-reading-page,
  body.ma-writing-page{display:block;padding:max(10px,env(safe-area-inset-top,0px)) 10px max(10px,env(safe-area-inset-bottom,0px));min-height:100svh;overflow-x:hidden;}
'''
)
replace_count(
    study,
    '''body[data-effective-display-mode="phone"].ma-reading-page,
body[data-effective-display-mode="phone"].ma-writing-page{
  display:block;
  padding:10px;
  min-height:100dvh;
''',
    '''body[data-effective-display-mode="phone"].ma-reading-page,
body[data-effective-display-mode="phone"].ma-writing-page{
  display:block;
  padding:max(10px,env(safe-area-inset-top,0px)) 10px max(10px,env(safe-area-inset-bottom,0px));
  min-height:100dvh;
'''
)

# Permanent source-level regression guards.
frontend_tests = Path('tests/frontend.test.js')
source = frontend_tests.read_text(encoding='utf-8')
marker = "test('2.47 final responsive polish keeps explicit display modes and Atlas rank milestones aligned'"
if marker not in source:
    source += r'''

test('2.47 final responsive polish keeps explicit display modes and Atlas rank milestones aligned', () => {
  const bindings = read('assets/ui/mode-atlas-profile-drawer-bindings.js');
  const navigation = read('assets/css/mode-atlas-navigation.css');
  const drawers = read('assets/css/mode-atlas-profile-settings.css');
  const study = read('assets/css/mode-atlas-study-shared.css');

  assert.match(bindings, /if \(level >= 75\) return 'teal'/);
  assert.match(bindings, /if \(level >= 50\) return 'violet'/);
  assert.match(bindings, /if \(level >= 25\) return 'gold'/);
  assert.match(bindings, /if \(level >= 10\) return 'silver'/);
  assert.doesNotMatch(bindings, /level >= (?:76|51|26|11)/,
    'Atlas rank colours must change on the milestone level itself');

  assert.match(navigation, /body\[data-effective-display-mode="phone"\] \.ma-nav__content/);
  assert.match(navigation, /body\[data-effective-display-mode="phone"\] \.ma-nav__links\{[\s\S]*grid-row:2/);
  assert.match(navigation, /body\[data-effective-display-mode="phone"\] \.ma-nav__actions\{[\s\S]*grid-row:1/);

  assert.match(drawers, /body\[data-effective-display-mode="tablet"\] \.ma-drawer\{/);
  assert.match(drawers, /overflow-x:hidden;overflow-y:auto/);
  assert.doesNotMatch(drawers, /@media\(max-width:1180px\)\{\s*body\[data-effective-display-mode="tablet"\]/,
    'explicit Tablet drawer geometry must not depend on physical viewport width');
  assert.match(drawers, /\.ma-progression-footer\{display:flex;flex-wrap:wrap/);

  assert.match(study, /safe-area-inset-top/);
  assert.doesNotMatch(study, /padding:20px 14px 130px/,
    'idle mobile trainer must not retain the retired viewport-filling bottom padding');
  assert.doesNotMatch(study, /padding:18px 12px 126px/,
    'explicit Phone trainer must not retain the retired viewport-filling bottom padding');
  assert.match(study, /body\.trainer-session-active \.ma-trainer-prompt-wrap/,
    'focused active-session sizing must remain owned separately');
});
'''
    frontend_tests.write_text(source, encoding='utf-8')

smoke = Path('tests/smoke.spec.js')
smoke_source = smoke.read_text(encoding='utf-8')
smoke_marker = "test('phone navigation, idle trainer, and explicit Tablet drawers stay inside their layouts'"
if smoke_marker not in smoke_source:
    insertion = r'''

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

      await gotoApp(page, '/reading/');
      const idleTrainer = await page.evaluate(() => {
        const card = document.querySelector('.ma-trainer-card');
        const style = card ? getComputedStyle(card) : null;
        return style ? {
          paddingBottom: parseFloat(style.paddingBottom),
          minHeight: parseFloat(style.minHeight) || 0,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        } : null;
      });
      expect(idleTrainer).not.toBeNull();
      expect(idleTrainer.paddingBottom).toBeLessThanOrEqual(32);
      expect(idleTrainer.minHeight).toBe(0);
      expect(idleTrainer.overflow).toBeLessThanOrEqual(1);
    });

    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.addInitScript(() => localStorage.setItem('modeAtlasDisplayMode', 'tablet'));
    await gotoApp(page, '/kana/');
    await expect(page.locator('body')).toHaveAttribute('data-effective-display-mode', 'tablet');

    const assertDrawerFits = async (selector) => {
      const metrics = await page.locator(selector).evaluate((drawer) => {
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
'''
    end = smoke_source.rfind('\n});')
    if end < 0:
        raise SystemExit('tests/smoke.spec.js: could not find describe terminator')
    smoke_source = smoke_source[:end] + insertion + smoke_source[end:]
    smoke.write_text(smoke_source, encoding='utf-8')
