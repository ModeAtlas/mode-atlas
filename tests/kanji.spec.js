const {test,expect}=require('@playwright/test');
async function setup(page,native=false,width=1280,theme='light'){
  await page.setViewportSize({width,height:900});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','kanji');localStorage.setItem('modeAtlasThemePreference',theme);
  },{native,theme});
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

test('Kanji teaching uses kana/romaji, resumes lessons and does not award study XP for flipping cards',async({page})=>{
  await setup(page);await ready(page);await page.getByLabel('Set length').selectOption('5');
  await expect(page.getByRole('button',{name:'N4 Everyday, locked',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Start learning',exact:true}).click();
  await expect(page.locator('.ma-kanji-glyph')).toBeVisible();await page.getByRole('button',{name:'Show romaji',exact:true}).click();await expect(page.getByRole('button',{name:'Show kana',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();const char=await page.locator('.ma-kanji-glyph').textContent();await page.reload();await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(page.locator('.ma-kanji-glyph')).toHaveText(char);
  for(let i=0;i<4;i++)await page.getByRole('button',{name:i===3?'Finish set':'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'A few more familiar faces'})).toBeVisible();expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(0);
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
  await page.getByRole('link',{name:'Revisit mistakes',exact:true}).click();await expect(page.getByRole('button',{name:'Finish set',exact:true})).toBeVisible();
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
