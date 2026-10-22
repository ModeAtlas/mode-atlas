const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>require('./helpers/returning-tours')(page));
test.use({timezoneId:'Australia/Melbourne'});
test.describe.configure({mode:'parallel'});

async function prepare(page,native=false){
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(native=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{setAppIcon:async()=>true}}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','stability');
  },native);
}

for(const native of [false,true])test(`repeating goals reset in the open page at Melbourne midnight and Monday ${native?'iOS':'web'}`,async({page})=>{
  await prepare(page,native);await page.clock.install({time:new Date('2026-10-25T23:59:30+11:00')});
  await page.goto('/progress/?tab=goals');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(()=>{
    const p=ModeAtlasProgress,day=ModeAtlasDates.localDateKey();
    p.setPersonalGoal('daily',{id:'kana-correct',target:20,repeat:true});
    p.setPersonalGoal('weekly',{id:'kana-correct',target:100,repeat:true});
    const state=p.readState();state.activity[day]={sources:{device:[100,0]},reviews:{reading:[],writing:[]},metrics:{},kana:['あ'],goalVersion:4};p.persistState(state);
  });
  for(const period of ['daily','weekly'])await expect(page.locator(`[data-goal="personal-${period}"]`)).toHaveAttribute('data-complete','true');
  await page.clock.fastForward(40000);await page.clock.runFor(50);
  for(const period of ['daily','weekly']){
    const goal=page.locator(`[data-goal="personal-${period}"]`);await expect(goal).toHaveAttribute('data-complete','false');await expect(goal).toContainText('Repeats');await expect(goal.locator('progress')).toHaveJSProperty('value',0);
  }
  await page.reload();await expect(page.locator('[data-personal="true"]')).toHaveCount(2);
});

test('returning after suspended calendar days refreshes repeating goals and expires one-off goals',async({page})=>{
  await prepare(page,true);await page.clock.install({time:new Date('2026-10-25T15:00:00+11:00')});await page.goto('/progress/?tab=goals');
  await page.evaluate(()=>{
    ModeAtlasProgress.setPersonalGoal('daily',{id:'kana-correct',target:20,repeat:true});
    ModeAtlasProgress.setPersonalGoal('weekly',{id:'kana-correct',target:100,repeat:false});
    dispatchEvent(new CustomEvent('modeAtlasAppStateChanged',{detail:{isActive:false}}));
  });
  await page.clock.setSystemTime(new Date('2026-10-27T10:00:00+11:00'));
  await page.evaluate(()=>dispatchEvent(new CustomEvent('modeAtlasAppStateChanged',{detail:{isActive:true}})));
  await expect(page.locator('[data-goal="personal-daily"]')).toContainText('Repeats');
  await expect(page.locator('[data-goal="personal-weekly"]')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'+ Set weekly goal',exact:true})).toBeVisible();
});

test('slow Firebase restoration keeps navigation usable and never presents Friends as signed out prematurely',async({page})=>{
  await prepare(page);let release;const held=new Promise(resolve=>{release=resolve;});
  await page.route('**/firebasejs/**',async route=>{await held;await route.abort().catch(()=>{});});
  try{
    await page.goto('/friends/',{waitUntil:'domcontentloaded'});
    await expect(page.locator('.ma-social-body')).toContainText('Restoring your account');
    await expect(page.locator('.ma-social-body').getByRole('button',{name:'Sign in',exact:true})).toHaveCount(0);
    expect(await page.evaluate(()=>KanaCloudSync.getSyncStatus().state)).toBe('restoring');
    await expect(page.locator('#maLoadingScreen')).toBeHidden();
    await page.locator('.ma-nav__link[data-ma-nav-item="learn"]').click();
    await expect(page).toHaveURL(/\/learn\/$/);await expect(page.locator('#maHubContent')).toBeVisible();
    await expect(page.locator('#maLoadingScreen')).toBeHidden();
  }finally{release();}
});

test('unavailable account restoration offers a retry without claiming the user signed out',async({page})=>{
  await prepare(page);await page.goto('/friends/');
  const body=page.locator('.ma-social-body');
  await expect(body).toContainText('Couldn’t restore your account');
  await expect(body.getByRole('button',{name:'Sign in',exact:true})).toHaveCount(0);
  await body.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(body).toContainText('Couldn’t restore your account');
  expect(await page.evaluate(()=>KanaCloudSync.isAuthResolved())).toBe(false);
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
});

test('an explicit retry reloads failed SDK imports and restores the account state',async({page})=>{
  await prepare(page);let online=false,authRequests=0;
  await page.route('**/firebasejs/**',route=>{
    const headers={'access-control-allow-origin':'*'};
    const name=new URL(route.request().url()).pathname.split('/').pop();
    if(name==='firebase-app.js')return route.fulfill({headers,contentType:'text/javascript',body:'export const initializeApp=()=>({}),getApps=()=>[],getApp=()=>({});'});
    if(name==='firebase-auth.js'){
      authRequests++;if(!online)return route.abort();
      return route.fulfill({headers,contentType:'text/javascript',body:'export const getAuth=()=>({}),getRedirectResult=async()=>null,onAuthStateChanged=(_auth,callback)=>{callback(null);return ()=>{};};export class GoogleAuthProvider{setCustomParameters(){}}'});
    }
    return route.abort();
  });
  await page.goto('/friends/');await expect(page.locator('.ma-social-body')).toContainText('Couldn’t restore your account');
  online=true;await page.evaluate(()=>KanaCloudSync.syncNow());
  expect(authRequests).toBe(1,'the failed import is cached until the document reloads');
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.locator('.ma-social-body')).toContainText('Learn alongside friends');
  expect(authRequests).toBe(2);expect(await page.evaluate(()=>KanaCloudSync.isAuthResolved())).toBe(true);
});

test('browser tabs and installed-app manifests share fingerprinted current brand assets',async({page})=>{
  await prepare(page);const icons=[];
  for(const route of ['/','/learn/','/friends/','/progress/','/kanji/','/wordbank/']){
    await page.goto(route);const icon=page.locator('link[rel="icon"][type="image/svg+xml"]');await expect(icon).toHaveCount(1);
    icons.push(await icon.evaluate(node=>node.href));
  }
  expect(new Set(icons).size).toBe(1);expect(icons[0]).toMatch(/mode-atlas-tab\.[a-f0-9]{12}\.svg$/);
  const manifest=await (await page.request.get('/site.webmanifest')).json();expect(manifest.id).toBe('/');
  for(const icon of manifest.icons){expect(icon.src).toMatch(/\.[a-f0-9]{12}\.png$/);expect((await page.request.get(icon.src)).ok()).toBe(true);}
});
