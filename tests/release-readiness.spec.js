const {test,expect}=require('@playwright/test');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
test.beforeAll(()=>execFileSync('python3',['build_ios_web.py'],{cwd:path.resolve(__dirname,'..'),stdio:'pipe'}));

test('native Firebase modules load offline from the payload and share a single app registry',async({page})=>{
  const downloads=[];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>{downloads.push(route.request().url());return route.abort();});
  await page.route('**/assets/vendor/**',route=>route.fulfill({path:path.join(__dirname,'../.build/ios-web',new URL(route.request().url()).pathname),contentType:'text/javascript'}));
  await page.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};});
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    await KanaCloudSync.ready;
    const [core,auth,firestore,functions]=await Promise.all(['app','auth','firestore','functions'].map(name=>ModeAtlasFirebase.load(name)));
    const app=core.getApp();
    return {same:core.getApp()===app&&auth.getAuth(app).app===app&&firestore.getFirestore(app).app===app&&functions.getFunctions(app).app===app,count:core.getApps().length};
  });
  expect(result).toEqual({same:true,count:1});
  expect(downloads.filter(url=>url.includes('/firebasejs/'))).toEqual([]);
  await expect(page.locator('.atlas-ios-home')).toBeVisible();
});

test('the first-use tour is skippable, keeps keyboard focus and can be replayed',async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    if(!localStorage.getItem('modeAtlasTourSeen')&&!sessionStorage.getItem('modeAtlasActiveTour'))sessionStorage.setItem('modeAtlasTourPending','1');
  });
  await page.goto('/');
  const dialog=page.getByRole('dialog',{name:'A quick look around'});
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog',{name:'What’s new',exact:true})).toBeHidden();
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Make practice yours'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(()=>localStorage.getItem('modeAtlasTourSeen'))).toBe('1');
  await page.waitForFunction(()=>!!window.ModeAtlasAccountNavigation);
  await page.evaluate(()=>ModeAtlasAccountNavigation.open('settings'));
  await page.getByRole('button',{name:'Quick tour',exact:true}).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#maAccountSheet')).toBeHidden();
  await dialog.getByRole('button',{name:'Skip tour',exact:true}).click();await expect(dialog).toBeHidden();
});

test('privacy and terms remain readable with large text in a narrow native viewport',async({page})=>{
  await page.setViewportSize({width:320,height:640});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};});
  for(const route of ['/privacy/','/terms/']){
    await page.goto(route);
    await page.evaluate(()=>document.documentElement.style.fontSize='22px');
    await expect(page.locator('.ma-legal-document')).toBeVisible();
    await expect(page.locator('.ma-legal-document a[href="mailto:support@mode-atlas.com"]').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:test.info().outputPath(route.includes('privacy')?'privacy.png':'terms.png'),fullPage:true});
  }
});

test('sign-out prevents a background widget refresh from republishing the previous save',async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{
    window.snapshots=[];window.resetCount=0;
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{
      publishWidgetSnapshot:async value=>{snapshots.push(value);},resetEngagement:async()=>{resetCount++;}
    }}};
  });
  await page.goto('/');await expect.poll(()=>page.evaluate(()=>snapshots.length)).toBeGreaterThan(0);
  await page.evaluate(()=>{window.dispatchEvent(new Event('modeAtlasAccountSignedOut'));snapshots=[];window.dispatchEvent(new CustomEvent('modeAtlasAppStateChanged',{detail:{isActive:false}}));ModeAtlasNativeEngagement.refresh();});
  await page.waitForTimeout(500);expect(await page.evaluate(()=>snapshots.length)).toBe(0);expect(await page.evaluate(()=>resetCount)).toBe(1);
  await page.evaluate(()=>{KanaCloudSync={...KanaCloudSync,getUser:()=>({uid:'next-account'})};window.dispatchEvent(new Event('kanaCloudSyncStatusChanged'));});
  await expect.poll(()=>page.evaluate(()=>snapshots.length)).toBeGreaterThan(0);
});


for(const mode of ['reading','writing'])test(`${mode}: an identity change suspends the old run without completion rewards`,async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','readiness');localStorage.setItem('modeAtlasSound','off');
  });
  await page.goto(`/${mode}/?practice=10&starter=starter`);await expect(page.locator('#startBtn')).toBeVisible();await page.locator('#startBtn').click();
  await page.evaluate(()=>handleCorrect('test answer'));await page.waitForTimeout(350);
  const before=await page.evaluate(()=>({xp:ModeAtlasProgress.getXP(),answers:sessionStats.answered}));
  await page.evaluate(()=>window.dispatchEvent(new Event('modeAtlasAccountWillChange')));
  await expect(page.locator('#startWrap')).toBeVisible();expect(await page.evaluate(()=>sessionStarted)).toBe(false);
  expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(before.xp);
  const checkpoint=await page.evaluate(mode=>JSON.parse(localStorage.getItem('modeAtlasPracticeCheckpoint:'+mode)),mode);
  expect(checkpoint.sessionStats.answered).toBe(before.answers);
  await page.waitForTimeout(450);expect(await page.evaluate(()=>sessionStarted)).toBe(false);
});


test('visual tour opens real practice setup, goals, rewards and account sections without awarding XP',async({page})=>{
  await page.setViewportSize({width:393,height:852});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','visual-tour');
  });
  await page.goto('/');await page.evaluate(()=>ModeAtlasTour.start());
  const tour=page.getByRole('dialog',{name:'A quick look around'});
  await expect(tour).toBeVisible();await expect(page.locator('.ma-tour-spot')).toBeVisible();
  await tour.getByRole('button',{name:'Next',exact:true}).click();await expect(page).toHaveURL(/\/reading\/$/);
  await expect(page.locator('#modifiersTab')).toBeVisible();
  const before=await page.evaluate(()=>ModeAtlasProgress.getXP());
  await tour.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('#practiceSetupDialog')).toBeVisible();await expect(page.locator('.ma-mode-choice').first()).toBeVisible();
  await page.screenshot({path:test.info().outputPath('tour-setup.png')});
  await tour.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('#maAccount-atlas')).toBeVisible();await expect(page.locator('#atlasPanel0')).toBeVisible();
  await page.screenshot({path:test.info().outputPath('tour-goals.png')});
  await tour.getByRole('button',{name:'Next',exact:true}).click();await expect(page.locator('#atlasPanel1')).toBeVisible();
  await tour.getByRole('button',{name:'Next',exact:true}).click();await expect(page.locator('#maAccount-friends')).toBeVisible();
  await tour.getByRole('button',{name:'Next',exact:true}).click();await expect(page.locator('#maAccount-settings')).toBeVisible();
  expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(before);
  await tour.getByRole('button',{name:'Finish tour',exact:true}).click();await expect(page).toHaveURL(/\/$/);await expect(tour).toHaveCount(0);
});

test('native legal reader opens bundled policies offline and feedback stays an editable in-app draft',async({page})=>{
  await page.setViewportSize({width:320,height:640});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{
    window.feedbackDrafts=[];window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{composeFeedback:async draft=>{feedbackDrafts.push(draft);return {status:'cancelled'};}}}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','help-test');
  });
  await page.goto('/');await page.evaluate(()=>ModeAtlas.openAbout('legal'));
  await page.getByRole('link',{name:'Open Privacy Policy',exact:true}).click();
  const policy=page.getByRole('dialog',{name:'Privacy Policy',exact:true});await expect(policy).toBeVisible();await expect(policy.getByRole('heading',{name:'Reports and safety'})).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  await policy.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.evaluate(()=>{void ModeAtlasHelp.legal('terms');});await expect(page.getByRole('dialog',{name:'Terms of Use',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.waitForFunction(()=>!!window.ModeAtlasAccountNavigation);
  await page.evaluate(()=>ModeAtlasAccountNavigation.open('settings'));await page.getByRole('button',{name:'Send feedback',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Send feedback',exact:true});await form.getByLabel('Message',{exact:true}).fill('A helpful, editable feedback message.');
  await form.getByRole('button',{name:'Continue to email'}).click();
  await expect(form.getByLabel('Message',{exact:true})).toHaveValue('A helpful, editable feedback message.');
  await expect(form.getByRole('status')).toContainText('still here');
  const drafts=await page.evaluate(()=>feedbackDrafts);expect(drafts).toHaveLength(1);expect(drafts[0].body).toContain('Screen: atlas');expect(drafts[0].body).not.toContain('uid');
  await page.screenshot({path:test.info().outputPath('feedback-form.png')});
});


test('a legal reader temporarily owns focus over first-use setup and restores the setup',async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};});
  await page.goto('/');await page.evaluate(()=>modeAtlasTriggerFirstVisit());
  await expect(page.locator('#maVisitModal.open')).toBeVisible();
  await page.locator('#maVisitModal').getByRole('link',{name:/Privacy/}).click();
  const policy=page.getByRole('dialog',{name:'Privacy Policy',exact:true});await expect(policy).toBeVisible();await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>document.activeElement.closest('.ma-dialog')!==null)).toBe(true);
  await page.keyboard.press('Escape');await expect(policy).toBeHidden();await expect(page.locator('#maVisitModal [role=dialog]')).not.toHaveAttribute('inert','');
  await expect(page.locator('#maVisitModal.open')).toBeVisible();
});
