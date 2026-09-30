const {test,expect}=require('@playwright/test');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const routes=['/','/kana/','/reading/','/writing/','/results/','/wordbank/'];
const baseline=process.env.MODE_ATLAS_WEB_THEME_BASE || fs.readFileSync(path.join(__dirname,'fixtures/web-theme-baseline.txt'),'utf8').trim();

async function prepare(page,theme,native=true){
  await page.setViewportSize({width:393,height:852});
  await page.route(/https:\/\/([\w-]+\.)?(gstatic|googleapis)\.com\/.*/,route=>route.abort());
  await page.addInitScript(({theme,native})=>{
    if(!localStorage.getItem('modeAtlasThemePreference'))localStorage.setItem('modeAtlasThemePreference',theme);
    localStorage.setItem('modeAtlasSound','off');
    localStorage.setItem('maWhatsNewSeen','theme-tests');
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('settings',JSON.stringify({hiraganaRows:['h_a'],katakanaRows:[],hint:true,activeBottomTab:null}));
    localStorage.setItem('reverseSettings',JSON.stringify({hiraganaRows:['h_a'],katakanaRows:[],hint:false,keyboardMode:false,choiceCount:4,activeBottomTab:null}));
    localStorage.setItem('testModeResults',JSON.stringify([{
      id:'theme-test-reading',type:'test',title:'Reading Test',mode:'reading',date:'2026-09-29',startedAt:'10:00',
      correct:4,wrong:1,total:5,durationMs:9000,avgMs:1800,overallScore:80,
      breakdown:{hiragana:{correct:4,wrong:1},katakana:{correct:0,wrong:0}},
      kana:{'あ':{correct:1,wrong:0,avgMs:1000},'い':{correct:1,wrong:0,avgMs:1400},'う':{correct:0,wrong:1,avgMs:3000},'え':{correct:1,wrong:0,avgMs:1600},'お':{correct:1,wrong:0,avgMs:2000}}
    }]));
    if(native){
      window.appearanceCalls=[];
      window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{
        setAppearance:async({preference})=>{window.appearanceCalls.push(preference);return {applied:true};},
        getEngagementState:async()=>({supported:true,reminder:{enabled:false,granted:false,status:'notDetermined',hour:19,minute:0},widgets:{available:true,progressSupported:false}}),
        publishWidgetSnapshot:async()=>({stored:false})
      }}};
    }
  },{theme,native});
}
async function settle(page){
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(async()=>{
    await document.fonts.ready;
    const style=document.createElement('style');
    style.textContent='*,*::before,*::after{animation:none!important;transition:none!important;}';
    document.head.append(style);
  });
}

async function expectSessionActions(page,theme){
  // Starting practice replaces the button under the mouse with Pause. Check
  // the resting and hover states separately, without retaining that hover.
  await page.mouse.move(0,0);
  for(const id of ['pauseSessionBtn','endSessionBtn']){
    const button=page.locator(`#${id}`);
    await expect(button).toHaveCSS('background-color',theme==='light'?'rgb(237, 237, 240)':'rgb(48, 48, 51)');
    await button.hover();
    await expect(button).toHaveCSS('background-color',theme==='light'?'rgb(225, 225, 230)':'rgb(58, 58, 63)');
    await page.mouse.move(0,0);
  }
}

for(const theme of ['dark','light'])test(`native ${theme}: six screens, drawers, feedback and keyboard`,async({page},testInfo)=>{
  test.setTimeout(120000);
  await prepare(page,theme);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const canvas=theme==='light'?'rgb(245, 245, 247)':'rgb(16, 16, 17)';
  for(const route of routes){
    await page.goto(route,{waitUntil:'domcontentloaded'});await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-ma-runtime','ios');
    await expect(page.locator('body')).toHaveCSS('background-color',canvas);
    await expect(page.locator('body')).toHaveCSS('background-image','none');
    if(route==='/')expect(await page.locator('body').evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toBe('none');
    const noNativeLeak=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ma-native-page').trim());
    expect(noNativeLeak).toBe(theme==='light'?'#f5f5f7':'#101011');
    await page.screenshot({path:testInfo.outputPath(`${route.split('/')[1]||'atlas'}-${theme}.png`),fullPage:true});
    if(route==='/'){
      await page.evaluate(()=>window.ModeAtlasSettings.open());
      await expect(page.locator('#maAccount-settings')).toHaveAttribute('aria-hidden','false');
      const reminder=page.locator('#maReminderEnabled');
      await expect(reminder).toBeEnabled();
      await expect(reminder).not.toBeChecked();
      await expect(reminder).toHaveCSS('background-color',theme==='light'?'rgb(237, 237, 240)':'rgb(48, 48, 51)');
      // Exercise both visual states without requesting real notification permission.
      await reminder.evaluate(el=>{el.checked=true;});
      await expect(reminder).toHaveCSS('background-color',theme==='light'?'rgb(36, 95, 206)':'rgb(155, 192, 255)');
      await reminder.evaluate(el=>{el.checked=false;});
      await expect(page.locator(`#maAccount-settings [data-ma-theme-choice="${theme}"]`)).toHaveCSS('background-color',theme==='light'?'rgb(225, 235, 255)':'rgb(38, 59, 91)');
      await page.locator(`#maAccount-settings [data-ma-theme-choice="${theme}"]`).hover();
      await expect(page.locator(`#maAccount-settings [data-ma-theme-choice="${theme}"]`)).toHaveCSS('background-color',theme==='light'?'rgb(225, 235, 255)':'rgb(38, 59, 91)');
      await page.screenshot({path:testInfo.outputPath(`settings-${theme}.png`)});
      await page.evaluate(()=>{window.ModeAtlasSettings.close();window.ModeAtlasProfile.open();});
      await page.screenshot({path:testInfo.outputPath(`profile-${theme}.png`)});
    }
    if(route==='/reading/'){
      await page.locator('#modifiersTab').click();
      await page.screenshot({path:testInfo.outputPath(`setup-${theme}.png`)});
      await page.locator('#practiceSetupDone').click();
      await page.locator('#startBtn').click();
      await expectSessionActions(page,theme);
      const key=page.locator('.ma-ios-reading-keyboard__key').first();
      await expect(key).toBeVisible();
      await page.evaluate(()=>window.ModeAtlasToast('Practice ready','info',800));
      await expect.poll(()=>page.evaluate(()=>document.querySelector('.ma-toast-wrap').getBoundingClientRect().bottom<=document.querySelector('.ma-ios-reading-keyboard').getBoundingClientRect().top-12)).toBe(true);
      await expect(page.locator('.ma-toast')).toHaveCount(0);
      await page.screenshot({path:testInfo.outputPath(`keyboard-${theme}.png`)});
      await key.hover();await page.mouse.down();
      await expect(key).toHaveCSS('transform','matrix(0.97, 0, 0, 0.97, 0, 3)');
      await page.mouse.up();
    }
    if(route==='/writing/'){
      await page.locator('#startBtn').click();
      await expectSessionActions(page,theme);
      const choices=page.locator('.choice-btn');await expect(choices.first()).toBeVisible();
      // Explicit visual states, without relying on a randomly selected question.
      await choices.first().evaluate(el=>el.classList.add('correct'));
      await choices.nth(1).evaluate(el=>el.classList.add('wrong'));
      await expect(choices.first()).toHaveCSS('background-color',theme==='light'?'rgb(224, 242, 232)':'rgb(24, 62, 44)');
      await expect(choices.nth(1)).toHaveCSS('background-color',theme==='light'?'rgb(252, 228, 232)':'rgb(74, 36, 45)');
      await page.screenshot({path:testInfo.outputPath(`writing-feedback-${theme}.png`)});
    }
  }
  expect(errors).toEqual([]);
});

test('System theme follows the device; manual choice persists; canvas charts redraw',async({page})=>{
  await prepare(page,'system');await page.emulateMedia({colorScheme:'dark'});
  await page.goto('/results/');await settle(page);
  await expect(page.locator('html')).toHaveAttribute('data-ma-theme','dark');
  await expect(page.locator('canvas').first()).toBeAttached();
  const chart=()=>page.locator('canvas').first().evaluate(el=>el.toDataURL());
  const darkChart=await chart();
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-ma-theme','light');
  await expect.poll(chart).not.toBe(darkChart);
  expect(await page.evaluate(()=>window.appearanceCalls.at(-1))).toBe('system');
  await page.evaluate(()=>window.ModeAtlasTheme.set('dark',{toast:false}));
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-ma-theme','dark');
  await page.reload();await settle(page);
  await expect(page.locator('html')).toHaveAttribute('data-ma-theme','dark');
  expect(await page.evaluate(()=>window.appearanceCalls.at(-1))).toBe('dark');
});

async function paintSnapshot(page){
  return page.evaluate(()=>{
    const properties=['color','backgroundColor','backgroundImage','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','boxShadow','textShadow','outlineColor','fill','stroke','webkitTextFillColor'];
    // New shared study/reward components have no 2.67.0 paint baseline.
    // Their theme/layout checks live in study-flow and progression.
    const newStudyComponent = el => el.closest('#studySetSetup,#studySessionProgress,#studyFeedback,#answerFeedback,.ma-profile-title,.ma-profile-atlas-link,.ma-practice-recovery,.ma-atlas-rewards,.ma-session-rewards');
    return [...document.body.querySelectorAll('*'),document.body].filter(el=>!newStudyComponent(el) && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden')
      .map(el=>[el.tagName,el.id,el.className?.baseVal ?? el.className,...['','::before','::after'].map(pseudo=>{
        const style=getComputedStyle(el,pseudo||null);return properties.map(name=>style[name]);
      })]);
  });
}
for(const theme of ['dark','light'])test(`website ${theme}: computed paint matches the pre-iOS-theme baseline`,async({page})=>{
  test.setTimeout(120000);
  await prepare(page,theme,false);
  const baselineFiles=new Set(execFileSync('git',['ls-tree','-r','--name-only',baseline],{encoding:'utf8'}).trim().split('\n'));
  for(const route of routes){
    await page.goto(route,{waitUntil:'domcontentloaded'});await settle(page);
    expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ma-native-page'))).toBe('');
    const current=await paintSnapshot(page);
    const links=await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.filter(link=>new URL(link.href).origin===location.origin).map(link=>({href:link.href,path:new URL(link.href).pathname.slice(1).replace(/\.assets-\d+\.\d+\.\d+(?=\.css$)/,'')})));
    for(const link of links){
      // The historical tree owns which sheets existed. New component sheets
      // are absent from that baseline and must not change existing web paint.
      link.css=baselineFiles.has(link.path)?execFileSync('git',['show',`${baseline}:${link.path}`],{encoding:'utf8'}):'';
    }
    await page.evaluate(links=>{
      for(const entry of links){
        const link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(link=>link.href===entry.href);
        const style=document.createElement('style');style.textContent=entry.css;link.replaceWith(style);
      }
    },links);
    expect(await paintSnapshot(page),`${route} ${theme} changed website paint`).toEqual(current);
  }
});
