const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>require('./helpers/kana-fixture')(page));
// Each case owns its browser context, mocks and output paths; shard them independently.
test.describe.configure({mode:'parallel'});

for(const layout of [{native:true,theme:'dark',width:393},{native:true,theme:'light',width:320},{native:false,theme:'dark',width:1280}])test(`character creator saves one portrait across profile and progress ${layout.native?'iOS':'web'} ${layout.theme}`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,layout);await page.setViewportSize({width:layout.width,height:900});await open(page,'/progress/');
  await page.evaluate(async()=>{
    window.avatarFixture={version:1,revision:0,avatar:'kana',character:{...ModeAtlasAvatarRules.defaults},level:1,accountPhoto:'https://lh3.googleusercontent.com/a/fixture'};
    window.avatarUser={uid:'character-owner'};window.avatarSaves=[];KanaCloudSync.getUser=()=>avatarUser;KanaCloudSync.syncNow=()=>new Promise(()=>{});
  });
  await page.evaluate(async()=>{
    window.ModeAtlasSocial={...ModeAtlasSocial,call:async(action,data)=>{
      if(action==='avatarState')return structuredClone(avatarFixture);
      if(action==='rewards')return {allCustom:false,grants:['shop-sakura','shop-honey-blonde'],validUntil:Date.now()+86400000};
      if(action==='avatarUpdate'){avatarSaves.push(data);avatarFixture={...avatarFixture,...data,revision:avatarFixture.revision+1};return structuredClone(avatarFixture);}
      throw Error('Unavailable');
    }};
    await ModeAtlasRewardAccess.refresh(true);await ModeAtlasAvatar.refresh(true);ModeAtlasAccountNavigation.open('profile');
  });
  await page.locator('#maAccount-profile [data-ma-avatar-open]').click();
  const dialog=page.getByRole('dialog',{name:'Your avatar & pet'});await expect(dialog.getByRole('img',{name:'Your character and pet preview'})).toBeVisible();
  const selectedType=dialog.getByRole('button',{name:'Character portrait',exact:true});await readable(selectedType,await selectedType.evaluate(node=>getComputedStyle(node).backgroundColor));
  await dialog.getByRole('button',{name:'Cocoa',exact:true}).click();await dialog.getByRole('button',{name:'Coils',exact:true}).click();
  await expect(dialog.locator('[data-avatar-slot=hairColor]')).toHaveCount(7);
  await expect(dialog.getByRole('button',{name:'Rose gold',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Honey blonde',exact:true}).click();
  await dialog.getByRole('button',{name:'Wardrobe',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Grove cardigan',exact:true})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Moonlight hoodie',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Blossom jacket',exact:true}).click();await dialog.getByRole('button',{name:'Blossom clip',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Trail trousers',exact:true})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Tailored pinstripes',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Blossom pleats',exact:true}).click();
  await page.screenshot({path:info.outputPath('character-wardrobe.png'),animations:'disabled'});
  expect(await dialog.evaluate(node=>[...node.querySelectorAll('button,fieldset')].filter(el=>el.getClientRects().length).some(el=>{const b=el.getBoundingClientRect();return b.left<0||b.right>innerWidth+1;}))).toBe(false);
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toBeHidden();
  expect(await page.evaluate(()=>avatarSaves)).toEqual([expect.objectContaining({avatar:'character',revision:0,character:expect.objectContaining({version:3,skin:'cocoa',hair:'coils',hairColor:'honey-blonde',outfit:'sakura',headwear:'sakura',pants:'sakura'})})]);
  await expect(page.locator('[data-ma-selected-avatar] svg')).toHaveCount(1);await expect(page.locator('#topProfileDot svg')).toHaveCount(1);
  await page.evaluate(()=>ModeAtlasAccountNavigation.open('profile'));await expect(page.locator('#profileAvatar svg')).toBeVisible();
  await page.locator('#maAccount-profile [data-ma-avatar-open]').click();await expect(dialog.getByRole('button',{name:'Character portrait',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(dialog.locator('[data-avatar-mode=emoji],[data-avatar-mode=atlas]')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Account photo',exact:true}).click();await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toBeHidden();expect(await page.evaluate(()=>avatarSaves.at(-1).avatar)).toBe('account');
  await expect(page.locator('[data-ma-avatar-open]')).toHaveCount(2);
  await page.evaluate(()=>{avatarUser=null;dispatchEvent(new Event('modeAtlasAccountSignedOut'));});await expect(page.locator('[data-ma-selected-avatar]')).toHaveText('あ');
  expect(errors).toEqual([]);
});

test('expanded wardrobe stays exclusive and a failed save keeps the draft for retry',async({page},info)=>{
  await prepare(page,{native:true,theme:'light'});await open(page,'/progress/');
  await page.evaluate(()=>{
    const value={version:1,revision:0,avatar:'character',character:ModeAtlasAvatarRules.defaults,level:1};
    window.wardrobeGrants=[];window.avatarAttempts=0;KanaCloudSync.getUser=()=>({uid:'wardrobe'});
    ModeAtlasRewardAccess={...ModeAtlasRewardAccess,current:()=>({grants:wardrobeGrants})};
    ModeAtlasAvatar={...ModeAtlasAvatar,refresh:async()=>value,save:async()=>{if(++avatarAttempts===1)throw Error('Unavailable');return value;}};
    ModeAtlasAccountNavigation.open('profile');
  });
  await page.locator('#maAccount-profile [data-ma-avatar-open]').click();const dialog=page.getByRole('dialog',{name:'Your avatar & pet'});
  await expect(dialog.locator('[data-avatar-slot=skin]')).toHaveCount(11);
  await expect(dialog.locator('[data-avatar-slot=hair]')).toHaveCount(6);
  for(const name of ['Short crop','Side sweep','Bob','Long hair','Coils','Bald'])await expect(dialog.getByRole('button',{name,exact:true})).toBeVisible();
  for(const name of ['Sculpted pompadour','Braided undercut'])await expect(dialog.getByRole('button',{name,exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Ivory',exact:true}).click();await dialog.getByRole('button',{name:'Long hair',exact:true}).click();
  await dialog.getByRole('button',{name:'Wardrobe',exact:true}).click();await expect(dialog.getByRole('button',{name:'Hunny jumper',exact:true})).toHaveCount(0);
  await page.evaluate(()=>{wardrobeGrants=['hunny-tester','shop-hunny-jumper','shop-hunny-pendant','shop-rose-gold','shop-pinstripe'];});
  await dialog.getByRole('button',{name:'Appearance',exact:true}).click();await dialog.getByRole('button',{name:'Rose gold',exact:true}).click();
  await expect(dialog.locator('.ma-avatar-studio svg linearGradient')).toHaveCount(1);
  await dialog.getByRole('button',{name:'Wardrobe',exact:true}).click();await dialog.getByRole('button',{name:'Tailored pinstripes',exact:true}).click();
  for(const name of ['Hunny jumper','Hunny bear ears','Hunny pendant'])await dialog.getByRole('button',{name,exact:true}).click();
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('could not be saved');
  await expect(dialog.getByRole('button',{name:'Hunny jumper',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(dialog.getByRole('button',{name:'Save changes',exact:true})).toBeEnabled();
  await dialog.locator('.ma-avatar-studio').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('hunny-wardrobe.png'),animations:'disabled'});
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toBeHidden();
  await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await page.locator('[data-reward-category=wardrobe] > summary').click();
  await expect(page.locator('[data-ma-wardrobe-item=hunny]')).toHaveCount(3);
  await expect(page.locator('.ma-atlas-panel [data-ma-avatar-open]')).toHaveCount(1);
});

test('guest character preview offers sign-in and account changes discard an open editor',async({page})=>{
  await prepare(page);await open(page,'/progress/');await page.evaluate(()=>ModeAtlasAvatarUI.open());
  const dialog=page.getByRole('dialog',{name:'Your avatar & pet'});await expect(dialog.getByRole('button',{name:'Sign in to save',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Sign in to save',exact:true}).click();await expect(page.locator('#maAccount-profile')).toHaveAttribute('aria-hidden','false');
  await page.locator('#maAccount-profile [data-ma-avatar-open]').click();await expect(dialog).toBeVisible();
  await page.evaluate(()=>dispatchEvent(new Event('modeAtlasAccountWillChange')));await expect(dialog).toBeHidden();
});

for(const native of [false,true])for(const collection of ['sakura','midnight','skyline','evergreen'])test(`collection first paint survives slow auth and page changes ${native?'iOS':'web'} ${collection}`,async({page})=>{
  await prepare(page,{native,theme:collection});
  await page.addInitScript(()=>{
    localStorage.setItem('modeAtlasLastUserId','theme-owner');
    localStorage.setItem('modeAtlasRewardAccess',JSON.stringify({uid:'theme-owner',checkedAt:Date.now(),access:{grants:['shop-sakura','shop-midnight','shop-skyline','shop-evergreen'],validUntil:Date.now()+86400000}}));
  });
  await page.route('**/cloud-sync.assets-*.js',route=>route.fulfill({contentType:'text/javascript',body:`
    let testUser=null,testResolved=false,readyResolve;
    window.KanaCloudSync={getUser:()=>testUser,isAuthResolved:()=>testResolved,ready:new Promise(r=>readyResolve=r),isConfigured:()=>false,
      bindUi:()=>{},beforePageLoad:async()=>false,waitForInitialHydration:async()=>false,getFirebaseApp:async()=>{throw Error('offline');},
      getSyncStatus:()=>({state:'local',tone:'neutral',text:'Saved',user:testUser}),scheduleSync:()=>{},syncNow:async()=>true};
    setTimeout(()=>{testUser={uid:'theme-owner'};testResolved=true;readyResolve();dispatchEvent(new CustomEvent('kanaCloudSyncStatusChanged'));},1200);
  `}));
  // Observe the first body script, after blocking head scripts and CSS have
  // executed. CSS request timing is too early because of the preload scanner.
  await page.route('**/mode-atlas-early-loader.assets-*.js',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:`
      window.initialCollectionTheme=document.documentElement.dataset.maCollectionTheme;
      window.themeChanges=[];
      new MutationObserver(()=>themeChanges.push(document.documentElement.dataset.maCollectionTheme))
        .observe(document.documentElement,{attributes:true,attributeFilter:['data-ma-collection-theme']});
    `+await response.text()});
  });
  for(const route of ['/progress/','/reading/','/writing/']){
    await open(page,route);await expect(page.locator('html')).toHaveAttribute('data-ma-collection-theme',collection);
    expect(await page.evaluate(()=>initialCollectionTheme)).toBe(collection);
    await expect.poll(()=>page.evaluate(()=>KanaCloudSync.isAuthResolved())).toBe(true);
    expect(await page.evaluate(()=>themeChanges.every(theme=>theme===localStorage.getItem('modeAtlasThemePreference')))).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-ma-collection-theme',collection);
  }
});

for(const native of [false,true])test(`home restores the saved avatar before auth on repeated visits ${native?'iOS':'web'}`,async({page})=>{
  await prepare(page,{native});
  await page.addInitScript(()=>{
    if(localStorage.getItem('avatar-return-seeded'))return;
    localStorage.setItem('avatar-return-seeded','true');localStorage.setItem('modeAtlasLastUserId','returning');
    // Exercise an existing account's valid pre-companion cache during upgrade.
    localStorage.setItem('modeAtlasAvatarProfile',JSON.stringify({uid:'returning',checkedAt:Date.now(),value:{version:1,revision:4,avatar:'character',level:1,character:{version:2,skin:'cocoa',hair:'bob',hairColor:'chestnut',eyes:'brown',outfit:'everyday',outfitColor:'teal',headwear:'none',accessory:'none',pants:'denim'}}}));
  });
  await page.route('**/cloud-sync.assets-*.js',route=>route.fulfill({contentType:'text/javascript',body:`
    let testUser=null,testResolved=false,readyResolve;
    window.KanaCloudSync={getUser:()=>testUser,isAuthResolved:()=>testResolved,ready:new Promise(r=>readyResolve=r),isConfigured:()=>false,
      bindUi:()=>{},beforePageLoad:async()=>false,waitForInitialHydration:async()=>false,getFirebaseApp:async()=>{throw Error('offline');},
      getSyncStatus:()=>({state:'local',tone:'neutral',text:'Saved',user:testUser}),scheduleSync:()=>{},syncNow:async()=>true};
    window.restoreTestAccount=()=>{testUser={uid:'returning'};testResolved=true;readyResolve();dispatchEvent(new CustomEvent('kanaCloudSyncStatusChanged'));};
    window.signOutTestAccount=()=>{testUser=null;dispatchEvent(new Event('modeAtlasAccountSignedOut'));};
  `}));
  for(let visit=0;visit<2;visit++){
    await open(page,'/');const avatar=page.locator('[data-ma-home-avatar]:visible');
    expect(await page.evaluate(()=>KanaCloudSync.isAuthResolved())).toBe(false);
    await expect(avatar).toHaveAttribute('data-character',/"hairColor":"chestnut"/);
    await expect(avatar).toHaveAttribute('data-character',/"pants":"denim"/);
    const appearance=await avatar.innerHTML();
    await page.evaluate(()=>{window.avatarReads=0;const call=ModeAtlasSocial.call;ModeAtlasSocial={...ModeAtlasSocial,call:(action,...args)=>{if(action==='avatarState')avatarReads++;return call(action,...args);}};restoreTestAccount();});
    await expect.poll(()=>page.evaluate(()=>ModeAtlasAvatar.current()?.revision)).toBe(4);
    expect(await avatar.innerHTML()).toBe(appearance);expect(await page.evaluate(()=>avatarReads)).toBe(0);
    if(visit===0)await open(page,'/learn/');
  }
  await page.evaluate(()=>signOutTestAccount());await expect(page.locator('[data-ma-home-avatar]:visible')).not.toHaveAttribute('data-character',/chestnut|denim/);
  expect(await page.evaluate(()=>localStorage.getItem('modeAtlasAvatarProfile'))).toBeNull();
});

for(const native of [false,true])test(`collection trainer colours and compact progress actions ${native?'iOS':'web'}`,async({page},info)=>{
  test.setTimeout(60000);await prepare(page,{native,theme:'sakura'});await page.setViewportSize({width:native?320:1280,height:900});
  await page.addInitScript(()=>{
    localStorage.setItem('modeAtlasLastUserId','palette-owner');
    localStorage.setItem('modeAtlasRewardAccess',JSON.stringify({uid:'palette-owner',checkedAt:Date.now(),access:{grants:['shop-sakura','shop-evergreen'],validUntil:Date.now()+86400000}}));
  });
  await page.route('**/cloud-sync.assets-*.js',route=>route.fulfill({contentType:'text/javascript',body:`window.KanaCloudSync={getUser:()=>({uid:'palette-owner'}),isAuthResolved:()=>true,isConfigured:()=>false,bindUi:()=>{},beforePageLoad:async()=>false,waitForInitialHydration:async()=>false,scheduleSync:()=>{},getSyncStatus:()=>({state:'local',text:'Saved'})};`}));
  for(const theme of ['sakura','evergreen']){
    for(const path of ['/reading/','/writing/']){
      await open(page,path);await page.evaluate(theme=>{ModeAtlasRewardAccess={...ModeAtlasRewardAccess,current:()=>({grants:['shop-sakura','shop-evergreen']})};ModeAtlasTheme.set(theme,{toast:false});},theme);
      await expect(page.locator('html')).toHaveAttribute('data-ma-collection-theme',theme);
      const expected=theme==='sakura'?'rgb(233, 191, 209)':'rgb(9, 26, 19)';
      expect(await page.evaluate(()=>{const body=getComputedStyle(document.body).backgroundColor;return body==='rgba(0, 0, 0, 0)'?getComputedStyle(document.documentElement).backgroundColor:body;})).toBe(expected);
      if(!native){
        const setup=page.locator('#modifiersTab');
        // Measure the selected palette after the button's colour transition.
        await setup.evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished)));
        await readable(setup,await setup.evaluate(node=>getComputedStyle(node).backgroundColor));
      }
      await page.screenshot({path:info.outputPath(`${theme}-${path.includes('writing')?'writing':'reading'}.png`),fullPage:true,animations:'disabled'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  }
  await open(page,'/progress/');
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.dataset.maLargeText='true';});
  for(const [tab,count]of [['Goals',2],['Recap',3],['Rewards',1]]){
    await page.getByRole('tab',{name:tab,exact:true}).click();const actions=page.getByRole('tabpanel',{name:tab,exact:true}).locator('.ma-action-grid');
    await expect(actions.locator('.ma-button')).toHaveCount(count);await actions.scrollIntoViewIfNeeded();
    expect(await actions.evaluate(node=>getComputedStyle(node).display)).toBe('grid');
    expect(await actions.evaluate(node=>[...node.querySelectorAll('.ma-button span')].every(label=>label.scrollWidth<=label.clientWidth+1))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`compact-${tab.toLowerCase()}.png`),animations:'disabled'});
  }
  await page.getByRole('tabpanel',{name:'Rewards',exact:true}).getByRole('button',{name:'View achievements',exact:true}).click();await expect(page.getByRole('dialog',{name:'Achievements',exact:true})).toBeVisible();
});

test('Progress avatar refreshes after auth, follows the selected identity and clears on sign-out',async({page})=>{
  await prepare(page);await open(page,'/progress/');
  await page.route('https://lh3.googleusercontent.com/a/selected',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ad5d80"/></svg>'}));
  await page.evaluate(()=>{
    window.avatarUser={uid:'avatar-owner',providerData:[{providerId:'google.com',photoURL:'https://lh3.googleusercontent.com/a/selected'}]};window.avatarProfile=null;
    KanaCloudSync.getUser=()=>avatarUser;
    ModeAtlasSocial={...ModeAtlasSocial,selfProfile:()=>avatarProfile,refreshProfile:async()=>{}};
    dispatchEvent(new CustomEvent('kanaCloudSyncStatusChanged'));
  });
  const avatar=page.locator('[data-ma-selected-avatar]');await expect(avatar.locator('img')).toHaveAttribute('src','https://lh3.googleusercontent.com/a/selected');
  await page.evaluate(()=>{avatarProfile={avatar:'emoji:🦊'};dispatchEvent(new CustomEvent('modeAtlasSelfProfileChanged'));});await expect(avatar).toHaveText('🦊');
  await page.evaluate(()=>{avatarProfile={avatar:'moon'};dispatchEvent(new CustomEvent('modeAtlasSelfProfileChanged'));});await expect(avatar).toHaveText('月');
  await page.evaluate(()=>{avatarProfile=null;avatarUser=null;dispatchEvent(new CustomEvent('modeAtlasAccountSignedOut'));});await expect(avatar).toHaveText('あ');await expect(avatar.locator('img')).toHaveCount(0);
});
async function prepare(page,{native=true,theme='dark',xp=0}={}){
  await page.setViewportSize({width:native?393:1280,height:native?852:900});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme,xp})=>{
    window.hapticCalls=[];window.iconCalls=[];
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{
      Haptics:{impact:async value=>window.hapticCalls.push(value),notification:async value=>window.hapticCalls.push(value)},
      ModeAtlasNative:{setAppIcon:async value=>window.iconCalls.push(value)}
    }};
    if(localStorage.getItem('progression-test-seeded'))return;
    localStorage.setItem('progression-test-seeded','1');
    localStorage.setItem('modeAtlasThemePreference',theme);localStorage.setItem('modeAtlasSound','off');
    localStorage.setItem('maWhatsNewSeen','progression');
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    for(const key of ['settings','reverseSettings'])localStorage.setItem(key,JSON.stringify({hiraganaRows:['h_a'],katakanaRows:[],hint:false,srs:true,keyboardMode:false}));
    if(xp)localStorage.setItem('modeAtlasProgress',JSON.stringify({version:2,legacySeeded:true,sources:{legacy:{'kana.reading.correct':xp}}}));
  },{native,theme,xp});
  if(native){const device=await page.context().newCDPSession(page);await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});}
}
async function open(page,path){await page.goto(path);await expect(page.locator('#maLoadingScreen')).toBeHidden();}
async function readable(locator,background){
  const result=await locator.evaluate((node,bg)=>{
    const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
    const lum=value=>{const c=rgb(value);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
    const style=getComputedStyle(node),foreground=style.webkitTextFillColor||style.color;
    const values=[lum(foreground),lum(bg)].sort((a,b)=>b-a);
    return {ratio:(values[0]+.05)/(values[1]+.05),foreground,bg,text:node.textContent};
  },background);
  expect(result.ratio,JSON.stringify(result)).toBeGreaterThanOrEqual(4.5);
}
for(const native of [false,true])test(`mixed collection surfaces keep readable previews and account actions ${native?'iOS':'web'}`,async({page},testInfo)=>{
  test.setTimeout(60000);const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,{native});await open(page,'/shop/');
  await page.locator('.ma-shop-full').getByRole('tab',{name:'Theme packs',exact:true}).click();
  await page.evaluate(()=>{
    const access={allCustom:true,grants:ModeAtlasRewardRules.themes.map(t=>t.grant)};
    ModeAtlasRewardAccess={...ModeAtlasRewardAccess,current:()=>access,presentation:()=>access,status:()=> 'ready',refresh:async()=>{}};
  });
  for(const theme of ['dark','light','sakura','midnight','skyline','evergreen']){
    await page.evaluate(theme=>ModeAtlasTheme.set(theme,{toast:false}),theme);
    if(theme==='dark')await page.screenshot({path:testInfo.outputPath(`${native?'ios':'web'}-shop.png`),animations:'disabled'});
    for(const id of ['sakura','midnight','skyline','evergreen']){
      const product=page.locator(`.ma-shop-full [data-ma-shop-product="${id}"]`);await product.scrollIntoViewIfNeeded();
      const canvas=await product.evaluate(node=>getComputedStyle(node,'::before').backgroundColor);
      for(const text of await product.locator('.ma-shop-product__name,.ma-shop-product__description,[data-ma-shop-availability]').all())await readable(text,canvas);
      await product.click();const sample=page.locator('.ma-shop-theme-preview');
      const bg=await sample.evaluate(node=>getComputedStyle(node).backgroundColor);
      for(const text of await sample.locator('strong,span').all())await readable(text,await text.evaluate(node=>getComputedStyle(node).backgroundColor)!=='rgba(0, 0, 0, 0)'?await text.evaluate(node=>getComputedStyle(node).backgroundColor):bg);
      const look=page.locator('.ma-shop-look'),banner=await look.evaluate(node=>getComputedStyle(node,'::before').backgroundColor);
      for(const text of await look.locator('.ma-shop-look__copy>*').all())await readable(text,banner);
      if(theme==='dark')await page.screenshot({path:testInfo.outputPath(`${native?'ios':'web'}-${id}-collection.png`),animations:'disabled'});
      await page.keyboard.press('Escape');await expect(page.locator('.ma-dialog-layer')).toBeHidden();
    }
    await page.locator('#profileOpenBtn').click();
    for(const banner of ['hunny','sakura','midnight','skyline','evergreen']){
      await page.evaluate(banner=>ModeAtlasProgress.selectBanner(banner),banner);
      const card=page.locator('.ma-account-card');await expect(card.locator('[data-ma-selected-banner]')).toHaveAttribute('data-ma-banner',banner);
      for(const signedIn of [false,true]){
        await page.evaluate(signedIn=>{currentUser=signedIn?{uid:'contrast-test',displayName:'Test learner'}:null;updateUiBinding({authBtn:document.querySelector('#profileAuthBtn')});},signedIn);
        const action=page.locator('#profileAuthBtn');await expect(action).toHaveText(signedIn?'Sign out':'Sign in with Google');
        await action.evaluate(async node=>{await Promise.all(node.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})));});
        await readable(action.locator('[data-profile-auth-label]'),await action.evaluate(node=>getComputedStyle(node).backgroundColor));
        if(theme==='dark'&&banner==='hunny'&&signedIn)await page.screenshot({path:testInfo.outputPath(`${native?'ios':'web'}-hunny-profile.png`),animations:'disabled'});
      }
    }
    await page.locator('#maAccountClose').click();
  }
  expect(errors).toEqual([]);
});
async function correct(page,mode){
  await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);
  await page.evaluate(mode=>mode==='reading'?handleCorrect(getAnswerForCurrentChar()):handleChoiceAnswer(currentChar,document.querySelector('.choice-btn')),mode);
}
for(const view of [{native:true,theme:'dark',width:393},{native:true,theme:'light',width:320},{native:false,theme:'dark',width:1280},{native:false,theme:'light',width:1280}]){
  test(`shop preview and review help ${view.native?'iOS':'web'} ${view.width} ${view.theme}`,async({page},testInfo)=>{
    await prepare(page,view);await page.setViewportSize({width:view.width,height:852});await open(page,'/progress/');
    await expect(page.getByRole('tablist',{name:'Progress',exact:true}).getByRole('tab')).toHaveText(['Goals','Rewards','Recap']);
    await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Shop',exact:true}).click();
    const shop=page.getByRole('tabpanel',{name:'Shop',exact:true});await expect(shop).toBeVisible();
    await expect(shop).not.toContainText('Purchases aren’t available yet.');
    await expect(shop.getByRole('button',{name:'Buy 500 coins',exact:true})).toBeVisible();
    await expect(shop.locator('[data-ma-coin-balance]')).toHaveText('Sign in to view your balance');
    for(const tile of await shop.locator('.ma-shop-product').all()){
      expect(await tile.evaluate(node=>getComputedStyle(node,'::before').backgroundImage)).not.toBe('none');
      const foreground=await tile.evaluate(node=>getComputedStyle(node).color);
      await expect(tile.locator('.ma-shop-product__name')).toHaveCSS('color',foreground);
      await expect(tile.locator('.ma-shop-product__name')).toHaveCSS('-webkit-text-fill-color',foreground);
    }
    for(const frame of await shop.locator('[data-ma-frame]').all())await expect(frame).not.toHaveCSS('box-shadow','none');
    const before=await page.evaluate(()=>({xp:ModeAtlasProgress.getXP(),appearance:ModeAtlasProgress.readState().appearance}));
    await shop.getByRole('button',{name:'Preview Sakura collection'}).click();
    await expect(page.locator('.ma-dialog__title')).toHaveText('Sakura');
    await expect(page.getByRole('button',{name:'Open Rewards',exact:true})).toBeHidden();
    await expect(page.locator('#maAccountSheet')).toHaveJSProperty('inert',true);
    await expect(page.locator('.ma-shop-includes img')).toBeVisible();
    expect(await page.evaluate(()=>({xp:ModeAtlasProgress.getXP(),appearance:ModeAtlasProgress.readState().appearance}))).toEqual(before);
    await expect(page.locator('.ma-dialog-layer')).toHaveCSS('opacity','1');
    await page.screenshot({path:testInfo.outputPath('shop-preview.png'),animations:'disabled'});
    await page.keyboard.press('Escape');await expect(shop.getByRole('button',{name:'Preview Sakura collection'})).toBeFocused();
    await expect(page.locator('#maAccountSheet')).toHaveJSProperty('inert',false);
    await shop.getByRole('button',{name:'Buy 500 coins',exact:true}).click();await expect(page.locator('.ma-dialog__message')).toContainText('Coin purchases are coming soon');await page.getByRole('button',{name:'Got it',exact:true}).click();
    await page.screenshot({path:testInfo.outputPath('shop.png'),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(view.width===393){
      await page.evaluate(()=>{
        ModeAtlasRewardAccess={current:()=>({grants:['shop-sakura']}),refresh:async()=>{},status:()=> 'ready'};
        ModeAtlasShop={current:()=>({status:'ready',balance:250,offers:ModeAtlasShopCatalogue.products.map(p=>ModeAtlasShopCatalogue.offer(p)).filter(Boolean),owned:['sakura'],inventory:{'streak-freeze':0,'streak-repair':0}}),refresh:async()=>{}};
        dispatchEvent(new CustomEvent('modeAtlasRewardAccessChanged'));dispatchEvent(new CustomEvent('modeAtlasShopChanged'));
      });
      await expect(shop.locator('[data-ma-coin-balance]')).toHaveText('250');
      await expect(shop.locator('[data-ma-shop-product="sakura"]')).toContainText('In your Rewards');
      await shop.getByRole('button',{name:'Preview Sakura collection'}).click();
      await expect(page.getByRole('button',{name:'Use banner & frame'})).toHaveCount(0);
      await page.getByRole('button',{name:'Open Rewards',exact:true}).click();
      await expect(page.locator('.ma-account-layer')).toBeHidden();
      await expect(page.getByRole('tab',{name:'Rewards',exact:true})).toBeFocused();
      await page.locator('.ma-atlas-banner-choice[data-ma-banner="sakura"]').click();
      expect(await page.evaluate(()=>ModeAtlasProgress.readState().appearance.banner)).toBe('sakura');
      await page.locator('[data-reward-category="frames"] summary').click();
      await page.locator('[data-landmark="sakura"]').click();
      await expect(page.locator('[data-landmark="midnight"]')).toBeHidden();
      expect(await page.evaluate(()=>ModeAtlasProgress.readState().appearance.landmark)).toBe('sakura');
      expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(before.xp);
      await page.locator('[data-reward-category="icons"] summary').click();
      await page.getByRole('button',{name:'Use Sakura app icon',exact:true}).click();expect(await page.evaluate(()=>iconCalls.at(-1))).toEqual({name:'Sakura'});
      await page.getByRole('tab',{name:'Goals',exact:true}).click();
      await page.evaluate(()=>{
        const due={reviewVersion:1,level:2,due:Date.now()-1000,lastSeen:Date.now()-86400000};
        ModeAtlasStorage.writeModeJSON('reading','srs',Object.fromEntries([... 'あいうえおかき'].map(k=>[k,due])));
        ModeAtlasStorage.writeModeJSON('writing','srs',{'ア':due,'イ':due});dispatchEvent(new CustomEvent('modeAtlasCloudDataChanged'));
      });
      await expect(page.getByRole('link',{name:'Review Read · 7 due',exact:true})).toBeVisible();
      await expect(page.getByRole('link',{name:'Review Recall · 2 due',exact:true})).toHaveAttribute('href','/writing/?practice=10&due=1');
      await expect(page.locator('.ma-toast')).toHaveCount(0);
      const help=page.getByRole('button',{name:'About due reviews'});await help.click();
      await expect(page.locator('.ma-dialog__message')).toContainText('Kana Read, Kana Recall and each Kanji skill have separate schedules');
      await expect(page.locator('.ma-dialog__message')).toContainText('not deadlines');await expect(page.locator('.ma-dialog-layer')).toHaveCSS('opacity','1');await page.screenshot({path:testInfo.outputPath('review-help.png'),animations:'disabled'});
      await page.keyboard.press('Escape');await expect(help).toBeFocused();
      await page.evaluate(()=>{ModeAtlasStorage.writeModeJSON('reading','srs',{});dispatchEvent(new CustomEvent('modeAtlasProgressChanged'));});
      await expect(page.getByRole('link',{name:'Review Read · 7 due',exact:true})).toHaveCount(0);
      await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Shop',exact:true}).click();
    }
    await page.evaluate(()=>{document.documentElement.dataset.maLargeText='true';document.documentElement.style.fontSize='24px';});
    await shop.getByRole('button',{name:'Preview Sakura collection'}).scrollIntoViewIfNeeded();
    await expect(shop.getByRole('button',{name:'Preview Sakura collection'})).toBeVisible();
    expect(await shop.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    expect(await shop.evaluate(node=>{
      const last=node.querySelector('.ma-shop-product:last-child').getBoundingClientRect();
      const next=node.querySelector('.ma-shop-rewards-link>span').getBoundingClientRect();
      return next.top>=last.bottom;
    })).toBe(true);
    await page.getByRole('tab',{name:'Settings',exact:true}).click();await page.getByRole('tab',{name:'Shop',exact:true}).click();
    await expect(shop).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('shop-large-text.png'),fullPage:true});
  });
}
test.describe('local midnight',()=>{
test.use({timezoneId:'Australia/Melbourne'});
for(const mode of ['reading','writing'])test(`${mode}: a guided session crossing midnight credits completion to the finish date`,async({page})=>{
  await prepare(page);await open(page,`/${mode}/?practice=10`);await page.clock.install({time:new Date('2026-10-02T23:59:40+10:00')});await page.locator('#startBtn').click();
  expect(await page.evaluate(()=>getTodayKey())).toBe('2026-10-02');
  for(let i=0;i<5;i++)await correct(page,mode);
  await page.clock.fastForward(30000);
  for(let i=5;i<10;i++)await correct(page,mode);
  await expect(page.locator('.ma-dialog__title')).toHaveText('Set complete');
  expect(await page.evaluate(()=>Object.fromEntries(Object.entries(ModeAtlasProgress.readState().activity).map(([day,row])=>[day,Object.values(row.metrics).reduce((sum,metrics)=>sum+(metrics['kana.guided']||0),0)])))).toEqual({'2026-10-02':0,'2026-10-03':1});
});
});

for(const mode of ['reading','writing'])test(`${mode}: session XP follows its pool and hints, including an older restored checkpoint`,async({page})=>{
  await prepare(page);await open(page,`/${mode}/?practice=10`);
  for(const [wide,hint,rate]of [[false,false,2],[false,true,1],[true,false,7]]){
    await page.evaluate(({wide,hint})=>{
      Object.assign(settings,{hiraganaRows:wide?Object.keys(ModeAtlasKanaData.hiraganaRows):['h_a'],katakanaRows:wide?Object.keys(ModeAtlasKanaData.katakanaRows):[],hint,focusWeak:false,dakuten:false,yoon:false,extended:false});onSettingsChanged();
    },{wide,hint});
    await page.locator('#startBtn').click();await correct(page,mode);
    expect(await page.evaluate(()=>sessionStats.study.xpParts.answers)).toBe(rate);
    if(hint){
      await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);
      await page.evaluate(mode=>{const key='modeAtlasPracticeCheckpoint:'+mode,checkpoint=ModeAtlasStorage.json(key);delete checkpoint.sessionStats.study.poolSize;delete checkpoint.sessionStats.study.hintsEnabled;ModeAtlasStorage.setJSON(key,checkpoint);},mode);
      await page.reload();await expect(page.locator('#maLoadingScreen')).toBeHidden();await page.getByRole('button',{name:'Resume set',exact:true}).click();await correct(page,mode);
      expect(await page.evaluate(()=>({answers:sessionStats.study.xpParts.answers,pool:sessionStats.study.poolSize,hints:sessionStats.study.hintsEnabled}))).toEqual({answers:2,pool:5,hints:true});
    }
    await page.locator('#endSessionBtn').click();
    await expect(page.locator('.ma-study-summary')).toContainText(`${rate} XP per correct kana`);
    await page.getByRole('button',{name:'Done',exact:true}).click();
  }
});

for(const theme of ['dark','light'])test(`iOS ${theme}: achievements use compact branch filters, retain detail navigation and fit large text`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await prepare(page,{theme});await open(page,'/');
  await page.evaluate(()=>ModeAtlasFeatures.openAchievements());
  const root=page.locator('.ma-ach-native');await expect(root).toBeVisible();
  await expect(root.locator('.ma-achievement-section')).toHaveCount(1);
  await expect(root.locator('.ma-achievement-tile')).toHaveCount(10);
  const boxes=await root.locator('.ma-achievement-tile').evaluateAll(nodes=>nodes.slice(0,2).map(node=>({x:node.getBoundingClientRect().x,y:node.getBoundingClientRect().y,height:node.getBoundingClientRect().height})));
  expect(boxes[0].y).toBe(boxes[1].y);expect(boxes[1].x).toBeGreaterThan(boxes[0].x);expect(boxes[0].height).toBeLessThan(200);
  await page.screenshot({animations:'disabled',path:info.outputPath(`ios-${theme}-achievements.png`)});
  await root.getByRole('button',{name:'Kana',exact:true}).click();
  await expect(root.locator('.ma-achievement-tile')).toHaveCount(15);
  await root.locator('[data-ma-ach-id="kana:on-a-roll"]').click();
  await expect(root.locator('.ma-ach-info-body')).toContainText('On a Roll');
  expect(await root.evaluate(node=>node.closest('.ma-dialog').scrollTop)).toBe(0);
  await page.getByRole('button',{name:'Close achievements or return to achievements',exact:true}).click();
  await expect(root.getByRole('button',{name:'Kana',exact:true})).toHaveAttribute('aria-pressed','true');
  await root.getByRole('button',{name:'Unlocked',exact:true}).click();await expect(root.locator('.ma-ach-empty')).toBeVisible();
  await root.getByRole('button',{name:'All',exact:true}).click();
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  expect(await root.evaluate(node=>[node,...node.querySelectorAll('.ma-achievement-tile,.ma-ach-switch')].every(el=>el.scrollWidth<=el.clientWidth+1))).toBe(true);
  await page.screenshot({animations:'disabled',path:info.outputPath(`ios-${theme}-achievements-large-text.png`)});
  expect(errors).toEqual([]);
});

test('web achievements expose every launched branch and the new milestones at a narrow viewport',async({page})=>{
  await prepare(page,{native:false});await page.setViewportSize({width:390,height:844});await open(page,'/');
  await page.evaluate(()=>ModeAtlasFeatures.openAchievements());
  await expect(page.locator('.ma-ach-native')).toHaveCount(0);await expect(page.locator('.ma-achievement-tile')).toHaveCount(26);
  await expect(page.locator('[data-ma-ach-id="modeAtlas:special-delivery"]')).toContainText('Special Delivery');
  expect(await page.locator('.ma-ach-dialog-content').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
});
for(const mode of ['reading','writing'])test(`iOS ${mode}: interrupted guided sets resume without replaying XP or answers`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await prepare(page);await open(page,`/${mode}/?practice=10`);await page.locator('#startBtn').click();
  await expect(page.locator('body')).toHaveClass(/study-nav-hidden/);
  for(let i=0;i<4;i++)await correct(page,mode);
  await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);
  const before=await page.evaluate(()=>({xp:ModeAtlasProgress.getXP(),id:sessionStats.study.runId}));
  await page.reload();await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect(page.locator('#practiceRecovery')).toContainText('4 answered');
  await page.getByRole('button',{name:'Resume set',exact:true}).click();
  expect(await page.evaluate(()=>({xp:ModeAtlasProgress.getXP(),id:sessionStats.study.runId,answered:sessionStats.answered}))).toEqual({...before,answered:4});
  for(let i=4;i<10;i++)await correct(page,mode);
  await expect(page.locator('.ma-dialog__title')).toHaveText('Set complete');
  expect(await page.evaluate(mode=>ModeAtlasStorage.readModeJSON(mode,'charStats',{}),mode)).toBeTruthy();
  expect(await page.evaluate(mode=>Object.values(ModeAtlasStorage.readModeJSON(mode,'charStats',{})).reduce((sum,row)=>sum+row.correct,0),mode)).toBe(10);
  expect(await page.evaluate(()=>ModeAtlasProgress.getLifetimeCorrect())).toBe(10);
  await expect(page.locator('body')).not.toHaveClass(/study-nav-hidden/);
  const reward=await page.evaluate(()=>({gain:getTrainerSessionXpGain(),parts:Object.values(sessionStats.study.xpParts).reduce((a,b)=>a+b,0)}));
  expect(reward.gain).toBe(reward.parts);
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.locator('.ma-dialog-layer')).toBeHidden();
  await page.reload();await expect(page.locator('#practiceRecovery')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a mistake returns after three other questions; recovery also finalizes the last saved answer once',async({page})=>{
  await prepare(page);await open(page,'/reading/?practice=10');await page.locator('#startBtn').click();
  const missed=await page.evaluate(()=>currentChar);await page.locator('#skipKanaBtn').click();await page.locator('#studyFeedbackContinue').click();
  for(let i=0;i<3;i++){expect(await page.evaluate(()=>currentChar)).not.toBe(missed);await correct(page,'reading');}
  await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);expect(await page.evaluate(()=>currentChar)).toBe(missed);
  for(let i=4;i<9;i++)await correct(page,'reading');
  await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);
  await page.clock.install();await page.clock.pauseAt(new Date());
  await correct(page,'reading'); // The answer journal commits before the 260ms transition to the summary.
  expect(await page.evaluate(()=>sessionStats.answered)).toBe(10);
  await page.reload();await page.clock.resume();await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.getByRole('button',{name:'Resume set',exact:true}).click();
  await expect(page.locator('.ma-dialog__title')).toHaveText('Set complete');
  expect(await page.evaluate(()=>ModeAtlasProgress.getLifetimeCorrect())).toBe(9);
  const xp=await page.evaluate(()=>ModeAtlasProgress.getXP());
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.reload();expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(xp);
});

test('due review can select kana outside setup rows, and account changes invalidate local recovery',async({page})=>{
  await prepare(page);await open(page,'/reading/');
  await page.evaluate(()=>{
    ModeAtlasStorage.writeModeJSON('reading','srs',{'か':{reviewVersion:1,level:3,due:Date.now()-1000,lastSeen:Date.now()-86400000,recent:[{id:'old',at:Date.now()-86400000,quality:2}],days:['2026-09-29'],peak:1}});
  });
  await open(page,'/reading/?practice=10&due=1');await page.locator('#startBtn').click();
  expect(await page.evaluate(()=>currentChar)).toBe('か');
  for(const key of ['k','a'])await page.locator(`.ma-ios-reading-keyboard [data-key="${key}"]`).click();
  await expect.poll(()=>page.evaluate(()=>sessionStats.correct)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);
  await page.evaluate(()=>ModeAtlasStorage.set('modeAtlasLastUserId','different-account'));
  await page.reload();await expect(page.locator('#maLoadingScreen')).toBeHidden();await expect(page.locator('#practiceRecovery')).toHaveCount(0);
});

for(const theme of ['dark','light'])test(`iOS ${theme}: collection, title, frame and app icon rewards work at large text`,async({page},testInfo)=>{
  await prepare(page,{theme,xp:700});await open(page,'/');
  await page.evaluate(()=>{ModeAtlasRewardsUI.open();});
  await expect(page.locator('.ma-hub-header h1')).toHaveText('Progress');
  await expect(page.locator('.ma-atlas-rewards .ma-routine-goal')).toHaveCount(5);
  await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await page.locator('[data-reward-category="frames"] > summary').click();
  const grove=page.locator('[data-landmark="grove"]');
  await grove.click();
  await expect(grove).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-reward-category="icons"] > summary').click();
  await page.getByRole('button',{name:'Use Grove app icon',exact:true}).click();
  expect(await page.evaluate(()=>iconCalls)).toEqual([{name:'Grove'}]);
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  await grove.scrollIntoViewIfNeeded();
  const fits=await page.evaluate(()=>[document.documentElement,...document.querySelectorAll('.ma-atlas-landmark,.ma-routine-goal')].every(node=>node.scrollWidth<=node.clientWidth+1));expect(fits).toBe(true);
  await page.screenshot({animations:'disabled',path:testInfo.outputPath(`ios-${theme}-collection.png`)});
  await page.reload();await expect(page.locator('#maLoadingScreen')).toBeHidden();
  expect(await page.evaluate(()=>ModeAtlasRewardsUI.appearance().id)).toBe('grove');
  await expect(page.locator('#profileAvatar')).toHaveAttribute('data-ma-frame','grove');
});

test('native answer feedback coalesces key haptics, respects Off and Reduce Motion, and manual focus wins',async({page})=>{
  await prepare(page);await page.emulateMedia({reducedMotion:'reduce'});await open(page,'/reading/?practice=10');await page.locator('#startBtn').click();
  await page.evaluate(()=>{hapticCalls.length=0;ModeAtlasFeedback.haptic('key');ModeAtlasFeedback.haptic('incorrect');});
  await page.waitForTimeout(100);expect(await page.evaluate(()=>hapticCalls)).toEqual([{type:'WARNING'}]);
  await page.evaluate(()=>{ModeAtlasStorage.set('modeAtlasHaptics','off');ModeAtlasFeedback.haptic('correct');ModeAtlasFeedback.haptic('key');ModeAtlasFeedback.question(document.getElementById('hiragana'));});
  await page.waitForTimeout(80);expect(await page.evaluate(()=>hapticCalls.length)).toBe(1);
  expect(await page.evaluate(()=>document.getElementById('hiragana').getAnimations().length)).toBe(0);
  await page.locator('#pauseSessionBtn').click();
  await page.locator('#studyNavShowBtn').click();await expect(page.locator('body')).not.toHaveClass(/study-nav-hidden/);
  await page.locator('#endSessionBtn').click();await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.locator('body')).not.toHaveClass(/study-nav-hidden/);
  expect(await page.evaluate(()=>ModeAtlasStorage.get('kanaTrainerNavHidden'))).toBe('0');
});

test('a level-crossing set has one reward summary and opens the collection without another level dialog',async({page})=>{
  await prepare(page,{xp:90});await open(page,'/reading/?practice=10');await page.locator('#startBtn').click();
  for(let i=0;i<10;i++)await correct(page,'reading');
  await expect(page.locator('.ma-dialog__title')).toHaveText('Set complete');
  await expect(page.locator('.ma-session-rewards__level')).toHaveText('Level up · Atlas Level 2');
  expect(await page.evaluate(()=>ModeAtlasProgressUI.hasPendingLevelUp())).toBe(false);
  await page.getByRole('button',{name:'Progress',exact:true}).click();
  await expect(page.locator('.ma-hub-header h1')).toHaveText('Progress');
  await expect(page.locator('.ma-dialog-layer')).toHaveCount(0);
});

test('the first slow mistake after upgrading retains previously earned mastery',async({page})=>{
  await prepare(page);await open(page,'/reading/');
  await page.evaluate(()=>{
    const chars=['あ','い','う','え','お'];
    ModeAtlasStorage.writeModeJSON('reading','charStats',Object.fromEntries(chars.map(kana=>[kana,{correct:50,wrong:0}])));
    ModeAtlasStorage.writeModeJSON('reading','charTimes',Object.fromEntries(chars.map(kana=>[kana,{avg:900,count:50}])));
  });
  await open(page,'/reading/?practice=10');await page.locator('#startBtn').click();
  const kana=await page.evaluate(()=>currentChar);
  await page.clock.install();await page.clock.runFor(15000);
  await page.locator('#skipKanaBtn').click();
  expect(await page.evaluate(kana=>ModeAtlasStorage.readModeJSON('reading','srs',{})[kana].peak,kana)).toBe(3);
  await expect(page.locator('#studyFeedback')).toContainText('Skipped');
});

for(const mode of ['reading','writing'])for(const kind of ['dailyChallenge','testMode'])test(`${mode}: ${kind} resumes its order, timing and final answer exactly once`,async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await prepare(page);await open(page,`/${mode}/`);
  const noon=new Date();noon.setHours(12,0,0,0);
  await page.clock.install({time:noon});await page.clock.pauseAt(noon);
  await page.evaluate(kind=>ModeAtlasTrainerControls.selectMode(kind),kind);await page.locator('#startBtn').click();
  for(let i=0;i<3;i++){await page.evaluate(()=>handleCorrect('saved answer'));await page.clock.runFor(350);}
  await page.locator('#skipKanaBtn').click();await page.clock.runFor(600);
  await page.clock.runFor(1500);await page.locator('#pauseSessionBtn').click();
  const before=await page.evaluate(mode=>({checkpoint:ModeAtlasSessionRecovery.read(mode),xp:ModeAtlasProgress.getXP(),kana:currentChar}),mode);
  expect(before.checkpoint).toBeTruthy();expect(before.checkpoint.sessionStats.answered).toBe(4);
  await page.clock.runFor(3600000);await page.reload();await page.clock.resume();await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect(page.locator('#practiceRecovery')).toContainText('4 answered');
  const action=kind==='dailyChallenge'?'Resume challenge':'Resume test';await page.getByRole('button',{name:action,exact:true}).click();
  const resumed=await page.evaluate(()=>({id:sessionStats.study.runId,answered:sessionStats.answered,correct:sessionStats.correct,wrong:sessionStats.wrong,
    xp:ModeAtlasProgress.getXP(),sequence:settings.testMode?testSequence:dailySequence,kana:currentChar,elapsed:ModeAtlasSessionControls.activeElapsed(),question:Date.now()-charStartTime}));
  expect(resumed.id).toBe(before.checkpoint.sessionStats.study.runId);expect(resumed.sequence).toEqual(before.checkpoint.sequence);
  expect(resumed.kana).toBe(before.kana);expect(resumed.answered).toBe(4);expect(resumed.correct).toBe(3);expect(resumed.wrong).toBe(1);expect(resumed.xp).toBe(before.xp);
  expect(Math.abs(resumed.elapsed-before.checkpoint.elapsed)).toBeLessThan(1500);
  expect(Math.abs(resumed.question-before.checkpoint.questionElapsed)).toBeLessThan(1500);
  // Freeze after the final answer is committed, before its summary callback.
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
  for(let i=4;i<resumed.sequence.length-1;i++){await page.evaluate(()=>handleCorrect('saved answer'));await page.clock.runFor(350);}
  await page.evaluate(()=>handleCorrect('last answer'));
  expect(await page.evaluate(()=>sessionStats.answered)).toBe(resumed.sequence.length);
  await page.reload();await page.clock.resume();await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.getByRole('button',{name:action,exact:true}).click();
  await expect(page.locator('.ma-dialog__title')).toHaveText(kind==='dailyChallenge'?'Daily session complete':'Test complete');
  const result=await page.evaluate(()=>({xp:ModeAtlasProgress.getXP(),daily:getTodayDailyRecord(),tests:loadStoredTestModeResults(),correct:ModeAtlasProgress.getLifetimeCorrect()}));
  expect(result.correct).toBe(resumed.sequence.length-1);
  if(kind==='dailyChallenge'){expect(result.daily.officialScore).toBe(19);expect(result.daily.attempts).toBe(1);expect(result.daily.timeMs).toBeLessThan(60000);}
  else{expect(result.tests).toHaveLength(1);expect(result.tests[0].correct).toBe(resumed.sequence.length-1);expect(result.tests[0].wrong).toBe(1);expect(result.tests[0].durationMs).toBeLessThan(90000);}
  await page.getByRole('button',{name:'Done',exact:true}).click();await page.reload();await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect(page.locator('#practiceRecovery')).toHaveCount(0);expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(result.xp);
  if(kind==='testMode')expect(await page.evaluate(()=>loadStoredTestModeResults().length)).toBe(1);
  else expect(await page.evaluate(()=>getTodayDailyRecord().attempts)).toBe(1);
  expect(errors).toEqual([]);
});

test('web test recovery survives navigation, and discard retains earned practice but no formal result',async({page})=>{
  await prepare(page,{native:false});await open(page,'/reading/');
  await page.evaluate(()=>ModeAtlasTrainerControls.selectMode('testMode'));await page.locator('#startBtn').click();await correct(page,'reading');
  await page.goto('/');await open(page,'/reading/');await expect(page.getByRole('button',{name:'Resume test',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Resume test',exact:true}).click();expect(await page.evaluate(()=>testIndex)).toBe(1);
  await page.reload();await expect(page.locator('#maLoadingScreen')).toBeHidden();await page.getByRole('button',{name:'Discard test',exact:true}).click();
  expect(await page.evaluate(()=>ModeAtlasProgress.getLifetimeCorrect())).toBe(1);expect(await page.evaluate(()=>loadStoredTestModeResults().length)).toBe(0);
  await page.reload();await expect(page.locator('#practiceRecovery')).toHaveCount(0);
});

test('recovery rejects an expired daily attempt, a changed sequence, and an account mismatch',async({page})=>{
  await prepare(page);await open(page,'/writing/');await page.evaluate(()=>ModeAtlasTrainerControls.selectMode('dailyChallenge'));await page.locator('#startBtn').click();
  const checks=await page.evaluate(()=>{
    const saved=ModeAtlasSessionRecovery.read('writing'),check=change=>{const copy=structuredClone(saved);change(copy);return ModeAtlasSessionRecovery.validate(copy,'writing')===null;};
    return [!!saved,check(v=>v.sessionStats.study.dateKey='2000-01-01'),check(v=>v.sequence[1]='invalid kana'),check(v=>v.owner='other'),check(v=>v.sessionStats.answered=2)];
  });expect(checks).toEqual([true,true,true,true,true]);
});

for(const theme of ['dark','light'])test(`iOS ${theme}: home goals, profile order and dock frame stay consistent`,async({page},info)=>{
  await prepare(page,{theme,xp:700});await open(page,'/');
  await expect(page.locator('#homeGoals [data-goal]')).toHaveCount(3);
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('#maAccount-profile')).toBeVisible();
  const order=await page.evaluate(()=>document.querySelector('.ma-progression-card').getBoundingClientRect().bottom<document.querySelector('.ma-sync-card').getBoundingClientRect().top);
  expect(order).toBe(true);
  await page.screenshot({animations:'disabled',path:info.outputPath(`profile-${theme}.png`)});
  await page.evaluate(()=>ModeAtlasAccountNavigation.close());await open(page,'/progress/');await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await page.locator('[data-reward-category="frames"] > summary').click();
  await page.locator('[data-landmark="grove"]').click();
  await expect(page.locator('#topProfileDot')).toHaveAttribute('data-ma-frame','grove');
  const frame=await page.locator('#topProfileDot').evaluate(node=>getComputedStyle(node).boxShadow);expect(frame).toContain(theme==='dark'?'232, 155, 128':'143, 62, 37');
  await page.screenshot({animations:'disabled',path:info.outputPath(`rewards-${theme}.png`)});
  await page.getByRole('tab',{name:'Rewards',exact:true}).focus();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'Goals',exact:true})).toBeFocused();
  await open(page,'/');await page.locator('.atlas-home [data-ma-rewards-open]').click();await expect(page.getByRole('tabpanel',{name:'Goals',exact:true})).toBeVisible();
  await open(page,'/kana/');
  await expect(page.locator('#topProfileDot')).toHaveAttribute('data-ma-frame','grove');
});

for(const native of [false,true])for(const theme of ['light','dark'])test(`${native?'iOS':'web'} ${theme}: profile banners preview, unlock and persist separately from frames`,async({page},info)=>{
  await prepare(page,{native,theme,xp:700});await open(page,'/');
  await page.evaluate(()=>ModeAtlasRewardsUI.open());await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  const banner=page.getByRole('button',{name:'Kana grove banner, available',exact:true});await banner.click();
  await expect(page.getByRole('button',{name:'Kana grove banner, selected',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Open horizon banner, unlocks at level 50',exact:true})).toBeDisabled();
  await expect(page.locator('.ma-atlas-identity')).toHaveAttribute('data-ma-banner','grove');
  await page.screenshot({path:info.outputPath('banner-rewards.png'),animations:'disabled'});
  await page.locator('[data-reward-category="frames"] > summary').click();
  await page.locator('[data-landmark="grove"]').click();
  expect(await page.evaluate(()=>ModeAtlasRewardsUI.banner().id)).toBe('grove');
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('.ma-account-user[data-ma-selected-banner]')).toHaveAttribute('data-ma-banner','grove');
  await page.screenshot({path:info.outputPath('profile-banner.png'),animations:'disabled'});
  await page.reload();await expect(page.locator('#maLoadingScreen')).toBeHidden();
  expect(await page.evaluate(()=>({banner:ModeAtlasRewardsUI.banner().id,frame:ModeAtlasRewardsUI.appearance().id,xp:ModeAtlasProgress.getXP()}))).toEqual({banner:'grove',frame:'grove',xp:700});
  await page.evaluate(()=>{ModeAtlasRewardsUI.open();document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  expect(await page.locator('.ma-atlas-banners').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Original banner, available',exact:true}).click();
  expect(await page.evaluate(()=>ModeAtlasRewardsUI.banner().id)).toBe('plain');
});

for(const native of [false,true])for(const theme of ['light','dark'])test(`${native?'iOS':'web'} ${theme}: exclusive banner access and collapsible categories stay readable across accounts`,async({page},info)=>{
  await prepare(page,{native,theme});await open(page,'/');
  await page.evaluate(()=>ModeAtlasRewardsUI.open());await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await expect(page.getByRole('button',{name:/Hunny banner/})).toHaveCount(0);
  await expect(page.locator('[data-reward-category="frames"]')).not.toHaveAttribute('open','');
  await page.evaluate(async()=>{
    window.rewardUser='ordinary';window.rewardGrant={grants:[],allCustom:false};window.rewardFail=true;
    KanaCloudSync.getUser=()=>rewardUser?{uid:rewardUser}:null;
    const call=ModeAtlasSocial.call;window.ModeAtlasSocial={...ModeAtlasSocial,call:(action,...args)=>action==='rewards'?(rewardFail?Promise.reject(new Error('Unavailable')):Promise.resolve({...rewardGrant,validUntil:Date.now()+86400000})):call(action,...args)};
    await ModeAtlasRewardAccess.refresh(true);
  });
  // A signed-in account with no known extra rewards must not see an invitation
  // or an error when the backend is unavailable.
  await expect(page.locator('.ma-reward-access')).toBeHidden();
  await expect(page.getByRole('button',{name:/Hunny banner/})).toHaveCount(0);
  await page.evaluate(async()=>{rewardUser='tester';rewardFail=false;rewardGrant={grants:['hunny-tester'],allCustom:false};await ModeAtlasRewardAccess.refresh(true);});
  await page.getByRole('button',{name:'Hunny banner, available',exact:true}).click();
  await expect(page.locator('.ma-atlas-identity')).toHaveAttribute('data-ma-banner','hunny');
  await page.evaluate(async()=>{rewardFail=true;await ModeAtlasRewardAccess.refresh(true);});
  await expect(page.locator('.ma-reward-access span')).toHaveText('Showing your saved extra rewards.');
  await expect(page.getByRole('button',{name:'Hunny banner, selected',exact:true})).toBeEnabled();
  await page.evaluate(()=>{rewardFail=false;});
  await page.locator('.ma-reward-access').getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.locator('.ma-reward-access')).toBeHidden();
  const image=await page.evaluate(()=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src='/assets/rewards/hunny.webp';}));expect(image).toBe(true);
  const summary=page.locator('[data-reward-category="banners"] > summary');await summary.click();await summary.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Hunny banner, selected',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hunny banner, selected',exact:true}).scrollIntoViewIfNeeded();
  expect(await page.locator('.ma-atlas-banner-choice[data-ma-banner="hunny"] .ma-reward-exclusive').evaluate(node=>{
    const text=document.createRange();text.selectNodeContents(node);return text.getClientRects().length;
  })).toBe(1);
  await page.screenshot({path:info.outputPath('exclusive-banner-collection.png'),animations:'disabled'});
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('.ma-account-user[data-ma-selected-banner]')).toHaveAttribute('data-ma-banner','hunny');
  await page.screenshot({path:info.outputPath('exclusive-profile.png'),animations:'disabled'});
  await page.evaluate(()=>ModeAtlasAccountNavigation.close());await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await page.evaluate(async()=>{ModeAtlasRewardAccess.clear();rewardUser='ordinary';rewardGrant={grants:[],allCustom:false};await ModeAtlasRewardAccess.refresh(true);});
  await expect(page.locator('.ma-reward-access')).toBeHidden();
  await expect(page.getByRole('button',{name:/Hunny banner/})).toHaveCount(0);await expect(page.locator('.ma-atlas-identity')).toHaveAttribute('data-ma-banner','plain');
  await page.evaluate(async()=>{ModeAtlasRewardAccess.clear();rewardUser='admin';rewardGrant={grants:[],allCustom:true};await ModeAtlasRewardAccess.refresh(true);});
  await expect(page.getByRole('button',{name:'Hunny banner, selected',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open horizon banner, unlocks at level 50',exact:true})).toBeDisabled();
  if(native){
    await page.setViewportSize({width:320,height:700});
    await page.getByRole('button',{name:'Hunny banner, selected',exact:true}).scrollIntoViewIfNeeded();
    expect(await page.locator('.ma-atlas-banners').evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath('exclusive-small.png'),animations:'disabled'});
  }
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  if(native)await page.setViewportSize({width:320,height:700});
  await page.getByRole('button',{name:'Hunny banner, selected',exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>[document.documentElement,...document.querySelectorAll('.ma-reward-category,.ma-atlas-banner-choice:not([hidden])')].every(node=>node.scrollWidth<=node.clientWidth+1))).toBe(true);
  await page.screenshot({path:info.outputPath('exclusive-large-text.png'),animations:'disabled'});
  await page.evaluate(()=>{rewardUser='';ModeAtlasRewardAccess.clear();});await expect(page.getByRole('button',{name:/Hunny banner/})).toHaveCount(0);
});

for(const mode of ['reading','writing'])test(`${mode}: targeted mastery practice uses kana outside selected rows and actual pool XP`,async({page})=>{
  await prepare(page);await open(page,`/${mode}/?practice=10&kana=${encodeURIComponent('ファ')}&hints=off`);
  await expect(page.locator('#studySetDescription')).toContainText('ファ');
  await expect(page).toHaveURL(new RegExp('/'+mode+'/$'));
  expect(await page.evaluate(()=>sessionStarted)).toBe(false);
  await page.locator('#startBtn').click();
  expect(await page.evaluate(()=>({kana:currentChar,pool:sessionStats.study.poolSize,hints:sessionStats.study.hintsEnabled}))).toEqual({kana:'ファ',pool:1,hints:false});
  if(mode==='writing')await page.locator('.choice-btn').getByText('ファ',{exact:true}).click();
  else for(const letter of 'fa')await page.locator(`.ma-ios-reading-keyboard [data-key="${letter}"]`).click();
  await expect.poll(()=>page.evaluate(()=>sessionStats.correct)).toBe(1);
  expect(await page.evaluate(()=>sessionStats.study.xpParts.answers)).toBe(2);
});

test('mastery shows one map with independent skill evidence and restores focus after details',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page);await open(page,'/');
  await page.evaluate(()=>{
    ModeAtlasStorage.writeModeJSON('reading','charStats',{'い':{correct:38,wrong:3},'う':{correct:50,wrong:1}});
    ModeAtlasStorage.writeModeJSON('reading','charTimes',{'い':2160,'う':1540});
    ModeAtlasStorage.writeModeJSON('writing','charStats',{'い':{correct:3,wrong:0},'う':{correct:2,wrong:0}});
    ModeAtlasFeatures.openMasteryMap();
  });
  const cell=page.locator('[data-ma-mastery-kana="い"]');await expect(cell).toContainText('Familiar');
  await cell.click();await expect(page.locator('.ma-kana-skill-evidence').nth(0)).toContainText('Confident');await expect(page.locator('.ma-kana-skill-evidence').nth(1)).toContainText('Learning');
  await expect(page.locator('.ma-kana-targets')).toHaveCount(3);
  await expect(page.locator('.ma-kana-skill-evidence').nth(0)).toBeVisible();
  await page.getByRole('button',{name:'Recall · Learning',exact:true}).click();
  await expect(page.locator('.ma-kana-skill-evidence').nth(1)).toBeVisible();
  const link=page.getByRole('link',{name:'Practise Recall',exact:true});await expect(link).toHaveAttribute('href',/\/writing\/\?practice=20&kana=/);
  await page.setViewportSize({width:320,height:852});await page.evaluate(()=>{document.documentElement.style.fontSize='24px';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:info.outputPath('mastery-directions.png'),animations:'disabled'});
  await page.getByRole('button',{name:'Close Mastery Map or return to the map',exact:true}).click();
  await expect(page.getByRole('group',{name:'Mastery direction'})).toHaveCount(0);await expect(cell).toBeFocused();
  expect(errors).toEqual([]);
});

test('goal shortcuts and weekly recap expose recorded activity without inventing historical totals',async({page})=>{
  await prepare(page);await open(page,'/');await page.evaluate(()=>ModeAtlasRewardsUI.open());
  await expect(page.locator('.ma-routine-goal[href]').first()).toHaveAttribute('href',/\/(reading|writing)\/\?/);
  await page.getByRole('tab',{name:'Recap',exact:true}).click();
  await expect(page.locator('.ma-recap-grid')).toContainText('Read correct');await expect(page.locator('.ma-recap-grid')).toContainText('0 / 7');
  await page.getByRole('button',{name:'Last week',exact:true}).click();await expect(page.locator('.ma-atlas-recap')).toContainText('No dated practice');
  await expect(page.getByRole('link',{name:'View weekly ranking',exact:true})).toHaveAttribute('href','/friends/?ranking=weekly');
  await page.getByRole('tab',{name:'Recap',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Goals',exact:true})).toHaveAttribute('aria-selected','true');
});

for(const native of [true,false])test(`coin purchase, owned themes and rotation ${native?'iOS':'web'}`,async({page},testInfo)=>{
  await prepare(page,{native,theme:'light'});await open(page,'/progress/');
  await page.evaluate(async()=>{
    const state={balance:2000,owned:[],inventory:{'streak-freeze':0,'streak-repair':0},hidden:[],protection:[],repairDay:null};
    window.shopFixture=state;window.shopPurchases=[];
    KanaCloudSync.getUser=()=>({uid:'shop-test',email:'shop@example.test',emailVerified:true});KanaCloudSync.syncNow=async()=>true;
    ModeAtlasSocial={...ModeAtlasSocial,call:async(action,data)=>{
      if(action==='rewards')return {allCustom:false,grants:state.owned.map(id=>'shop-'+id),validUntil:Date.now()+86400000};
      if(action==='weeklyState')return {enabled:false};
      if(action==='shopPurchase'){
        window.shopPurchases.push(data);const product=ModeAtlasShopCatalogue.item(data.productId);state.balance-=product.coinPrice;
        if(product.kind==='collection')state.owned.push(product.id);else state.inventory[product.id]++;
      }
      if(action==='shopUse'){state.inventory['streak-repair']--;state.protection.push(state.repairDay);state.repairDay=null;}
      return {version:2,currency:'atlas-coins',balance:state.balance,offers:ModeAtlasShopCatalogue.products.filter(p=>!state.hidden.includes(p.id)).map(p=>ModeAtlasShopCatalogue.offer(p)).filter(Boolean),owned:[...state.owned],inventory:{...state.inventory},protection:state.protection,repairDay:state.repairDay,checkedAt:Date.now(),developer:false};
    }};
    await ModeAtlasRewardAccess.refresh(true);await ModeAtlasShop.refresh(true);
  });
  await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Shop',exact:true}).click();
  const shop=page.getByRole('tabpanel',{name:'Shop',exact:true});await expect(shop.locator('[data-ma-coin-balance]')).toHaveText('2,000');
  await shop.getByRole('button',{name:'Preview Sakura collection'}).click();await page.getByRole('button',{name:'Buy for 750 Atlas Coins',exact:true}).click();
  await expect(shop.locator('[data-ma-coin-balance]')).toHaveText('1,250');await expect(shop.locator('[data-ma-shop-product="sakura"]')).toContainText('In your Rewards');
  expect(await page.evaluate(()=>shopPurchases.length)).toBe(1);
  await shop.getByRole('button',{name:'Preview Sakura collection'}).click();await page.getByRole('button',{name:'Open Rewards',exact:true}).click();
  await page.locator('[data-reward-category="themes"] summary').click();await page.locator('[data-reward-category="themes"] [data-ma-theme-choice="sakura"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-ma-collection-theme','sakura');await expect(page.locator('html')).toHaveAttribute('data-ma-theme','light');
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(233, 191, 209)');
  await page.screenshot({path:testInfo.outputPath('sakura-rewards.png'),fullPage:true,animations:'disabled'});
  await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.locator('#maAccount-settings [data-ma-theme-choice]')).toHaveCount(0);await expect(page.getByRole('button',{name:'Themes & rewards',exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('sakura-settings.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('tab',{name:'Shop',exact:true}).click();
  await shop.locator('[data-ma-shop-product="streak-freeze"]').click();await page.getByRole('button',{name:'Buy for 150 Atlas Coins',exact:true}).click();
  await expect(shop.locator('[data-ma-coin-balance]')).toHaveText('1,100');await expect(shop.locator('[data-ma-shop-product="streak-freeze"]')).toContainText('1 ready');
  await page.evaluate(async()=>{shopFixture.hidden=['sakura'];await ModeAtlasShop.refresh(true);});
  await expect(shop.locator('[data-ma-shop-product="sakura"]')).toBeHidden();
  await shop.getByRole('button',{name:'Your rewards Your collections, wardrobe, themes and streak items.'}).click();
  await expect(page.locator('[data-reward-category="themes"] [data-ma-theme-choice="sakura"]')).toBeVisible();
  await expect(page.locator('[data-ma-shop-inventory]')).toContainText('1 Streak Freeze ready');
  expect(await page.evaluate(()=>ModeAtlasRewardRules.allowed('themes','sakura',1,ModeAtlasRewardAccess.current()))).toBe(true);
  await page.evaluate(async()=>{shopFixture.owned.push('midnight');await ModeAtlasRewardAccess.refresh(true);ModeAtlasTheme.set('midnight',{toast:false});});
  await expect(page.locator('html')).toHaveAttribute('data-ma-collection-theme','midnight');await expect(page.locator('body')).toHaveCSS('background-color','rgb(24, 22, 40)');
  await page.screenshot({path:testInfo.outputPath('midnight-rewards.png'),fullPage:true,animations:'disabled'});
  await page.evaluate(async()=>{shopFixture.owned=[];await ModeAtlasRewardAccess.refresh(true);});
  await expect(page.locator('html')).not.toHaveAttribute('data-ma-collection-theme');
  await expect(page.locator('[data-reward-category="themes"] [data-ma-theme-choice="sakura"]')).toBeHidden();
  await expect(page.locator('[data-reward-category="themes"] [data-ma-theme-choice="dark"]')).toBeVisible();
  await expect(page.locator('[data-reward-category="themes"] .ma-reward-category__meta')).toContainText('3 available');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('developer shop reset clears paid selections and uses the signed-in account',async({page})=>{
  await prepare(page,{native:false});await open(page,'/progress/');
  await page.evaluate(async()=>{
    window.devShopOperations=[];let balance=0,owned=['sakura'];
    KanaCloudSync.getUser=()=>({uid:'developer-test',email:'admin@mode-atlas.com',emailVerified:true});KanaCloudSync.syncNow=async()=>true;
    ModeAtlasSocial={...ModeAtlasSocial,call:async(action,data)=>{
      if(action==='rewards')return {allCustom:true,grants:['hunny-tester',...owned.map(id=>'shop-'+id)],validUntil:Date.now()+86400000};
      if(action==='shopDeveloper'){devShopOperations.push(data);if(data.operation==='credit')balance+=data.amount;else owned=[];}
      return {version:2,currency:'atlas-coins',balance,offers:ModeAtlasShopCatalogue.products.map(p=>ModeAtlasShopCatalogue.offer(p)).filter(Boolean),owned:[...owned],inventory:{'streak-freeze':0,'streak-repair':0},protection:[],repairDay:null,checkedAt:Date.now(),developer:true};
    }};
    await ModeAtlasRewardAccess.refresh(true);await ModeAtlasShop.refresh(true);ModeAtlasProgress.selectBanner('sakura');ModeAtlasProgress.selectAppearance('sakura');ModeAtlasTheme.set('sakura',{toast:false});
    await ModeAtlasDevConsoleLoader.loadIfEligible();ModeAtlasDevConsole.open();
  });
  await page.locator('[data-ma-dev-shop]').click();await page.locator('[data-ma-dev-coins]').fill('1500');await page.getByRole('button',{name:'Add currency',exact:true}).click();
  await expect(page.locator('[data-ma-dev-shop-status]')).toContainText('1,500 Atlas Coins added');
  await page.getByRole('button',{name:'Reset purchases',exact:true}).click();await expect(page.locator('.ma-dialog__title')).toHaveText('Reset your shop purchases?');
  await page.locator('.ma-dialog').getByRole('button',{name:'Reset purchases',exact:true}).click();
  await expect(page.locator('[data-ma-dev-shop-status]')).toContainText('Shop purchases reset');
  expect(await page.evaluate(()=>({balance:ModeAtlasShop.current().balance,banner:ModeAtlasProgress.readState().appearance.banner,frame:ModeAtlasProgress.readState().appearance.landmark,theme:ModeAtlasTheme.getPreference(),grants:ModeAtlasRewardAccess.current().grants,operations:devShopOperations.map(item=>item.operation)}))).toEqual({balance:1500,banner:'plain',frame:'trail',theme:'light',grants:['hunny-tester'],operations:['credit','resetPurchases']});
});

for(const layout of [{native:true,theme:'light',width:320},{native:true,theme:'dark',width:393},{native:false,theme:'light',width:1280}])test(`wardrobe colours, named pets and identity share one editor ${layout.native?'iOS':'web'} ${layout.theme}`,async({page},info)=>{
  await prepare(page,layout);await page.setViewportSize({width:layout.width,height:900});await open(page,'/progress/');
  await page.evaluate(()=>{
    KanaCloudSync.getUser=()=>({uid:'companion-owner'});
    window.companionState={version:1,revision:1,avatar:'character',displayName:'Atlas Learner',greeting:'Learning with Shiro',character:{...ModeAtlasAvatarRules.defaults,pet:'japanese-spitz',petName:'Shiro'},petNames:{'japanese-spitz':'Shiro'},level:15};
    ModeAtlasRewardAccess={...ModeAtlasRewardAccess,current:()=>({grants:['shop-calico','shop-japanese-spitz','shop-seigaiha-kimono','shop-meadow-dress','shop-starfall-skirt']})};
    ModeAtlasAvatar={...ModeAtlasAvatar,refresh:async()=>structuredClone(companionState),save:async(selection,revision)=>{window.companionSaved={...selection,revision};companionState={...companionState,...selection,revision:revision+1};return companionState;}};
  });
  await page.getByRole('tab',{name:'Rewards',exact:true}).click();await page.locator('.ma-atlas-panel [data-ma-avatar-open]').click();
  const editor=page.getByRole('dialog',{name:'Your avatar & pet'});
  await editor.getByRole('button',{name:'Edit avatar message',exact:true}).click();await editor.getByLabel('Your avatar’s message',{exact:true}).fill('A new chapter with my companion.');await editor.getByLabel('Display name',{exact:true}).fill('Atlas Explorer');
  await editor.getByRole('button',{name:'Wardrobe',exact:true}).click();await editor.getByRole('button',{name:'A-line skirt',exact:true}).click();await editor.locator('[data-avatar-slot=pantsColor][data-avatar-choice=coral]').click();
  await editor.getByRole('button',{name:'Everyday dress',exact:true}).click();await expect(editor.locator('[data-avatar-slot=pants]')).toHaveCount(0);
  await editor.getByRole('button',{name:'Ocean waves kimono',exact:true}).click();await expect(editor.locator('[data-avatar-slot=outfitColor]')).toHaveCount(4);await expect(editor.locator('[data-avatar-slot=outfitColor][data-avatar-choice=coral]')).toHaveCount(0);
  await editor.locator('[data-avatar-slot=outfitColor][data-avatar-choice=navy]').click();
  await editor.getByRole('button',{name:'Pet',exact:true}).click();await expect(editor.getByRole('button',{name:'Rabbit',exact:true})).toHaveCount(0);await expect(editor.getByRole('button',{name:'Moon fox',exact:true})).toHaveCount(0);
  await editor.getByRole('button',{name:'Calico cat',exact:true}).click();await editor.getByLabel('Pet name',{exact:true}).fill('Mochi');await editor.getByRole('button',{name:'Japanese Spitz',exact:true}).click();await expect(editor.getByLabel('Pet name',{exact:true})).toHaveValue('Shiro');
  await editor.getByRole('button',{name:'Edit avatar message',exact:true}).click();await editor.locator('.ma-avatar-studio').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('kimono-and-shiro.png'),animations:'disabled'});
  if(layout.native&&layout.theme==='dark'){await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.dataset.maLargeText='true';});await page.screenshot({path:info.outputPath('avatar-large-text.png'),animations:'disabled'});}
  expect(await editor.evaluate(node=>[...node.querySelectorAll('button,input,fieldset')].filter(el=>el.getClientRects().length).some(el=>{const b=el.getBoundingClientRect();return b.left<0||b.right>innerWidth+1;}))).toBe(false);
  await editor.getByRole('button',{name:'Save changes',exact:true}).click();await expect(editor).toBeHidden();
  expect(await page.evaluate(()=>companionSaved)).toMatchObject({revision:1,displayName:'Atlas Explorer',greeting:'A new chapter with my companion.',petNames:{calico:'Mochi','japanese-spitz':'Shiro'},character:{version:3,outfit:'seigaiha-kimono',outfitColor:'navy',pants:'a-line',pantsColor:'coral',pet:'japanese-spitz',petName:'Shiro'}});
});

test('full goals group each period while preserving live progress and practice destinations',async({page})=>{
  await page.setViewportSize({width:393,height:852});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');});
  await page.goto('/progress/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect(page.locator('.ma-goal-group')).toHaveCount(2);await expect(page.locator('.ma-goal-group').first().getByRole('heading',{name:'Today',exact:true})).toBeVisible();
  expect(await page.locator('.ma-goal-group').evaluateAll(groups=>groups.map(group=>group.querySelectorAll('.ma-routine-goal').length))).toEqual([3,2]);
  const goals=await page.evaluate(()=>ModeAtlasProgress.routine().goals);
  for(const goal of goals){const card=page.locator(`[data-goal="${goal.id}"]`);await expect(card.locator('progress')).toHaveAttribute('max',String(goal.target));await expect(card).toContainText(`+${goal.xp} XP`);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.ma-routine-goal[href]').first()).toHaveAttribute('href',/\/(reading|writing|kanji)\//);
});

test('personal daily and weekly goals create, repeat, edit and remove in the shared dialog',async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');localStorage.setItem('maWhatsNewSeen','personal-goals');});
  await page.goto('/progress/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.getByRole('button',{name:'+ Set daily goal',exact:true}).click();
  await page.getByLabel('Goal',{exact:true}).selectOption('kana-correct');await page.getByLabel('Target',{exact:true}).selectOption('50');await page.getByLabel('Repeat each day',{exact:true}).check();await page.getByRole('button',{name:'Create goal',exact:true}).click();
  await expect(page.locator('[data-goal="personal-daily"]')).toContainText('Recall 50 kana correctly');await expect(page.locator('[data-goal="personal-daily"]')).toContainText('Repeats');
  await page.getByRole('button',{name:'+ Set weekly goal',exact:true}).click();await page.getByLabel('Target',{exact:true}).selectOption('10');await page.getByRole('button',{name:'Create goal',exact:true}).click();
  await page.reload();await expect(page.locator('[data-personal="true"]')).toHaveCount(2);
  await page.locator('[data-goal="personal-daily"]').click();await expect(page.getByLabel('Target',{exact:true})).toHaveValue('50');await page.getByLabel('Target',{exact:true}).selectOption('20');await page.getByRole('button',{name:'Save goal',exact:true}).click();
  await page.locator('[data-goal="personal-weekly"]').click();await page.getByRole('button',{name:'Remove goal',exact:true}).click();await expect(page.locator('[data-personal="true"]')).toHaveCount(1);await expect(page.getByRole('button',{name:'+ Set weekly goal',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
