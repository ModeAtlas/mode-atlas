const {test,expect}=require('@playwright/test');
for(const [native,width,theme]of [[true,320,'light'],[true,393,'dark'],[true,768,'light'],[false,1280,'dark']])test(`shared hub navigation ${native?'iOS':'web'} ${width} ${theme}`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:852});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','hub-navigation');localStorage.setItem('modeAtlasThemePreference',theme);
  },{native,theme});
  if(native){const device=await page.context().newCDPSession(page);await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});}
  const nav=()=>page.locator(native?'.ma-ios-tabs':'.ma-nav__links');
  await page.goto('/learn/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect(nav().locator(native?'.ma-ios-tab__label':'a')).toHaveText(['Atlas','Learn','Progress','Friends']);
  await expect(page.getByRole('link',{name:'Open Word Bank',exact:true})).toBeVisible();
  for(const [name,href] of [['Reading','/reading/'],['Writing','/writing/'],['Results','/results/'],['Kana overview','/kana/'],['Open Word Bank','/wordbank/']]){
    const link=page.getByRole('link',{name,exact:true});await expect(link).toHaveAttribute('href',href);
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('.ma-learn-next')).toHaveAttribute('href','/reading/?practice=10&starter=starter');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(native&&width===393){
    const words=await page.getByRole('link',{name:'Open Word Bank',exact:true}).boundingBox(),dock=await nav().boundingBox();
    expect(words.y+words.height).toBeLessThanOrEqual(dock.y-8);
  }
  await page.screenshot({path:info.outputPath('learn.png'),animations:'disabled'});
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('link',{name:'Open Word Bank',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('link',{name:'Open Word Bank',exact:true})).toBeInViewport();
  expect(await page.locator('.ma-learn-next__start,.ma-learn-row__copy').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1))).toBe(true);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:info.outputPath('learn-large-text.png'),animations:'disabled'});
  await page.evaluate(()=>{document.documentElement.style.fontSize='';document.documentElement.removeAttribute('data-ma-large-text');});
  if(native&&width===393){
    // Saved reviews must still update the existing recommendation and its route.
    await page.evaluate(()=>{
      const due={reviewVersion:1,level:2,due:Date.now()-1000,lastSeen:Date.now()-86400000,recent:[],days:[],peak:1};
      ModeAtlasStorage.writeModeJSON('reading','srs',{'あ':due});
      window.dispatchEvent(new Event('modeAtlasCloudDataChanged'));
    });
    await expect(page.locator('#maLearnNextTitle')).toHaveText('Time to revisit');
    await expect(page.locator('.ma-learn-next')).toHaveAttribute('href','/reading/?practice=10&due=1');
    await page.screenshot({path:info.outputPath('learn-review.png'),animations:'disabled'});
    await page.evaluate(()=>{
      const due={reviewVersion:1,level:2,due:Date.now()-1000,lastSeen:Date.now()-86400000,recent:[],days:[],peak:1};
      ModeAtlasStorage.writeModeJSON('writing','srs',{'あ':due,'い':due});
      window.dispatchEvent(new Event('modeAtlasProgressChanged'));
    });
    await expect(page.locator('.ma-learn-next')).toHaveAttribute('data-mode','writing');
    await expect(page.locator('.ma-learn-next__start')).toHaveText('Start Writing');
    await page.locator('.ma-learn-next').click();
    await expect(page).toHaveURL(/\/writing\/\?practice=10&due=1$/);
    await nav().getByRole('link',{name:'Learn',exact:true}).click();
    await expect(page.locator('.ma-hub-header h1')).toHaveText('Learn');
  }
  await page.getByRole('link',{name:'Reading',exact:true}).click();
  await expect(page).toHaveURL(/\/reading\/$/);await expect(nav().locator(native?'.ma-ios-tab__label':'a')).toHaveText(['Atlas','Learn','Progress','Friends']);
  await nav().getByRole('link',{name:'Progress',exact:true}).click();
  await expect(page.locator('.ma-hub-header h1')).toHaveText('Progress');
  await expect(page.locator('.ma-routine-goal')).toHaveCount(5);
  await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('tablist',{name:'Account sections'}).getByRole('tab')).toHaveText(['Profile','Settings']);
  await page.locator('#maAccountClose').click();await expect(page.getByRole('tabpanel',{name:'Rewards',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Goals',exact:true}).click();
  await page.screenshot({path:info.outputPath('progress.png'),animations:'disabled'});
  await nav().getByRole('link',{name:'Friends',exact:true}).click();
  await expect(page.locator('.ma-hub-header h1')).toHaveText('Friends');await expect(page.locator('.ma-social')).toBeVisible();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#profileAuthBtn')).toBeVisible();await page.locator('#maAccountClose').click();
  await page.screenshot({path:info.outputPath('friends.png'),animations:'disabled'});
  await page.goto('/?section=friends&ranking=weekly');await expect(page).toHaveURL(/\/friends\/\?ranking=weekly$/);
  await page.goto('/?section=atlas');await expect(page).toHaveURL(/\/progress\/$/);
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await page.getByRole('tablist',{name:'Progress',exact:true}).getByRole('tab').evaluateAll(tabs=>tabs.every(tab=>{const range=document.createRange();range.selectNodeContents(tab);return range.getClientRects().length===1&&tab.scrollWidth<=tab.clientWidth+1;}))).toBe(true);
  if(native)expect(await nav().evaluate(dock=>[...dock.querySelectorAll('.ma-ios-tab__label')].every(node=>{const range=document.createRange();range.selectNodeContents(node);return range.getClientRects().length===1&&node.scrollWidth<=node.clientWidth+1;}))).toBe(true);
  await page.screenshot({path:info.outputPath('progress-large-text.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});
