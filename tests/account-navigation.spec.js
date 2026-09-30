const {test,expect}=require('@playwright/test');
async function prepare(page,{native=true,width=393,height=852,theme='dark'}={}){
  await page.setViewportSize({width,height});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','account-navigation');
    localStorage.setItem('modeAtlasThemePreference',theme);
  },{native,theme});
  if(native){const device=await page.context().newCDPSession(page);await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});}
  await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
}
async function fits(page){
  expect(await page.locator('#maAccountSheet').evaluate(sheet=>{
    const issues=[],rect=sheet.getBoundingClientRect(),dock=document.querySelector('.ma-ios-tabs');
    if(rect.left<0||rect.right>innerWidth+1||rect.top<0||rect.bottom>innerHeight+1)issues.push('sheet outside viewport');
    if(dock&&dock.getClientRects().length&&rect.bottom>dock.getBoundingClientRect().top+1)issues.push('sheet overlaps dock');
    for(const node of sheet.querySelectorAll('button,.ma-card,input,select')){
      if(node.closest('[hidden],[inert]')||!node.getClientRects().length)continue;
      const box=node.getBoundingClientRect();
      if(box.left<rect.left||box.right>rect.right+1)issues.push(node.textContent+' outside sheet');
      if(node.tagName==='BUTTON'&&node.scrollWidth>node.clientWidth+2)issues.push(node.textContent+' clipped');
    }
    return issues;
  })).toEqual([]);
}
for(const layout of [
  {native:true,theme:'dark',width:393,height:852},
  {native:true,theme:'light',width:393,height:852},
  {native:true,theme:'dark',width:320,height:700},
  {native:true,theme:'light',width:820,height:1180},
  {native:false,theme:'dark',width:1280,height:900}
])test(`${layout.native?'iOS':'web'} ${layout.width} ${layout.theme}: account sections are peers in one surface`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,layout);
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('#profileOpenBtn')).toHaveAttribute('aria-controls','maAccountSheet');
  await expect(page.locator('#profileOpenBtn')).toHaveAttribute('aria-expanded','true');
  const navigation=page.getByRole('tablist',{name:'Account sections',exact:true});
  await expect(navigation.getByRole('tab')).toHaveText(['Profile','Your Atlas','Friends','Settings']);
  for(const label of ['Profile','Your Atlas','Friends','Settings']){
    await navigation.getByRole('tab',{name:label,exact:true}).click();
    await expect(page.locator('#maAccountTitle')).toHaveText(label);
    await expect(page.locator('.ma-account-view:visible')).toHaveCount(1);
    await expect(page.locator('[data-ma-dialog-layer]:visible')).toHaveCount(0);
    await fits(page);
    await page.screenshot({path:info.outputPath(`${label.replaceAll(' ','-')}.png`),animations:'disabled'});
  }
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  await fits(page);
  await navigation.getByRole('tab',{name:'Friends',exact:true}).click();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(navigation.getByRole('tab',{name:'Profile',exact:true})).toHaveAttribute('aria-selected','true');
  await page.locator('#maAccountClose').click();
  await expect(page.locator('#profileOpenBtn')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#profileOpenBtn')).toBeFocused();
  expect(errors).toEqual([]);
});
test('account navigation keeps focus and settings context across a cancelled destructive action',async({page})=>{
  await prepare(page);
  await page.locator('#profileOpenBtn').click();
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  const settings=page.locator('#maAccount-settings');
  await settings.getByRole('button',{name:'Reset data',exact:true}).click();
  await expect(page.locator('.ma-dialog__title')).toHaveText('Reset all Mode Atlas data?');
  await expect(page.locator('#maAccountSheet')).toHaveJSProperty('inert',true);
  await page.getByRole('button',{name:'Keep data',exact:true}).click();
  await expect(settings).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#maAccountSheet')).toHaveJSProperty('inert',false);
  await expect(settings.getByRole('button',{name:'Reset data',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ma-account-layer')).toBeHidden();
  await expect(page.locator('#profileOpenBtn')).toBeFocused();
});
test('account section keys and repeated dock taps keep one navigation owner',async({page})=>{
  await prepare(page);
  await page.locator('#profileOpenBtn').click();
  const nav=page.getByRole('tablist',{name:'Account sections',exact:true});
  await nav.getByRole('tab',{name:'Profile',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(nav.getByRole('tab',{name:'Your Atlas',exact:true})).toBeFocused();
  await page.keyboard.press('End');
  await expect(nav.getByRole('tab',{name:'Settings',exact:true})).toBeFocused();
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('.ma-account-layer')).toBeHidden();
  await page.locator('#profileOpenBtn').click();
  await nav.getByRole('tab',{name:'Your Atlas',exact:true}).click();
  await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('.ma-account-layer')).toBeHidden();
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('#maAccountTitle')).toHaveText('Profile');
  await expect(page.locator('.ma-account-layer')).toHaveCount(1);
  await expect(page.locator('.ma-account-sheet')).toHaveCount(1);
});
