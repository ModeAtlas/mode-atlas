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
  await expect(page.locator('#iosHomeContinue')).toHaveAttribute('href', '/reading/?practice=10&starter=starter');
  await expect(page.locator('#iosHomeGoals [data-goal]')).toHaveCount(3);
  await expect(page.locator('.atlas-ios-home [data-ma-rewards-open]')).toBeVisible();
  await page.evaluate(() => {
    for (const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted']) localStorage.setItem(key, 'true');
    localStorage.setItem('maWhatsNewSeen', 'guided-study');
  });
  await page.locator('#iosHomeContinue').click();
  await expect(page).toHaveURL(/\/reading\/$/);
  await expect(page.locator('#studyLength')).toHaveValue('10');
  expect(await page.evaluate(() => settings.hiraganaRows)).toEqual(['h_a']);
});

test('iOS home fits portrait phones and keeps its last action above the dock', async ({ page }) => {
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} };
  });
  await page.goto('/');
  await expect(page.locator('.ma-ios-tabs')).toBeVisible();
  for (const size of [{width:375,height:667}, {width:393,height:852}, {width:430,height:932}]) {
    await page.setViewportSize(size);
    console.log('Native home geometry', await page.evaluate(() => ({
      viewport:innerHeight, scroll:document.documentElement.scrollHeight,
      body:document.body.getBoundingClientRect().toJSON(),
      padding:getComputedStyle(document.body).padding,
      main:document.querySelector('.atlas-home').getBoundingClientRect().toJSON(),
      home:document.querySelector('.atlas-ios-home').getBoundingClientRect().toJSON(),
      dock:document.querySelector('.ma-ios-tabs').getBoundingClientRect().toJSON()
    })));
    await expect.poll(() => page.evaluate(() => ({
      fits: document.documentElement.scrollHeight <= innerHeight + 1,
      clear: document.querySelector('.atlas-ios-home').getBoundingClientRect().bottom
        <= document.querySelector('.ma-ios-tabs').getBoundingClientRect().top,
      width: document.documentElement.scrollWidth <= innerWidth
    }))).toEqual({fits:true,clear:true,width:true});
  }
});

test('native account chooser uses enabled methods and Settings owns account deletion', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {
      FirebaseAuthentication: { signInWithGoogle: async () => ({}), signInWithApple: async () => ({}) }
    } };
  });
  await page.goto('/');
  await expect(page.locator('#profileAuthBtn')).toHaveText('Sign in');
  await page.evaluate(() => window.ModeAtlasProfile.open());
  await page.locator('#profileAuthBtn').click();
  await expect(page.locator('[data-ma-account-provider="google.com"]')).toHaveText('Continue with Google');
  await expect(page.locator('[data-ma-account-provider="apple.com"]')).toHaveText('Continue with Apple');
  await expect(page.locator('[data-ma-account-provider="apple.com"]')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect.poll(() => page.locator('.ma-account-apple img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.ma-dialog-layer')).toHaveCSS('opacity','1');
  await page.screenshot({path:testInfo.outputPath('apple-account-chooser.png'),animations:'disabled'});
  await expect(page.locator('#maAccount-profile')).toHaveAttribute('aria-hidden','true');
  await page.locator('.ma-dialog__close').click();
  await page.evaluate(() => {
    const user = { uid:'test-user', providerData:[{providerId:'google.com'}] };
    window.KanaCloudSync = { ...window.KanaCloudSync,
      getUser: () => user,
      getSyncStatus: () => ({user,state:'synced',tone:'success',text:'Synced'})
    };
    window.ModeAtlasProfile.refresh();
    window.ModeAtlasProfile.open();
  });
  await page.locator('#profileLinkBtn').click();
  await expect(page.locator('[data-ma-account-provider="google.com"]')).toHaveText('Google · Connected');
  await expect(page.locator('[data-ma-account-provider="google.com"]')).toBeDisabled();
  await page.locator('.ma-dialog__close').click();
  await expect(page.locator('#maAccount-profile #settingsDeleteAccountBtn')).toHaveCount(0);
  await expect(page.locator('#maAccount-settings #settingsDeleteAccountBtn')).toHaveCount(1);
  await expect(page.locator('#settingsDeleteAccountBtn')).not.toHaveAttribute('hidden','');
  await expect(page.locator('#settingsDeleteAccountBtn').locator('..').locator('[data-ma-unified-reset]')).toHaveCount(1);
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
          addListener: (name, callback) => { if (name === 'appUrlOpen') window.modeAtlasOpenUrl = callback; },
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
  await expect(page.locator('.ma-ios-tabs__links .ma-ios-tab')).toHaveCount(4);
  await expect(page.locator('.ma-ios-tab[href="/learn/"]')).toHaveCount(1);
  expect(await page.evaluate(() => [...document.querySelectorAll('style')].some(style => style.textContent.includes('@view-transition{navigation:auto}')))).toBe(true);
  await expect(page.locator('.ma-ios-tab[aria-current="page"]')).toHaveCount(0);
  await expect(page.locator('.ma-nav__links')).toBeHidden();
  await page.locator('.ma-ios-tab[href="/learn/"]').click();
  await expect(page).toHaveURL(/\/learn\/$/);
  await page.getByRole('link',{name:'Reading',exact:true}).click();
  await expect(page).toHaveURL(/\/reading\/$/);
  await expect(page.locator('.ma-kana-navigation [aria-current="page"]')).toHaveText('Reading');
  await expect(page.locator('.ma-ios-tabs__links .ma-ios-tab.is-active')).toContainText('Learn');
  await expect(page.locator('.ma-ios-tabs')).toBeVisible();
  await expect(page.locator('.ma-nav')).toBeHidden();
  await expect(page.locator('#profileOpenBtn')).toHaveCount(1);
  await expect(page.locator('#profileOpenBtn')).toHaveAttribute('aria-label', 'Profile and settings');
  await expect(page.locator('.ma-ios-tabs [data-settings-open]')).toHaveCount(0);
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('#maAccount-profile')).toHaveClass(/is-active/);
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('#maAccount-profile')).not.toHaveClass(/is-active/);
  await page.locator('#profileOpenBtn').click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.locator('#maAccount-settings')).toHaveClass(/is-active/);
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('#maAccount-settings')).not.toHaveClass(/is-active/);
  await expect(page.locator('.ma-ios-practice-actions #modifiersTab')).toBeVisible();
  await expect(page.locator('.ma-ios-practice-actions #modifiersTab')).toContainText('Practice setup');
  await expect(page.locator('.bottom-shell.ma-modifiers-only .tab-row')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-ma-native-warm', 'true');

  const layout = await page.evaluate(() => {
    const dock = document.querySelector('.ma-ios-tabs').getBoundingClientRect();
    const setup = document.querySelector('.bottom-shell.ma-modifiers-only').getBoundingClientRect();
    return { setupBottom:setup.bottom, dockTop:dock.top };
  });
  expect(layout.setupBottom).toBeLessThanOrEqual(layout.dockTop + 1);
  await page.locator('.ma-ios-practice-actions #modifiersTab').click();
  await expect(page.locator('#modifiersContent')).toBeVisible();
  await expect(page.locator('.ma-ios-practice-actions #modifiersTab')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#practiceSetupDone').click();
  await expect(page.locator('#modifiersContent')).toBeHidden();

  await page.evaluate(() => document.getElementById('studyNavHideBtn').click());
  await expect(page.locator('.ma-ios-tabs #studyNavShowBtn')).toBeVisible();
  await expect(page.locator('.ma-ios-tabs__links')).toBeHidden();
  await page.locator('.ma-ios-tabs #studyNavShowBtn').click();
  await page.locator('.ma-ios-tabs__links .ma-ios-tab[href="/"]').click();
  await expect(page.locator('.ma-ios-tabs__utilities')).toHaveCount(0);
  await expect(page.locator('.ma-ios-profile')).toBeVisible();
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
  await expect.poll(() => page.evaluate(() => window.modeAtlasHapticCalls.length)).toBeGreaterThan(0);
  const pulses = await page.evaluate(() => window.modeAtlasHapticCalls);
  expect(pulses.every(style => style === 'LIGHT')).toBe(true);
  expect(pulses.length).toBeLessThanOrEqual(answer.length); // Key and answer pulses coalesce.
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

test('native safe-area insets survive phone trainer styles and keep the home above the dock', async ({page}, testInfo) => {
  await page.setViewportSize({width:393,height:852});
  const device=await page.context().newCDPSession(page);
  await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});
  await page.addInitScript(() => {
    localStorage.setItem('modeAtlasDisplayMode','desktop');
    localStorage.setItem('maWhatsNewSeenVersion','test-seen');
    localStorage.setItem('modeAtlasKanaSetupComplete','true');
    localStorage.setItem('modeAtlasOnboardingComplete','true');
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
  });
  for(const path of ['/reading/','/writing/']){
    await page.goto(path);
    await expect(page.locator('body')).toHaveAttribute('data-effective-display-mode','phone');
    await expect(page.locator('.ma-ios-tabs')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>parseFloat(getComputedStyle(document.body).paddingTop))).toBe(59);
    await expect(page.locator('#maLoadingScreen')).toBeHidden();
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('#endSessionBtn')).toBeHidden();
    await expect.poll(()=>page.locator('.ma-trainer-card').evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(59);
    await page.screenshot({path:testInfo.outputPath(path.includes('reading')?'native-reading.png':'native-writing.png')});
  }
  await page.goto('/');
  await expect(page.locator('.atlas-ios-home')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    const home=document.querySelector('.atlas-ios-home').getBoundingClientRect();
    const dock=document.querySelector('.ma-ios-tabs').getBoundingClientRect();
    return home.bottom<=dock.top && dock.top-home.bottom<32 && document.documentElement.scrollHeight<=innerHeight+1;
  })).toBe(true);
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.screenshot({path:testInfo.outputPath('native-home.png')});
});

test('compact native reminders keep notification testing in the authorised dev menu', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('maOnboardingDone','1');
    const calls=[];
    const state={supported:true,reminder:{enabled:false,granted:false,status:'notDetermined',hour:19,minute:0},widgets:{available:true,progressSupported:true}};
    window.engagementTest={calls,state};
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{
      getNotificationStatus:async()=>state.reminder,
      getEngagementState:async()=>structuredClone(state),
      requestNotifications:async()=>{calls.push('permission');Object.assign(state.reminder,{granted:true,status:'authorized'});return state.reminder;},
      configureStudyReminder:async value=>{calls.push(['reminder',value]);Object.assign(state.reminder,value);return value;},
      publishWidgetSnapshot:async value=>{calls.push(['snapshot',value]);return {stored:state.widgets.progressSupported};},
      resetEngagement:async()=>{state.reminder.enabled=false;return {reset:true};},
      testNotification:async()=>{calls.push('test');return {scheduled:state.reminder.granted};},
      openNotificationSettings:async()=>({opened:true})
    }}};
  });
  await page.goto('/');
  await page.evaluate(()=>window.ModeAtlasSettings.open());
  const enabled=page.locator('#maReminderEnabled'), time=page.locator('#maReminderTime');
  await expect(enabled).toBeEnabled();
  expect(await page.evaluate(()=>window.engagementTest.calls.includes('permission'))).toBe(false);
  await time.fill('08:45');
  await enabled.check();
  await expect(enabled).toBeEnabled();
  await expect(enabled).toBeChecked();
  await expect(time).toHaveValue('08:45');
  await expect(page.locator('#maReminderTest')).toHaveCount(0);
  await expect(page.locator('#maWidgetProgress')).toHaveCount(0);
  await expect(page.locator('#maWidgetHelp')).toHaveCount(0);
  await expect(page.locator('#maReminderStatus')).toBeHidden();
  await expect(page.locator('#maNotificationSettings')).toBeVisible();
  expect(await page.evaluate(()=>!!window.ModeAtlasDevConsole)).toBe(false);
  await enabled.uncheck();
  await expect(enabled).toBeEnabled();
  expect(await page.evaluate(()=>window.engagementTest.calls.filter(x=>x==='permission').length)).toBe(1);
  await page.evaluate(()=>{Object.assign(window.engagementTest.state.reminder,{status:'denied',granted:false});return window.ModeAtlasNativeSettings.refresh();});
  await expect(page.locator('#maNotificationSettings')).toBeVisible();
  await page.locator('#maNotificationSettings').click();
  await expect(page.locator('#maReminderStatus')).toBeHidden();
  await page.screenshot({path:'test-results/native-reminders-settings.png',fullPage:true});
  await page.evaluate(()=>window.ModeAtlasNativeEngagement.reset());
  await expect(enabled).not.toBeChecked();
  await page.evaluate(async()=>{
    window.ModeAtlasSettings.close();
    Object.assign(window.engagementTest.state.reminder,{granted:true,status:'authorized'});
    window.KanaCloudSync={...window.KanaCloudSync,getUser:()=>({email:'admin@mode-atlas.com'})};
    await window.ModeAtlasDevConsoleLoader.loadIfEligible();
    window.ModeAtlasDevConsole.open();
  });
  await page.locator('[data-ma-dev-test-notification]').click();
  await expect.poll(()=>page.evaluate(()=>window.engagementTest.calls.filter(x=>x==='test').length)).toBe(1);
  expect(await page.evaluate(()=>window.engagementTest.calls.filter(x=>x==='permission').length)).toBe(1);
  await page.evaluate(()=>{
    window.KanaCloudSync.getUser=()=>null;
    window.dispatchEvent(new CustomEvent('kanaCloudSyncStatusChanged'));
  });
  await expect(page.locator('#maDevMenu')).not.toHaveClass(/open/);
});

test('account alerts are independent, opt-in and remain editable with large text', async ({page}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{
    localStorage.setItem('maOnboardingDone','1');
    const calls=[],state={supported:true,reminder:{enabled:false,granted:false,hour:19,minute:0},widgets:{available:false}};
    window.alertTest={calls,state,preferences:{dailyGoals:false,weeklyGoals:false,streak:false,overtaken:false}};
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{
      ModeAtlasNative:{getEngagementState:async()=>structuredClone(state),getNotificationStatus:async()=>state.reminder,
        requestNotifications:async()=>{calls.push('permission');state.reminder.granted=true;return state.reminder;},
        deletePushToken:async()=>{calls.push('delete');return {deleted:true};}},
      FirebaseMessaging:{addListener(){},getToken:async()=>{calls.push('token');return {token:'valid-device-token-for-tests'};}}
    }};
  });
  await page.goto('/');
  await page.evaluate(()=>{
    KanaCloudSync.getUser=()=>({uid:'alerts-owner'});
    window.ModeAtlasSocial={...ModeAtlasSocial,call:async(action,data)=>{
      alertTest.calls.push(action);
      if(action==='configureNotifications'){alertTest.preferences={...data.preferences};alertTest.schedule={...data.schedule};}
      return {preferences:{...alertTest.preferences},schedule:alertTest.schedule};
    }};
    ModeAtlasSettings.open();
  });
  const daily=page.locator('#maAlert-dailyGoals');await expect(daily).toBeEnabled();
  expect(await page.evaluate(()=>alertTest.calls.includes('permission'))).toBe(false);
  for(const key of ['dailyGoals','weeklyGoals','streak','overtaken']){
    const control=page.locator('#maAlert-'+key);await control.check();await expect(control).toBeEnabled();await expect(control).toBeChecked();
  }
  await daily.uncheck();await expect(daily).toBeEnabled();await expect(daily).not.toBeChecked();
  await expect(page.locator('#maAlert-streak')).toBeChecked();
  await page.locator('#maAlertTime-reminderMinute').fill('18:30');
  await page.locator('#maAlertTime-quietStart').fill('21:30');
  await page.locator('#maAlertTime-quietEnd').fill('08:00');
  await page.getByRole('button',{name:'Save alert times',exact:true}).click();
  await expect(page.locator('#maReminderStatus')).toHaveText('Alert times saved.');
  expect(await page.evaluate(()=>alertTest.schedule)).toEqual({reminderMinute:1110,quietStart:1290,quietEnd:480});
  await page.locator('#maAlertTime-reminderMinute').fill('22:00');
  await page.getByRole('button',{name:'Save alert times',exact:true}).click();
  await expect(page.locator('#maReminderStatus')).toContainText('outside quiet hours');
  await page.setViewportSize({width:320,height:852});
  await page.evaluate(()=>{document.documentElement.style.setProperty('--ma-ios-text-scale','1.6');document.documentElement.setAttribute('data-ma-large-text','');});
  await page.locator('#maAlert-overtaken').scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await daily.evaluate(control=>{const panel=control.closest('.ma-setting-list');return panel.scrollWidth<=panel.clientWidth&&control.closest('label').getBoundingClientRect().left>=panel.getBoundingClientRect().left;})).toBe(true);
  await page.screenshot({path:'test-results/notification-options-large-text.png'});
  for(const key of ['weeklyGoals','streak','overtaken']){const control=page.locator('#maAlert-'+key);await control.uncheck();await expect(control).toBeEnabled();}
  expect(await page.evaluate(()=>alertTest.calls.filter(x=>x==='permission').length)).toBe(4);
  expect(await page.evaluate(()=>alertTest.calls.includes('delete'))).toBe(true);
});

test('browser Settings do not render native engagement controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#maReminderEnabled')).toHaveCount(0);
  await expect(page.locator('#maWidgetProgress')).toHaveCount(0);
});
