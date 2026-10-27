const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>require('./helpers/kana-fixture')(page));
const fs=require('node:fs');
const catalogue=require('../assets/app/mode-atlas-shop-catalogue.js');
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
      const records=new Map();
      getDoc=async ref=>({exists:()=>records.has(ref),data:()=>structuredClone(records.get(ref)),metadata:{fromCache:false}});
      setDoc=async(ref,value)=>{records.set(ref,structuredClone(value));};
      runTransaction=async(_db,action)=>{const changes=[];const result=await action({get:getDoc,set:(ref,value)=>changes.push(()=>records.set(ref,structuredClone(value))),delete:ref=>changes.push(()=>records.delete(ref))});if(changes.length&&window.stallCloud)await new Promise(resolve=>{window.finishCloud=resolve;});changes.forEach(commit=>commit());return result;};
      signOut=async()=>window.testAuthChanged(null);return true;
    }`;
    await page.route('**/cloud-sync.assets-*.js',route=>route.fulfill({contentType:'text/javascript',body:"window.ModeAtlasEnv={...window.ModeAtlasEnv,canUseFirebase:true};window.KANA_FIREBASE_CONFIG={apiKey:'test',projectId:'test',appId:'test'};\n"+source.slice(0,start)+loader+source.slice(end)}));
  }
  await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
}
for(const layout of [{native:true,width:320,theme:'light'},{native:true,width:393,theme:'dark'},{native:true,width:820,height:1180,theme:'light'},{native:false,width:1280,theme:'dark'}]){
  test(`shop categories and scrolling preview ${layout.native?'iOS':'web'} ${layout.width}`,async({page},info)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,layout);
    await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Shop',exact:true}).click();
    const preview=page.locator('#maAccount-shop'),fullLink=preview.getByRole('link',{name:'See full shop'});
    await expect(fullLink).toBeVisible();
    const header=preview.locator('.ma-shop-header'),before=(await header.boundingBox()).y;
    await preview.evaluate(node=>{node.scrollTop=node.scrollHeight;});
    const scrolled=await preview.evaluate(node=>node.scrollTop);
    expect(before-(await header.boundingBox()).y).toBeCloseTo(scrolled,0);
    await preview.evaluate(node=>{node.scrollTop=0;});await expect(fullLink).toBeInViewport();
    await fullLink.click();await expect(page).toHaveURL(/\/shop\/$/);
    const full=page.locator('.ma-shop-full');await expect(full).toBeVisible();
    await expect(full.getByRole('tab')).toHaveText(['Featured','Wardrobe','Pets','Theme packs','Streak items','Atlas Coins']);
    await full.getByRole('tab',{name:'Wardrobe',exact:true}).click();await full.getByLabel('Wardrobe type').selectOption('hairstyles');
    await expect(full.locator('[data-ma-shop-product]:visible')).toHaveCount(catalogue.products.filter(p=>p.rewards?.[0]?.type==='hairstyles').length);
    await expect(full.locator('[data-ma-shop-product="hunny-jumper"]')).toBeHidden();
    await full.getByRole('tab',{name:'Pets',exact:true}).click();await expect(full.locator('[data-ma-shop-product]:visible')).toHaveCount(8);await expect(full.locator('[data-ma-shop-product=japanese-spitz] .ma-shop-essential__symbol svg')).toHaveAttribute('viewBox','0 -14 120 140');
    await full.locator('[data-ma-shop-product=japanese-spitz]').click();await expect(page.locator('.ma-dialog__title')).toHaveText('Japanese Spitz');
    const large=await page.locator('.ma-shop-detail .ma-shop-item-preview').boundingBox();expect(large.height).toBeGreaterThan(190);await page.keyboard.press('Escape');
    await full.getByRole('tab',{name:'Theme packs',exact:true}).click();await expect(full.locator('.ma-shop-product:visible')).toHaveCount(4);
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

test('repair inventory previews the entire eligible gap and its calendar expiry',async({page})=>{
  await prepare(page);await page.evaluate(()=>{
    const wallet={status:'ready',balance:0,inventory:{'streak-freeze':0,'streak-repair':1},repairDay:'2026-10-05',repair:{days:['2026-10-03','2026-10-04','2026-10-05'],expiresOn:'2026-10-12'}};
    window.repairUses=0;KanaCloudSync.getUser=()=>({uid:'repair-owner'});
    window.ModeAtlasShop={...ModeAtlasShop,current:()=>wallet,useRepair:async()=>{repairUses++;}};
    const host=document.createElement('section');host.id='repairFixture';document.querySelector('.atlas-home').append(host);ModeAtlasShopUI.renderInventory(host);
  });
  await expect(page.locator('#repairFixture')).toContainText('Restore 3 missed days');
  await expect(page.locator('#repairFixture')).toContainText('Use by');
  await page.getByRole('button',{name:'Use repair',exact:true}).click();await expect(page.locator('.ma-dialog__message')).toContainText('without adding study days or XP');
  await page.locator('.ma-dialog').getByRole('button',{name:'Use repair',exact:true}).click();expect(await page.evaluate(()=>repairUses)).toBe(1);
});

test('large purchase preview keeps the item visible, retries errors and spends the chosen currency',async({page},info)=>{
  await prepare(page,{width:393});await page.goto('/shop/?category=wardrobe');await expect(page.locator('.ma-shop-full')).toBeVisible();
  await page.evaluate(async()=>{
    KanaCloudSync.getUser=()=>({uid:'preview-buyer'});KanaCloudSync.syncNow=async()=>true;
    window.previewWallet={balance:1000,tokenBalance:2000,owned:[]};window.previewPayments=[];window.failPreviewPurchase=true;
    ModeAtlasSocial={...ModeAtlasSocial,call:async(action,data)=>{
      const w=previewWallet;
      if(action==='rewards')return {allCustom:false,grants:w.owned.map(id=>'shop-'+id),validUntil:Date.now()+86400000};
      if(action==='shopPurchase'){
        previewPayments.push(data);if(failPreviewPurchase){failPreviewPurchase=false;throw Object.assign(Error('Try again'),{code:'unavailable'});}
        w[data.currency==='study-tokens'?'tokenBalance':'balance']-=data.price;w.owned.push(data.productId);
      }
      return {version:3,currency:'atlas-coins',earnedCurrency:'study-tokens',...w,inventory:{'streak-freeze':0,'streak-repair':0},protection:[],repairDay:null,offers:ModeAtlasShopCatalogue.products.map(p=>ModeAtlasShopCatalogue.offer(p)).filter(Boolean),checkedAt:Date.now()};
    }};await ModeAtlasRewardAccess.refresh(true);await ModeAtlasShop.refresh(true);
  });
  await page.locator('.ma-shop-full [data-ma-shop-product=crewneck]').click();const detail=page.locator('[data-ma-shop-detail]');await expect(detail.locator('.ma-shop-item-preview svg')).toBeVisible();
  await expect(detail.getByRole('button',{name:'Buy for 90 Atlas Coins',exact:true})).toBeEnabled();await detail.getByRole('button',{name:'Buy for 550 Study Tokens',exact:true}).click();
  await expect(detail.locator('[data-ma-shop-detail-status]')).not.toBeEmpty();await expect(detail.locator('.ma-shop-item-preview')).toBeVisible();
  await expect(detail.getByRole('button',{name:'Buy for 550 Study Tokens',exact:true})).toBeEnabled();await page.screenshot({path:info.outputPath('purchase-preview.png')});
  await detail.getByRole('button',{name:'Buy for 550 Study Tokens',exact:true}).click();await expect(detail).toHaveCount(0);
  await expect(page.locator('.ma-shop-full [data-ma-token-balance]')).toHaveText('1,450');await expect(page.locator('.ma-shop-full [data-ma-coin-balance]')).toHaveText('1,000');
  expect(await page.evaluate(()=>previewPayments.map(p=>[p.currency,p.price]))).toEqual([['study-tokens',550],['study-tokens',550]]);
  await page.getByRole('tab',{name:'Theme packs',exact:true}).click();await page.locator('.ma-shop-full [data-ma-shop-product=sakura]').click();await expect(page.locator('[data-ma-shop-buy]')).toHaveCount(1);await expect(page.locator('[data-ma-shop-buy]')).toHaveText('Buy for 750 Atlas Coins');
});

for(const width of [320,393])test(`compact branch, wallet and About layout stays usable at ${width}px`,async({page})=>{
  await prepare(page,{width});
  await page.addInitScript(()=>{window.Capacitor.Plugins.ModeAtlasNative={setAppIcon:async()=>true};});
  await page.goto('/kanji/');await page.getByRole('button',{name:'Start as a beginner',exact:true}).click();await expect(page.locator('.ma-kanji-level')).toHaveCount(5);
  const levels=await page.locator('.ma-kanji-level').evaluateAll(nodes=>nodes.map(node=>({width:node.clientWidth,scroll:node.scrollWidth,top:node.getBoundingClientRect().top})));
  expect(levels.every(box=>box.scroll<=box.width+1)).toBe(true);expect(new Set(levels.map(box=>box.top)).size).toBe(1);
  await expect(page.locator('.ma-kanji-course-summary')).toContainText('N5 · Foundations');
  await expect(page.getByRole('button',{name:'How levels unlock',exact:true})).toHaveCount(0);
  await page.goto('/progress/?tab=rewards');const summary=page.locator('[data-reward-category=icons]>summary');await expect(summary.locator('img')).toBeVisible();
  const image=await summary.locator('img').boundingBox(),box=await summary.boundingBox();expect(image.y+image.height).toBeLessThanOrEqual(box.y+box.height);await summary.click();await expect(page.locator('.ma-atlas-icon-choice img').first()).toHaveAttribute('src','/assets/mode-atlas-icon.svg');
  await page.goto('/shop/');await expect(page.locator('.ma-shop-full')).toBeVisible();
  await page.evaluate(()=>{ModeAtlasShop={...ModeAtlasShop,current:()=>({status:'ready',balance:450,tokenBalance:3043,offers:null,owned:[],inventory:{}})};ModeAtlasShopUI.refresh();});
  const coins=await page.locator('.ma-shop-full [data-ma-coin-balance]').boundingBox(),tokens=await page.locator('.ma-shop-full [data-ma-token-balance]').boundingBox();expect(Math.abs(coins.y-tokens.y)).toBeLessThan(2);
  const first=await page.locator('.ma-shop-product:visible').first().boundingBox();expect(first.y+first.height).toBeLessThan(760);
  await expect(page.getByRole('button',{name:'How to earn Study Tokens',exact:true})).toHaveCount(0);
  await page.addStyleTag({content:'html[data-ma-runtime="ios"]{--ma-page-inset-top:59px;}'});await page.evaluate(()=>ModeAtlas.openAbout());await expect(page.locator('.ma-dialog-layer')).toHaveCSS('opacity','1');
  await expect(page.locator('.ma-about-mark')).toHaveAttribute('src','/assets/brand/mode-atlas-symbol.svg');
  const cards=await page.locator('.ma-about-card').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top));expect(cards[0]).toBe(cards[1]);
  const dialog=await page.locator('.ma-dialog').boundingBox();expect(dialog.y).toBeGreaterThanOrEqual(59);expect(dialog.width).toBeLessThanOrEqual(width-24);
  await page.getByRole('tab',{name:'Legal',exact:true}).click();await expect(page.getByRole('link',{name:'Open Privacy Policy',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.locator('.ma-dialog-layer')).toBeHidden();
});

test('unopened shops stay unmounted and catalogue refresh projects progress once',async({page})=>{
  await prepare(page);
  await expect(page.locator('#maAccount-shop [data-ma-shop-product]')).toHaveCount(0);
  await page.evaluate(()=>{
    const original=ModeAtlasProgress;window.summaryReads=0;
    window.ModeAtlasProgress={...original,getSummary(...args){summaryReads++;return original.getSummary(...args);}};
    ModeAtlasShopUI.refresh();
  });
  expect(await page.evaluate(()=>summaryReads)).toBe(0);
  await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Shop',exact:true}).click();
  expect(await page.locator('#maAccount-shop [data-ma-shop-product]').count()).toBeLessThanOrEqual(6);
  expect(await page.evaluate(()=>{summaryReads=0;ModeAtlasShopUI.refresh();return summaryReads;})).toBe(1);
  await page.locator('#maAccountClose').click();
  expect(await page.evaluate(()=>{summaryReads=0;ModeAtlasShopUI.refresh();return summaryReads;})).toBe(0);
  await page.goto('/progress/?tab=goals');
  await expect(page.locator('[data-reward-category]')).toHaveCount(0);
  await page.getByRole('tab',{name:'Rewards',exact:true}).click();await expect(page.locator('[data-reward-category=themes]')).toBeVisible();
  await expect(page.locator('[data-reward-category=themes] .ma-reward-category__meta')).toContainText('3 available');
  await page.getByRole('tab',{name:'Recap',exact:true}).click();await expect(page.getByText('Your weekly recap',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Goals',exact:true}).click();await expect(page.locator('.ma-routine-goal')).toHaveCount(5);
});
