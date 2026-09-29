const {test,expect}=require('@playwright/test');

async function prepare(page){
  await page.setViewportSize({width:393,height:852});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{
    window.nativeEvents={};
    window.sharedBackups=[];
    window.widgetSnapshots=[];
    window.textScale=1;
    window.nextExport={supported:true,completed:false};
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{
      App:{addListener:(name,callback)=>{window.nativeEvents[name]=callback;}},
      ModeAtlasNative:{
        addListener:(name,callback)=>{window.nativeEvents[name]=callback;},
        consumeDestination:async()=>{const destination=window.pendingDestination||'';window.pendingDestination='';return {destination};},
        getAccessibilityPreferences:async()=>({textScale:window.textScale}),
        exportBackup:async file=>{window.sharedBackups.push(file);return window.nextExport;},
        publishWidgetSnapshot:async({snapshot})=>{window.widgetSnapshots.push(JSON.parse(snapshot));return {stored:true};}
      }
    }};
    localStorage.setItem('modeAtlasSound','off');
    localStorage.setItem('modeAtlasThemePreference','dark');
    localStorage.setItem('maWhatsNewSeen','native-experience');
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
  });
  const device=await page.context().newCDPSession(page);
  await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});
}
async function open(page,path){
  await page.goto(path);
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(()=>document.fonts.ready);
}

for(const mode of ['reading','writing']){
  test(mode+': inactive Speed Run stays paused, preserves time and resumes once',async({page})=>{
    await prepare(page);await open(page,'/'+mode+'/');
    await page.clock.install();
    await page.evaluate(()=>{
      Object.assign(settings,{speedRun:true,timeTrial:false,endless:false,dailyChallenge:false,testMode:false});
      onSettingsChanged();
    });
    await page.locator('#startBtn').click();
    await page.clock.runFor(1500);
    const before=await page.evaluate(()=>({char:currentChar,elapsed:Date.now()-charStartTime,remaining:trialEndTime-Date.now()}));
    await page.evaluate(()=>{window.nativeEvents.appStateChange({isActive:false});window.nativeEvents.appStateChange({isActive:false});});
    await expect(page.locator('#pauseSessionBtn')).toContainText('Resume');
    await page.clock.fastForward(90000);
    await page.evaluate(()=>window.nativeEvents.appStateChange({isActive:true}));
    expect(await page.evaluate(()=>({active:sessionStarted,char:currentChar,paused:window.ModeAtlasSessionControls.paused,disabled:inputEl.disabled})))
      .toEqual({active:true,char:before.char,paused:true,disabled:true});
    await page.locator('#pauseSessionBtn').click();
    const after=await page.evaluate(()=>({elapsed:Date.now()-charStartTime,remaining:trialEndTime-Date.now(),timer:trialTimerId,paused:window.ModeAtlasSessionControls.paused}));
    expect(after.paused).toBe(false);expect(after.timer).toBeTruthy();
    expect(Math.abs(after.remaining-before.remaining)).toBeLessThan(1500);
    expect(Math.abs(after.elapsed-before.elapsed)).toBeLessThan(1500);
    await page.clock.runFor(1000);
    expect(await page.evaluate(()=>trialEndTime-Date.now())).toBeLessThan(after.remaining-800);
  });

  test(mode+': interruption during feedback keeps the scored answer and advances only after Resume',async({page})=>{
    await prepare(page);await open(page,'/'+mode+'/');
    await page.clock.install();
    await page.evaluate(()=>{Object.assign(settings,{endless:true,timeTrial:false,speedRun:false,dailyChallenge:false,testMode:false});onSettingsChanged();});
    await page.locator('#startBtn').click();
    const before=await page.evaluate(()=>{
      handleCorrect();
      window.nativeEvents.appStateChange({isActive:false});
      return {char:currentChar,correct:sessionStats.correct};
    });
    await page.clock.fastForward(30000);
    expect(await page.evaluate(()=>({char:currentChar,correct:sessionStats.correct,locked,disabled:inputEl.disabled})))
      .toEqual({...before,locked:true,disabled:true});
    await page.locator('#pauseSessionBtn').click();
    await page.clock.runFor(500);
    expect(await page.evaluate(()=>({correct:sessionStats.correct,locked,paused:window.ModeAtlasSessionControls.paused})))
      .toEqual({correct:before.correct,locked:false,paused:false});
    await page.locator('#endSessionBtn').click();
    await page.clock.runFor(1000);
    expect(await page.evaluate(()=>sessionStarted)).toBe(false);
  });
}

test('native export only records completion after the Share Sheet succeeds',async({page})=>{
  await prepare(page);await open(page,'/');
  await page.evaluate(()=>window.ModeAtlasSettings.open());
  await page.locator('[data-ma-unified-export]').click();
  await expect.poll(()=>page.evaluate(()=>window.sharedBackups.length)).toBe(1);
  expect(await page.evaluate(()=>localStorage.getItem('modeAtlasLastExportAt'))).toBeNull();
  await page.evaluate(()=>{window.nextExport={supported:true,completed:true};});
  await page.locator('[data-ma-unified-export]').click();
  await expect.poll(()=>page.evaluate(()=>Number(localStorage.getItem('modeAtlasLastExportAt')))).toBeGreaterThan(0);
  const file=await page.evaluate(()=>window.sharedBackups[1]);
  expect(file.filename).toMatch(/^mode-atlas-save-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(file.contents).app).toBe('Mode Atlas');
});

test('native fonts load locally with all external requests blocked',async({page})=>{
  await prepare(page);
  const remoteFonts=[];
  page.on('request',request=>{if(/fonts\.(googleapis|gstatic)\.com/.test(request.url()))remoteFonts.push(request.url());});
  await open(page,'/reading/');
  const fonts=await page.evaluate(async()=>{
    await Promise.all([document.fonts.load('700 20px Inter'),document.fonts.load('800 20px Sora'),document.fonts.load('700 40px "Noto Sans JP"','あア語')]);
    return [...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family.replaceAll('"',''));
  });
  expect(fonts).toEqual(expect.arrayContaining(['Inter','Sora','Noto Sans JP']));
  expect(remoteFonts).toEqual([]);
});

test('widget words and activity reflect a successful save and survive page reloads',async({page})=>{
  await prepare(page);await open(page,'/wordbank/');
  const initial=await page.evaluate(()=>window.ModeAtlasNativeEngagement.snapshot());
  expect(initial.lastActivityAt).toBe(0);
  await page.locator('#wordBankAddJumpBtn').click();
  await page.locator('#kanaInput').fill('ねこ');
  await page.locator('#addWordBtn').click();
  await expect.poll(()=>page.evaluate(()=>window.ModeAtlasNativeEngagement.snapshot().words)).toBe(initial.words+1);
  const after=await page.evaluate(()=>window.ModeAtlasNativeEngagement.snapshot());
  expect(after.lastActivityAt).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>window.widgetSnapshots.at(-1)?.words)).toBe(initial.words+1);
  await open(page,'/');
  expect((await page.evaluate(()=>window.ModeAtlasNativeEngagement.snapshot())).lastActivityAt).toBe(after.lastActivityAt);
  await page.evaluate(()=>window.nativeEvents.appStateChange({isActive:false}));
  expect(await page.evaluate(()=>window.widgetSnapshots.at(-1).lastActivityAt)).toBe(after.lastActivityAt);
});

test('system text changes reflow Atlas, settings and practice without horizontal clipping',async({page},testInfo)=>{
  test.setTimeout(90000);
  await prepare(page);
  for(const path of ['/','/reading/','/writing/']){
    await open(page,path);
    await page.evaluate(()=>window.nativeEvents.accessibilityChanged({textScale:2}));
    await expect(page.locator('html')).toHaveCSS('font-size','32px');
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    await page.screenshot({path:testInfo.outputPath('large-text-'+(path.split('/')[1]||'atlas')+'.png')});
    await page.locator('.ma-nav__settings').click();
    await expect(page.locator('#settingsDrawer')).toBeVisible();
    await expect(page.locator('#settingsDrawer')).toHaveAttribute('aria-hidden','false');
    expect(await page.locator('#settingsDrawer').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await page.evaluate(()=>window.ModeAtlasSettings.close());
  }
});
