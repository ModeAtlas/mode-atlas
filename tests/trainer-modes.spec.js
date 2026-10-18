const {test,expect}=require('@playwright/test');
// Every case owns its browser context; let CI split the long mode matrix across shards.
test.describe.configure({mode:'parallel'});
test.beforeEach(async({page})=>require('./helpers/kana-fixture')(page));
async function setup(page,mode,{native=false,theme='dark'}={}){
  await page.setViewportSize({width:native?393:1280,height:native?852:900});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','trainer-modes');localStorage.setItem('modeAtlasSound','off');localStorage.setItem('modeAtlasThemePreference',theme);
    for(const key of ['settings','reverseSettings'])localStorage.setItem(key,JSON.stringify({hiraganaRows:['h_a'],katakanaRows:[],hint:false,srs:false,keyboardMode:false}));
  },{native,theme});
  if(native){const device=await page.context().newCDPSession(page);await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});}
  await page.goto(`/${mode}/`);await expect(page.locator('#maLoadingScreen')).toBeHidden();await page.evaluate(()=>document.fonts.ready);
}
async function chooseMode(page,mode){
  const family=['guided','free','endless'].includes(mode)?'practice':['speedRun','timeTrial'].includes(mode)?'timed':mode==='dailyChallenge'?'daily':'test';
  await page.getByLabel('Session',{exact:true}).selectOption(family);
  if(family==='practice'){await page.getByLabel('Session length',{exact:true}).selectOption(mode==='guided'?'10':'0');await page.getByLabel('Feedback',{exact:true}).selectOption(mode==='endless'?'quick':'learn');}
  if(family==='timed')await page.getByLabel('Timed goal',{exact:true}).selectOption(mode==='speedRun'?'score':'target');
}
async function select(page,mode){
  await page.locator('#modifiersTab').click();
  await expect(page.getByRole('dialog',{name:'Practice setup',exact:true})).toBeVisible();
  await chooseMode(page,mode);
  await page.locator('#practiceSetupDone').click();
}
async function finishAnswers(page,count){
  for(let i=0;i<count;i++){await page.evaluate(()=>handleCorrect('test answer'));await page.clock.runFor(300);}
}
for(const mode of ['reading','writing']){
  test(`${mode}: setup selects one flow, restores focus, and locks configuration during a run`,async({page},info)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await setup(page,mode,{native:true});
    await page.locator('#modifiersTab').click();
    await expect(page.locator('#practiceSetupDone')).toBeFocused();
    await expect(page.getByLabel('Session',{exact:true}).locator('option')).toHaveCount(5);
    await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:info.outputPath(`${mode}-setup.png`),animations:'disabled'});
    await page.keyboard.press('Escape');await expect(page.locator('#modifiersTab')).toBeFocused();
    for(const selected of ['guided','endless','timeTrial','speedRun','dailyChallenge','testMode','free']){
      await select(page,selected);
      expect(await page.evaluate(()=>ModeAtlasPracticeModes.selected(settings))).toBe(selected);
      expect(await page.evaluate(()=>['endless','timeTrial','speedRun','dailyChallenge','testMode'].filter(key=>settings[key]).length)).toBeLessThanOrEqual(1);
    }
    await page.locator('#startBtn').click();
    await page.evaluate(()=>ModeAtlasTrainerControls.selectMode('speedRun'));
    expect(await page.evaluate(()=>ModeAtlasPracticeModes.selected(settings))).toBe('free');
    await page.locator('#skipKanaBtn').click();
    await expect(page.locator('#studyFeedbackTitle')).toHaveText('− Skipped');
    await page.locator('#studyFeedbackContinue').click();
    expect(await page.evaluate(()=>sessionStats.answered)).toBe(1);expect(errors).toEqual([]);
  });
  test(`${mode}: stopping Daily or Test early never stores a completed result`,async({page})=>{
    await setup(page,mode);
    for(const selected of ['dailyChallenge','testMode']){
      await select(page,selected);await page.locator('#startBtn').click();await page.clock.install();
      await page.locator('#skipKanaBtn').click();await page.clock.runFor(500);
      await page.locator('#endSessionBtn').click();
      await expect(page.locator('.ma-dialog__title')).toHaveText('Practice saved');
      expect(await page.evaluate(()=>Object.keys(dailyChallengeHistory).length)).toBe(0);
      expect(await page.evaluate(()=>loadStoredTestModeResults().length)).toBe(0);
      expect(await page.evaluate(()=>sessionStats.wrong)).toBe(1);
      await page.getByRole('button',{name:'Done',exact:true}).click();
    }
  });
  test(`${mode}: Daily completion records once, replay preserves official score, review includes unselected kana`,async({page})=>{
    test.setTimeout(60000);await setup(page,mode);await page.evaluate(()=>{settings.katakanaRows=['k_sa'];onSettingsChanged();});await select(page,'dailyChallenge');await page.locator('#startBtn').click();await page.clock.install();
    await page.evaluate(()=>{dailySequence[0]='ツ';nextCharacter();});
    await page.locator('#skipKanaBtn').click();await page.clock.runFor(500);await finishAnswers(page,19);
    await expect(page.locator('.ma-dialog__title')).toHaveText('Daily session complete');
    expect(await page.evaluate(()=>getTodayDailyRecord().officialScore)).toBe(19);
    await page.getByRole('button',{name:'Practise these kana',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>currentChar)).toBe('ツ');
    expect(await page.evaluate(()=>getAnswerMapForCurrentMode()[currentChar])).toBe('tsu');
    await page.locator('#endSessionBtn').click();await page.getByRole('button',{name:'Done',exact:true}).click();
    await select(page,'dailyChallenge');await page.locator('#startBtn').click();await finishAnswers(page,20);
    expect(await page.evaluate(()=>getTodayDailyRecord().officialScore)).toBe(19);
    expect(await page.evaluate(()=>getTodayDailyRecord().attempts)).toBe(2);
    await expect(page.locator('.ma-study-summary')).toContainText('This replay keeps your first completed score.');
  });
  test(`${mode}: full Test saves accurate results and real button count`,async({page})=>{
    test.setTimeout(60000);await setup(page,mode);await select(page,'testMode');await page.locator('#startBtn').click();await page.clock.install();
    const count=await page.evaluate(()=>testSequence.length);await finishAnswers(page,count);
    await expect(page.locator('.ma-dialog__title')).toHaveText('Test complete');
    const results=await page.evaluate(()=>loadStoredTestModeResults());expect(results).toHaveLength(1);
    expect(results[0].correct).toBe(count);expect(results[0].wrong).toBe(0);
    if(mode==='writing')expect(results[0].buttonLayout).toBe(6);
    await expect(page.getByRole('link',{name:'View Results',exact:true})).toBeVisible();
  });
  test(`${mode}: timer pause preserves remaining time, partial runs do not rank, completed runs do`,async({page})=>{
    test.setTimeout(60000);await setup(page,mode);await select(page,'timeTrial');
    await page.locator('#trialTime').fill('0.1');await page.locator('#trialTarget').fill('1');await page.clock.install();
    await page.locator('#startBtn').click();await finishAnswers(page,1);
    await page.locator('#pauseSessionBtn').click();const remaining=await page.locator('#trialTimer').textContent();
    await page.clock.runFor(8000);expect(await page.evaluate(()=>sessionStarted)).toBe(true);await expect(page.locator('#trialTimer')).toHaveText(remaining);
    await page.locator('#pauseSessionBtn').click();await page.clock.runFor(6100);
    await expect(page.locator('.ma-dialog__title')).toHaveText('Target challenge complete');
    await expect(page.locator('.ma-study-summary')).toContainText('Target reached');
    expect(await page.evaluate(()=>scoreHistory.timeTrialTop3)).toHaveLength(1);
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await select(page,'speedRun');await page.locator('#startBtn').click();await finishAnswers(page,1);await page.locator('#endSessionBtn').click();
    expect(await page.evaluate(()=>scoreHistory.speedRunTop3)).toHaveLength(0);await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.locator('#startBtn').click();await finishAnswers(page,1);await page.clock.runFor(60100);
    await expect(page.locator('.ma-dialog__title')).toHaveText('60-second challenge complete');expect(await page.evaluate(()=>scoreHistory.speedRunTop3)).toHaveLength(1);
    expect(await page.evaluate(()=>locked)).toBe(false);
  });
  test(`${mode}: joined kana stay whole in answers, progress and reviews`,async({page})=>{
    await setup(page,mode);await page.evaluate(()=>{settings.yoon=true;settings.hiraganaRows=['h_ka'];onSettingsChanged();ModeAtlasTrainerControls.setPracticeCount(10);});
    await page.locator('#startBtn').click();await page.evaluate(()=>{currentChar='きゃ';if(typeof currentChoices!=='undefined'){currentChoices=buildChoiceOptionStrings(currentChar);currentPrompt=getPromptForCurrentChar(currentChar);showCurrentPrompt();renderChoiceGrid();}else{hiraganaEl.textContent=currentChar;}});
    const answer=await page.evaluate(()=>typeof getRomajiForChars==='function'?getRomajiForChars(currentChar):getAnswerForCurrentChar());expect(answer).toBe('kya');
    if(mode==='reading')await page.locator('#input').fill('kya');else await page.getByRole('button',{name:'きゃ',exact:true}).click();
    expect(await page.evaluate(()=>stats['きゃ'])).toEqual({correct:1,wrong:0});
    expect(await page.evaluate(()=>stats['ゃ'])).toBeUndefined();
  });
}
test('Writing single-item Combo cannot hang while trying to manufacture eight unique choices',async({page})=>{
  await setup(page,'writing');
  const choices=await page.evaluate(()=>{settings.comboKana=true;settings.choiceCount=8;charMap={'あ':'a'};activeChars=['あ'];currentChar='ああ';return buildChoiceOptionStrings(currentChar);});
  expect(choices).toEqual(['ああ']);
});

for(const native of [false,true])for(const mode of ['reading','writing'])for(const preset of ['starter','intermediate','advanced','pro'])test(`review matrix ${native?'iOS':'web'} ${mode}: ${preset} across all seven sessions`,async({page})=>{
  test.setTimeout(90000);await setup(page,mode,{native});await page.clock.install();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const sessions=['guided','free','endless','speedRun','timeTrial','dailyChallenge','testMode'];
  for(const [index,selected]of sessions.entries()){
    const variant=(index+['starter','intermediate','advanced','pro'].indexOf(preset))%5;
    const pool=await page.evaluate(({preset,selected,variant,mode})=>{
      ModeAtlasTrainerControls.applyPreset(preset);ModeAtlasTrainerControls.selectMode(selected);
      if(mode==='writing')Object.assign(settings,{keyboardMode:variant>=3,keyboardInputType:variant===3?'kana':'romaji',choiceCount:[4,6,8][variant%3]});
      onSettingsChanged();return {active:activeChars.length,hint:settings.hint,selected:ModeAtlasPracticeModes.selected(settings)};
    },{preset,selected,variant,mode});
    expect(pool.selected).toBe(selected);expect(pool.active).toBe({starter:5,intermediate:46,advanced:142,pro:240}[preset]);
    if(['dailyChallenge','testMode'].includes(selected))expect(pool.hint).toBe(false);
    if(await page.locator('#practiceSetupDialog').isVisible())await page.locator('#practiceSetupDone').click();
    await page.locator('#startBtn').click();expect(await page.evaluate(()=>sessionStarted)).toBe(true);
    const answer=await page.evaluate(()=>typeof getAnswerForCurrentChar==='function'?getAnswerForCurrentChar():currentChar);
    if(mode==='reading'&&native){for(const key of answer)await page.locator(`.ma-ios-reading-keyboard [data-key="${key}"]`).click();}
    else if(mode==='reading')await page.locator('#input').fill(answer);
    else if(variant>=3){await page.locator('#input').fill(answer);if(variant===4)await page.locator('#input').press('Enter');}
    else await page.locator('#choiceGrid').getByRole('button',{name:answer,exact:true}).click();
    expect(await page.evaluate(()=>({correct:sessionStats.correct,wrong:sessionStats.wrong}))).toEqual({correct:1,wrong:0});
    await page.clock.runFor(600);
    if(mode==='reading'&&native){for(const key of 'zzz'){await page.locator(`.ma-ios-reading-keyboard [data-key="${key}"]`).click();if(await page.evaluate(()=>locked))break;}}
    else if(mode==='reading')await page.locator('#input').fill('zzzzzzzzzz');
    else if(variant>=3){await page.locator('#input').fill('違');if(variant===4)await page.locator('#input').press('Enter');}
    else {
      const wrong=await page.evaluate(()=>currentChoices.find(value=>!getAcceptedAnswersForCurrentChar().includes(value)));
      expect(wrong).toBeTruthy();await page.locator('#choiceGrid').getByRole('button',{name:wrong,exact:true}).click();
    }
    expect(await page.evaluate(()=>({correct:sessionStats.correct,wrong:sessionStats.wrong}))).toEqual({correct:1,wrong:1});
    if(await page.locator('#studyFeedbackContinue').isVisible())await page.locator('#studyFeedbackContinue').click();
    await page.clock.runFor(600);await page.locator('#endSessionBtn').click();
    await expect(page.locator('.ma-study-summary')).toBeVisible();await page.getByRole('button',{name:'Done',exact:true}).click();
  }
  expect(errors).toEqual([]);
});

for(const native of [false,true])test(`review keyboard ${native?'iOS':'web'}: IME drafts do not score and both Writing keyboards recall from a romaji cue`,async({page})=>{
  await setup(page,'writing',{native});await page.clock.install();
  await page.evaluate(()=>{settings.keyboardMode=true;settings.keyboardInputType='kana';onSettingsChanged();});
  if(await page.locator('#practiceSetupDialog').isVisible())await page.locator('#practiceSetupDone').click();
  await page.locator('#startBtn').click();
  const answer=await page.evaluate(()=>currentChar);
  await page.evaluate(()=>{inputEl.dispatchEvent(new CompositionEvent('compositionstart'));inputEl.value='k';inputEl.dispatchEvent(new InputEvent('input',{data:'k',isComposing:true}));});
  expect(await page.evaluate(()=>sessionStats.answered)).toBe(0);
  await page.evaluate(answer=>{inputEl.value=answer;inputEl.dispatchEvent(new CompositionEvent('compositionend',{data:answer}));inputEl.dispatchEvent(new InputEvent('input',{data:answer}));},answer);
  expect(await page.evaluate(()=>sessionStats.correct)).toBe(1);
  await page.clock.runFor(600);await page.locator('#endSessionBtn').click();await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.evaluate(()=>{settings.keyboardInputType='romaji';onSettingsChanged();});await page.locator('#startBtn').click();
  const state=await page.evaluate(()=>({answer:currentChar,prompt:currentPrompt,romaji:getRomajiForChars(currentChar)}));expect(state.prompt).toBe(state.romaji);expect(state.prompt).not.toBe(state.answer);
  await page.locator('#input').fill(state.answer);expect(await page.evaluate(()=>sessionStats.answered)).toBe(0);
  await page.locator('#input').press('Enter');expect(await page.evaluate(()=>sessionStats.correct)).toBe(1);
});

for(const native of [false,true])for(const mode of ['reading','writing'])test(`review modifiers ${native?'iOS':'web'} ${mode}: empty rows, mixed scripts, Combo tiers, hints and repetition`,async({page})=>{
  await setup(page,mode,{native});
  await page.evaluate(()=>{settings.hiraganaRows=[];settings.katakanaRows=[];onSettingsChanged();});
  await page.locator('#startBtn').click();expect(await page.evaluate(()=>sessionStarted)).toBe(false);await expect(page.locator('#hint')).toContainText('Select at least one row');
  await page.evaluate(()=>{
    ModeAtlasTrainerControls.applyPreset('pro');ModeAtlasTrainerControls.toggleMode('comboKana');
    Object.assign(settings,{focusWeak:true,srs:true,hint:true,choiceCount:8});onSettingsChanged();
  });
  if(await page.locator('#practiceSetupDialog').isVisible())await page.locator('#practiceSetupDone').click();
  await page.locator('#startBtn').click();
  const samples=await page.evaluate(()=>{
    const samples=[];
    for(const comboMode of ['same_row','random'])for(const tier of [0,10,25])for(let i=0;i<10;i++){
      settings.comboMode=comboMode;streak=tier;nextCharacter();const units=getCurrentKanaUnits();
      samples.push({comboMode,tier,units,rows:units.map(getRowKeyForChar),answer:typeof getAnswerForCurrentChar==='function'?getAnswerForCurrentChar():getRomajiForChars(currentChar),valid:units.every(kana=>!!getAnswerMapForCurrentMode()[kana]),
        choices:typeof currentChoices==='undefined'?null:currentChoices,correct:currentChar});
    }
    return samples;
  });
  for(const row of samples){
    expect(row.valid).toBe(true);expect(row.answer).not.toBe('');expect(row.units).toHaveLength(row.tier===25?4:row.tier===10?3:2);
    if(row.comboMode==='same_row')expect(new Set(row.rows).size).toBe(1);
    if(row.choices){expect(row.choices).toContain(row.correct);expect(new Set(row.choices).size).toBe(row.choices.length);expect(row.choices.length).toBeLessThanOrEqual(8);}
  }
  await page.evaluate(()=>{localStorage.removeItem('modeAtlasPracticeCheckpoint:'+ (document.body.classList.contains('ma-writing-page')?'writing':'reading'));dispatchEvent(new Event('modeAtlasAccountWillChange'));});
  expect(await page.evaluate(()=>sessionStarted)).toBe(false);
  expect(await page.evaluate(mode=>localStorage.getItem('modeAtlasPracticeCheckpoint:'+mode),mode)).toBe(null);
});
for(const theme of ['light','dark'])test(`iOS ${theme}: setup and incorrect feedback fit large text and small screens`,async({page},info)=>{
  await setup(page,'reading',{native:true,theme});await page.setViewportSize({width:375,height:667});
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  await page.locator('#modifiersTab').click();await expect(page.locator('#practiceSetupDone')).toBeInViewport();
  await expect(page.locator('#practiceSetupDialog')).toHaveCSS('transform','none');
  const sheet=await page.locator('#practiceSetupDialog').evaluate(el=>({width:el.scrollWidth,client:el.clientWidth,bottom:el.getBoundingClientRect().bottom}));
  expect(sheet.width).toBeLessThanOrEqual(sheet.client+1);expect(sheet.bottom).toBeLessThanOrEqual(667);
  await chooseMode(page,'free');await page.locator('#practiceSetupDone').click();await page.locator('#startBtn').click();
  await page.evaluate(()=>handleWrong('wrong'));
  await expect(page.locator('#studyFeedbackTitle')).toHaveText('✕ Incorrect');
  await page.locator('#studyFeedbackContinue').scrollIntoViewIfNeeded();await expect(page.locator('#studyFeedbackContinue')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`${theme}-incorrect-large-text.png`),animations:'disabled'});
});
for(const mode of ['reading','writing'])test(`${mode}: Endless, hints, Focus Weak, confusables and Combo follow their own rules`,async({page})=>{
  await setup(page,mode);await select(page,'endless');await page.clock.install();await page.locator('#startBtn').click();
  await page.evaluate(()=>handleWrong('wrong'));await expect(page.locator('#answerFeedback')).toContainText('Incorrect');await expect(page.locator('#studyFeedback')).toBeHidden();await page.clock.runFor(500);
  await finishAnswers(page,2);await page.locator('#endSessionBtn').click();
  expect(await page.evaluate(()=>scoreHistory.endlessBest)).toEqual({total:3,correct:2,wrong:1});
  await page.getByRole('button',{name:'Done',exact:true}).click();await select(page,'free');
  await page.evaluate(()=>{stats['あ']={correct:1,wrong:5};settings.focusWeak=true;settings.hint=true;onSettingsChanged();});await page.locator('#startBtn').click();
  expect(await page.evaluate(()=>currentChar)).toBe('あ');await page.clock.runFor(1800);await expect(page.locator('#hint')).not.toBeEmpty();
  await page.locator('#endSessionBtn').click();await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.evaluate(()=>ModeAtlasTrainerControls.toggleMode('confusableKana'));
  expect(await page.evaluate(()=>getEligiblePool().every(kana=>MODE_ATLAS_CONFUSABLE_KANA.has(kana)))).toBe(true);
  expect(await page.evaluate(()=>settings.focusWeak)).toBe(false);
  await page.evaluate(()=>{ModeAtlasTrainerControls.toggleMode('confusableKana');ModeAtlasTrainerControls.toggleMode('comboKana');settings.comboMode='same_row';onSettingsChanged();});
  await page.locator('#startBtn').click();expect(await page.evaluate(()=>getCurrentKanaUnits().length)).toBe(2);
  await page.evaluate(()=>handleWrong('wrong'));await expect(page.locator('#studyFeedback')).toBeVisible();
  await expect(page.locator('#studyFeedback')).toContainText('Read each kana in order');await page.locator('#studyFeedbackContinue').click();
  expect(await page.evaluate(()=>sessionStats.answered)).toBe(1);
});
