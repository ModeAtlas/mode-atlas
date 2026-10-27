const {test,expect}=require('@playwright/test');
async function setup(page,{native=false,theme='dark'}={}){
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    localStorage.setItem('modeAtlasBranchToursSeen',JSON.stringify({kana:true,kanji:true,words:true}));
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasThemePreference',theme);localStorage.setItem('modeAtlasSound','off');localStorage.setItem('maWhatsNewSeen','kana-learning');
  },{native,theme});
}
async function open(page,url='/kana/') {await page.goto(url);await expect(page.locator('#maLoadingScreen')).toBeHidden();}

test('native path gives every row one reachable full-page entry',async({page},info)=>{
 await page.setViewportSize({width:393,height:852});await setup(page,{native:true});await open(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();await open(page,'/kana/?view=path');
 await expect(page.locator('.ma-kana-course-unit')).toHaveCount(24);await expect(page.locator('.ma-kana-course-unit:enabled')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('native-path.png'),fullPage:true});
});

for(const native of [false,true])test(`combined practice alternates and saves each skill independently ${native?'iOS':'web'}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await setup(page,{native});await open(page);await page.getByRole('button',{name:/Start lesson/}).click();
  await open(page,'/kana/?view=practice');await page.getByRole('button',{name:'Read + Recall',exact:true}).click();
  await expect(page.getByRole('button',{name:'Read + Recall',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Start practice',exact:true}).click();
  await expect(page).toHaveURL(/\/reading\//);await expect(page.locator('body')).toHaveClass(/trainer-session-active/);await page.clock.install();
  expect(errors).toEqual([]);
  const first=await page.evaluate(()=>({char:currentChar,answer:getAnswerForCurrentChar()}));
  if(native){for(const char of first.answer)await page.locator(`.ma-ios-reading-keyboard [data-key="${char}"]`).click();}
  else await page.locator('#input').fill(first.answer);
  await page.clock.runFor(500);
  await expect(page.locator('#mixedRecallChoices')).toBeVisible();
  const second=await page.evaluate(()=>currentChar);
  await page.locator('#mixedRecallChoices').getByRole('button',{name:second,exact:true}).click();await page.clock.runFor(500);
  const evidence=await page.evaluate(({first,second})=>({read:ModeAtlasStorage.readModeJSON('reading','charStats',{})[first]?.correct,recall:ModeAtlasStorage.readModeJSON('writing','charStats',{})[second]?.correct,answered:sessionStats.answered,mode:answerMode}),{first:first.char,second});
  expect(evidence).toEqual({read:1,recall:1,answered:2,mode:'reading'});
  await expect(page.locator('#input')).toBeVisible();await expect(page.locator('#mixedRecallChoices')).toBeHidden();
  expect(errors).toEqual([]);
});
test('fresh entry offers placement or beginner, with one course and locked future rows',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await open(page);await expect(page.getByRole('button',{name:'Find my starting point',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start lesson',exact:true}).click();await expect(page.locator('.ma-kana-task-glyph')).toHaveText('あ');await expect(page.locator('#maKanaLearning select')).toHaveCount(0);
 await open(page,'/kana/?view=path');await expect(page.getByRole('heading',{name:'Your learning path'})).toBeVisible();await expect(page.locator('.ma-kana-course-unit:enabled')).toHaveCount(1);await page.getByRole('button',{name:'Katakana',exact:true}).click();await expect(page.locator('[data-row="katakana:base:a"]')).toContainText('ア イ ウ エ オ');await page.getByRole('button',{name:'Full script tests',exact:true}).click();await expect(page.getByText(/Check every basic row/)).toHaveCount(2);expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(0);expect(errors).toEqual([]);await page.screenshot({path:info.outputPath('kana-course.png')});
});
test('entering a lesson keeps its controls and focus when an overview refresh is queued',async({page})=>{
  await setup(page);await open(page);
  const result=await page.evaluate(async()=>{
    // Queue an overview update, then enter the task before the next paint.
    // The old overview callback must not replace the new lesson's controls.
    dispatchEvent(new CustomEvent('modeAtlasKanaLearningChanged'));
    [...document.querySelectorAll('button')].find(button=>button.textContent==='Start lesson').click();
    const task=document.querySelector('.ma-course-view[data-task]');
    const control=[...task.querySelectorAll('button')].find(button=>button.textContent==='Continue');
    control.focus();
    const session=ModeAtlasKanaLearning.courseSession();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const current=ModeAtlasKanaLearning.courseSession();
    return {taskRetained:task.isConnected,controlRetained:control.isConnected,focusRetained:document.activeElement===control,
      sessionRetained:current.id===session.id,index:current.index};
  });
  expect(result).toEqual({taskRetained:true,controlRetained:true,focusRetained:true,sessionRetained:true,index:0});
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.locator('.ma-kana-task-glyph')).toHaveText('い');
});
test('placement resumes after reload, stops each direction at a gap, and saves no XP',async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:'Find my starting point',exact:true}).click();await page.getByRole('button',{name:'Begin check',exact:true}).click();
  for(let i=0;i<2;i++){const answer=await page.evaluate(()=>ModeAtlasKanaPlacement.question(ModeAtlasKanaPlacement.read()).roman);await page.getByLabel('Reading answer').fill(answer);await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();}
  await page.reload();await page.getByRole('button',{name:'Learning path',exact:true}).click();await page.getByRole('button',{name:'Check my starting point',exact:true}).click();await expect(page.locator('.ma-kana-page-heading')).toContainText('Ka row');
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'I don’t know yet',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();}await expect(page.locator('.ma-kana-page-heading')).toContainText('Recall');
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'I don’t know yet',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();}
  await expect(page.getByRole('heading',{name:'Your learning path is ready'})).toBeVisible();
  const result=await page.evaluate(()=>({xp:ModeAtlasProgress.getXP(),read:ModeAtlasKanaLearning.path('hiragana','reading')[1].unlocked,recall:ModeAtlasKanaLearning.path('hiragana','writing')[1].unlocked}));expect(result).toEqual({xp:0,read:true,recall:false});
});
for(const skill of ['reading','writing'])test(`${skill} shared setup preserves feedback choices and counts real practice toward the row`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await open(page);await page.getByRole('button',{name:/Start lesson/}).click();
  await open(page,`/${skill}/?practice=20&kana=あ,い,う,え,お`);await page.locator('#modifiersTab').click();await expect(page.getByLabel('Session',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Session',{exact:true}).locator('option')).toHaveCount(5);await expect(page.locator('[data-preset]')).toHaveCount(0);
  await page.getByLabel('Feedback',{exact:true}).selectOption('quick');await page.getByLabel('Hints',{exact:true}).selectOption('on');await page.locator('#practiceSetupDone').click();await expect(page.locator('#kanaHintsQuick')).toHaveText('Hints on');await page.locator('#kanaHintsQuick').click();
  await page.locator('#startBtn').click();await page.clock.install();
  expect(await page.evaluate(()=>sessionStats.study.feedback)).toBe('quick');
  for(let i=0;i<15;i++){await page.evaluate(i=>{currentChar='あいうえお'[i%5];handleCorrect('test');},i);await page.clock.runFor(300);}
  expect(await page.evaluate(skill=>ModeAtlasKanaLearning.path('hiragana',skill)[1].unlocked,skill)).toBe(true);
  expect(await page.evaluate(skill=>ModeAtlasKanaLearning.path('hiragana',skill==='reading'?'writing':'reading')[1].unlocked,skill)).toBe(false);expect(errors).toEqual([]);
});
test('one mastery view keeps earned Read progress visible while Recall is new',async({page})=>{
  await setup(page);await open(page);await page.evaluate(()=>{const s=ModeAtlasKanaLearning.start();s.earned.reading['あ']=5;ModeAtlasKanaLearning.save(s);});await open(page,'/kana/?view=mastery');
  await expect(page.getByRole('group',{name:'Mastery direction'})).toHaveCount(0);await page.getByRole('button',{name:'あ mastery details: Familiar',exact:true}).click();
  const skills=page.locator('.ma-kana-skill-evidence');await expect(skills).toHaveCount(3);await expect(skills.nth(0)).toContainText('Mastered');await expect(skills.nth(1)).toContainText('New');await expect(skills.nth(2)).toContainText('Mastered+');
});
for(const [native,theme] of [[true,'light'],[true,'dark'],[false,'light'],[false,'dark']])test(`Kana layout and lesson fit ${native?'iOS':'web'} ${theme} without horizontal scrolling`,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page,{native,theme});await page.setViewportSize({width:native?320:1280,height:native?740:900});await open(page);await page.getByRole('button',{name:/Start lesson/}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeInViewport();
  expect(await page.locator('.ma-kana-navigation a').evaluateAll(links=>links.every(link=>link.scrollWidth<=link.clientWidth+1))).toBe(true);
  await page.screenshot({path:info.outputPath(`kana-path-${native}.png`)});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.locator('.ma-kana-task-glyph')).toHaveText('あ');await require('./helpers/kana-course').task(page);await expect(page.locator('.ma-kana-task-glyph')).toHaveText('い');
  await page.screenshot({path:info.outputPath(`kana-lesson-${native}.png`)});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
  await page.getByRole('button',{name:'Save & exit',exact:true}).click();
  await expect(page.getByRole('button',{name:'Continue session',exact:true})).toBeVisible();
});

test('handwriting awards a clean independent completion, while watching strokes awards nothing',async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:/Start lesson/}).click();await open(page,'/kana/handwriting/?kana=あ');
  await expect(page.locator('.ma-handwriting-board')).toBeVisible();
  await page.getByRole('button',{name:'Next stroke',exact:true}).click();expect(await page.evaluate(()=>ModeAtlasKanaLearning.read().handwriting['あ']||[])).toEqual([]);
  await page.getByRole('button',{name:'Write',exact:true}).click();await expect(page.locator('.ma-handwriting-characters')).toHaveText('Part 1');await expect(page.locator('.ma-handwriting-status')).toContainText('a · Stroke');
  for(let i=0;i<3;i++){
    const points=await page.locator('.ma-handwriting-board').evaluate((board,i)=>{const p=board.querySelectorAll('.ma-handwriting-guide')[i],box=board.getBoundingClientRect(),length=p.getTotalLength();return Array.from({length:24},(_,n)=>{const at=p.getPointAtLength(length*n/23);return {x:box.left+at.x*box.width/109,y:box.top+at.y*box.height/109};});},i);
    await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const point of points.slice(1))await page.mouse.move(point.x,point.y);await page.mouse.up();
  }
  await expect(page.locator('.ma-handwriting-status')).toHaveText('Independent writing saved.');
  const saved=await page.evaluate(()=>({items:ModeAtlasKanaLearning.read().handwriting['あ'],skill:ModeAtlasKanaLearning.earned('あ','handwriting',ModeAtlasKanaLearning.read(),{}),xp:ModeAtlasProgress.getXP()}));expect(saved.items).toHaveLength(1);expect(saved.items[0].independent).toBe(true);expect(saved.skill).toBe(3);expect(saved.xp).toBe(0);
  await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('option',{name:/Ka row · Basics/})).toHaveJSProperty('disabled',true);
});

for(const skill of ['reading','writing'])test(`${skill} accuracy uses the requested unlocked set before and during practice`,async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:/Start lesson/}).click();
  // Old settings can contain rows unavailable to this account or this skill.
  await page.evaluate(skill=>ModeAtlasStorage.writeModeJSON(skill,'settings',{kanaRows:['hiragana:base:a','hiragana:yoon:ka'],kanaSelection:true,practiceCount:20,feedbackStyle:'learn'}),skill);
  await open(page,`/${skill}/?practice=20&kana=い,きゃ`);
  await expect(page.locator('#heatmap .cell')).toHaveText(['い']);
  await page.locator('#startBtn').click();await expect(page.locator('#heatmap .cell')).toHaveText(['い']);
  const pool=await page.evaluate(()=>getEligiblePool());expect(pool).toEqual(['い']);
});

test('accuracy recomputes account eligibility and clears pending targets on account change',async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:/Start lesson/}).click();
  await page.evaluate(()=>{const s=ModeAtlasKanaLearning.read();s.placed.reading['hiragana:yoon:ka']=1;ModeAtlasKanaLearning.save(s);ModeAtlasStorage.writeModeJSON('reading','settings',{kanaRows:['hiragana:yoon:ka'],practiceCount:20});});
  await open(page,'/reading/?practice=20&kana=きゃ');await expect(page.locator('#heatmap .cell')).toHaveText(['きゃ']);
  await page.evaluate(()=>{
    dispatchEvent(new Event('modeAtlasAccountWillChange'));
    ModeAtlasStorage.setJSON('modeAtlasKanaLearning',{startedAt:1,startKind:'beginner'});
    ModeAtlasStorage.writeModeJSON('reading','settings',{kanaRows:['hiragana:base:a','hiragana:yoon:ka'],practiceCount:20});
    dispatchEvent(new CustomEvent('modeAtlasCloudDataChanged',{detail:{sections:['reading','kanaLearning']}}));
  });
  await expect(page.locator('#heatmap .cell')).toHaveText(['あ','い','う','え','お']);
  expect(await page.evaluate(()=>trainerController.study.hasPendingReview())).toBe(false);
});

test('custom practice edits row, feedback and timing in one setup surface',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page,{native:true});await page.setViewportSize({width:393,height:852});await open(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();await open(page,'/kana/?view=practice');await page.getByRole('button',{name:'Recall',exact:true}).click();
 await page.getByLabel('Session length',{exact:true}).selectOption('10');await page.getByLabel('Feedback',{exact:true}).selectOption('quick');await page.locator('.ma-kana-row-picker summary').click();await page.getByRole('checkbox',{name:'hiragana Basics A row',exact:true}).uncheck();await page.getByRole('checkbox',{name:'katakana Basics A row',exact:true}).check();await expect(page.getByRole('checkbox',{name:'hiragana Basics Ka row',exact:true})).toHaveCount(0);await page.screenshot({path:info.outputPath('practice-ios-dark.png'),fullPage:true});
 await page.getByRole('button',{name:'Start practice',exact:true}).click();await expect(page).toHaveURL(/\/writing\//);await expect(page.locator('#heatmap .cell')).toHaveText(['ア','イ','ウ','エ','オ']);await page.waitForFunction(()=>typeof window.ModeAtlasTrainerControls?.getSettings==='function');const settings=await page.evaluate(()=>ModeAtlasTrainerControls.getSettings());expect(settings.practiceCount).toBe(10);expect(settings.feedbackStyle).toBe('quick');
 await open(page,'/kana/?view=practice');await page.getByLabel('Session',{exact:true}).selectOption('timed');await page.getByLabel('Timed goal',{exact:true}).selectOption('target');await page.getByLabel('Minutes',{exact:true}).fill('2');await page.getByLabel('Minutes',{exact:true}).press('Tab');await page.getByLabel('Correct-answer target',{exact:true}).fill('30');await page.getByLabel('Correct-answer target',{exact:true}).press('Tab');await page.getByRole('button',{name:'Start practice',exact:true}).click();await expect(page.locator('#maLoadingScreen')).toBeHidden();await expect(page.locator('body')).toHaveClass(/trainer-session-active/);await expect(page.locator('#trialTimerPill')).toBeVisible();expect(await page.evaluate(()=>ModeAtlasTrainerControls.getSettings().timeTrial)).toBe(true);expect(errors).toEqual([]);
});

for(const native of [false,true])test(`study selection uses two columns and script-wide unlocked toggles on ${native?'iOS':'web'}`,async({page},info)=>{
  await setup(page,{native});await page.setViewportSize({width:393,height:852});await open(page);
  await page.evaluate(()=>{const s=ModeAtlasKanaLearning.start();s.placed.reading['hiragana:base:ka']=1;ModeAtlasKanaLearning.save(s);});await open(page,'/kana/?view=practice');
  const dialog=page.locator('.ma-course-body');await dialog.locator('.ma-kana-row-picker summary').click();
  const all=dialog.getByRole('checkbox',{name:'All unlocked Hiragana',exact:true});
  await expect(all).toHaveJSProperty('indeterminate',true);await all.check();
  await expect(dialog.getByRole('checkbox',{name:'hiragana Basics A row',exact:true})).toBeChecked();await expect(dialog.getByRole('checkbox',{name:'hiragana Basics Sa row',exact:true})).toBeChecked();await expect(dialog.getByRole('checkbox',{name:'hiragana Basics Ta row',exact:true})).toHaveCount(0);
  await dialog.getByRole('checkbox',{name:'All unlocked Katakana',exact:true}).check();await all.uncheck();
  await expect(dialog.getByRole('checkbox',{name:'hiragana Basics A row',exact:true})).not.toBeChecked();await expect(dialog.getByRole('checkbox',{name:'katakana Basics A row',exact:true})).toBeChecked();
  await all.check();await dialog.getByRole('checkbox',{name:'hiragana Basics Ka row',exact:true}).uncheck();await expect(all).toHaveJSProperty('indeterminate',true);
  const grid=dialog.locator('.ma-kana-row-picker-grid').first();expect(await grid.evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length)).toBe(2);
  await grid.locator('label').first().scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`row-selection-${native}.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Start practice',exact:true}).click();await expect(page).toHaveURL(/\/reading\//);await expect(page.locator('#maLoadingScreen')).toBeHidden();await expect(page.locator('#heatmap .cell')).toHaveCount(15);await expect(page.locator('#heatmap')).not.toContainText('か');await expect(page.locator('#heatmap')).toContainText('ア');
});

for(const theme of ['light','dark'])test(`mastery displays exact next targets with accessible pass and missing states in ${theme}`,async({page},info)=>{
  await setup(page,{native:true,theme});await page.setViewportSize({width:393,height:852});await open(page);
  await page.evaluate(()=>{
    const s=ModeAtlasKanaLearning.start();s.earned.reading['あ']=4;s.earned.writing['あ']=3;ModeAtlasKanaLearning.save(s);
    ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:52,wrong:3}});ModeAtlasStorage.writeModeJSON('reading','charTimes',{'あ':1100});
    ModeAtlasStorage.writeModeJSON('reading','srs',{'あ':{reviewVersion:1,level:4,days:['2026-10-12','2026-10-13','2026-10-14','2026-10-15'],recent:Array.from({length:8},(_,i)=>({id:String(i),at:i+1,quality:2}))}});
  });await open(page,'/kana/?view=mastery');await page.getByRole('button',{name:'あ mastery details: Confident',exact:true}).click();
  const read=page.locator('.ma-kana-skill-evidence').first();await expect(read).toBeVisible();await expect(read.locator('[data-check="correct"]')).toHaveAttribute('data-status','met');await expect(read.locator('[data-check="correct"]')).toContainText('✓ Met');
  await expect(read.locator('[data-check="accuracy"]')).toHaveAttribute('data-status','reference');await expect(read.locator('[data-check="time"]')).toHaveAttribute('data-status','reference');await expect(read.locator('[data-check="recent-attempts"]')).toHaveAttribute('data-status','needed');await expect(read.locator('[data-check="time"]')).toContainText('1.100s');await expect(read.locator('[data-check="time"]')).toContainText('Does not block mastery');
  await expect(read.locator('details')).toHaveCount(0);await page.screenshot({path:info.outputPath(`mastery-targets-${theme}.png`),fullPage:true});
  await page.getByRole('button',{name:'Recall · Familiar',exact:true}).click();await expect(read).toBeHidden();await expect(page.locator('.ma-kana-skill-evidence').nth(1)).toBeVisible();
  await page.getByRole('button',{name:'Handwrite · New',exact:true}).click();await expect(page.locator('.ma-kana-skill-evidence').nth(2)).toContainText('Clean writes without a guide');
  await page.getByRole('button',{name:'Back to mastery map',exact:true}).click();await expect(page.locator('.ma-kana-mastery-help')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('native placement keeps the shared app keyboard ready between answers and disposes it on exit',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page,{native:true});await page.setViewportSize({width:393,height:852});await open(page);await page.getByRole('button',{name:'Find my starting point',exact:true}).click();await page.getByRole('button',{name:'Begin check',exact:true}).click();
  const input=page.getByLabel('Reading answer');await expect(input).toHaveJSProperty('readOnly',true);await expect(input).toHaveAttribute('inputmode','none');
  for(let i=0;i<3;i++){
    await expect(page.locator('.ma-ios-reading-keyboard')).toHaveCount(1);const answer=await page.evaluate(()=>ModeAtlasKanaPlacement.question(ModeAtlasKanaPlacement.read()).roman);
    for(const letter of answer)await page.locator(`.ma-ios-reading-keyboard [data-key="${letter}"]`).click();await expect(input).toHaveValue(answer);
    if(i===0)await page.screenshot({path:info.outputPath('placement-ios.png'),fullPage:true});
    if(i===2)await input.press('Enter');else await page.getByRole('button',{name:'Check answer',exact:true}).click();await expect(page.locator('.ma-ios-reading-keyboard button').first()).toBeDisabled();await page.getByRole('button',{name:'Continue',exact:true}).click();
  }
  // Hardware editing still works on the readonly input without summoning iOS input.
  await page.keyboard.type('xy');await expect(input).toHaveValue('xy');await page.keyboard.press('Backspace');await expect(input).toHaveValue('x');
  for(let misses=0;misses<2;misses++){await page.getByRole('button',{name:'I don’t know yet',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();}await expect(page.locator('.ma-kana-placement-choices')).toBeVisible();await expect(page.locator('.ma-ios-reading-keyboard')).toHaveCount(0);
  await page.getByRole('button',{name:'Finish with my progress so far',exact:true}).click();await expect(page.locator('.ma-ios-accessibility-status')).toHaveCount(0);expect(errors).toEqual([]);expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(0);
});

for(const skill of ['reading','writing'])test(`${skill} returns to the saved practice pace and selected rows`,async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:/Start lesson/}).click();
  await page.evaluate(skill=>ModeAtlasStorage.writeModeJSON(skill,'settings',{
    kanaSelection:true,kanaRows:['katakana:base:a'],practiceCount:0,endless:true,feedbackStyle:'quick',hint:false,srs:true
  }),skill);
  await open(page,`/kana/?view=practice&skill=${skill}`);
  await expect(page.getByLabel('Session',{exact:true})).toHaveValue('practice');
  await expect(page.getByLabel('Session length',{exact:true})).toHaveValue('0');
  await expect(page.getByLabel('Feedback',{exact:true})).toHaveValue('quick');

  await page.getByRole('button',{name:'Start practice',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/'+skill+'/$'));
  await expect(page.locator('#heatmap .cell')).toHaveText(['ア','イ','ウ','エ','オ']);
  await open(page,`/kana/?view=practice&skill=${skill}`);
  await expect(page.getByLabel('Session length',{exact:true})).toHaveValue('0');
  expect(await page.evaluate(skill=>ModeAtlasStorage.readModeJSON(skill,'settings',{}).endless,skill)).toBe(true);
});

for(const width of [320,393])test(`combined kana remain readable in the ${width}px course path`,async({page})=>{
 await setup(page,{native:true});await page.setViewportSize({width,height:852});await open(page);await page.evaluate(()=>{const L=ModeAtlasKanaLearning,s=L.start('placement'),rows=L.rows.filter(r=>r.script==='hiragana'),index=rows.findIndex(r=>r.group==='yoon');for(const row of rows.slice(0,index))s.placed.reading[row.id]=Date.now();L.save(s);});await open(page,'/kana/?view=path');const row=page.locator('[data-row="hiragana:yoon:ka"]');await row.scrollIntoViewIfNeeded();await expect(row).toContainText('きゃ きゅ きょ');expect(await row.locator('.ma-kana-course-unit-chars').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);await row.click();await expect(page.locator('.ma-kana-next-chars')).toHaveText('きゃ きゅ きょ');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Your path includes every row and reopens old lessons without changing unlocks',async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:/Start lesson/}).click();
  await page.evaluate(()=>{const L=ModeAtlasKanaLearning,s=L.read();for(const row of L.rows.filter(r=>r.script==='hiragana'&&r.group==='base').slice(0,6))s.placed.reading[row.id]=Date.now();L.save(s);});
  await open(page,'/kana/?view=path');
  const expected=await page.evaluate(()=>ModeAtlasKanaLearning.rows.filter(r=>r.script==='hiragana').length);
  await expect(page.locator('.ma-kana-course-unit')).toHaveCount(expected);
  await expect(page.locator('[data-row="hiragana:base:a"]')).toBeEnabled();
  await page.locator('[data-row="hiragana:base:a"]').click();await expect(page.locator('.ma-kana-next-chars')).toHaveText('あ い う え お');await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('[data-row="hiragana:yoon:ka"]')).toBeDisabled();
});
test('Confident, Mastered and Mastered+ have distinct colours in the legend and details',async({page})=>{
  await setup(page);await open(page,'/kana/?view=mastery');
  // Enter the branch as an existing learner, keeping real mastery rendering.
  await page.evaluate(()=>{const L=ModeAtlasKanaLearning,s=L.start();s.earned.reading['あ']=5;s.earned.writing['あ']=5;s.earned.handwriting['あ']=5;L.save(s);});await open(page,'/kana/?view=mastery');
  const colours=await page.locator('.ma-kana-mastery-legend>[data-stage]').evaluateAll(nodes=>nodes.filter(n=>Number(n.dataset.stage)>=4).map(n=>getComputedStyle(n).borderLeftColor));expect(new Set(colours).size).toBe(3);
  await page.getByRole('button',{name:'あ mastery details: Mastered+',exact:true}).click();await expect(page.locator('.ma-kana-mastery-heading')).toHaveAttribute('data-stage','6');
});

test('practice presents four equal skill choices and handwriting remains usable',async({page},info)=>{
 await page.setViewportSize({width:393,height:852});await setup(page,{native:true});await open(page);await page.getByRole('button',{name:/Start lesson/}).click();await open(page,'/kana/?view=practice');
 const choices=page.getByRole('group',{name:'Kana skill',exact:true});await expect(choices.getByRole('button')).toHaveText(['Read','Recall','Read + Recall','Handwrite']);
 const boxes=await choices.getByRole('button').evaluateAll(items=>items.map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width};}));
 expect(boxes.every(b=>b.w>=44)).toBe(true);expect(await choices.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('practice-skills.png')});
 await choices.getByRole('button',{name:'Handwrite',exact:true}).click();await expect(page.getByRole('link',{name:'Open handwriting',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Open handwriting',exact:true}).click();await expect(page).toHaveURL(/kana\/handwriting/);
});
