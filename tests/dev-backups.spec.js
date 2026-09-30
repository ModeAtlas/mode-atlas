const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');

async function prepare(page,{native=false,production=false,theme='dark'}={}){
  await page.setViewportSize({width:393,height:852});
  await page.route(/^https?:\/\//,async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1')return route.continue();
    if(url.hostname==='mode-atlas.app'){
      const response=await route.fetch({url:`http://127.0.0.1:4173${url.pathname}${url.search}`});
      return route.fulfill({response});
    }
    return route.abort();
  });
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','developer-files');
    localStorage.setItem('modeAtlasThemePreference',theme);
  },{native,theme});
  await page.goto(production?'https://mode-atlas.app/':'/');
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>!!window.KanaCloudSync)).toBe(true);
}
async function openFiles(page,{admin=false}={}){
  await page.evaluate(async admin=>{
    if(admin)window.KanaCloudSync.getUser=()=>({uid:'developer',email:'admin@mode-atlas.com'});
    await window.ModeAtlasDevConsoleLoader.loadIfEligible();
    window.ModeAtlasDevConsole.open();
  },admin);
  await page.getByRole('button',{name:'Save files',exact:true}).click();
}
const filePayload=()=>({name:'test-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'Mode Atlas',version:2,
  exportedAt:new Date().toISOString(),data:{charStats:JSON.stringify({'あ':{correct:9,wrong:1}})}}))});

for(const native of [false,true])test(`${native?'iOS localhost':'production web'}: normal Settings has no file tools and reset still asks`,async({page})=>{
  await prepare(page,{native,production:!native});
  await page.evaluate(()=>{
    ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:3,wrong:0}});
    // A stale global from another script cannot grant developer eligibility.
    window.currentUser={email:'admin@mode-atlas.com'};
    window.ModeAtlasSettings.open();
  });
  await expect(page.locator('[data-ma-unified-export],[data-ma-unified-copy],[data-ma-unified-import],[data-ma-unified-file]')).toHaveCount(0);
  expect(await page.evaluate(async()=>({eligible:ModeAtlasDevConsoleLoader.isEligible(),loaded:await ModeAtlasDevConsoleLoader.loadIfEligible(),backups:!!window.ModeAtlasDevBackups})))
    .toEqual({eligible:false,loaded:false,backups:false});
  const blocked=await page.evaluate(async()=>{
    const errors=[];
    for(const call of [()=>KanaCloudSync.createBackup(),()=>KanaCloudSync.previewLocalBackup({}),()=>KanaCloudSync.importLocalBackup({})]){
      try{await call();}catch(error){errors.push(error.message);}
    }
    return errors;
  });
  expect(blocked).toHaveLength(3);expect(blocked.every(message=>message.includes('Developer access'))).toBe(true);
  await expect(page.locator('[data-ma-repair-data]')).toBeVisible();
  await page.locator('[data-ma-unified-reset]').click();
  await expect(page.locator('.ma-dialog__title')).toHaveText('Reset all Mode Atlas data?');
  await page.getByRole('button',{name:'Keep data',exact:true}).click();
  expect(await page.evaluate(()=>ModeAtlasStorage.readModeJSON('reading','charStats',{})['あ'].correct)).toBe(3);
});

test('localhost developer exports and copies the canonical save, then cancels or confirms import',async({page})=>{
  await prepare(page);await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.evaluate(()=>{
    ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:3,wrong:0}});
    ModeAtlasStorage.writeModeJSON('writing','charStats',{'い':{correct:2,wrong:0}});
  });
  await openFiles(page);
  const downloaded=page.waitForEvent('download');
  await page.locator('[data-ma-dev-export-save]').click();
  const download=await downloaded;
  const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  expect(backup.app).toBe('Mode Atlas');expect(backup.version).toBe(2);
  expect(JSON.parse(backup.data.charStats)['あ'].correct).toBe(3);
  await page.locator('[data-ma-dev-copy-save]').click();
  await expect(page.locator('[data-ma-dev-backup-status]')).toHaveText('Save copied.');
  const copied=await page.evaluate(async()=>JSON.parse(await navigator.clipboard.readText()));
  expect(copied.snapshot.sections.reading.data).toEqual(backup.snapshot.sections.reading.data);
  await page.locator('[data-ma-dev-backup-file]').setInputFiles(filePayload());
  await expect(page.locator('.ma-dialog__title')).toHaveText('Review imported save');
  await expect(page.locator('#maDevMenu')).not.toHaveClass(/open/);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>ModeAtlasStorage.readModeJSON('reading','charStats',{})['あ'].correct)).toBe(3);
  await openFiles(page);
  await page.locator('[data-ma-dev-backup-file]').setInputFiles(filePayload());
  await expect(page.locator('.ma-dialog__title')).toHaveText('Review imported save');
  const reloaded=page.waitForEvent('load');
  await page.getByRole('button',{name:'Continue import',exact:true}).click();
  await reloaded;
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  expect(await page.evaluate(()=>({reading:ModeAtlasStorage.readModeJSON('reading','charStats',{})['あ'].correct,
    writing:ModeAtlasStorage.readModeJSON('writing','charStats',{})['い'].correct}))).toEqual({reading:9,writing:2});
});

test('iOS developer files remain readable in light mode and access is revoked during confirmation',async({page})=>{
  await prepare(page,{native:true,theme:'light'});await openFiles(page,{admin:true});
  // Diagnostics keeps a dark surface, independent of the learner's theme.
  const ink=await page.locator('.ma-dev-save-files').evaluate(el=>getComputedStyle(el).color.match(/\d+/g).slice(0,3).map(Number));
  expect(Math.min(...ink)).toBeGreaterThan(220);
  const close=page.locator('[data-ma-dev-close]');
  expect(await close.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.locator('[data-ma-dev-backup-file]').setInputFiles(filePayload());
  await expect(page.locator('.ma-dialog__title')).toHaveText('Review imported save');
  await page.evaluate(()=>{
    KanaCloudSync.getUser=()=>null;
    window.dispatchEvent(new Event('kanaCloudSyncStatusChanged'));
  });
  await page.getByRole('button',{name:'Continue import',exact:true}).click();
  await expect(page.locator('.ma-toast')).toContainText('Developer access is required.');
  expect(await page.evaluate(()=>ModeAtlasStorage.readModeJSON('reading','charStats',{}))).toEqual({});
  expect(await page.evaluate(()=>ModeAtlasDevBackups.exportFile())).toBe(false);
  expect(await page.evaluate(()=>ModeAtlasDevConsoleLoader.loadIfEligible())).toBe(false);
  await expect(page.locator('#maHiddenDevTrigger')).toHaveCount(0);
});

test('developer import rejects malformed files and an account switch during file reading',async({page})=>{
  await prepare(page);await openFiles(page);
  expect(await page.evaluate(()=>ModeAtlasDevBackups.importFile({text:async()=>'{broken'}))).toBe(false);
  const result=await page.evaluate(async()=>{
    let finish;
    const pending=ModeAtlasDevBackups.importFile({text:()=>new Promise(resolve=>{finish=resolve;})});
    KanaCloudSync.getUser=()=>({uid:'different-account',email:'learner@example.test'});
    finish(JSON.stringify({data:{charStats:JSON.stringify({'あ':{correct:99}})}}));
    return pending;
  });
  expect(result).toBe(false);
  await expect(page.locator('.ma-dialog__title')).toHaveCount(0);
  expect(await page.evaluate(()=>ModeAtlasStorage.readModeJSON('reading','charStats',{}))).toEqual({});
});
