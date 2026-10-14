const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../cloud-sync.js'),'utf8');
async function prepare(page,{native=true,width=393,height=852,theme='dark',auth=false}={}){
  await page.setViewportSize({width,height});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','account-shop');localStorage.setItem('modeAtlasThemePreference',theme);localStorage.setItem('modeAtlasSound','off');
  },{native,theme});
  if(auth){
    const start=source.indexOf('async function loadFirebaseModules() {'),end=source.indexOf('\n}\n\nconst CONFIG',start)+2;
    const loader=`async function loadFirebaseModules(){
      initializeApp=()=>({});getApps=()=>[];getAuth=()=>({});initializeAuth=()=>({});browserLocalPersistence={};getRedirectResult=async()=>null;
      GoogleAuthProvider=class{setCustomParameters(){}};
      onAuthStateChanged=(_auth,callback)=>{window.testAuthChanged=callback;queueMicrotask(()=>callback({uid:'test-account',displayName:'Jack',email:'learner@example.test',emailVerified:true,providerData:[{providerId:'google.com'}]}));};
      getFirestore=()=>({});doc=(_db,...parts)=>parts.join('/');
      getDoc=async()=>({exists:()=>false});setDoc=async()=>{if(window.stallCloud)await new Promise(resolve=>{window.finishCloud=resolve;});};
      signOut=async()=>window.testAuthChanged(null);return true;
    }`;
    await page.route('**/cloud-sync.assets-*.js',route=>route.fulfill({contentType:'text/javascript',body:"window.ModeAtlasEnv={...window.ModeAtlasEnv,canUseFirebase:true};window.KANA_FIREBASE_CONFIG={apiKey:'test',projectId:'test',appId:'test'};\n"+source.slice(0,start)+loader+source.slice(end)}));
  }
  await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
}
for(const layout of [{native:true,width:320,theme:'light'},{native:true,width:393,theme:'dark'},{native:true,width:820,height:1180,theme:'light'},{native:false,width:1280,theme:'dark'}]){
  test(`shop categories and pinned preview ${layout.native?'iOS':'web'} ${layout.width}`,async({page},info)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,layout);
    await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Shop',exact:true}).click();
    const preview=page.locator('#maAccount-shop'),fullLink=preview.getByRole('link',{name:'See full shop'});
    await preview.evaluate(node=>{node.scrollTop=node.scrollHeight;});await expect(fullLink).toBeInViewport();
    await fullLink.click();await expect(page).toHaveURL(/\/shop\/$/);
    const full=page.locator('.ma-shop-full');await expect(full).toBeVisible();
    await expect(full.getByRole('tab')).toHaveText(['Featured','Wardrobe','Theme packs','Streak items','Atlas Coins']);
    await full.getByRole('tab',{name:'Wardrobe',exact:true}).click();await full.getByLabel('Wardrobe type').selectOption('hairstyles');
    await expect(full.locator('[data-ma-shop-product]:visible')).toHaveCount(2);
    await expect(full.locator('[data-ma-shop-product="hunny-jumper"]')).toBeHidden();
    await full.getByRole('tab',{name:'Theme packs',exact:true}).click();await expect(full.locator('.ma-shop-product:visible')).toHaveCount(3);
    await full.getByRole('button',{name:'Preview Skyline collection'}).click();await expect(page.locator('.ma-dialog__title')).toHaveText('Skyline');await page.keyboard.press('Escape');
    await full.getByRole('tab',{name:'Streak items',exact:true}).click();await expect(full.locator('[data-ma-shop-product]:visible')).toHaveCount(2);
    await full.getByRole('tab',{name:'Atlas Coins',exact:true}).click();await expect(full.locator('[data-ma-coin-pack]')).toHaveCount(4);
    await full.getByRole('button',{name:'1,200 Atlas Coins',exact:true}).click();await expect(page.locator('.ma-dialog__title')).toHaveText('1,200 Atlas Coins');await expect(page.locator('.ma-dialog__message')).toContainText('Coin purchases are coming soon');await page.getByRole('button',{name:'Got it',exact:true}).click();
    await page.reload();await expect(page.locator('.ma-shop-full')).toHaveAttribute('data-category','coins');
    await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.dataset.maLargeText='true';});
    await page.locator('.ma-shop-full').getByRole('tab',{name:'Featured',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath('full-shop-large-text.png'),fullPage:true});expect(errors).toEqual([]);
  });
}
test('sign-out opens before a slow sync, shows the last save and updates when it finishes',async({page},info)=>{
  await prepare(page,{auth:true});await page.evaluate(()=>KanaCloudSync.syncNow());
  await page.locator('#profileOpenBtn').click();await expect(page.locator('#profileSyncChip')).toHaveText('Synced');
  await expect(page.locator('#profileLinkBtn')).toBeVisible();
  expect(await page.locator('.ma-auth-actions').evaluate(node=>{
    const boxes=[...node.querySelectorAll('button')].filter(n=>!n.hidden).map(n=>n.getBoundingClientRect());return Math.max(...boxes.map(b=>b.top))-Math.min(...boxes.map(b=>b.top));
  })).toBeLessThan(2);
  const lastSync=await page.locator('#profileSyncMeta').textContent();
  await page.evaluate(()=>{window.stallCloud=true;ModeAtlasStorage.setJSON('kanaWordBank',[{id:'pending',kana:'ねこ',english:'Cat'}]);KanaCloudSync.markSectionUpdated('wordBank');});
  await page.locator('#profileAuthBtn').click();await expect(page.locator('.ma-dialog__title')).toHaveText('Sign out?',{timeout:1000});
  await expect(page.locator('.ma-dialog__message')).toContainText(lastSync);await expect(page.locator('.ma-dialog__message')).toContainText('will be lost');
  await expect(page.getByRole('button',{name:'Sign out and clear',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>typeof finishCloud)).toBe('function');await page.evaluate(()=>{stallCloud=false;finishCloud();});
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();await expect(page.locator('.ma-dialog__message')).toContainText('latest progress is saved');
  await page.screenshot({path:info.outputPath('confirmed-signout.png')});await page.getByRole('button',{name:'Keep studying',exact:true}).click();
  await expect(page.locator('#profileSyncSummary')).toHaveText('All changes saved');expect(await page.evaluate(()=>ModeAtlasStorage.json('kanaWordBank',[])[0].english)).toBe('Cat');
});
test('a cancelled sign-out cannot update the next dialog when its sync finishes',async({page})=>{
  await prepare(page,{auth:true});await page.evaluate(()=>KanaCloudSync.syncNow());await page.locator('#profileOpenBtn').click();
  await page.evaluate(()=>{window.stallCloud=true;ModeAtlasStorage.setJSON('kanaWordBank',[{id:'pending',kana:'ねこ',english:'Cat'}]);});
  await page.locator('#profileAuthBtn').click();await expect.poll(()=>page.evaluate(()=>typeof finishCloud)).toBe('function');await page.getByRole('button',{name:'Keep studying',exact:true}).click();
  await page.evaluate(()=>{void ModeAtlasDialog.alert({title:'Another dialog',message:'Leave this message alone.',confirmLabel:'Got it'});stallCloud=false;finishCloud();});
  await expect(page.locator('.ma-dialog__title')).toHaveText('Another dialog');await expect(page.locator('.ma-dialog__message')).toHaveText('Leave this message alone.');
  await expect(page.getByRole('button',{name:'Got it',exact:true})).toBeVisible();
});
