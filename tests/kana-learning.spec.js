const {test,expect}=require('@playwright/test');
async function setup(page,{native=false,theme='dark'}={}){
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasThemePreference',theme);localStorage.setItem('modeAtlasSound','off');localStorage.setItem('maWhatsNewSeen','kana-learning');
  },{native,theme});
}
async function open(page,url='/kana/') {await page.goto(url);await expect(page.locator('#maLoadingScreen')).toBeHidden();}
test('fresh entry offers placement or beginner, with one path and independently locked rows',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await open(page);
  await expect(page.getByRole('button',{name:/Take a starting-point test/})).toBeVisible();await page.getByRole('button',{name:/Start as a beginner/}).click();
  await expect(page.getByRole('heading',{name:'Your Kana journey'})).toBeVisible();
  await expect(page.locator('#maKanaLearning select')).toHaveCount(0);
  await page.getByRole('button',{name:'Explore your path',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your learning path'})).toBeVisible();
  await expect(page.locator('.ma-kana-path-row[data-locked="false"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Katakana',exact:true}).click();await expect(page.locator('.ma-kana-next-chars')).toHaveText('ア イ ウ エ オ');
  await page.getByRole('button',{name:'Recall',exact:true}).click();await expect(page.locator('.ma-kana-path-row[data-locked="false"]')).toHaveCount(1);
  await page.getByRole('navigation',{name:'Kana sections'}).getByRole('link',{name:'Tests',exact:true}).click();await expect(page.getByText(/Unlock every basic row/)).toHaveCount(2);
  expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(0);expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath('kana-course.png')});
});
test('placement resumes after reload, stops each direction at a gap, and saves no XP',async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:/Take a starting-point test/}).click();await page.getByRole('button',{name:'Begin check',exact:true}).click();
  for(let i=0;i<2;i++){const answer=await page.evaluate(()=>ModeAtlasKanaPlacement.question(ModeAtlasKanaPlacement.read()).roman);await page.getByLabel('Reading answer').fill(answer);await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();}
  await page.reload();await page.getByRole('button',{name:'Check my starting point',exact:true}).click();await expect(page.locator('.ma-kana-page-heading')).toContainText('Ka row');
  await page.getByRole('button',{name:'I don’t know yet',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.ma-kana-page-heading')).toContainText('Recall');
  await page.getByRole('button',{name:'I don’t know yet',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your learning path is ready'})).toBeVisible();
  const result=await page.evaluate(()=>({xp:ModeAtlasProgress.getXP(),read:ModeAtlasKanaLearning.path('hiragana','reading')[1].unlocked,recall:ModeAtlasKanaLearning.path('hiragana','writing')[1].unlocked}));expect(result).toEqual({xp:0,read:true,recall:false});
});
for(const skill of ['reading','writing'])test(`${skill} shared setup preserves feedback choices and counts real practice toward the row`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await open(page);await page.getByRole('button',{name:/Start as a beginner/}).click();
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
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page,{native,theme});await page.setViewportSize({width:native?320:1280,height:native?740:900});await open(page);await page.getByRole('button',{name:/Start as a beginner/}).click();
  await expect(page.getByRole('button',{name:'Continue learning',exact:true})).toBeInViewport();
  expect(await page.locator('.ma-kana-navigation a').evaluateAll(links=>links.every(link=>link.scrollWidth<=link.clientWidth+1))).toBe(true);
  await page.screenshot({path:info.outputPath(`kana-path-${native}.png`)});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Continue learning',exact:true}).click();await expect(page.locator('.ma-kana-lesson-shape')).toHaveText('あ');await page.getByRole('button',{name:'Next character',exact:true}).click();await expect(page.locator('.ma-kana-lesson-shape')).toHaveText('い');
  await page.screenshot({path:info.outputPath(`kana-lesson-${native}.png`)});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});

test('handwriting awards a clean independent completion, while watching strokes awards nothing',async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:/Start as a beginner/}).click();await open(page,'/kana/handwriting/?kana=あ');
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
  await setup(page);await open(page);await page.getByRole('button',{name:/Start as a beginner/}).click();
  // Old settings can contain rows unavailable to this account or this skill.
  await page.evaluate(skill=>ModeAtlasStorage.writeModeJSON(skill,'settings',{kanaRows:['hiragana:base:a','hiragana:yoon:ka'],kanaSelection:true,practiceCount:20,feedbackStyle:'learn'}),skill);
  await open(page,`/${skill}/?practice=20&kana=い,きゃ`);
  await expect(page.locator('#heatmap .cell')).toHaveText(['い']);
  await page.locator('#startBtn').click();await expect(page.locator('#heatmap .cell')).toHaveText(['い']);
  const pool=await page.evaluate(()=>getEligiblePool());expect(pool).toEqual(['い']);
});

test('accuracy recomputes account eligibility and clears pending targets on account change',async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:/Start as a beginner/}).click();
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

test('practice starts simple and the optional sheet retains row, feedback and timing choices',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await setup(page,{native:true});await page.setViewportSize({width:393,height:852});await open(page);await page.getByRole('button',{name:/Start as a beginner/}).click();
  await page.getByRole('navigation',{name:'Kana sections'}).getByRole('link',{name:'Practise',exact:true}).click();
  await expect(page.locator('#maKanaLearning select')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Open session',exact:true})).toBeInViewport();
  await page.screenshot({path:info.outputPath('practice-ios-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'Recall',exact:true}).click();await expect(page.locator('.ma-kana-skill-explanation')).toContainText('choose or type あ');
  await page.getByRole('button',{name:'Adjust this session',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('Session length',{exact:true}).selectOption('10');await dialog.getByLabel('Feedback',{exact:true}).selectOption('quick');
  await dialog.locator('.ma-kana-row-picker summary').click();
  await dialog.getByRole('checkbox',{name:'hiragana Basics A row',exact:true}).uncheck();
  await dialog.getByRole('checkbox',{name:'katakana Basics A row',exact:true}).check();
  await expect(dialog.getByRole('checkbox',{name:'hiragana Basics Ka row',exact:true})).toBeDisabled();
  await dialog.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.locator('.ma-kana-session')).toContainText('10 questions');await expect(page.locator('.ma-kana-session')).toContainText('Katakana');
  await page.getByRole('button',{name:'Open session',exact:true}).click();await expect(page).toHaveURL(/\/writing\//);
  await expect(page.locator('#heatmap .cell')).toHaveText(['ア','イ','ウ','エ','オ']);
  const settings=await page.evaluate(()=>ModeAtlasTrainerControls.getSettings());expect(settings.practiceCount).toBe(10);expect(settings.feedbackStyle).toBe('quick');
  await open(page,'/kana/?view=practice');await page.getByRole('button',{name:/Timed challenge Build speed/}).click();
  await page.getByRole('button',{name:'Adjust this session',exact:true}).click();
  await dialog.getByLabel('Timed goal',{exact:true}).selectOption('target');await dialog.getByLabel('Minutes',{exact:true}).fill('2');await dialog.getByLabel('Minutes',{exact:true}).press('Tab');await dialog.getByLabel('Correct-answer target',{exact:true}).fill('30');await dialog.getByLabel('Correct-answer target',{exact:true}).press('Tab');
  await dialog.getByRole('button',{name:'Done',exact:true}).click();await expect(page.locator('.ma-kana-session')).toContainText('30 correct answers in 2 minutes');
  await page.getByRole('button',{name:'Open session',exact:true}).click();await expect(page.locator('#maLoadingScreen')).toBeHidden();await expect(page.locator('#trialConfig')).toBeVisible();expect(await page.evaluate(()=>ModeAtlasTrainerControls.getSettings().timeTrial)).toBe(true);expect(errors).toEqual([]);
});
