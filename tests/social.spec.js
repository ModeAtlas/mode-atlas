const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>require('./helpers/returning-tours')(page));
const socialConfig=require('../assets/app/mode-atlas-social-config.js');
async function launch(page,{native=true,theme='dark',width=393,share=false}={}){
  await page.setViewportSize({width,height:852});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await require('./helpers/firebase-guest')(page);
  await page.addInitScript(({native,theme,share})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    if(share){window.sharedCodes=[];window.nextShare='cancelled';window.Capacitor.Plugins.ModeAtlasNative={shareFriendCode:async value=>{sharedCodes.push(value);if(nextShare==='failed')throw new Error('sharing failed');return {status:nextShare};}};}
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','social-tests');localStorage.setItem('modeAtlasThemePreference',theme);
  },{native,theme,share});
  await page.goto('/friends/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
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
      if(action==='state')return window.socialUser==='self'?{active:data.active,profile:data.self,preferences:{displayName:data.self.displayName,avatar:data.self.avatar,greeting:data.self.greeting||''},accountPhoto:'https://lh3.googleusercontent.com/a/fixture',code:'ABCDEF0123456789ABCD',counts:{friends:data.friends.length,incoming:data.incoming.length,outgoing:data.outgoing.length,blocked:data.blocked.length},...(input.listKind?{list:{kind:input.listKind,rows:structuredClone(data[input.listKind]),total:data[input.listKind].length,nextCursor:null}}:{})}:{active:false};
      if(action==='avatarState')return {version:1,revision:data.revision||0,avatar:data.self.avatar,character:data.self.character||{...ModeAtlasAvatarRules.defaults},displayName:data.self.displayName,greeting:data.self.greeting||'',level:20};
      if(action==='avatarUpdate'){Object.assign(data.self,input);data.revision=(data.revision||0)+1;return {version:1,...input,revision:data.revision,level:20};}
      if(action==='weeklyState')return {enabled:!!data.weeklyEnabled,period:ModeAtlasWeeklyRules.period(),score:1200,rank:2,prizes:[500,300,150],minimumScore:100,minimumPlayers:2,awards:[]};
      if(action==='weeklyPreference'){data.weeklyEnabled=input.enabled;return {enabled:input.enabled};}
      if(action==='weeklyList')return {rows:(input.scope==='friends'?[{...data.self,rank:1,score:1200}]:[{...data.friend,rank:1,score:1400},{...data.self,rank:2,score:1200}]).map(({stats,...row})=>row),nextCursor:null};
      if(action==='list'){
        if(input.metric&&!['xp','streak','mastery','reading','writing','correct'].includes(input.metric))throw new Error('Choose a ranking.');
        const rows=input.kind==='rankings'?[{...data.friend,rank:1,score:9000},{...data.self,rank:2,score:4321}]:data[input.kind];
        const response={rows:structuredClone(rows),total:rows.length,nextCursor:null};
        if(window.socialDelayList)return new Promise(resolve=>{window.finishSocialList=()=>resolve(response);});
        return response;
      }
      if(action==='profile'){
        const relationship=input.uid==='self'?'self':data.friends.some(p=>p.uid===input.uid)?'friend':data.incoming.some(p=>p.uid===input.uid)?'incoming':data.outgoing.some(p=>p.uid===input.uid)?'outgoing':'none';
        const profile=input.uid==='self'?data.self:{...data.friend};if(!['self','friend'].includes(relationship))delete profile.stats;
        return {profile,relationship,friend:['self','friend'].includes(relationship),canRequest:relationship==='none'&&!!data.weeklyEnabled};
      }
      if(action==='updateProfile'){data.active=true;data.self.displayName=input.displayName;data.self.greeting=input.greeting;if(input.avatar)data.self.avatar=input.avatar;return {ok:true};}
      if(action==='lookup')return {profile:pending,relationship:'none'};
      if(action==='sendRequest'){data.outgoing=[input.uid===data.friend.uid?data.friend:pending];return {ok:true};}
      if(action==='accept'){const person=data.incoming.find(p=>p.uid===input.uid);data.incoming=[];if(person)data.friends.push(person);return {ok:true};}
      if(action==='decline'){data.incoming=[];return {ok:true};}
      if(action==='cancel'){data.outgoing=[];return {ok:true};}
      if(action==='block'){data.blocked=[data.friend];data.friends=[];return {ok:true};}
      if(action==='remove'){data.friends=[];return {ok:true};}
      if(action==='leave'){data.active=false;data.friends=[];return {ok:true};}
      if(action==='unblock'){data.blocked=[];return {ok:true};}
      return {ok:true};
    }};
    ModeAtlasSocialUI.mount(document.getElementById('maHubContent'));
  },active);
  await expect(page.locator('.ma-hub-header h1')).toHaveText('Friends');
  await expect(active?page.getByRole('button',{name:'My code',exact:true}):page.getByText('Create your friends profile',{exact:true})).toBeVisible();
}
test('a saved character renders in weekly rankings without a duplicate self banner',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{
    const character={...ModeAtlasAvatarRules.defaults,hair:'waves'};
    window.ModeAtlasAvatar={...ModeAtlasAvatar,current:()=>({avatar:'character',character})};
    socialFixture.friend.avatar='character';socialFixture.friend.character={...character,skin:'cocoa'};socialFixture.weeklyEnabled=true;
    dispatchEvent(new Event('modeAtlasAvatarChanged'));
  });
  await expect(page.locator('.ma-social-home>.ma-social-self')).toHaveCount(0);
  await page.getByRole('tab',{name:'Rankings',exact:true}).click();
  await expect(page.locator('.ma-social-row .ma-social-avatar svg')).toHaveCount(2);
});
for(const native of [false,true])test(`${native?'iOS':'web'}: released Friends entry directs guests to the existing sign-in screen`,async({page})=>{
  const socialRequests=[];
  page.on('request',request=>{
    if(/firebase-functions\.js|cloudfunctions\.net|\.run\.app/.test(request.url()))socialRequests.push(request.url());
  });
  await launch(page,{native,width:native?393:1280});
  if(!socialConfig.enabled){await expect(page.getByText('Friends is not available yet.',{exact:false})).toBeVisible();return;}
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
    await page.getByRole('tab',{name:'Rankings',exact:true}).click();await page.getByRole('button',{name:'All time',exact:true}).click();await expect(page.locator('.ma-social-rank')).toHaveText(['1','2']);await fits(page);
    await page.screenshot({path:info.outputPath('rankings.png'),animations:'disabled'});
    await page.getByLabel('Ranking',{exact:true}).selectOption('reading');await fits(page);
    await page.locator('.ma-social-person').first().click();await expect(page.getByText('Kana',{exact:true})).toBeVisible();await fits(page);
    await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});await fits(page);
    await page.screenshot({path:info.outputPath('profile-large-text.png'),animations:'disabled'});expect(errors).toEqual([]);
  });
}
test('profile opt-in, code preview and request controls use the shared screen',async({page})=>{
  await prepare(page,{active:false,theme:'light'});
  await page.getByLabel('Display name',{exact:true}).fill('Jack Wright');await expect(page.locator('.ma-social-form .ma-avatar-editor')).toHaveCount(0);
  await page.getByRole('button',{name:'Create profile',exact:true}).click();expect(await page.evaluate(()=>socialCalls.some(call=>call.action==='updateProfile'))).toBe(false);
  await page.getByLabel('Share my profile through Friends').check();await page.getByRole('button',{name:'Create profile',exact:true}).click();
  await expect(page.getByRole('button',{name:'My code',exact:true})).toBeVisible();
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
  await page.locator('.ma-social-privacy summary').click();await page.getByRole('button',{name:'Leave Friends',exact:true}).click();
  await expect(page.getByText(/Your learning progress stays saved/)).toBeVisible();await page.getByRole('button',{name:'Leave Friends',exact:true}).click();
  await expect(page.getByText('Create your friends profile',{exact:true})).toBeVisible();
});
test('sign-out clears friends immediately and a delayed result cannot restore them',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{socialDelayList=true;});await page.getByRole('tab',{name:'Rankings',exact:true}).click();await page.getByRole('button',{name:'All time',exact:true}).click();
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
  await page.getByRole('button',{name:'All time',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof finishSocialList)).toBe('function');
  await page.goto('/progress/');
  await expect(page.locator('.ma-hub-header h1')).toHaveText('Progress');
  await expect(page.locator('.ma-social')).toHaveCount(0);
  await expect(page.getByRole('tabpanel',{name:'Goals',exact:true})).toBeVisible();
  await prepare(page);
  await expect(page.getByRole('button',{name:'My code',exact:true})).toBeVisible();
});


test('pending requests stay visible outside their list and Refresh shares the My code row',async({page})=>{
  await prepare(page);
  const badge=page.getByRole('button',{name:'Review 1 pending friend request',exact:true});await expect(badge).toBeVisible();
  await expect(page.getByText('Your circle',{exact:true})).toHaveCount(0);
  const tools=page.locator('.ma-social-tools').filter({has:page.getByRole('button',{name:'My code',exact:true})});await expect(tools.getByRole('button',{name:'Refresh',exact:true})).toBeVisible();
  await badge.click();await expect(page.getByRole('combobox',{name:'Friends list'})).toHaveValue('incoming');await expect(badge).toHaveCount(0);
  await page.getByRole('button',{name:'Accept',exact:true}).click();await expect(page.locator('.ma-social-request-badge')).toHaveCount(0);
});
test('the avatar editor owns name and bio; My code only contains sharing controls',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:'My code',exact:true}).click();
  await expect(page.getByLabel('Your friend code',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toHaveCount(0);
  await page.evaluate(()=>ModeAtlasAccountNavigation.open('profile'));await page.locator('#maAccount-profile [data-ma-avatar-open]').click();
  const editor=page.getByRole('dialog',{name:'Your avatar & pet'});
  await editor.getByLabel('Display name',{exact:true}).fill('Jack Atlas');
  await editor.getByRole('button',{name:'Edit avatar message',exact:true}).click();
  await editor.getByLabel('Your avatar’s message',{exact:true}).fill('One step closer! 🌱');
  await editor.getByRole('button',{name:'Save changes',exact:true}).click();await expect(editor).toBeHidden();
  const data=await page.evaluate(()=>socialCalls.filter(item=>item.action==='avatarUpdate').at(-1).input);
  expect(data.displayName).toBe('Jack Atlas');expect(data.greeting).toBe('One step closer! 🌱');expect(data.character.version).toBe(3);
  await page.evaluate(()=>ModeAtlasAvatarUI.open());await editor.getByRole('button',{name:'Edit avatar message',exact:true}).click();
  await expect(editor.getByLabel('Your avatar’s message',{exact:true})).toHaveValue('One step closer! 🌱');
  await expect(editor.getByLabel('Display name',{exact:true})).toHaveValue('Jack Atlas');
});

test('reporting fits a small phone and moderation actions require confirmation',async({page},info)=>{
  await prepare(page,{native:true,width:320,theme:'light'});
  await expect(page.getByRole('button',{name:'Moderator menu',exact:true})).toHaveCount(0);
  await page.locator('.ma-social-person').first().click();await page.getByRole('button',{name:'Report',exact:true}).click();
  await page.getByLabel('Reason',{exact:true}).selectOption('harassment');
  await page.getByLabel('Details (optional)',{exact:true}).fill('Repeated unwanted requests.');await fits(page);
  await page.screenshot({path:info.outputPath('report-phone.png'),animations:'disabled'});
  await page.getByRole('button',{name:'Send report',exact:true}).click();await expect(page.getByRole('heading',{name:'Report sent',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>socialCalls.find(row=>row.action==='reportProfile').input)).toEqual({uid:'friend',reason:'harassment',note:'Repeated unwanted requests.'});
  expect(await page.evaluate(()=>socialCalls.some(row=>row.action==='block'))).toBe(false);
  await page.evaluate(()=>{
    const original=ModeAtlasSocial.call;window.reviewed=false;
    ModeAtlasSocial.call=async(action,data)=>{
      if(action==='state')return {...await original(action,data),canModerate:true};
      if(action==='listReports')return {rows:[{id:'a'.repeat(64),target:'friend',reason:'name',note:'<img src=x onerror=alert(1)>',snapshot:{displayName:'Reported name',avatar:'kana'},current:{displayName:'Reported name'},createdAt:Date.now()}],nextCursor:null};
      if(action==='reviewReport'){socialCalls.push({action,input:data});window.reviewed=true;return {ok:true};}
      return original(action,data);
    };
  });
  await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:'Moderator menu',exact:true}).click();
  await expect(page.getByText('<img src=x onerror=alert(1)>',{exact:true})).toBeVisible();await fits(page);
  await page.getByRole('button',{name:'Restrict Friends access',exact:true}).click();await expect(page.getByRole('heading',{name:'Restrict Friends access?',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>reviewed)).toBe(false);
  await page.getByRole('button',{name:'Restrict Friends access',exact:true}).click();
  expect(await page.evaluate(()=>socialCalls.find(row=>row.action==='reviewReport').input)).toEqual({id:'a'.repeat(64),decision:'restrict'});
});


test('report details remain editable in a short viewport without locking page scroll',async({page})=>{
  await prepare(page);
  await page.getByRole('button',{name:/桜の道/}).first().click();await page.getByRole('button',{name:'Report',exact:true}).click();
  await page.setViewportSize({width:393,height:450});
  const details=page.getByLabel('Details (optional)');await details.fill('Keyboard viewport regression.');await details.scrollIntoViewIfNeeded();
  await expect(details).toBeInViewport();await expect(details).toHaveValue('Keyboard viewport regression.');
  expect(await page.evaluate(()=>document.body.style.position)).toBe('');
});

test('staff controls show role badges, warning history and an explicit warning confirmation',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{
    const call=ModeAtlasSocial.call;
    ModeAtlasSocial.call=async(action,input)=>{
      if(action==='state')return {...await call(action,input),canModerate:true,role:'admin'};
      if(action==='profile')return {profile:{...socialFixture.friend,role:'moderator'}};
      if(action==='listReports')return {rows:[],nextCursor:null};
      if(action==='listModerators')return {canManage:true,rows:[{uid:'friend',displayName:'Mika'}]};
      if(action==='staffProfile')return {uid:'friend',displayName:'Mika',role:'moderator',canAct:true,canManage:true,count:2,history:[{id:'warning',message:'An earlier warning',at:Date.now()}]};
      return call(action,input);
    };
    ModeAtlasSocialUI.mount(document.getElementById('maHubContent'));
  });
  await page.getByRole('button',{name:/桜の道/}).first().click();await expect(page.locator('.ma-social-self').getByText('✓ Moderator',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Moderation & warnings',exact:true}).click();
  await expect(page.getByText('2 warnings · Visible only to Admin and Moderators',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Remove moderator role'})).toBeVisible();
  await page.getByLabel('Send a warning',{exact:true}).fill('Please review the community rules.');await page.getByRole('button',{name:'Review warning',exact:true}).click();
  expect(await page.evaluate(()=>socialCalls.some(row=>row.action==='warnProfile'))).toBe(false);
  await page.getByRole('button',{name:'Send warning',exact:true}).click();
  expect(await page.evaluate(()=>socialCalls.find(row=>row.action==='warnProfile').input.message)).toBe('Please review the community rules.');
  await page.getByRole('button',{name:'← Friends',exact:true}).click();
  await page.getByRole('button',{name:'Moderator menu',exact:true}).click();
  await page.getByRole('tab',{name:'Team',exact:true}).click();
  await page.getByRole('button',{name:'Remove role',exact:true}).click();
  expect(await page.evaluate(()=>socialCalls.some(row=>row.action==='assignModerator'))).toBe(false);
  await page.getByRole('button',{name:'Remove role',exact:true}).click();
  expect(await page.evaluate(()=>socialCalls.find(row=>row.action==='assignModerator').input)).toEqual({uid:'friend',moderator:false});
});


test('warnings arrive on a visit, remain until acknowledged and disappear on account change',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{
    ModeAtlasAccountNavigation.close();window.notices=[{id:'warning-one',message:'Please keep your profile welcoming.',at:Date.now()}];
    const original=ModeAtlasSocial.call;
    ModeAtlasSocial.call=async(action,input={},expectedUid)=>{
      if(action==='accountNotices')return {role:'member',warnings:window.socialUser==='self'?window.notices:[]};
      if(action==='acknowledgeWarnings'){window.noticeAcknowledged={input,expectedUid};window.notices=[];return {ok:true};}
      return original(action,input);
    };
    document.body.classList.add('trainer-session-active');
    window.dispatchEvent(new CustomEvent('modeAtlasAppStateChanged',{detail:{isActive:true}}));
  });
  const warning=page.getByRole('dialog',{name:'A message from Mode Atlas',exact:true});
  await expect(warning).toBeHidden();
  await page.evaluate(()=>{document.body.classList.remove('trainer-session-active');window.dispatchEvent(new CustomEvent('modeAtlasAppStateChanged',{detail:{isActive:true}}));});
  await expect(warning).toBeVisible();await expect(warning).toContainText('Please keep your profile welcoming.');
  await warning.getByRole('button',{name:'Read later',exact:true}).click();
  expect(await page.evaluate(()=>noticeAcknowledged??null).catch(()=>null)).toBe(null);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('modeAtlasAppStateChanged',{detail:{isActive:true}})));
  await expect(warning).toBeVisible();await warning.getByRole('button',{name:'I understand',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.noticeAcknowledged)).toEqual({input:{ids:['warning-one']},expectedUid:'self'});
  await page.evaluate(()=>{window.notices=[{id:'warning-two',message:'Private warning for the first account.',at:Date.now()}];window.dispatchEvent(new CustomEvent('modeAtlasAppStateChanged',{detail:{isActive:true}}));});
  await expect(warning).toBeVisible();
  await page.evaluate(()=>{window.socialUser='other';window.dispatchEvent(new Event('kanaCloudSyncStatusChanged'));});
  await expect(warning).toBeHidden();expect(await page.evaluate(()=>noticeAcknowledged.input.ids)).toEqual(['warning-one']);
});

test('native friend sharing supports cancel, failure, retry and sends only the friend code',async({page})=>{
  await prepare(page,{share:true,width:320});await page.getByRole('button',{name:'My code',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your friend code'})).toBeFocused();
  const share=page.getByRole('button',{name:'Share code',exact:true});await share.click();await expect(share).toBeEnabled();
  await expect(page.getByText('Friend code shared.',{exact:true})).toBeHidden();
  expect(await page.evaluate(()=>sharedCodes)).toEqual([{code:'ABCD-EF01-2345-6789-ABCD'}]);
  await page.evaluate(()=>window.nextShare='failed');await share.click();await expect(page.getByText('Could not share your code. Try again or copy it instead.')).toBeVisible();
  await page.evaluate(()=>window.nextShare='shared');await share.click();await expect(page.getByText('Friend code shared.',{exact:true})).toBeVisible();
  await fits(page);await page.screenshot({path:test.info().outputPath('friend-code-sharing.png')});
});

for(const layout of [{native:false,width:1280,theme:'dark',role:'admin'},{native:true,width:393,theme:'dark',role:'moderator'},{native:true,width:320,theme:'light',role:'admin'},{native:false,width:393,theme:'light',role:'member'}]){
  test(`${layout.native?'iOS':'web'} ${layout.width} ${layout.role}: compact Friends and moderation hub fit without stacked menus`,async({page},info)=>{
    await prepare(page,layout);
    await page.evaluate(role=>{
      socialFixture.self.role=role;
      socialFixture.friends=['Mika','Ren','Hana','Yuki','Sora','Aoi'].map((displayName,index)=>({...socialFixture.friend,uid:'friend-'+index,displayName,banner:['grove','bridge','summit','lantern','trail','plain'][index]}));
      const original=ModeAtlasSocial.call;
      ModeAtlasSocial.call=async(action,input)=>{
        if(action==='state')return {...await original(action,input),role,canModerate:role!=='member'};
        if(action==='listReports'||action==='listRestrictions')return {rows:[],nextCursor:null};
        if(action==='listModerators')return {canManage:role==='admin',rows:[{uid:'friend',displayName:'Mika'}]};
        if(action==='listWarnings'){
          const result={rows:[{uid:'friend',displayName:input?.cursor?'Ren':'Mika',role:'member',canAct:true,count:2,lastWarnedAt:Date.now()}],nextCursor:input?.cursor?null:'friend'};
          if(window.delayWarnings)return new Promise(resolve=>{window.finishWarnings=()=>resolve(result);});
          return result;
        }
        if(action==='staffProfile')return {uid:'friend',displayName:'Mika',role:'member',canAct:true,canManage:role==='admin',count:2,history:[{id:'one',message:'Please keep your profile welcoming.',at:Date.now()}]};
        return original(action,input);
      };
      ModeAtlasSocialUI.mount(document.getElementById('maHubContent'));
    },layout.role);
    await expect(page.locator('#maSocialList .ma-social-row')).toHaveCount(6);await fits(page);
    await expect(page.locator('.ma-social-friend__art[data-ma-banner="grove"]')).toHaveCount(1);
    if(layout.width===1280){
      const controls=await page.locator('.ma-social-home-tools>.ma-button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
      expect(controls.every(height=>height>=44&&height<=48)).toBe(true);
      const select=await page.getByRole('combobox',{name:'Friends list'}).boundingBox(),request=await page.getByRole('button',{name:'Review 1 pending friend request'}).boundingBox();
      expect(Math.abs(select.y-request.y)).toBeLessThanOrEqual(1);
    }
    await expect(page.getByRole('button',{name:'Review reports',exact:true})).toHaveCount(0);
    const visibleRows=await page.locator('#maSocialList').evaluate(list=>{
      const panel={top:0,bottom:document.querySelector('.ma-ios-tabs')?.getBoundingClientRect().top||innerHeight};
      return [...list.children].filter(row=>{const box=row.getBoundingClientRect();return box.top>=panel.top&&box.bottom<=panel.bottom;}).length;
    });
    // Illustrated cards show two people side by side on narrow web screens.
    if(layout.width>=393)expect(visibleRows).toBeGreaterThanOrEqual(!layout.native&&layout.width<600?2:3);
    await page.screenshot({path:info.outputPath('friends-compact-banners.png'),animations:'disabled'});
    const staff=page.getByRole('button',{name:'Moderator menu',exact:true});
    if(layout.role==='member'){await expect(staff).toHaveCount(0);return;}
    await staff.click();await page.getByRole('tab',{name:'Warnings',exact:true}).click();await fits(page);
    await expect(page.getByText('2 warnings',{exact:false})).toBeVisible();
    await expect(page.locator('[data-ma-dialog-layer]:visible')).toHaveCount(0);
    await page.getByRole('button',{name:/Mika.*2 warnings/}).click();
    await expect(page.getByText('Please keep your profile welcoming.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Clear warnings',exact:true})).toHaveCount(layout.role==='admin'?1:0);
    await page.getByRole('button',{name:'← Moderator menu',exact:true}).click();
    await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page.getByText('Ren',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Back to first page',exact:true}).click();await expect(page.getByText('Mika',{exact:true})).toBeVisible();
    await page.getByRole('tab',{name:'Team',exact:true}).click();
    await expect(page.getByRole('button',{name:'Remove role',exact:true})).toHaveCount(layout.role==='admin'?1:0);
    await page.getByRole('tab',{name:'Team',exact:true}).press('ArrowLeft');
    await expect(page.getByRole('tab',{name:'Warnings',exact:true})).toBeFocused();
    await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
    await fits(page);await page.screenshot({path:info.outputPath('moderator-hub-large-text.png'),animations:'disabled'});
    await page.evaluate(()=>{window.delayWarnings=true;});
    await page.getByRole('tab',{name:'Warnings',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>typeof finishWarnings)).toBe('function');
    await page.goto('/progress/');
    await expect(page.locator('#maModerationPanel')).toHaveCount(0);await expect(page.locator('.ma-hub-header h1')).toHaveText('Progress');
  });
}

test('a friend’s server-approved exclusive banner displays without granting it to the viewer',async({page},info)=>{
  await prepare(page,{native:true});
  await page.evaluate(()=>{socialFixture.friend.banner='hunny';});
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.locator('.ma-social-friend__art[data-ma-banner="hunny"]')).toHaveCount(1);
  expect(await page.locator('.ma-social-friend__art[data-ma-banner="hunny"]').evaluate(row=>{
    const art=row.getBoundingClientRect(),caption=row.closest('.ma-social-person').querySelector('.ma-social-friend__caption').getBoundingClientRect();
    return caption.top>=art.bottom&&caption.right<=row.closest('.ma-social-person').getBoundingClientRect().right;
  })).toBe(true);
  await page.screenshot({path:info.outputPath('friend-exclusive-banner.png'),animations:'disabled'});
  await page.goto('/progress/');await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await expect(page.getByRole('button',{name:/Hunny banner/})).toHaveCount(0);
});

for(const layout of [{native:true,theme:'dark',width:393},{native:true,theme:'light',width:320},{native:false,theme:'dark',width:1280}]){
  test(`weekly opt-in, reset, prizes and filters fit ${layout.native?'iOS':'web'} ${layout.theme} ${layout.width}`,async({page},info)=>{
    await prepare(page,layout);
    expect(await page.locator('.ma-social-body').evaluate(body=>body.firstElementChild.getAttribute('aria-label'))).toBe('Friends and rankings');
    await expect(page.getByRole('button',{name:'My code',exact:true})).toBeVisible();await expect(page.locator('.ma-social-home>.ma-social-self')).toHaveCount(0);
    await page.getByRole('tab',{name:'Rankings',exact:true}).click();
    await expect(page.getByRole('button',{name:'This week',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.ma-social-self')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);
    await expect(page.getByLabel('Ranking',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Join weekly competition',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>socialCalls.some(call=>call.action==='weeklyList'))).toBe(false);
    await fits(page);await page.getByRole('button',{name:'Join weekly competition',exact:true}).click();
    await expect(page.locator('.ma-social-rank')).toHaveText(['1','2']);
    await expect(page.getByRole('heading',{name:'Weekly ladder',exact:true})).toBeVisible();
    await expect(page.locator('.ma-weekly-summary time')).toContainText('Resets');
    await expect(page.locator('.ma-weekly-stats')).toContainText('Global rank');
    await expect(page.locator('.ma-weekly-details details[open]')).toHaveCount(0);
    await expect(page.getByText(/Rankings use each friend/)).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Near me',exact:true})).toHaveCount(0);
    await expect(page.getByRole('group',{name:'Weekly ranking scope'}).getByRole('button')).toHaveText(['Global','Friends']);
    const summaryBox=await page.locator('.ma-weekly-summary').boundingBox();expect(summaryBox.height).toBeLessThan(260);
    if(layout.width>=393){
      const first=await page.locator('.ma-social-row').first().boundingBox();
      const bottom=await page.evaluate(()=>document.querySelector('.ma-ios-tabs')?.getBoundingClientRect().top||innerHeight);
      expect(first.y+first.height).toBeLessThanOrEqual(bottom);
    }
    await fits(page);await page.screenshot({path:info.outputPath('weekly-board.png'),animations:'disabled'});
    await page.locator('#maSocialList').getByRole('button',{name:'Friends',exact:true}).click();
    await expect(page.locator('.ma-social-rank')).toHaveText(['1']);
    await page.locator('#maSocialTab-friends').click();
    await expect(page.getByRole('button',{name:'My code',exact:true})).toBeVisible();await expect(page.locator('.ma-social-home>.ma-social-self')).toHaveCount(0);
    await expect(page.locator('.ma-social-row')).toHaveCount(1);await expect(page.locator('.ma-social-status')).toBeHidden();
    for(const kind of ['incoming','outgoing','blocked','friends']){
      await page.getByLabel('Friends list',{exact:true}).selectOption(kind);
      await expect(page.locator('.ma-social-row')).toHaveCount(['incoming','friends'].includes(kind)?1:0);
    }
    expect(await page.evaluate(()=>socialCalls.filter(call=>call.action==='list'&&call.input.kind!=='rankings').every(call=>!('metric' in call.input)))).toBe(true);
    await page.locator('#maSocialTab-rankings').click();
    await expect(page.getByRole('button',{name:'This week',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.ma-social-rank')).toHaveText(['1']);
    await page.getByRole('button',{name:'All time',exact:true}).click();await page.getByLabel('Ranking',{exact:true}).selectOption('writing');
    await expect(page.getByText(/Rankings use each friend/)).toHaveCount(0);await expect(page.locator('.ma-social-self')).toHaveCount(0);
    await page.getByRole('button',{name:'This week',exact:true}).click();await page.getByRole('button',{name:'All time',exact:true}).click();
    await expect(page.getByLabel('Ranking',{exact:true})).toHaveValue('writing');
    await page.getByRole('button',{name:'This week',exact:true}).click();
    await expect(page.locator('.ma-social-rank')).toHaveText(['1']);
    await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
    const tabLines=await page.getByRole('tablist',{name:'Friends and rankings'}).getByRole('tab').evaluateAll(tabs=>tabs.map(tab=>{
      const label=tab.firstChild,range=document.createRange();range.selectNodeContents(label);return range.getClientRects().length;
    }));expect(tabLines).toEqual([1,1]);
    await fits(page);await page.screenshot({path:info.outputPath('weekly-large-text.png'),animations:'disabled'});
    await page.getByText('Rules & prizes',{exact:true}).click();
    await expect(page.getByText(/Everyone resets together on Monday/)).toBeVisible();await expect(page.getByText(/First place also earns 100 Atlas Coins/)).toBeVisible();await fits(page);
    await page.getByRole('button',{name:'Leave weekly competition',exact:true}).click();
    await page.getByRole('button',{name:'Leave competition',exact:true}).click();
    await expect(page.getByRole('button',{name:'Join weekly competition',exact:true})).toBeVisible();
  });
}

test('friend cards show status, left-aligned avatars and reuse the list when returning',async({page},info)=>{
  await prepare(page,{native:true,width:393});
  await page.evaluate(()=>Object.assign(socialFixture.friend,{avatar:'character',character:{...ModeAtlasAvatarRules.defaults},greeting:'I just learnt あ today!'}));
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.locator('.ma-social-friend__status')).toHaveText('I just learnt あ today!');
  const art=await page.locator('.ma-social-friend__art').boundingBox(),figure=await page.locator('.ma-social-friend__figure').boundingBox();
  expect(figure.x+figure.width/2).toBeLessThan(art.x+art.width*.4);
  const speech=await page.locator('.ma-social-friend__status').boundingBox();expect(speech.y).toBeGreaterThan(art.y);expect(speech.y+speech.height).toBeLessThan(figure.y+10);
  const before=await page.evaluate(()=>socialCalls.filter(call=>['state','list'].includes(call.action)).length);
  await page.locator('.ma-social-friend .ma-social-person').click();
  await page.getByRole('button',{name:'← Friends',exact:true}).click();
  await expect(page.locator('.ma-social-friend__status')).toBeVisible();
  expect(await page.evaluate(()=>socialCalls.filter(call=>['state','list'].includes(call.action)).length)).toBe(before);
  await fits(page);await page.screenshot({path:info.outputPath('friends-status.png'),animations:'disabled'});
});

test('weekly deep links open the ladder and delayed weekly rows cannot replace Friends',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{
    socialFixture.weeklyEnabled=true;
    const call=ModeAtlasSocial.call;
    ModeAtlasSocial.call=async(action,input)=>{
      const result=await call(action,input);
      if(action==='weeklyState')return {...result,results:[{week:'2026-09-21',rank:4,score:840,xp:0}]};
      if(action==='weeklyList'&&window.delayWeekly)return new Promise(resolve=>{window.finishWeekly=()=>resolve(result);});
      return result;
    };
    history.replaceState(null,'','/friends/?ranking=weekly');ModeAtlasSocialUI.mount(document.getElementById('maHubContent'));
  });
  await expect(page.getByRole('heading',{name:'Weekly ladder',exact:true})).toBeVisible();
  await page.getByText('Past results',{exact:true}).click();await expect(page.getByText('Week of 2026-09-21 · #4 · 840 weekly XP · No prize',{exact:true})).toBeVisible();
  await page.locator('#maSocialTab-rankings').focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('#maSocialTab-friends')).toBeFocused();
  await page.evaluate(()=>{window.delayWeekly=true;});await page.keyboard.press('ArrowRight');
  await expect.poll(()=>page.evaluate(()=>typeof finishWeekly)).toBe('function');
  await page.locator('#maSocialTab-friends').click();await page.evaluate(()=>finishWeekly());
  await expect(page.locator('.ma-social-row')).toHaveCount(1);await expect(page.locator('.ma-weekly-summary')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'My code',exact:true})).toBeVisible();await expect(page.locator('.ma-social-home>.ma-social-self')).toHaveCount(0);
});

test('Friends opens from one bundled response without waiting for rewards; name editing lives beside the code',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{
    window.ModeAtlasRewardAccess={...ModeAtlasRewardAccess,refresh:()=>new Promise(()=>{})};
    socialCalls=[];ModeAtlasSocialUI.mount(document.getElementById('maHubContent'));
  });
  await expect(page.locator('#maSocialList .ma-social-row')).toHaveCount(1,{timeout:1000});
  expect(await page.evaluate(()=>socialCalls.filter(call=>['state','list'].includes(call.action)))).toEqual([{action:'state',input:{listKind:'friends'}}]);
  await expect(page.locator('.ma-social-home>.ma-social-self')).toHaveCount(0);
  await page.getByRole('button',{name:'My code',exact:true}).click();await expect(page.getByLabel('Your friend code',{exact:true})).toBeVisible();await expect(page.locator('.ma-social-code-name')).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toHaveCount(0);
});


for(const native of [true,false])test(`global weekly profile can request, cancel and accept a friendship without a code ${native?'iOS':'web'}`,async({page},info)=>{
  await prepare(page,{native,width:native?320:1280});await page.evaluate(()=>{socialFixture.friends=[];socialFixture.incoming=[];socialFixture.weeklyEnabled=true;socialFixture.friend.theme='sakura';socialFixture.friend.greeting='See you at the summit!';socialFixture.friend.character={...ModeAtlasAvatarRules.defaults,hair:'side-part',hairColor:'walnut',pants:'cargo',pet:'japanese-spitz',petName:'Shiro'};});
  await page.getByRole('tab',{name:'Rankings',exact:true}).click();
  await page.locator('.ma-social-person').filter({hasText:'桜の道'}).click();
  await expect(page.getByRole('button',{name:'Add friend',exact:true})).toBeVisible();
  await expect(page.locator('.ma-social-stats')).toHaveCount(0);
  await expect(page.locator('.ma-social-character__figure svg')).toHaveAttribute('viewBox','0 0 320 340');
  await expect(page.locator('.ma-social-character__speech')).toHaveText('We aren’t friends yet. Want to learn together?');
  await page.screenshot({path:info.outputPath('visitor-avatar.png'),fullPage:true});
  await page.getByRole('button',{name:'Add friend',exact:true}).click();await expect(page.getByText('Friend request sent',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>socialCalls.filter(c=>c.action==='sendRequest').at(-1).input)).toEqual({uid:'friend'});
  await page.getByRole('button',{name:'Cancel request',exact:true}).click();await expect(page.getByRole('button',{name:'Add friend',exact:true})).toBeVisible();
  await page.evaluate(()=>{socialFixture.incoming=[socialFixture.friend];});
  await page.getByRole('button',{name:'← Rankings',exact:true}).click();await page.locator('.ma-social-person').filter({hasText:'桜の道'}).click();
  await page.getByRole('button',{name:'Accept request',exact:true}).click();await expect(page.getByRole('button',{name:'Remove friend',exact:true})).toBeVisible();
  await expect(page.locator('.ma-social-stats')).toBeVisible();await expect(page.getByRole('button',{name:'Add friend',exact:true})).toHaveCount(0);
  await expect(page.locator('.ma-social-character__speech')).toHaveText('See you at the summit!');
  await expect(page.locator('.ma-social-pet-name')).toHaveText('Shiro');
  await expect(page.locator('.ma-social-profile')).toHaveAttribute('data-ma-profile-theme','sakura');await expect(page.locator('html')).not.toHaveAttribute('data-ma-collection-theme','sakura');
  expect(await page.locator('.ma-social-character__figure').evaluate(node=>{const svg=node.querySelector('svg').getBoundingClientRect(),name=node.querySelector('.ma-social-pet-name').getBoundingClientRect();return Math.abs(name.x+name.width/2-(svg.x+svg.width*258.5/320));})).toBeLessThan(2);
  expect(await page.locator('.ma-social-character').evaluate(node=>node.querySelector('.ma-social-character__speech').getBoundingClientRect().bottom<=node.querySelector('.ma-social-character__figure').getBoundingClientRect().top)).toBe(true);
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.dataset.maLargeText='true';document.querySelector('.ma-social-pet-name').textContent='W'.repeat(24);});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('friend-avatar-large-text.png'),fullPage:true});
});

test('weekly podium keeps server ties, profile actions and pagination without duplicating rows',async({page})=>{
  await prepare(page,{native:false,width:1280});
  await page.evaluate(()=>{
    socialFixture.weeklyEnabled=true;
    const original=ModeAtlasSocial.call;
    ModeAtlasSocial.call=async(action,input)=>{
      if(action!=='weeklyList')return original(action,input);
      const people=[['first',1],['friend',1],['third',3],['fourth',4],['fifth',5]];
      const items=(input.cursor?people.slice(4):people.slice(0,4)).map(([uid,rank])=>({...socialFixture.friend,uid,rank,score:2000-rank*100,displayName:uid}));
      return {rows:items,nextCursor:input.cursor?null:'page-two'};
    };
  });
  await page.getByRole('tab',{name:'Rankings',exact:true}).click();
  await expect(page.locator('.ma-weekly-podium .ma-social-rank')).toHaveText(['1','1','3']);
  await expect(page.locator('.ma-social-row')).toHaveCount(4);
  await page.getByRole('button',{name:'Load more',exact:true}).click();
  await expect(page.locator('.ma-social-rank')).toHaveText(['1','1','3','4','5']);
  await expect(page.locator('.ma-weekly-podium')).toHaveCount(1);
  await page.locator('.ma-weekly-podium .ma-social-person').nth(1).click();
  await expect(page.getByText('Kana',{exact:true})).toBeVisible();
});

test('friend artwork stays above readable identity and a narrow card opens the real profile',async({page})=>{
  await prepare(page,{width:393});
  await page.evaluate(()=>{
    const friend=socialFixture.friend;friend.displayName='Evelyn';friend.banner='hunny';friend.avatar='character';friend.character={...ModeAtlasAvatarRules.defaults};
    socialFixture.friends=[friend,{...friend,uid:'another',displayName:'Admin',banner:'skyline'}];ModeAtlasSocialUI.mount(document.getElementById('maHubContent'));
  });
  await expect(page.locator('.ma-social-friend')).toHaveCount(2);
  const geometry=await page.locator('.ma-social-friend').evaluateAll(cards=>cards.map(card=>{const art=card.querySelector('.ma-social-friend__art').getBoundingClientRect(),copy=card.querySelector('.ma-social-friend__caption').getBoundingClientRect();return {clear:art.bottom<=copy.top,contained:card.scrollWidth<=card.clientWidth};}));
  expect(geometry.every(card=>card.clear&&card.contained)).toBe(true);
  await page.locator('.ma-social-friend .ma-social-person').first().click();await expect(page.locator('.ma-social-character')).toBeVisible();
  expect(await page.evaluate(()=>socialCalls.some(call=>call.action==='profile'&&call.input.uid==='friend'))).toBe(true);
});

for(const native of [true,false])test(`account-wide friend insights distinguish mastery from learning ${native?'iOS':'web'}`,async({page},info)=>{
  await prepare(page,{native,width:native?393:1280});
  await page.evaluate(()=>{socialFixture.friend.stats.insights={dailyGoals:143,weeklyGoals:22,studyDays:78,dailyChallenges:41,achievements:{earned:32,total:96,percent:33},kana:{total:240,mastered:48,confident:144,learning:24,percent:20},kanji:{total:2093,mastered:21,confident:20,learning:14,percent:1}};});
  await page.locator('.ma-social-person').first().click();
  await expect(page.locator('.ma-social-insights')).toContainText('Daily goals');await expect(page.locator('.ma-social-insights')).toContainText('Weekly goals');
  await expect(page.locator('.ma-social-insights')).toContainText('32 of 96');await expect(page.locator('.ma-social-branch__title')).toHaveText(['Kana20% mastered','Kanji1% mastered']);
  await expect(page.locator('.ma-social-branch__legend').first()).toContainText('144 Confident');
  await page.getByText('How mastery is counted',{exact:true}).click();await expect(page.locator('.ma-social-mastery-help')).toContainText('including locked characters');await fits(page);
  await page.screenshot({path:info.outputPath(`account-insights-${native?'ios':'web'}.png`),fullPage:true,animations:'disabled'});
});

for(const width of [320,393,1280])test(`banner compositions and weekly identities stay readable at ${width}`,async({page},info)=>{
 await prepare(page,{native:width<600,width});
 await page.evaluate(()=>{
  Object.assign(socialFixture.friend,{displayName:'Ev',banner:'hunny',avatar:'character',character:{...ModeAtlasAvatarRules.defaults},greeting:'I just learnt あ today! Now I am practising a whole new row of hiragana.'});
  const admin={...socialFixture.friend,uid:'admin',displayName:'Admin',avatar:'kana',character:null,banner:'skyline',role:'admin',greeting:'Hello, I am the Admin for Mode Atlas!'};
  socialFixture.friends=[socialFixture.friend,admin];socialFixture.weeklyEnabled=true;
  const call=ModeAtlasSocial.call;ModeAtlasSocial.call=async(action,input)=>action==='weeklyList'?{rows:[socialFixture.friend,{...socialFixture.self,banner:'bridge'},admin].map((p,i)=>({...p,rank:i+1,score:118-i*16})),nextCursor:null}:call(action,input);
 });
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 const cards=await page.locator('.ma-social-friend').evaluateAll(items=>items.map(c=>{const art=c.querySelector('.ma-social-friend__art'),box=art.getBoundingClientRect(),photo=art.querySelector('.ma-social-avatar')?.getBoundingClientRect();return {height:c.getBoundingClientRect().height,centered:!photo||Math.abs(photo.x+photo.width/2-box.x-box.width/2)<2,bubble:!!art.querySelector('.ma-social-friend__status')};}));
 expect(cards.every(c=>c.centered&&c.bubble)).toBe(true);expect(Math.abs(cards[0].height-cards[1].height)).toBeLessThan(2);
 await fits(page);await page.screenshot({path:info.outputPath('friend-composition.png')});
 await page.getByRole('tab',{name:'Rankings',exact:true}).click();
 await expect(page.locator('.ma-weekly-podium .ma-social-rank')).toHaveText(['1','2','3']);
 const banners=await page.locator('.ma-weekly-podium .ma-banner-scene').evaluateAll(items=>items.map(el=>{const style=getComputedStyle(el),art=getComputedStyle(el,'::before');return {opacity:style.opacity,artOpacity:art.opacity,mask:art.maskImage,background:art.backgroundImage};}));
 expect(banners.every(b=>b.opacity==='1'&&b.artOpacity==='1'&&b.mask==='none')).toBe(true);expect(banners[0].background).toContain('hunny');
 const rows=await page.locator('.ma-weekly-podium .ma-social-row').evaluateAll(items=>items.map(c=>({width:c.clientWidth,scroll:c.scrollWidth,text:c.querySelector('.ma-social-identity').getBoundingClientRect().width,height:c.getBoundingClientRect().height})));
 expect(rows.every(c=>c.scroll<=c.width&&c.text>70&&c.height<300)).toBe(true);
 await fits(page);await page.screenshot({path:info.outputPath('weekly-composition.png')});
});
