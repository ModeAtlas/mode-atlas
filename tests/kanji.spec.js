const {test,expect}=require('@playwright/test');
// Each case owns its browser context, mocks and output paths; shard them independently.
test.describe.configure({mode:'parallel'});
async function setup(page,native=false,width=1280,theme='light',experienced=true){
  await page.setViewportSize({width,height:900});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme,experienced})=>{
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
test('guided Kanji teaching checks meaning and pronunciation, then resumes the same small set',async({page})=>{
  await setup(page,false,1280,'light',false);await ready(page);
  await expect(page.getByRole('button',{name:'N4 Everyday, locked',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Start learning',exact:true}).click();await expect(page.locator('.ma-kanji-glyph')).toHaveText('一');
  await page.getByRole('button',{name:'Show romaji',exact:true}).click();await expect(page.locator('.ma-kanji-focus-reading')).toHaveText('ichi');
  await finishLesson(page);await expect(page.locator('.ma-kanji-glyph')).toHaveText('二');await page.reload();await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(page.locator('.ma-kanji-glyph')).toHaveText('二');
  for(let i=0;i<4;i++)await finishLesson(page);
  await expect(page.getByRole('heading',{name:'Ready to remember'})).toBeVisible();expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(0);
  await page.getByRole('button',{name:'Back to Kanji',exact:true}).click();await page.getByRole('button',{name:'Start learning',exact:true}).click();await expect(page.locator('.ma-kanji-glyph')).toHaveText('月');
});

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
  await expect(page.locator('.ma-kanji-recap-score')).toHaveText('19 / 20 correct');await page.getByRole('link',{name:'View results',exact:true}).click();await expect(page.locator('.ma-kanji-result-stats')).toContainText('95.0%');await expect(page.locator('.ma-kanji-result-answers li')).toHaveCount(20);
  await page.screenshot({path:info.outputPath('kanji-results.png'),animations:'disabled'});
  await page.getByRole('link',{name:'Kana',exact:true}).click();await expect(page).toHaveURL(/\/results\/$/);await page.getByRole('link',{name:'Kanji',exact:true}).click();await expect(page.locator('.ma-kanji-result-stats')).toContainText('95.0%');
  await page.getByRole('link',{name:'Revisit mistakes',exact:true}).click();await expect(page.getByRole('button',{name:'Check meaning',exact:true})).toBeVisible();await finishLesson(page);await expect(page.getByRole('heading',{name:'Ready to remember'})).toBeVisible();
});

test('level gates and the Kanji mastery map use the same completion evidence',async({page})=>{
  await setup(page);await ready(page);
  await page.evaluate(()=>{const s=ModeAtlasKanjiState.read(),chars=[...ModeAtlasKanjiCurriculum[0].chars];for(const c of chars.slice(1))s.completions[c]=Date.now();ModeAtlasKanjiState.save(s);dispatchEvent(new Event('modeAtlasCloudDataChanged'));});
  await expect(page.getByRole('button',{name:'N4 Everyday, locked',exact:true})).toBeDisabled();
  await page.evaluate(()=>{const s=ModeAtlasKanjiState.read();s.completions[[...ModeAtlasKanjiCurriculum[0].chars][0]]=Date.now();ModeAtlasKanjiState.save(s);dispatchEvent(new Event('modeAtlasCloudDataChanged'));});
  await page.getByRole('button',{name:'N4 Everyday',exact:true}).click();await expect(page.locator('.ma-kanji-course-summary')).toContainText('169');
  await page.getByRole('button',{name:'Mastery Map',exact:true}).click();await expect(page.locator('.ma-kanji-mastery')).toBeVisible();await expect(page.getByRole('button',{name:'Kanji',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Kana',exact:true}).click();await expect(page.locator('.ma-kanji-mastery')).toHaveCount(0);
});

for(const [native,width,theme]of [[true,320,'light'],[true,393,'dark'],[true,768,'light'],[false,1280,'dark']])test(`Kanji layout ${native?'iOS':'web'} ${width} ${theme}`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await setup(page,native,width,theme);await ready(page);await expect(page.getByRole('button',{name:'Start learning',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('kanji-course.png'),animations:'disabled'});
  await page.getByRole('button',{name:'Start learning',exact:true}).click();await expect(page.locator('.ma-kanji-lesson')).toBeVisible();await page.screenshot({path:info.outputPath('kanji-lesson.png'),animations:'disabled'});
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('Meaning Match tests save results while keeping mastery evidence assisted',async({page})=>{
  await setup(page);await ready(page,'/kanji/?test=match');
  for(let i=0;i<20;i++){
    const answer=await page.evaluate(()=>{const s=ModeAtlasKanjiSession.current();return ModeAtlasKanjiContent.get(s.sequence[s.index]).meanings[0];});
    await page.locator('.ma-kanji-choices').getByRole('button',{name:answer,exact:true}).click();await page.getByRole('button',{name:i===19?'Finish set':'Continue',exact:true}).click();
  }
  expect(await page.evaluate(()=>ModeAtlasKanjiResults.read()[0].mode)).toBe('match');
  expect(await page.evaluate(()=>Object.values(ModeAtlasKanjiState.read().sources).flatMap(s=>Object.values(s)).every(row=>row.meaning[2]===0))).toBe(true);
  await page.getByRole('link',{name:'View results',exact:true}).click();await expect(page.getByRole('heading',{name:'N5 · Meaning Match'})).toBeVisible();
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

test('phone lessons fit above the dock, explain readings and route Japanese audio through iOS',async({page},info)=>{
  await setup(page,true,393,'dark',false);await page.setViewportSize({width:393,height:852});
  await page.addInitScript(()=>{window.__speech=[];Capacitor.Plugins.ModeAtlasNative={speakJapanese:async value=>{window.__speech.push(value);return {played:true};},stopSpeech:async()=>{}};});
  const device=await page.context().newCDPSession(page);await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});
  await ready(page,'/kanji/?learn=1');await expect(page.locator('.ma-kanji-glyph')).toHaveText('一');
  await page.getByRole('button',{name:'Listen: いち',exact:true}).click();expect(await page.evaluate(()=>window.__speech.at(-1))).toEqual({text:'いち',slow:false});
  const next=await page.getByRole('button',{name:'Check meaning',exact:true}).boundingBox(),dock=await page.locator('.ma-ios-tabs').boundingBox();expect(next.y+next.height).toBeLessThanOrEqual(dock.y-4);
  await page.getByRole('button',{name:'About readings',exact:true}).click();await expect(page.locator('.ma-dialog__message')).toContainText('native Japanese readings');await page.getByRole('button',{name:'Got it',exact:true}).click();
  await page.screenshot({path:info.outputPath('guided-phone-lesson.png'),animations:'disabled'});
  await page.getByRole('button',{name:'Write it',exact:true}).click();await expect(page.getByRole('dialog',{name:'Writing practice'})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('.ma-kanji-glyph')).toHaveText('一');
});

async function drawStroke(page,{reverse=false,touch=false}={}){
  const points=await page.locator('.ma-handwriting-board').evaluate(board=>{
    const p=board.querySelector('.ma-handwriting-guide.is-next'),box=board.getBoundingClientRect(),length=p.getTotalLength();
    return Array.from({length:24},(_,i)=>{const at=p.getPointAtLength(length*i/23);return {x:box.left+at.x*box.width/109,y:box.top+at.y*box.height/109};});
  });if(reverse)points.reverse();
  if(touch){const device=await page.context().newCDPSession(page);await device.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});for(const point of points.slice(1))await device.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});await device.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await device.detach();}
  else{await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const point of points.slice(1))await page.mouse.move(point.x,point.y);await page.mouse.up();}
}
test('handwriting guides stroke direction and supports mouse, touch, undo, reset and kana selection',async({page},info)=>{
  await setup(page,false,900,'light',false);await ready(page,'/kanji/?learn=1');await page.getByRole('button',{name:'Write it',exact:true}).click();
  await expect(page.locator('.ma-handwriting-board')).toBeVisible();await drawStroke(page,{reverse:true});await expect(page.locator('.ma-handwriting-status')).toContainText('Try that stroke again');
  await drawStroke(page);await expect(page.locator('.ma-handwriting-status')).toContainText('The stroke is practised');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.ma-handwriting-status')).toContainText('Stroke 1 of 1');
  await drawStroke(page,{touch:true});await expect(page.locator('.ma-handwriting-status')).toContainText('The stroke is practised');await page.getByRole('button',{name:'Clear',exact:true}).click();
  await page.screenshot({path:info.outputPath('kanji-writing.png'),animations:'disabled'});await page.keyboard.press('Escape');await expect(page.locator('.ma-handwriting')).toHaveCount(0);
  await page.goto('/kana/handwriting/');await expect(page.getByRole('heading',{name:'Handwriting',exact:true})).toBeVisible();await page.getByRole('button',{name:'Write あ (a)',exact:true}).click();await expect(page.locator('.ma-handwriting-status')).toContainText('Stroke 1 of 3');
  await page.getByRole('button',{name:'Next stroke',exact:true}).click();await expect(page.locator('.ma-handwriting-status')).toContainText('Showing stroke 1 of 3');await page.getByRole('button',{name:'Trace',exact:true}).click();await drawStroke(page);await expect(page.locator('.ma-handwriting-status')).toContainText('Stroke 2 of 3');
  await page.getByRole('button',{name:'Write',exact:true}).click();await expect(page.locator('.ma-handwriting-guide.is-hidden')).toHaveCount(3);await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Katakana',exact:true}).click();await expect(page.getByRole('button',{name:'Write ア (a)',exact:true})).toBeVisible();await page.getByLabel('Choose a row').selectOption('extended:a');await expect(page.getByRole('button',{name:/Write ウィ/})).toBeVisible();await page.getByLabel('Choose a row').selectOption('base:a');await page.getByRole('button',{name:'Write ア (a)',exact:true}).click();await expect(page.locator('.ma-handwriting-status')).toContainText('ア · Stroke 1');
  await page.screenshot({path:info.outputPath('kana-writing.png'),animations:'disabled'});
});

test('Learn shows three sibling learning branches and shared results outside them',async({page})=>{
  await setup(page);await page.goto('/learn/');const library=page.locator('.ma-learn-library');
  await expect(library.locator(':scope > section[data-branch]')).toHaveCount(3);await expect(library.locator(':scope > section[data-branch] h2')).toHaveText(['Kana','Kanji','Word Bank']);
  await expect(page.getByRole('link',{name:'Kana handwriting',exact:true})).toHaveAttribute('href','/kana/handwriting/');await expect(library.locator('section[data-branch] a[href="/results/"]')).toHaveCount(0);
});
