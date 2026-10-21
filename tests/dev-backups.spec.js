const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>require('./helpers/returning-tours')(page));
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
  await page.getByRole('button',{name:'Storage',exact:true}).click();
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
  const contrast=await page.locator('.ma-dev-save-files').evaluate(el=>{
    const rgb=value=>value.match(/\d+(?:\.\d+)?/g).slice(0,3).map(Number);
    const luminance=values=>values.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
    const text=luminance(rgb(getComputedStyle(el).color)),surface=luminance(rgb(getComputedStyle(el.closest('.ma-dev-modal')).backgroundColor));
    return (Math.max(text,surface)+.05)/(Math.min(text,surface)+.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
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

for(const width of [393,1280])test(`developer console account directory and account boundary at ${width}`,async({page},info)=>{
  await prepare(page,{theme:'dark'});await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.evaluate(async()=>{
    window.consoleUser={uid:'developer',email:'admin@mode-atlas.com'};KanaCloudSync.getUser=()=>consoleUser;
    window.directoryCalls=[];ModeAtlasSocial={...ModeAtlasSocial,call:async(action,data)=>{
      directoryCalls.push({action,data});
      if(action==='adminUsers')return {rows:[{uid:'one',displayName:'Test Learner',email:'learner@example.test',role:'member',verified:true,friends:false}],nextCursor:data.cursor?null:'next-page'};
      if(action==='adminInspect')return {uid:'one',providers:['apple.com'],save:{exists:true,revision:7,generation:1,updatedAt:Date.now(),sections:[{name:'reading',partitioned:true,parts:2}]},wallet:{balance:10,tokenBalance:200,purchases:2},social:{active:false,projectionVersion:7,syncedAt:Date.now(),refreshQueued:false},warningCount:0,deleting:false,receipts:[]};
      throw Error('No mock for '+action);
    }};
    await ModeAtlasDevConsoleLoader.loadIfEligible();ModeAtlasDevConsole.open();
  });
  const consoleDialog=page.getByRole('dialog',{name:'Developer console'});await expect(consoleDialog).toBeVisible();
  expect(await consoleDialog.locator('.ma-dev-tabs button').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1))).toBe(true);
  await consoleDialog.getByRole('button',{name:'Accounts',exact:true}).click();await expect(consoleDialog).toContainText('learner@example.test');
  await consoleDialog.getByRole('button',{name:'Next 25'}).click();expect(await page.evaluate(()=>directoryCalls.at(-1).data.cursor)).toBe('next-page');
  await consoleDialog.getByRole('button',{name:'Inspect',exact:true}).click();await expect(consoleDialog).toContainText('Revision 7');await expect(consoleDialog).toContainText('reading (2 parts)');
  await expect(consoleDialog.getByRole('link',{name:'Moderation & warnings'})).toHaveAttribute('href','/friends/?moderate=one');
  expect(await consoleDialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('developer-directory.png')});
  await page.evaluate(()=>{consoleUser=null;dispatchEvent(new CustomEvent('modeAtlasAccountWillChange'));});await expect(consoleDialog).toHaveCount(0);expect(await page.locator('#maDevMenu').textContent()).toBe('');expect(errors).toEqual([]);
});
