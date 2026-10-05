const {test,expect}=require('@playwright/test');
for(const [native,width,theme]of [[true,320,'light'],[true,393,'dark'],[false,1280,'dark']])test(`shared hub navigation ${native?'iOS':'web'} ${width} ${theme}`,async({page},info)=>{
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
  await page.screenshot({path:info.outputPath('learn.png'),animations:'disabled'});
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
  if(native)expect(await nav().evaluate(dock=>[...dock.querySelectorAll('.ma-ios-tab__label')].every(node=>{const range=document.createRange();range.selectNodeContents(node);return range.getClientRects().length===1&&node.scrollWidth<=node.clientWidth+1;}))).toBe(true);
  await page.screenshot({path:info.outputPath('progress-large-text.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});
