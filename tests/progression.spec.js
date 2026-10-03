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
  await expect(page.locator('#maAccountTitle')).toHaveText('Your Atlas');
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
  await page.getByRole('button',{name:'Your Atlas',exact:true}).click();
  await expect(page.locator('#maAccountTitle')).toHaveText('Your Atlas');
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
  await expect(page.locator('.ma-dialog__title')).toHaveText(kind==='dailyChallenge'?'Daily Challenge complete':'Test Mode complete');
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
  await expect(page.locator('#iosHomeGoals [data-goal]')).toHaveCount(3);
  await page.locator('#profileOpenBtn').click();
  await expect(page.locator('#maAccount-profile')).toBeVisible();
  const order=await page.evaluate(()=>document.querySelector('.ma-progression-card').getBoundingClientRect().bottom<document.querySelector('.ma-sync-card').getBoundingClientRect().top);
  expect(order).toBe(true);
  await page.screenshot({animations:'disabled',path:info.outputPath(`profile-${theme}.png`)});
  await page.getByRole('tab',{name:'Your Atlas',exact:true}).click();await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await page.locator('[data-reward-category="frames"] > summary').click();
  await page.locator('[data-landmark="grove"]').click();
  await expect(page.locator('#topProfileDot')).toHaveAttribute('data-ma-frame','grove');
  const frame=await page.locator('#topProfileDot').evaluate(node=>getComputedStyle(node).boxShadow);expect(frame).toContain(theme==='dark'?'232, 155, 128':'143, 62, 37');
  await page.screenshot({animations:'disabled',path:info.outputPath(`rewards-${theme}.png`)});
  await page.getByRole('tab',{name:'Rewards',exact:true}).focus();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('tab',{name:'Goals',exact:true})).toBeFocused();
  await page.locator('#maAccountClose').click();await page.locator('.atlas-ios-home [data-ma-rewards-open]').click();await expect(page.getByRole('tabpanel',{name:'Goals',exact:true})).toBeVisible();
  await page.locator('#maAccountClose').click();await page.locator('.ma-ios-tabs__links a[href="/kana/"]').click();await page.waitForURL('**/kana/');
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
  await page.getByRole('tab',{name:'Profile',exact:true}).click();
  await expect(page.locator('.ma-account-card[data-ma-selected-banner]')).toHaveAttribute('data-ma-banner','grove');
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
  await page.getByRole('tab',{name:'Profile',exact:true}).click();
  await expect(page.locator('.ma-account-card[data-ma-selected-banner]')).toHaveAttribute('data-ma-banner','hunny');
  await page.screenshot({path:info.outputPath('exclusive-profile.png'),animations:'disabled'});
  await page.getByRole('tab',{name:'Your Atlas',exact:true}).click();await page.getByRole('tab',{name:'Rewards',exact:true}).click();
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

test('mastery separates Reading, Writing and Both and returns to the selected map',async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page);await open(page,'/');
  await page.evaluate(()=>{
    ModeAtlasStorage.writeModeJSON('reading','charStats',{'い':{correct:38,wrong:3},'う':{correct:50,wrong:1}});
    ModeAtlasStorage.writeModeJSON('reading','charTimes',{'い':2160,'う':1540});
    ModeAtlasStorage.writeModeJSON('writing','charStats',{'い':{correct:3,wrong:0},'う':{correct:2,wrong:0}});
    ModeAtlasFeatures.openMasteryMap();
  });
  const cell=page.locator('[data-ma-mastery-kana="い"]');await expect(cell).toContainText('Reviewing');
  await page.getByRole('button',{name:'Writing',exact:true}).click();await expect(cell).toContainText('Learning');
  await page.getByRole('button',{name:'Both',exact:true}).click();await expect(cell).toContainText('Learning');
  await cell.click();await expect(page.locator('.ma-mastery-directions')).toContainText('Reading: Reviewing · Writing: Learning');
  await expect(page.locator('.ma-mastery-checks')).toHaveCount(2);
  const link=page.getByRole('link',{name:'Practise Writing',exact:true});await expect(link).toHaveAttribute('href',/\/writing\/\?practice=10&kana=/);
  await page.setViewportSize({width:320,height:852});await page.evaluate(()=>{document.documentElement.style.fontSize='24px';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:info.outputPath('mastery-directions.png'),animations:'disabled'});
  await page.getByRole('button',{name:'Close Mastery Map or return to the map',exact:true}).click();
  await expect(page.getByRole('button',{name:'Both',exact:true})).toHaveAttribute('aria-pressed','true');await expect(cell).toBeFocused();
  expect(errors).toEqual([]);
});

test('goal shortcuts and weekly recap expose recorded activity without inventing historical totals',async({page})=>{
  await prepare(page);await open(page,'/');await page.evaluate(()=>ModeAtlasRewardsUI.open());
  await expect(page.locator('.ma-routine-goal[href]').first()).toHaveAttribute('href',/\/(reading|writing)\/\?/);
  await page.getByRole('tab',{name:'Recap',exact:true}).click();
  await expect(page.locator('.ma-recap-grid')).toContainText('Reading correct');await expect(page.locator('.ma-recap-grid')).toContainText('0 / 7');
  await page.getByRole('button',{name:'Last week',exact:true}).click();await expect(page.locator('.ma-atlas-recap')).toContainText('No dated practice');
  await expect(page.getByRole('link',{name:'View weekly ranking',exact:true})).toHaveAttribute('href','/?section=friends&ranking=weekly');
  await page.getByRole('tab',{name:'Recap',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Goals',exact:true})).toHaveAttribute('aria-selected','true');
});
