const {test,expect}=require('@playwright/test');
for(const native of [false,true])test(`${native?'native':'production web'}: manual saves have no public UI or alternate API and cannot change learning`,async({page})=>{
  await page.route(/^https?:\/\//,async route=>{
    const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
    if(url.hostname==='mode-atlas.app'){const response=await route.fetch({url:`http://127.0.0.1:4173${url.pathname}${url.search}`});return route.fulfill({response});}
    return route.abort();
  });
  await page.addInitScript(native=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
  },native);
  await page.goto(native?'/':'https://mode-atlas.app/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(()=>{KanaCloudSync.getUser=()=>({uid:'ordinary-user',email:'admin@mode-atlas.com',getIdTokenResult:async()=>({claims:{modeAtlasAdmin:false}})});ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:8,wrong:2}});ModeAtlasSettings.open();});
  const settings=page.locator('#maAccount-settings');await expect(settings).toBeVisible();
  await expect(settings.getByRole('button',{name:/backup|save file|export learning|restore learning/i})).toHaveCount(0);
  await expect(settings.locator('input[type=file],[data-ma-export-learning],[data-ma-restore-learning]')).toHaveCount(0);
  const result=await page.evaluate(async()=>{
    await ModeAtlasDevConsoleLoader.loadIfEligible();
    const before=JSON.stringify(ModeAtlasStorage.snapshotBackupStorage(localStorage)),errors=[];
    const fake={app:'Mode Atlas',kind:'learning-backup',version:1,owner:'ordinary-user',snapshot:{sections:{reading:{data:{charStats:{'あ':{correct:9999,wrong:0}}},updatedAt:Date.now()}}}};
    for(const call of [()=>KanaCloudSync.createBackup(),()=>KanaCloudSync.previewLocalBackup(fake),()=>KanaCloudSync.importLocalBackup(fake)])try{await call();}catch(error){errors.push(error.message);}
    return {errors,unchanged:before===JSON.stringify(ModeAtlasStorage.snapshotBackupStorage(localStorage)),alternate:['createLearningBackup','previewLearningBackup','importLearningBackup'].filter(name=>name in KanaCloudSync),eligible:ModeAtlasDevConsoleLoader.isEligible()};
  });
  expect(result.eligible).toBe(false);expect(result.alternate).toEqual([]);expect(result.errors).toHaveLength(3);expect(result.errors.every(value=>value.includes('Developer access'))).toBe(true);expect(result.unchanged).toBe(true);
});
