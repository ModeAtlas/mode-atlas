const {test,expect}=require('@playwright/test');
// Each case owns its browser context, mocks and output paths; shard them independently.
test.describe.configure({mode:'parallel'});
async function setup(page,native=false,width=1280,theme='light',experienced=true){
  await page.setViewportSize({width,height:900});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme,experienced})=>{
    localStorage.setItem('modeAtlasBranchToursSeen',JSON.stringify({kana:true,kanji:true,words:true}));
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','kanji');if(!localStorage.getItem('modeAtlasThemePreference'))localStorage.setItem('modeAtlasThemePreference',theme);
    if(experienced&&!localStorage.getItem('modeAtlasKanji')){const chars='一二三人日月木山川水火土大小上下中左左右男女父母子学生先本名年今半分何出入北南西東外多天安小少山川後手新日早時書月木本来東校毎気水火父生男白百聞行西見言話語読買足車週道金長間雨電食飲駅高魚';const dates=Object.fromEntries([...chars].map(c=>[c,Date.now()]));localStorage.setItem('modeAtlasKanji',JSON.stringify({lessons:dates,introductions:dates}));}
  },{native,theme,experienced});
}
async function ready(page,url='/kanji/'){
  await page.goto(url);await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect(page.locator('#maKanjiContent')).not.toHaveText('');
}
async function answer(page,correct=true){
  const value=await page.evaluate(()=>{const s=ModeAtlasKanjiSession.current(),c=ModeAtlasKanjiContent,e=c.get(s.sequence[s.index]);return s.mode==='pronunciation'?c.romaji(c.pronunciation(e).answers[0]):e.meanings[0];});
  await page.getByLabel(/Your (kana|English) answer/).fill(correct?value:'incorrect-answer');
  await page.getByRole('button',{name:'Check answer',exact:true}).click();
}

async function finishLesson(page){
  const answer=await page.evaluate(()=>{const s=ModeAtlasKanjiSession.current(),e=ModeAtlasKanjiContent.get(s.sequence[s.index]);return {meaning:e.meanings[0],reading:ModeAtlasKanjiTeaching.lesson(e).reading,last:s.index+1===s.sequence.length,roman:ModeAtlasKanjiState.read().settings.romaji};});
  await page.getByRole('button',{name:'Check meaning',exact:true}).click();await page.locator('.ma-kanji-choices').getByRole('button',{name:answer.meaning,exact:true}).click();
  await page.getByRole('button',{name:'Check reading',exact:true}).click();
  const label=answer.roman?await page.evaluate(k=>ModeAtlasKanjiContent.romaji(k),answer.reading):answer.reading;
  await page.locator('.ma-kanji-choices').getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:answer.last?'Finish set':'Next kanji',exact:true}).click();
}

test('typed recall, IME composition, hints, wrong answers and matching keep independent evidence accurate',async({page})=>{
  await setup(page);await ready(page,'/kanji/?char=水&mode=pronunciation');
  const input=page.getByLabel('Your kana answer');await input.fill('mizu');await input.dispatchEvent('compositionstart');await page.getByRole('button',{name:'Check answer',exact:true}).click();await expect(page.locator('.ma-kanji-feedback')).toHaveCount(0);await input.dispatchEvent('compositionend');await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(page.locator('.ma-kanji-feedback')).toHaveAttribute('data-result','correct');await page.getByRole('button',{name:'Finish set',exact:true}).click();
  await ready(page,'/kanji/?char=水&mode=meaning');await page.getByRole('button',{name:'Show answer',exact:true}).click();await answer(page);await page.getByRole('button',{name:'Finish set',exact:true}).click();
  expect(await page.evaluate(()=>ModeAtlasKanjiState.metrics(ModeAtlasKanjiState.read(),'水','meaning').independent)).toBe(0);
  await ready(page,'/kanji/?char=水&mode=match');await page.getByRole('button',{name:'water',exact:true}).click();await expect(page.locator('.ma-kanji-feedback')).toHaveAttribute('data-result','correct');await page.getByRole('button',{name:'Finish set',exact:true}).click();
  await ready(page,'/kanji/?char=水&mode=meaning');await answer(page,false);await expect(page.locator('.ma-kanji-feedback')).toHaveAttribute('data-result','incorrect');await page.getByRole('button',{name:'Finish set',exact:true}).click();
  expect(await page.evaluate(()=>ModeAtlasKanjiState.metrics(ModeAtlasKanjiState.read(),'水','meaning').wrong)).toBe(1);
});

test('formal Kanji tests persist separately and share Results navigation with Kana',async({page},info)=>{
  await setup(page);await ready(page,'/kanji/?test=meaning&level=5');await expect(page.getByRole('button',{name:'Show answer',exact:true})).toHaveCount(0);
  for(let i=0;i<20;i++){await answer(page,i!==3);await page.getByRole('button',{name:i===19?'Finish set':'Continue',exact:true}).click();}
  await require('./helpers/session-recap')(page);
  await expect(page.locator('.ma-kanji-recap-score')).toHaveText('19 / 20 correct');await page.getByRole('link',{name:'View results',exact:true}).click();await expect(page.locator('.ma-kanji-result-stats')).toContainText('95.0%');await expect(page.locator('.ma-kanji-result-answers li')).toHaveCount(20);
  await page.screenshot({path:info.outputPath('kanji-results.png'),animations:'disabled'});
  await page.getByRole('link',{name:'Kana',exact:true}).click();await expect(page).toHaveURL(/\/results\/$/);await page.getByRole('link',{name:'Kanji',exact:true}).click();await expect(page.locator('.ma-kanji-result-stats')).toContainText('95.0%');
  await page.getByRole('link',{name:'Revisit mistakes',exact:true}).click();await expect(page.getByRole('button',{name:'Check meaning',exact:true})).toBeVisible();await finishLesson(page);await expect(page.getByRole('heading',{name:'Set complete'})).toBeVisible();
});



test('Meaning Match tests save results while keeping mastery evidence assisted',async({page})=>{
  await setup(page);await ready(page,'/kanji/?test=match');
  for(let i=0;i<20;i++){
    const answer=await page.evaluate(()=>{const s=ModeAtlasKanjiSession.current();return ModeAtlasKanjiContent.get(s.sequence[s.index]).meanings[0];});
    await page.locator('.ma-kanji-choices').getByRole('button',{name:answer,exact:true}).click();await page.getByRole('button',{name:i===19?'Finish set':'Continue',exact:true}).click();
  }
  expect(await page.evaluate(()=>ModeAtlasKanjiResults.read()[0].mode)).toBe('match');
  expect(await page.evaluate(()=>Object.values(ModeAtlasKanjiState.read().sources).flatMap(s=>Object.values(s)).every(row=>row.meaning[2]===0))).toBe(true);
  // Earned levels must be acknowledged before interacting with the recap below.
  await require('./helpers/session-recap')(page);
  await page.getByRole('link',{name:'View results',exact:true}).click();await expect(page.getByRole('heading',{name:'Meaning Match · N5 content band'})).toBeVisible();
});

test('Kanji due reviews appear in Progress and open the correct skill session',async({page})=>{
  await setup(page);await ready(page,'/kanji/?char=水&mode=meaning');await answer(page);await page.getByRole('button',{name:'Finish set',exact:true}).click();
  await page.evaluate(()=>{const s=ModeAtlasKanjiState.read();for(const source of Object.values(s.sources))source['水'].meaning[6]=Date.now()-1000;ModeAtlasKanjiState.save(s);});
  await page.goto('/progress/');const review=page.getByRole('link',{name:'Kanji N5 · Meaning · 1 due',exact:true});await expect(review).toBeVisible();await review.click();await expect(page.locator('.ma-kanji-glyph')).toHaveText('水');await expect(page.getByLabel('Your English answer')).toBeVisible();
});

test('shared Results switch is readable, reachable and keeps the chosen theme on web and iOS',async({page})=>{
  await setup(page);
  for(const native of [false,true]){
    await page.addInitScript(native=>{if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};},native);
    await page.setViewportSize({width:native?393:1280,height:900});
    for(const theme of ['dark','light']){
      await page.goto('/results/kanji/');await expect(page.locator('#maLoadingScreen')).toBeHidden();await page.evaluate(theme=>ModeAtlasTheme.set(theme,{toast:false}),theme);
      const nav=page.getByRole('navigation',{name:'Results branch'});await expect(nav.getByRole('link')).toHaveText(['Kana','Kanji']);await expect(nav.getByRole('link',{name:'Kanji',exact:true})).toHaveAttribute('aria-current','page');
      for(const link of await nav.getByRole('link').all()){await expect(link).toBeVisible();expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);}
      const colours=await nav.getByRole('link',{name:'Kanji',exact:true}).evaluate(el=>{const s=getComputedStyle(el);return {text:s.color,background:s.backgroundColor};});expect(colours.text).not.toBe(colours.background);expect(colours.background).not.toBe('rgba(0, 0, 0, 0)');
      await nav.getByRole('link',{name:'Kana',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-ma-theme',theme);await expect(page.getByRole('navigation',{name:'Results branch'}).getByRole('link',{name:'Kana',exact:true})).toHaveAttribute('aria-current','page');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  }
});


async function drawStroke(page,{reverse=false,touch=false}={}){
  const points=await page.locator('.ma-handwriting-board').evaluate(board=>{
    const p=board.querySelector('.ma-handwriting-guide.is-next'),box=board.getBoundingClientRect(),length=p.getTotalLength();
    return Array.from({length:24},(_,i)=>{const at=p.getPointAtLength(length*i/23);return {x:box.left+at.x*box.width/109,y:box.top+at.y*box.height/109};});
  });if(reverse)points.reverse();
  if(touch){const device=await page.context().newCDPSession(page);await device.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});for(const point of points.slice(1))await device.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});await device.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await device.detach();}
  else{await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const point of points.slice(1))await page.mouse.move(point.x,point.y);await page.mouse.up();}
}
test('handwriting guides stroke direction and supports mouse, touch, undo, reset and kana selection',async({page,browserName},info)=>{
  test.skip(browserName==='webkit','This case uses Chromium CDP touch-drag injection; stroke matching is separately unit-tested.');
  await setup(page,false,900,'light',false);await ready(page);await page.getByRole('button',{name:'Start as a beginner',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Try writing',exact:true}).click();
  await expect(page.locator('.ma-handwriting-board')).toBeVisible();await drawStroke(page,{reverse:true});await expect(page.locator('.ma-handwriting-status')).toContainText('Try that stroke again');
  await drawStroke(page);await expect(page.locator('.ma-handwriting-status')).toContainText('Practice saved');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.ma-handwriting-status')).toContainText('Stroke 1 of 1');
  await drawStroke(page,{touch:true});await expect(page.locator('.ma-handwriting-status')).toContainText('The stroke is practised');await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.screenshot({path:info.outputPath('kanji-writing.png'),animations:'disabled'});await page.keyboard.press('Escape');await expect(page.locator('.ma-handwriting')).toHaveCount(0);
  await require('./helpers/kana-fixture')(page);
  await page.goto('/kana/handwriting/');await expect(page.getByRole('heading',{name:'Handwriting',exact:true})).toBeVisible();await page.getByRole('button',{name:'Write あ (a)',exact:true}).click();await expect(page.locator('.ma-handwriting-status')).toContainText('Stroke 1 of 3');
  await page.getByRole('button',{name:'Next stroke',exact:true}).click();await expect(page.locator('.ma-handwriting-status')).toContainText('Showing stroke 1 of 3');await page.getByRole('button',{name:'Trace',exact:true}).click();await drawStroke(page);await expect(page.locator('.ma-handwriting-status')).toContainText('Stroke 2 of 3');
  await page.getByRole('button',{name:'Write',exact:true}).click();await expect(page.locator('.ma-handwriting-guide.is-hidden')).toHaveCount(3);await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Katakana',exact:true}).click();await expect(page.getByRole('button',{name:'Write ア (a)',exact:true})).toBeVisible();await page.getByLabel('Choose a row').selectOption('katakana:extended:a');await expect(page.getByRole('button',{name:/Write ウィ/})).toBeVisible();await page.getByLabel('Choose a row').selectOption('katakana:base:a');await page.getByRole('button',{name:'Write ア (a)',exact:true}).click();await expect(page.locator('.ma-handwriting-status')).toContainText('ア · Stroke 1');
  await page.screenshot({path:info.outputPath('kana-writing.png'),animations:'disabled'});
});

test('Learn shows three sibling learning branches and shared results outside them',async({page})=>{
  await setup(page);await page.goto('/learn/');const library=page.locator('.ma-branch-library');
  await expect(library.locator(':scope > a[data-branch]')).toHaveCount(3);await expect(library.locator(':scope > a[data-branch] .ma-branch-tile__title')).toHaveText(['Kana','Kanji','Words']);
  await expect(page.getByRole('link',{name:'Open Kana',exact:true})).toHaveAttribute('href','/kana/');await expect(library.locator('a[data-branch][href="/results/"]')).toHaveCount(0);
});

test('Kanji recap celebrates a level gain and lists only the ranks earned in this session',async({page})=>{
  await setup(page,true,393,'dark');await ready(page);
  await page.evaluate(()=>{ModeAtlasProgress.debugAdjustXP(99);ModeAtlasKanjiState.save({...ModeAtlasKanjiState.read(),sources:{fixture:{'水':{meaning:[9,0,9,9,9000,Date.now(),Date.now(),0,'2026-10-20']}}}});});
  await ready(page,'/kanji/?char=水&mode=meaning');
  await answer(page);await page.getByRole('button',{name:'Finish set',exact:true}).click();
  await expect(page.locator('.ma-level-up-card')).toBeVisible();await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.locator('.ma-session-achievements')).toContainText('Meaning maker');
  await expect(page.locator('.ma-session-achievements')).not.toContainText('First impressions');
  await page.getByRole('button',{name:'Back to Kanji',exact:true}).click();await expect(page.locator('.ma-level-up-card')).toHaveCount(0);
});

test('Kanji starting-point check grants access without XP or fabricated mastery',async({page})=>{
  await setup(page,false,393,'light',false);await ready(page);await page.getByRole('button',{name:'Check my starting point',exact:true}).click();
  for(let i=0;i<8;i++){
    const item=await page.evaluate(()=>{const q=ModeAtlasKanjiPlacement.question(ModeAtlasKanjiPlacement.read()),c=ModeAtlasKanjiContent;return {skill:q.skill,answer:q.skill==='meaning'?c.get(q.char).meanings[0]:c.romaji(c.pronunciation(c.get(q.char)).answers[0])};});
    await page.getByLabel(item.skill==='meaning'?'English meaning':'Kana or romaji answer',{exact:true}).fill(item.answer);await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  }
  await expect(page.locator('#maKanjiContent .ma-kicker')).toContainText('N4');await page.getByRole('button',{name:'Finish here',exact:true}).click();
  await page.getByRole('button',{name:'Character library',exact:true}).click();await page.getByLabel('Study band').selectOption('4');await expect(page.getByLabel('Find a character or meaning')).toBeVisible();expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(0);expect(await page.evaluate(()=>ModeAtlasKanjiState.summary().every(b=>b.mastered===0))).toBe(true);
});





const firstUnit={一:{meaning:'one',reading:'ichi'},二:{meaning:'two',reading:'ni'},三:{meaning:'three',reading:'san'}};
async function beginCourse(page){await ready(page);await page.getByRole('button',{name:'Start as a beginner',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();}
// Answers come from this human-readable first-unit fixture and the rendered
// task. This journey never calls answer handlers or seeds completion records.
async function finishVisibleUnit(page,{wrongOnce=false,onPrompt}={}){
  let wrong=false,turns=0;
  while(!await page.locator('.ma-kanji-recap').isVisible()){
    if(++turns>100)throw Error('visible course did not finish');
    if(await page.locator('.ma-kanji-course-teaching').isVisible()){await page.getByRole('button',{name:'Continue',exact:true}).click();continue;}
    const glyph=(await page.locator('.ma-course-body .ma-kanji-glyph').textContent()).trim(),item=firstUnit[glyph];expect(item,`unexpected first-unit character ${glyph}`).toBeTruthy();
    if(await page.locator('.ma-kanji-feedback').isVisible()){await page.getByRole('button',{name:/^(Continue|Finish unit)$/}).click();continue;}
    const title=await page.locator('.ma-course-body h2').textContent();await onPrompt?.({glyph,title});
    if(await page.locator('.ma-kanji-choices').isVisible())await page.locator('.ma-kanji-choices').getByRole('button',{name:item.meaning,exact:true}).click();
    else{const value=wrongOnce&&!wrong?'not-the-answer':title==='Read this word'?item.reading:item.meaning;wrong=wrong||value==='not-the-answer';await page.getByLabel(/Your (kana|English) answer/).fill(value);await page.getByRole('button',{name:'Check answer',exact:true}).click();}
  }
}

test('a beginner completes a real unit, a separate check, and resumes the next unit without choosing modes',async({page})=>{
  await setup(page,false,393,'light',false);await beginCourse(page);await finishVisibleUnit(page);
  await expect(page.getByRole('heading',{name:'Unit introduced',exact:true})).toBeVisible();await page.getByRole('button',{name:'Check this unit',exact:true}).click();await finishVisibleUnit(page);
  await expect(page.getByRole('heading',{name:'Unit check passed',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>ModeAtlasKanjiState.courseStatus(ModeAtlasKanjiCourse.get('first-numbers')))).toMatchObject({introduced:true,checked:true,retained:false});
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'People and size',exact:true})).toBeVisible();await expect(page.locator('.ma-kanji-shape .ma-kanji-glyph')).toHaveText('人');
  await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.ma-kanji-shape .ma-kanji-glyph')).toHaveText('大');
  await page.getByRole('button',{name:'Save & exit',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(page.locator('.ma-kanji-shape .ma-kanji-glyph')).toHaveText('大');
});

test('a wrong answer returns after other items and a corrected retry cannot pass a unit check',async({page})=>{
  await setup(page,false,1280,'light',false);await beginCourse(page);await finishVisibleUnit(page);await page.getByRole('button',{name:'Check this unit',exact:true}).click();
  const prompts=[];await finishVisibleUnit(page,{wrongOnce:true,onPrompt:prompt=>prompts.push(prompt)});
  const first=prompts[0],same=prompts.findIndex((p,i)=>i>0&&p.glyph===first.glyph&&p.title===first.title);expect(same).toBeGreaterThanOrEqual(3);expect(prompts.slice(1,same).some(p=>p.glyph!==first.glyph)).toBe(true);
  await expect(page.getByRole('heading',{name:'Keep practising this unit',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Practise missed items',exact:true})).toBeVisible();
  const evidence=await page.evaluate(()=>ModeAtlasKanjiSession.current().answers);expect(evidence.find(a=>!a.correct)).toMatchObject({first:true,assisted:false});expect(evidence.find(a=>a.correct&&!a.first)).toMatchObject({assisted:true});
});

test('later-day review follows a real completed check and remains separate from same-day completion',async({page})=>{
  await setup(page,false,1280,'light',false);await beginCourse(page);await finishVisibleUnit(page);await page.getByRole('button',{name:'Check this unit',exact:true}).click();await finishVisibleUnit(page);
  await page.getByRole('button',{name:'Back to Kanji',exact:true}).click();await page.clock.setFixedTime(new Date(Date.now()+25*60*60*1000));await page.reload();
  await expect(page.locator('.ma-kanji-current')).toContainText('Bring this unit back from memory.');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.ma-course-heading')).toContainText('Delayed review');await expect(page.locator('.ma-kanji-course-teaching')).toHaveCount(0);await finishVisibleUnit(page);
  await expect(page.getByRole('heading',{name:'Review complete',exact:true})).toBeVisible();expect(await page.evaluate(()=>ModeAtlasKanjiState.courseStatus(ModeAtlasKanjiCourse.get('first-numbers')).retained)).toBe(true);
});

test('path and character details open in place with matching browser and explicit Back navigation',async({page})=>{
  await setup(page,false,393,'light',false);await ready(page);await page.getByRole('button',{name:'Start as a beginner',exact:true}).click();
  await page.getByRole('button',{name:'Learning path',exact:true}).click();await expect(page).toHaveURL(/view=path/);await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.ma-kanji-unit-list').getByRole('button',{name:/One, two, three/}).click();await expect(page.getByRole('heading',{name:'One, two, three',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'一',exact:true}).click();await expect(page.getByRole('heading',{name:'一 · Character library',exact:true})).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'One, two, three',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to path',exact:true}).click();await expect(page.getByRole('heading',{name:'Your Kanji path',exact:true})).toBeVisible();await page.goBack();await expect(page.locator('.ma-kanji-current')).toBeVisible();
});

test('reading answers and audio remain hidden until submitted while character and word meaning stay distinct',async({page})=>{
  await setup(page,false,1280,'light',false);await beginCourse(page);await finishVisibleUnit(page);await page.getByRole('button',{name:'Check this unit',exact:true}).click();
  for(let i=0;i<3;i++){const char=(await page.locator('.ma-course-body .ma-kanji-glyph').textContent()).trim();await page.getByLabel('Your English answer').fill(firstUnit[char].meaning);await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();}
  await expect(page.getByRole('heading',{name:'Read this word',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Listen:/})).toHaveCount(0);await expect(page.getByRole('button',{name:'Show answer',exact:true})).toHaveCount(0);await expect(page.locator('.ma-kanji-focus-reading')).toHaveCount(0);
  const char=(await page.locator('.ma-course-body .ma-kanji-glyph').textContent()).trim();await page.getByLabel('Your kana answer').fill(firstUnit[char].reading);await page.getByRole('button',{name:'Check answer',exact:true}).click();await expect(page.getByRole('button',{name:/^Listen:/})).toBeVisible();
});

for(const [width,height,theme]of [[320,740,'light'],[393,852,'dark'],[768,1024,'light'],[960,440,'dark'],[1280,720,'light']])test(`focused Kanji course uses ${width}×${height} with a visible primary action`,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page,true,width,theme,false);await page.setViewportSize({width,height});await ready(page);await page.getByRole('button',{name:'Start as a beginner',exact:true}).click();
  const primary=page.locator('.ma-kanji-current > .ma-button--primary');await expect(primary).toBeInViewport();await expect(page.locator('.ma-kanji-current-art')).toBeVisible();await expect(page.locator('.ma-kanji-mode,.ma-kanji-tests')).toHaveCount(0);await page.screenshot({path:info.outputPath('kanji-overview.png'),animations:'disabled'});
  await primary.click();await expect(page.locator('.ma-course-exit')).toHaveCount(1);await expect(page.locator('.ma-kanji-header')).toBeHidden();await expect(page.locator('.ma-course-actions > .ma-button--primary')).toBeInViewport();
  await page.screenshot({path:info.outputPath('kanji-focused-lesson.png'),animations:'disabled'});await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.setViewportSize({width:height,height:width});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});

for(const scale of [1,1.5])test(`Kanji closed native geometry keeps the first lesson action visible at ${scale}x`,async({page},info)=>{
  const geometry={width:432,height:640,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:358,y:60,width:52,height:100}]};
  await require('./helpers/native-geometry').prepare(page,geometry,'dark',false);
  await page.addInitScript(scale=>document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.setProperty('--ma-ios-text-scale',String(scale));document.documentElement.toggleAttribute('data-ma-large-text',scale>1);}),scale);
  await beginCourse(page);
  const shape=await page.locator('.ma-kanji-shape-heading .ma-kanji-glyph').boundingBox(),meaning=await page.locator('.ma-kanji-shape-heading h2').boundingBox();expect(shape.x+shape.width).toBeLessThanOrEqual(meaning.x);
  const action=page.locator('.ma-course-actions>.ma-button--primary');await expect(action).toBeInViewport({ratio:1});expect((await action.boundingBox()).y+(await action.boundingBox()).height).toBeLessThanOrEqual(605);
  await page.screenshot({path:info.outputPath('kanji-closed.png'),animations:'disabled'});
  for(let i=0;i<12&&!await page.getByLabel('Your English answer').count();i++){
    if(await page.locator('.ma-kanji-course-teaching').count()||await page.locator('.ma-kanji-feedback').count())await page.getByRole('button',{name:'Continue',exact:true}).click();
    else{const glyph=(await page.locator('.ma-course-body .ma-kanji-glyph').textContent()).trim();await page.locator('.ma-kanji-choices').getByRole('button',{name:firstUnit[glyph].meaning,exact:true}).click();}
  }
  await expect(page.getByLabel('Your English answer')).toBeInViewport({ratio:1});await expect(page.locator('.ma-course-exit')).toBeInViewport({ratio:1});
  const submit=page.locator('.ma-course-actions').getByRole('button',{name:'Check answer',exact:true});await expect(submit).toBeInViewport({ratio:1});
  expect(await submit.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})).toBe(true);
  await page.screenshot({path:info.outputPath('kanji-closed-retrieval.png'),animations:'disabled'});
});

test('guided Kanji plays the taught word through native Japanese audio',async({page})=>{
  await setup(page,true,393,'dark',false);await page.addInitScript(()=>{window.__speech=[];Capacitor.Plugins.ModeAtlasNative={speakJapanese:async value=>{window.__speech.push(value);return {played:true};},stopSpeech:async()=>{}};});
  await beginCourse(page);await page.getByRole('button',{name:'Listen: いち',exact:true}).click();expect(await page.evaluate(()=>window.__speech.at(-1))).toEqual({text:'いち',slow:false});
});

test('experienced library retains every advanced character without calling it learned',async({page})=>{
  await setup(page,false,1280,'light',false);await ready(page);await page.getByRole('button',{name:'I’m confident in Kanji',exact:true}).click();await page.getByRole('button',{name:'Open library',exact:true}).click();
  await page.getByLabel('Study band').selectOption('1');await expect(page.locator('.ma-kanji-library-grid > button')).toHaveCount(120);await page.getByRole('button',{name:'Show more characters',exact:true}).click();await expect(page.locator('.ma-kanji-library-grid > button')).toHaveCount(240);
  await page.getByLabel('Find a character or meaning').fill('𠮟');await expect(page.locator('.ma-kanji-library-grid > button')).toHaveCount(1);await page.getByRole('button',{name:'𠮟',exact:true}).click();await expect(page.getByRole('heading',{name:'𠮟 · Character library',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>Object.keys(ModeAtlasKanjiState.read().introductions).length)).toBe(0);
  await page.getByRole('button',{name:'Back to library',exact:true}).click();await expect(page.getByLabel('Find a character or meaning')).toHaveValue('𠮟');await expect(page.locator('.ma-kanji-library-grid > button')).toHaveCount(1);
});
