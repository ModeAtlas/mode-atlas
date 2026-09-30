const {test,expect}=require('@playwright/test');

async function prepare(page,theme){
  await page.setViewportSize({width:393,height:852});
  await page.route(/https:\/\/([\w-]+\.)?(gstatic|googleapis)\.com\/.*/,route=>route.abort());
  await page.addInitScript(theme=>{
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    localStorage.setItem('modeAtlasThemePreference',theme);
    localStorage.setItem('maWhatsNewSeen','home-layout');
    localStorage.setItem('modeAtlasLastStudiedAt',String(Date.now()));
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
  },theme);
  const device=await page.context().newCDPSession(page);
  await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});
  return device;
}
async function geometry(page){
  return page.evaluate(()=>{
    const dock=document.querySelector('.ma-ios-tabs').getBoundingClientRect();
    const home=document.querySelector('.atlas-ios-home').getBoundingClientRect();
    const header=document.querySelector('.atlas-ios-home__header').getBoundingClientRect();
    const css=getComputedStyle(document.documentElement);
    return {
      overflow:document.documentElement.scrollHeight-innerHeight,
      gap:dock.top-home.bottom,
      header:header.top,
      measured:parseFloat(css.getPropertyValue('--ma-ios-dock-height')),
      actual:dock.height,
      horizontal:document.documentElement.scrollWidth-innerWidth,
      scrollY
    };
  });
}
async function expectCompact(page){
  await expect.poll(async()=>{
    const g=await geometry(page);
    return g.overflow<=1 && g.gap>=12 && g.gap<=24 && g.header>=59 && g.horizontal<=1 && Math.abs(g.actual-g.measured)<1 ? null : g;
  }).toBeNull();
}

async function seedRecommendation(page,kind,{complete=false}={}){
  await page.evaluate(({kind,complete})=>{
    const strong={'あ':{correct:20,wrong:0}},weak=Object.fromEntries(['あ','い'].map(kana=>[kana,{correct:2,wrong:2}]));
    for(const mode of ['reading','writing']){
      ModeAtlasStorage.writeModeJSON(mode,'charStats',kind==='new'?{}:kind===`weak-${mode}`?weak:kind==='cross-mode'&&mode==='writing'?{}:strong);
      ModeAtlasStorage.writeModeJSON(mode,'srs',kind==='due'?{'あ':{reviewVersion:1,level:2,due:Date.now()-1000,lastSeen:Date.now()-86400000,recent:[],days:[],peak:1}}:{});
    }
    ModeAtlasStorage.setJSON('modeAtlasLastMode',{href:kind.includes('writing')?'/writing/':'/reading/'});
    if(complete){
      // Hydrated progression must render both long numbers and completed ticks.
      // Recommendation selection still runs through the real study policy.
      const routine=ModeAtlasProgress.routine();
      window.ModeAtlasProgress={...ModeAtlasProgress,
        getSummary:()=>({level:50,lifetimeCorrect:123456,levelXp:799,levelRequirement:800,progress:.999}),
        routine:()=>({...routine,goals:routine.goals.map(goal=>({...goal,value:goal.target}))})};
    }
    window.dispatchEvent(new Event('modeAtlasCloudDataChanged'));
  },{kind,complete});
}

for(const theme of ['dark','light'])test(`iOS ${theme}: returning suggestions and completed goals fit above the dock`,async({page},testInfo)=>{
  await prepare(page,theme);
  await page.goto('/');
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(()=>document.fonts.ready);
  const suggestions={'new':'Start small','reading':'Build your reading','writing':'Build your recall',
    'weak-reading':'Read tricky kana','weak-writing':'Recall tricky kana','cross-mode':'Try writing','due':'Time to revisit'};
  // Keep the larger 59px notch inset even on the narrower phone: verify spare
  // space, not just one exact screen with fresh/empty account content.
  for(const viewport of [{width:393,height:852},{width:390,height:844},{width:375,height:812},{width:430,height:932}]){
    await page.setViewportSize(viewport);
    for(const [kind,title] of Object.entries(suggestions)){
      await seedRecommendation(page,kind);
      await expect(page.locator('#iosHomeContinueTitle')).toHaveText(title);
      await expectCompact(page);
    }
    await seedRecommendation(page,'weak-writing',{complete:true});
    await expect(page.locator('#iosHomeCorrect')).toHaveText('123,456');
    await expect(page.locator('#iosHomeGoals [data-complete="true"]')).toHaveCount(3);
    await expectCompact(page);
    const fits=await page.evaluate(()=>[...document.querySelectorAll('.atlas-ios-home__continue,.atlas-ios-home__cta,.atlas-ios-home__routine .ma-button,#iosHomeGoals strong,#iosHomeGoals span')].every(node=>node.scrollWidth<=node.clientWidth+1));
    expect(fits).toBe(true);
  }
  await page.setViewportSize({width:393,height:852});
  await expectCompact(page);
  await expect(page.locator('.ma-toast')).toHaveCount(0,{timeout:15000});
  await page.screenshot({path:testInfo.outputPath(`returning-goals-${theme}.png`)});
  await page.locator('.atlas-ios-home__routine [data-ma-rewards-open]').click();
  await expect(page.locator('#maAccountTitle')).toHaveText('Your Atlas');
  await page.locator('.ma-dialog__close').click();
  await expectCompact(page);
});

for(const theme of ['dark','light'])test(`iOS ${theme}: cold launch, safe-area change and return to Atlas have the same fit`,async({page},testInfo)=>{
  const device=await prepare(page,theme);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ma-native-warm','false');
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  console.log('Cold home geometry',await geometry(page));
  await expectCompact(page);
  // Simulate cloud progress arriving after the first document paint.
  await page.evaluate(()=>{
    window.ModeAtlasProgress={...window.ModeAtlasProgress,getSummary:()=>({level:15,lifetimeCorrect:6214,levelXp:264,levelRequirement:800,progress:.33})};
    window.dispatchEvent(new Event('modeAtlasProgressChanged'));
  });
  await expect(page.locator('#iosHomeCorrect')).toHaveText('6,214');
  await expectCompact(page);
  await expect.poll(()=>page.evaluate(()=>{
    const toast=document.querySelector('.ma-toast-wrap');
    return !toast || toast.getBoundingClientRect().bottom<=document.querySelector('.ma-ios-tabs').getBoundingClientRect().top-12;
  })).toBe(true);
  await expect(page.locator('.ma-toast')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath(`home-safe-area-${theme}.png`)});
  // WKWebView safe areas can settle without a viewport resize or body-class change.
  await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:21,left:0,right:0}});
  await expectCompact(page);
  await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});
  await expectCompact(page);
  await page.locator('.ma-ios-tabs__links a[href="/kana/"]').click();
  await page.waitForURL('**/kana/');
  await page.locator('.ma-ios-kana-back').click();
  await page.locator('.ma-ios-tabs__links a[href="/"]').click();
  await page.waitForURL('**/');
  await expect(page.locator('html')).toHaveAttribute('data-ma-native-warm','true');
  await expectCompact(page);
  expect((await geometry(page)).scrollY).toBe(0);
  await page.evaluate(()=>window.ModeAtlas.openAbout());
  await page.locator('.ma-dialog__close').click();
  await expectCompact(page);
});

test('iOS Atlas keeps the final actions reachable with larger text and a short viewport',async({page})=>{
  await prepare(page,'light');
  await page.setViewportSize({width:375,height:667});
  await page.goto('/');
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(()=>document.documentElement.style.fontSize='24px');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight>innerHeight)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await expect.poll(()=>page.evaluate(()=>{
    const last=document.querySelector('.atlas-ios-home__routine').getBoundingClientRect();
    const dock=document.querySelector('.ma-ios-tabs').getBoundingClientRect();
    return last.top>=0 && last.bottom<=dock.top-12 && scrollY>0;
  })).toBe(true);
});
