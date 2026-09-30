const {test,expect}=require('@playwright/test');
const socialConfig=require('../assets/app/mode-atlas-social-config.js');
async function launch(page,{native=true,theme='dark',width=393}={}){
  await page.setViewportSize({width,height:852});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','social-tests');localStorage.setItem('modeAtlasThemePreference',theme);
  },{native,theme});
  await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
}
async function prepare(page,{active=true,...layout}={}){
  await page.route('**/mode-atlas-social-config.assets-*.js',route=>route.fulfill({contentType:'text/javascript',body:"window.ModeAtlasSocialConfig={enabled:true,region:'australia-southeast1'};"}));
  await launch(page,layout);
  await page.evaluate(active=>{
    window.socialUser='self';window.socialCalls=[];window.socialOffline=false;window.socialDelayList=false;
    const stats={xp:4321,totalCorrect:1234,streak:12,readingMastered:42,writingMastered:21,combinedMastered:18,kanaCount:300,syncedAt:Date.now()};
    const self={uid:'self',displayName:'Jack',avatar:'kana',frame:'summit',title:'Summit Seeker',level:20,stats};
    const friend={uid:'friend',displayName:'桜の道を歩いて日本語を学ぶ友達',avatar:'sakura',frame:'lantern',title:'Lantern Keeper',level:35,stats:{...stats,xp:9000}};
    const pending={...friend,uid:'pending',displayName:'Mika'};
    const data=window.socialFixture={active,self,friend,friends:[friend],incoming:[pending],outgoing:[],blocked:[]};
    KanaCloudSync.getUser=()=>window.socialUser?{uid:window.socialUser,email:'private@example.test'}:null;
    KanaCloudSync.syncNow=async()=>true;
    const original=ModeAtlasSocial;
    window.ModeAtlasSocial={...original,isEnabled:()=>true,call:async(action,input={})=>{
      window.socialCalls.push({action,input});
      if(window.socialOffline)throw Object.assign(new Error('Connect to the internet to use Friends.'),{code:'offline'});
      if(action==='state')return window.socialUser==='self'?{active:data.active,profile:data.self,preferences:{displayName:data.self.displayName,avatar:data.self.avatar},accountPhoto:'https://lh3.googleusercontent.com/a/fixture',code:'ABCDEF0123456789ABCD',counts:{friends:data.friends.length,incoming:data.incoming.length,outgoing:data.outgoing.length,blocked:data.blocked.length}}:{active:false};
      if(action==='list'){
        const rows=input.kind==='rankings'?[{...data.friend,rank:1,score:9000},{...data.self,rank:2,score:4321}]:data[input.kind];
        const response={rows:structuredClone(rows),total:rows.length,nextCursor:null};
        if(window.socialDelayList)return new Promise(resolve=>{window.finishSocialList=()=>resolve(response);});
        return response;
      }
      if(action==='profile')return {profile:input.uid==='self'?data.self:data.friend};
      if(action==='updateProfile'){data.active=true;data.self.displayName=input.displayName;data.self.avatar=input.avatar;return {ok:true};}
      if(action==='lookup')return {profile:pending,relationship:'none'};
      if(action==='sendRequest'){data.outgoing=[pending];return {ok:true};}
      if(action==='accept'){data.incoming=[];data.friends.push(pending);return {ok:true};}
      if(action==='decline'){data.incoming=[];return {ok:true};}
      if(action==='cancel'){data.outgoing=[];return {ok:true};}
      if(action==='block'){data.blocked=[data.friend];data.friends=[];return {ok:true};}
      if(action==='remove'){data.friends=[];return {ok:true};}
      if(action==='leave'){data.active=false;data.friends=[];return {ok:true};}
      if(action==='unblock'){data.blocked=[];return {ok:true};}
      return {ok:true};
    }};
    ModeAtlasProfile.open();
  },active);
  await page.getByRole('tab',{name:'Friends',exact:true}).click();
  await expect(page.locator('#maAccountTitle')).toHaveText('Friends');
  await expect(page.getByText(active?'Jack · You':'Create your friends profile',{exact:true})).toBeVisible();
}
for(const native of [false,true])test(`${native?'iOS':'web'}: released Friends entry directs guests to the existing sign-in screen`,async({page})=>{
  const socialRequests=[];
  page.on('request',request=>{
    if(/firebase-functions\.js|cloudfunctions\.net|\.run\.app/.test(request.url()))socialRequests.push(request.url());
  });
  await launch(page,{native,width:native?393:1280});
  await page.locator('#profileOpenBtn').click();
  const entry=page.getByRole('tab',{name:'Friends',exact:true});
  if(!socialConfig.enabled){await expect(entry).toHaveCount(0);return;}
  await entry.click();
  await expect(page.getByText('Learn alongside friends',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('#maAccount-profile')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#profileAuthBtn')).toBeVisible();
  await expect(page.locator('[data-ma-dialog-layer]:visible')).toHaveCount(0);
  expect(socialRequests).toEqual([]);
});
async function fits(page){
  const issues=await page.locator('.ma-social').evaluate(root=>{
    const issues=[];
    for(const el of [root,...root.querySelectorAll('button,input,select,.ma-social-stats>div')]){
      if(!el.getClientRects().length)continue;const box=el.getBoundingClientRect();
      if(box.left<0 || box.right>innerWidth+1)issues.push(el.textContent+' outside screen');
      if(el.tagName==='BUTTON' && el.scrollWidth>el.clientWidth+2)issues.push(el.textContent+' clipped');
    }return issues;
  });expect(issues).toEqual([]);
}
for(const layout of [{native:true,theme:'dark',width:393},{native:true,theme:'light',width:320},{native:false,theme:'dark',width:1280},{native:false,theme:'light',width:393}]){
  test(`${layout.native?'iOS':'web'} ${layout.theme} ${layout.width}: friends, rankings and frames fit`,async({page},info)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,layout);await fits(page);
    await expect(page.locator('.ma-social-row [data-ma-frame="lantern"]')).toBeVisible();
    await page.getByRole('tab',{name:'Rankings',exact:true}).click();await expect(page.locator('.ma-social-rank')).toHaveText(['1','2']);await fits(page);
    await page.screenshot({path:info.outputPath('rankings.png'),animations:'disabled'});
    await page.getByLabel('Ranking',{exact:true}).selectOption('reading');await fits(page);
    await page.locator('.ma-social-person').first().click();await expect(page.getByText('Reading mastery',{exact:true})).toBeVisible();await fits(page);
    await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});await fits(page);
    await page.screenshot({path:info.outputPath('profile-large-text.png'),animations:'disabled'});expect(errors).toEqual([]);
  });
}
test('profile opt-in, code preview and request controls use the shared screen',async({page})=>{
  await prepare(page,{active:false,theme:'light'});
  await page.getByLabel('Display name',{exact:true}).fill('Jack Wright');await page.getByRole('button',{name:'Book',exact:true}).click();
  await page.getByRole('button',{name:'Create profile',exact:true}).click();expect(await page.evaluate(()=>socialCalls.some(call=>call.action==='updateProfile'))).toBe(false);
  await page.getByLabel('Share my profile through Friends').check();await page.getByRole('button',{name:'Create profile',exact:true}).click();
  await expect(page.getByText('Jack Wright · You',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'My code',exact:true}).click();await expect(page.getByLabel('Your friend code',{exact:true})).toHaveValue('ABCD-EF01-2345-6789-ABCD');await fits(page);
  await page.getByRole('button',{name:'← Friends',exact:true}).click();await page.getByRole('button',{name:'Add friend',exact:true}).click();
  await page.getByLabel('Friend code',{exact:true}).fill('1234-5678-90AB-CDEF-1234');await page.getByRole('button',{name:'Find profile',exact:true}).click();
  await expect(page.getByText('Mika',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Send request',exact:true}).click();
  await expect(page.getByLabel('Friends list',{exact:true})).toHaveValue('outgoing');await page.getByRole('button',{name:'Cancel request',exact:true}).click();
  await page.getByLabel('Friends list',{exact:true}).selectOption('incoming');await page.getByRole('button',{name:'Accept',exact:true}).click();
  expect(await page.evaluate(()=>socialCalls.filter(call=>call.action==='accept').length)).toBe(1);
});
test('block and opt-out require confirmation; cancelling preserves the current view',async({page})=>{
  await prepare(page);await page.locator('.ma-social-person').first().click();
  await page.getByRole('button',{name:'Block',exact:true}).click();await expect(page.getByText(/You will not see each other/)).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(()=>socialCalls.some(call=>call.action==='block'))).toBe(false);
  await page.getByRole('button',{name:'Block',exact:true}).click();await page.getByRole('button',{name:'Block',exact:true}).click();
  await page.getByLabel('Friends list',{exact:true}).selectOption('blocked');
  await expect(page.locator('.ma-social-row')).toContainText('Blocked profile');
  await expect(page.locator('.ma-social-row')).not.toContainText('Level');
  await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Leave Friends',exact:true}).click();
  await expect(page.getByText(/Your learning progress stays saved/)).toBeVisible();await page.getByRole('button',{name:'Leave Friends',exact:true}).click();
  await expect(page.getByText('Create your friends profile',{exact:true})).toBeVisible();
});
test('sign-out clears friends immediately and a delayed result cannot restore them',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{socialDelayList=true;});await page.getByRole('tab',{name:'Rankings',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof finishSocialList)).toBe('function');
  await page.evaluate(()=>{socialUser=null;window.dispatchEvent(new Event('kanaCloudSyncStatusChanged'));finishSocialList();});
  await expect(page.getByText('Learn alongside friends',{exact:true})).toBeVisible();
  await expect(page.locator('.ma-social-row')).toHaveCount(0);await expect(page.getByText('Jack · You',{exact:true})).toHaveCount(0);
});
test('offline failure offers refresh without a fabricated empty friends list',async({page})=>{
  await prepare(page);await page.evaluate(()=>{socialOffline=true;});await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.getByText('Connect to the internet to use Friends.',{exact:true})).toBeVisible();await expect(page.locator('.ma-social-row')).toHaveCount(0);
  await page.evaluate(()=>{socialOffline=false;});await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.locator('.ma-social-row')).toHaveCount(1);
});
test('leaving Friends discards a delayed response without changing the next account section',async({page})=>{
  await prepare(page);await page.evaluate(()=>{socialDelayList=true;});
  await page.getByRole('tab',{name:'Rankings',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof finishSocialList)).toBe('function');
  await page.getByRole('tab',{name:'Your Atlas',exact:true}).click();
  await page.evaluate(()=>{finishSocialList();socialDelayList=false;});
  await expect(page.locator('#maAccountTitle')).toHaveText('Your Atlas');
  await expect(page.locator('.ma-social')).toHaveCount(0);
  await expect(page.getByRole('tabpanel',{name:'Goals',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Friends',exact:true}).click();
  await expect(page.getByText('Jack · You',{exact:true})).toBeVisible();
});


test('pending requests stay visible outside their list and Refresh shares the My code row',async({page})=>{
  await prepare(page);
  const badge=page.getByRole('button',{name:'Review 1 pending friend request',exact:true});await expect(badge).toBeVisible();
  await expect(page.getByText('Your circle',{exact:true})).toHaveCount(0);
  const tools=page.locator('.ma-social-tools').filter({has:page.getByRole('button',{name:'My code',exact:true})});await expect(tools.getByRole('button',{name:'Refresh',exact:true})).toBeVisible();
  await badge.click();await expect(page.getByRole('combobox',{name:'Friends list'})).toHaveValue('incoming');await expect(badge).toHaveCount(0);
  await page.getByRole('button',{name:'Accept',exact:true}).click();await expect(page.locator('.ma-social-request-badge')).toHaveCount(0);
});
test('Friends avatar picker supports single emojis and an explicit account-photo choice',async({page},info)=>{
  await prepare(page);await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByRole('button',{name:'Emoji',exact:true}).click();await page.getByRole('textbox',{name:'Your emoji',exact:true}).fill('👩🏽‍🚀');
  await expect(page.getByRole('button',{name:'Emoji',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-avatar-mode="atlas"]')).toHaveAttribute('aria-pressed','false');
  await page.screenshot({path:info.outputPath('emoji-picker.png'),animations:'disabled'});
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  expect(await page.evaluate(()=>socialCalls.filter(item=>item.action==='updateProfile').at(-1).input.avatar)).toBe('emoji:👩🏽‍🚀');
  await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Account photo',exact:true}).click();
  await expect(page.getByText('Use your linked Google account photo in Friends.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  const data=await page.evaluate(()=>socialCalls.filter(item=>item.action==='updateProfile').at(-1).input);expect(data.avatar).toBe('account');expect(data.avatarURL).toBeUndefined();
});
