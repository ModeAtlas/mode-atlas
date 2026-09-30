const {test,expect}=require('@playwright/test');
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
async function correct(page,mode){
  await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);
  await page.evaluate(mode=>mode==='reading'?handleCorrect(getAnswerForCurrentChar()):handleChoiceAnswer(currentChar,document.querySelector('.choice-btn')),mode);
}
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
  await expect(page.locator('.ma-dialog__title')).toHaveText('Your Atlas');
  await expect(page.locator('.ma-routine-goal')).toHaveCount(4);
  const grove=page.locator('[data-landmark="grove"]');
  await grove.getByRole('button',{name:'Use title & frame',exact:true}).click();
  await expect(grove.getByRole('button',{name:'Selected',exact:true})).toHaveAttribute('aria-pressed','true');
  await grove.getByRole('button',{name:'Use app icon',exact:true}).click();
  expect(await page.evaluate(()=>iconCalls)).toEqual([{name:'Grove'}]);
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  await grove.scrollIntoViewIfNeeded();
  const fits=await page.evaluate(()=>[document.documentElement,...document.querySelectorAll('.ma-atlas-landmark,.ma-routine-goal')].every(node=>node.scrollWidth<=node.clientWidth+1));expect(fits).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`ios-${theme}-collection.png`)});
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
  await page.getByRole('button',{name:'Your Atlas',exact:true}).click();
  await expect(page.locator('.ma-dialog__title')).toHaveText('Your Atlas');
  expect(await page.locator('.ma-dialog-layer').count()).toBe(1);
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
