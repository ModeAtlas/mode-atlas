const {test,expect}=require('@playwright/test');
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
async function select(page,mode){
  await page.locator('#modifiersTab').click();
  await expect(page.getByRole('dialog',{name:'Practice setup',exact:true})).toBeVisible();
  await page.locator(`[data-ma-mode="${mode}"]`).click();
  await expect(page.locator(`[data-ma-mode="${mode}"]`)).toHaveAttribute('aria-pressed','true');
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
    await expect(page.locator('[data-ma-mode]')).toHaveCount(7);
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
    test.setTimeout(60000);await setup(page,mode);await select(page,'dailyChallenge');await page.locator('#startBtn').click();await page.clock.install();
    await page.evaluate(()=>{dailySequence[0]='ツ';nextCharacter();});
    await page.locator('#skipKanaBtn').click();await page.clock.runFor(500);await finishAnswers(page,19);
    await expect(page.locator('.ma-dialog__title')).toHaveText('Daily Challenge complete');
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
    await expect(page.locator('.ma-dialog__title')).toHaveText('Test Mode complete');
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
    await expect(page.locator('.ma-dialog__title')).toHaveText('Time Trial complete');
    await expect(page.locator('.ma-study-summary')).toContainText('Target reached');
    expect(await page.evaluate(()=>scoreHistory.timeTrialTop3)).toHaveLength(1);
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await select(page,'speedRun');await page.locator('#startBtn').click();await finishAnswers(page,1);await page.locator('#endSessionBtn').click();
    expect(await page.evaluate(()=>scoreHistory.speedRunTop3)).toHaveLength(0);await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.locator('#startBtn').click();await finishAnswers(page,1);await page.clock.runFor(60100);
    await expect(page.locator('.ma-dialog__title')).toHaveText('Speed Run complete');expect(await page.evaluate(()=>scoreHistory.speedRunTop3)).toHaveLength(1);
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
for(const theme of ['light','dark'])test(`iOS ${theme}: setup and incorrect feedback fit large text and small screens`,async({page},info)=>{
  await setup(page,'reading',{native:true,theme});await page.setViewportSize({width:375,height:667});
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  await page.locator('#modifiersTab').click();await expect(page.locator('#practiceSetupDone')).toBeInViewport();
  await expect(page.locator('#practiceSetupDialog')).toHaveCSS('transform','none');
  const sheet=await page.locator('#practiceSetupDialog').evaluate(el=>({width:el.scrollWidth,client:el.clientWidth,bottom:el.getBoundingClientRect().bottom}));
  expect(sheet.width).toBeLessThanOrEqual(sheet.client+1);expect(sheet.bottom).toBeLessThanOrEqual(667);
  await page.locator('[data-ma-mode="free"]').click();await page.locator('#practiceSetupDone').click();await page.locator('#startBtn').click();
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
