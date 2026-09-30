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
    sessionStorage.setItem('modeAtlasTourPending','1');
  });
  await page.goto('/');
  const dialog=page.getByRole('dialog',{name:'A quick look around'});
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog',{name:'What’s new',exact:true})).toBeHidden();
  await dialog.getByRole('button',{name:'Next',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Make practice yours'})).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
  expect(await page.evaluate(()=>localStorage.getItem('modeAtlasTourSeen'))).toBe('1');
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
