const {test,expect}=require('@playwright/test');
async function prepare(page,{native=false,theme='dark'}={}){
  await page.setViewportSize({width:native?393:1280,height:native?852:900});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    localStorage.setItem('modeAtlasThemePreference',theme);
    localStorage.setItem('modeAtlasSound','off');
    localStorage.setItem('maWhatsNewSeen','study-flow');
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    for(const key of ['settings','reverseSettings'])localStorage.setItem(key,JSON.stringify({hiraganaRows:['h_a'],katakanaRows:[],hint:false,srs:true,keyboardMode:false}));
  },{native,theme});
  if(native){const device=await page.context().newCDPSession(page);await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});}
}
async function open(page,path){
  await page.goto(path);
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(()=>document.fonts.ready);
}
async function answer(page,mode,correct=true,native=false){
  await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);
  const value=await page.evaluate(({mode,correct})=>{
    if(mode==='writing')return correct?currentChar:currentChoices.find(kana=>kana!==currentChar);
    const expected=charMap[currentChar];
    return correct?expected:(expected==='a'?'i':'a');
  },{mode,correct});
  if(mode==='writing')await page.locator('.choice-btn').getByText(value,{exact:true}).click();
  else if(native)for(const letter of value)await page.locator(`.ma-ios-reading-keyboard [data-key="${letter}"]`).click();
  else await page.locator('#input').fill(value);
}
for(const mode of ['reading','writing'])for(const native of [false,true]){
  test(`${native?'iOS':'Web'} ${mode}: finite set teaches a mistake, saves once and focuses the follow-up`,async({page},testInfo)=>{
    test.setTimeout(60000);
    const errors=[];page.on('pageerror',error=>errors.push(error.stack));
    await prepare(page,{native});await open(page,`/${mode}/?practice=10`);
    await expect(page.locator('#studyLength')).toHaveValue('10');
    await expect(page).toHaveURL(new RegExp('/'+mode+'/$'));
    await page.locator('#startBtn').click();
    const missed=await page.evaluate(()=>currentChar);
    await answer(page,mode,false,native);
    await expect(page.locator('#studyFeedback')).toBeVisible();
    await expect(page.locator('#studyFeedback')).toContainText('Correct answer:');
    await expect(page.locator('#studyProgressLabel')).toHaveText('1 of 10 answered');
    if(native&&mode==='reading')await expect(page.locator('.ma-ios-reading-keyboard')).toBeHidden();
    await page.waitForTimeout(650); // A wrong answer must outlive the old 420ms flash.
    expect(await page.evaluate(()=>sessionStats.answered)).toBe(1);
    await page.screenshot({path:testInfo.outputPath(`${native?'ios':'web'}-${mode}-coaching.png`)});
    await page.locator('#pauseSessionBtn').click();
    await expect(page.locator('#studyFeedbackContinue')).toBeDisabled();
    await page.locator('#pauseSessionBtn').click();
    await page.locator('#studyFeedbackContinue').click();
    await expect(page.locator('#studyFeedback')).toBeHidden();
    for(let i=1;i<10;i++)await answer(page,mode,true,native);
    await expect(page.locator('.ma-dialog__title')).toHaveText('Set complete');
    await expect(page.locator('.ma-study-summary')).toContainText('10 / 10');
    await expect(page.locator('.ma-study-summary')).toContainText('90%');
    const totals=await page.evaluate(mode=>Object.values(window.ModeAtlasStorage.readModeJSON(mode,'charStats',{})).reduce((n,row)=>({correct:n.correct+row.correct,wrong:n.wrong+row.wrong}),{correct:0,wrong:0}),mode);
    expect(totals).toEqual({correct:9,wrong:1});
    await expect(page.locator('.ma-dialog-layer')).toHaveCSS('opacity','1');
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:testInfo.outputPath(`${native?'ios':'web'}-${mode}-complete.png`)});
    await page.getByRole('button',{name:'Practise these kana',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>sessionStarted&&sessionStats.answered===0)).toBe(true);
    expect(await page.evaluate(()=>currentChar)).toBe(missed);
    for(let i=0;i<3;i++){await answer(page,mode,true,native);await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);expect(await page.evaluate(()=>currentChar)).toBe(missed);}
    await page.locator('#endSessionBtn').click();
    await expect(page.locator('.ma-dialog__title')).toHaveText('Practice saved');
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.reload();await expect(page.locator('#maLoadingScreen')).toBeHidden();
    expect(await page.evaluate(()=>sessionStarted)).toBe(false);
    expect(errors).toEqual([]);
  });
}

test('guided skip is taught once; stopping feedback cannot advance a later session',async({page})=>{
  await prepare(page,{native:true,theme:'light'});await open(page,'/reading/?practice=20');
  await page.locator('#startBtn').click();
  await page.locator('#skipKanaBtn').click();
  await expect(page.locator('#studyFeedback')).toContainText('Your answer: Skipped');
  await page.locator('#endSessionBtn').click();
  await expect(page.locator('.ma-study-summary')).toContainText('1 / 20');
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.locator('#startBtn').click();
  await page.waitForTimeout(650);
  expect(await page.evaluate(()=>({answered:sessionStats.answered,locked}))).toEqual({answered:0,locked:false});
});

test('longer sets finish at their own goal; free practice retains its original wrong-answer result',async({page})=>{
  await prepare(page);await open(page,'/reading/');
  for(const length of [20,30]){
    await page.locator('#studyLength').selectOption(String(length));
    await page.locator('#startBtn').click();
    await page.clock.install();
    for(let i=0;i<length;i++){
      await page.evaluate(()=>handleCorrect(charMap[currentChar]));
      await page.clock.runFor(300);
    }
    await expect(page.locator('.ma-dialog__title')).toHaveText('Set complete');
    await expect(page.locator('.ma-study-summary')).toContainText(`${length} / ${length}`);
    expect(await page.evaluate(()=>sessionStats.answered)).toBe(length);
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await open(page,'/reading/');
  }
  await page.locator('#studyLength').selectOption('0');
  await page.locator('#startBtn').click();
  await page.evaluate(()=>handleWrong('wrong'));
  await page.clock.runFor(500);
  await expect(page.locator('#gameOver')).toBeVisible();
  await expect(page.locator('#studyFeedback')).toBeHidden();
});

test('guided settings cannot take over Daily Challenge and Test Mode',async({page})=>{
  await prepare(page);await open(page,'/reading/?mode=daily&practice=10');
  await expect(page.locator('#studySetSetup')).toBeHidden();
  await page.locator('#startBtn').click();
  expect(await page.evaluate(()=>sessionStats.study)).toBeNull();
  await page.evaluate(()=>handleWrong('wrong'));
  await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);
  await expect(page.locator('#studyFeedback')).toBeHidden();
  await open(page,'/writing/?practice=10');
  await page.evaluate(()=>{Object.assign(settings,{testMode:true});onSettingsChanged();});
  await page.locator('#startBtn').click();
  expect(await page.evaluate(()=>sessionStats.study)).toBeNull();
});

for(const theme of ['light','dark'])test(`iOS ${theme}: recommendation reflects saved difficulties and guides the selected activity`,async({page},testInfo)=>{
  await prepare(page,{native:true,theme});
  await page.addInitScript(()=>localStorage.setItem('charStats',JSON.stringify({'あ':{correct:3,wrong:5}})));
  await open(page,'/');
  await expect(page.locator('#iosHomeContinueTitle')).toHaveText('Read tricky kana');
  await expect(page.locator('#iosHomeGreeting')).toContainText('1 kana has');
  await page.screenshot({path:testInfo.outputPath(`ios-${theme}-recommendation.png`)});
  await page.locator('#iosHomeContinue').click();
  await expect(page.locator('#studyLength')).toHaveValue('10');
  expect(await page.evaluate(()=>settings.focusWeak)).toBe(true);
  await page.locator('#startBtn').click();
  expect(await page.evaluate(()=>getEligiblePool())).toEqual(['あ']);
  await page.locator('#skipKanaBtn').click();
  await expect(page.locator('#studyFeedback')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`ios-${theme}-coaching.png`)});
});

test('phone Reading keeps input focus through correct feedback and reflows teaching at larger text sizes',async({page},testInfo)=>{
  await prepare(page);await page.setViewportSize({width:375,height:667});await open(page,'/reading/?practice=10');
  await page.locator('#startBtn').click();
  await page.clock.install();await page.clock.pauseAt(new Date());
  await answer(page,'reading');
  await expect(page.locator('#input')).toBeEnabled();
  await expect(page.locator('#input')).toBeFocused();
  await page.clock.runFor(300);
  await page.locator('#skipKanaBtn').click();
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  await page.locator('#studyFeedbackContinue').scrollIntoViewIfNeeded();
  await expect(page.locator('#studyFeedbackContinue')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('web-phone-large-text-coaching.png'),animations:'disabled'});
});
