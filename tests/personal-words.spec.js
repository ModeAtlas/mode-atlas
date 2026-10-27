const {test,expect}=require('@playwright/test');
const {prepare,settle,inner}=require('./helpers/native-geometry');
const short={width:640,height:432,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:20,left:0},occlusions:[]};
const cat={id:'personal-cat',written:'猫',reading:'ねこ',english:'cat',notes:'My own vocabulary'};
const selectedWords=[cat,{id:'personal-dog',written:'犬',reading:'いぬ',english:'dog'},
  {id:'personal-water',written:'水',reading:'みず',english:'water'},
  {id:'personal-book',written:'本',reading:'ほん',english:'book'},
  {id:'personal-rain',written:'雨',reading:'あめ',english:'rain'},
  {id:'personal-house',written:'家',reading:'いえ',english:'house'}];
async function setup(page,geometry,theme,words=[cat]){
  await prepare(page,geometry,theme,false);
  await page.addInitScript(words=>{
    localStorage.setItem('modeAtlasBranchToursSeen',JSON.stringify({kana:true,kanji:true,words:true}));
    // Seed saved content only. The test performs teaching and every answer itself.
    if(!localStorage.getItem('personalFixtureSet')){localStorage.setItem('kanaWordBank',JSON.stringify(words));localStorage.setItem('personalFixtureSet','true');}
    if(Capacitor?.Plugins?.ModeAtlasNative)Capacitor.Plugins.ModeAtlasNative.speakJapanese=async()=>({played:false});
  },words);
  await page.goto('/wordbank/?view=bank');await settle(page);await page.evaluate(()=>ModeAtlas.markWhatsNewSeen());
}
for(const [label,geometry,theme]of [['short',short,'dark'],['wide',inner,'light']])test(`personal words teach, resume feedback and return to their collection: ${label}`,async({page},info)=>{
  await setup(page,geometry,theme);
  await page.getByRole('button',{name:'Learn these words',exact:true}).click();
  const focus=page.locator('#maWordsFocus');await expect(focus.getByRole('heading',{name:'Meet this word'})).toBeVisible();
  await expect(page.locator('#wordBankAddJumpBtn')).toBeHidden();await expect(focus).toContainText('cat');
  await page.screenshot({path:info.outputPath('personal-teaching-'+label+'.png'),animations:'disabled'});
  await focus.getByRole('button',{name:'Ready to remember',exact:true}).click();await expect(focus.getByRole('heading',{name:'Read the word',exact:true})).toBeVisible();
  await page.reload();await settle(page);await expect(focus.getByRole('heading',{name:'Read the word',exact:true})).toBeVisible();
  await expect(focus.getByLabel('Your answer (kana or romaji)')).toHaveValue('');
  await focus.getByLabel('Your answer (kana or romaji)').fill('neko');await focus.getByRole('button',{name:'Check reading',exact:true}).click();
  await expect(focus.getByRole('button',{name:'Continue',exact:true})).toBeVisible();
  await page.reload();await settle(page);await expect(focus.getByRole('button',{name:'Continue',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>ModeAtlasWordBank.read()[0].readingReview.events.length)).toBe(1);
  await focus.getByRole('button',{name:'Continue',exact:true}).click();await expect(focus.getByRole('heading',{name:'Recall the meaning',exact:true})).toBeVisible();
  await expect(focus).not.toContainText('cat');await focus.getByRole('button',{name:'Reveal',exact:true}).click();await expect(focus).toContainText('cat');
  await focus.getByRole('button',{name:'Remembered',exact:true}).click();await focus.getByRole('button',{name:'Continue',exact:true}).click();await expect(focus.getByRole('heading',{name:'Set complete',exact:true})).toBeVisible();
  await expect(focus).toContainText('2 / 2 first attempts');
  const saved=await page.evaluate(()=>ModeAtlasWordBank.read()[0]);expect(saved.review.events.length).toBe(1);expect(saved.readingReview.level).toBe(0);expect(saved.listeningReview.events).toEqual([]);
  expect(await focus.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('personal-complete-'+label+'.png'),animations:'disabled'});
  await focus.getByRole('button',{name:'Back to Word Bank',exact:true}).click();await expect(page.locator('#wordBankLearnBtn')).toBeVisible();await expect(page).toHaveURL(/view=bank/);
});

test('personal incomplete content can be kept and completed without an unanswerable lesson',async({page})=>{
  await setup(page,inner,'light',[{id:'incomplete',written:'猫'}]);await page.getByRole('button',{name:'Learn these words',exact:true}).click();
  const focus=page.locator('#maWordsFocus');await expect(focus).toContainText('Add a kana reading or a meaning');await expect(focus.locator('input')).toHaveCount(0);
  await focus.getByRole('button',{name:'Back to Word Bank',exact:true}).click();expect(await page.evaluate(()=>ModeAtlasWordBank.read().length)).toBe(1);
});

test('skipping unavailable personal-word audio creates no listening evidence',async({page})=>{
  await setup(page,inner,'dark');await page.getByRole('button',{name:'Review words',exact:true}).click();const focus=page.locator('#maWordsFocus');
  await focus.getByLabel('Your answer (kana or romaji)').fill('neko');await focus.getByRole('button',{name:'Check reading',exact:true}).click();await focus.getByRole('button',{name:'Continue',exact:true}).click();
  await focus.getByRole('button',{name:'Reveal',exact:true}).click();await focus.getByRole('button',{name:'Remembered',exact:true}).click();await focus.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(focus.getByRole('heading',{name:'Listen and type',exact:true})).toBeVisible();await expect(focus.getByRole('button',{name:'Check reading',exact:true})).toBeDisabled();
  await expect(focus.getByRole('button',{name:'Listen',exact:true})).toBeVisible();await expect(focus.getByRole('button',{name:'Slower',exact:true})).toBeVisible();
  const accessible=await focus.evaluate(node=>[node.textContent,...[...node.querySelectorAll('[aria-label],[title],[alt]')].flatMap(element=>['aria-label','title','alt'].map(name=>element.getAttribute(name)||''))].join(' '));
  expect(accessible).not.toMatch(/ねこ|neko|猫|\bcat\b/i);
  await focus.getByRole('button',{name:'Skip listening',exact:true}).click();await expect(focus.getByRole('heading',{name:'Set complete',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>ModeAtlasWordBank.read()[0].listeningReview.events)).toEqual([]);
});

test('Learn selected teaches only the chosen personal entry',async({page})=>{
  await setup(page,inner,'light',selectedWords.slice(0,2));
  await page.getByRole('checkbox',{name:'Select 猫',exact:true}).check();
  await page.getByRole('button',{name:'Learn 1 selected',exact:true}).click();
  const focus=page.locator('#maWordsFocus');await expect(focus.getByRole('heading',{name:'Meet this word',exact:true})).toBeVisible();
  await expect(focus).toContainText('cat');await expect(focus).not.toContainText('dog');
  const course=await page.evaluate(()=>ModeAtlasWordLessonState.read()['wordbank-course'].course);
  expect(course.selectionIds).toEqual(['personal-cat']);expect(course.wordIds).toEqual(['personal-cat']);
  await page.reload();await settle(page);await expect(focus).toContainText('cat');await expect(focus).not.toContainText('dog');
});

test('Learn all preserves a six-word selection through reload and the next batch',async({page})=>{
  test.setTimeout(60_000);await setup(page,short,'dark',selectedWords);
  await page.getByRole('button',{name:'Learn these words',exact:true}).click();const focus=page.locator('#maWordsFocus');
  const original=await page.evaluate(()=>ModeAtlasWordLessonState.read()['wordbank-course'].course);
  expect(original.selectionIds).toHaveLength(6);expect(original.wordIds).toHaveLength(5);
  for(let i=0;i<2;i++)await focus.getByRole('button',{name:'Ready to remember',exact:true}).click();
  await page.reload();await settle(page);
  expect(await page.evaluate(()=>ModeAtlasWordLessonState.read()['wordbank-course'].course.selectionIds)).toEqual(original.selectionIds);
  for(let i=2;i<5;i++)await focus.getByRole('button',{name:'Ready to remember',exact:true}).click();
  for(let i=0;i<5;i++){
    await expect(focus.getByRole('heading',{name:'Read the word',exact:true})).toBeVisible();
    const prompt=await focus.locator('.ma-vocabulary-glyph').innerText(),word=selectedWords.find(word=>word.written===prompt);
    expect(word).toBeTruthy();await focus.getByLabel('Your answer (kana or romaji)').fill(word.reading);
    await focus.getByRole('button',{name:'Check reading',exact:true}).click();await focus.getByRole('button',{name:'Continue',exact:true}).click();
  }
  for(let i=0;i<5;i++){
    await expect(focus.getByRole('heading',{name:'Recall the meaning',exact:true})).toBeVisible();
    await focus.getByRole('button',{name:'Reveal',exact:true}).click();await focus.getByRole('button',{name:'Remembered',exact:true}).click();await focus.getByRole('button',{name:'Continue',exact:true}).click();
  }
  await expect(focus.getByRole('heading',{name:'Set complete',exact:true})).toBeVisible();await expect(focus).toContainText('1 word left in this selection.');
  await page.reload();await settle(page);await expect(focus.getByRole('button',{name:'Continue learning',exact:true})).toBeVisible();
  await focus.getByRole('button',{name:'Continue learning',exact:true}).click();await expect(focus.getByRole('heading',{name:'Meet this word',exact:true})).toBeVisible();
  const next=await page.evaluate(()=>ModeAtlasWordLessonState.read()['wordbank-course'].course);
  expect(next.selectionIds).toEqual(original.selectionIds);expect(next.wordIds).toEqual(original.selectionIds.filter(id=>!original.wordIds.includes(id)));expect(next.wordIds).toHaveLength(1);
  await focus.getByRole('button',{name:'Ready to remember',exact:true}).click();
  const word=selectedWords.find(word=>word.id===next.wordIds[0]);await focus.getByLabel('Your answer (kana or romaji)').fill(word.reading);await focus.getByRole('button',{name:'Check reading',exact:true}).click();await focus.getByRole('button',{name:'Continue',exact:true}).click();
  await focus.getByRole('button',{name:'Reveal',exact:true}).click();await focus.getByRole('button',{name:'Remembered',exact:true}).click();await focus.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(focus.getByRole('heading',{name:'Set complete',exact:true})).toBeVisible();await expect(focus.getByRole('button',{name:'Continue learning',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>ModeAtlasWordBank.untaught().length)).toBe(0);
});

test('editing the current word resumes current content from Home without losing an independent answer',async({page})=>{
  await setup(page,inner,'light');await page.getByRole('button',{name:'Learn these words',exact:true}).click();const focus=page.locator('#maWordsFocus');
  await focus.getByRole('button',{name:'Ready to remember',exact:true}).click();await focus.getByLabel('Your answer (kana or romaji)').fill('neko');
  await focus.getByRole('button',{name:'Check reading',exact:true}).click();await focus.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(focus.getByRole('heading',{name:'Recall the meaning',exact:true})).toBeVisible();await focus.getByRole('button',{name:'Save & exit',exact:true}).click();
  const card=page.locator('.wordbank-entry[data-id="personal-cat"]');await card.locator('summary').click();await card.getByLabel('English',{exact:true}).fill('feline');await card.getByRole('button',{name:'Save changes',exact:true}).click();
  await page.goto('/');await settle(page);await expect(page.locator('#homeContinueAction')).toHaveAttribute('href',/session=bank/);await page.locator('#homeContinueAction').click();await settle(page);
  await expect(focus.getByRole('heading',{name:'Meet this word',exact:true})).toBeVisible();await expect(focus).toContainText('feline');await expect(focus).not.toContainText('This entry changed');
  expect(await page.evaluate(()=>ModeAtlasWordBank.read()[0].readingReview.events.length)).toBe(1);
  await focus.getByRole('button',{name:'Ready to remember',exact:true}).click();await expect(focus.getByRole('heading',{name:'Read the word',exact:true})).toBeVisible();
  await focus.getByRole('button',{name:'Save & exit',exact:true}).click();await page.getByRole('button',{name:'Learn these words',exact:true}).click();await expect(focus.getByRole('heading',{name:'Read the word',exact:true})).toBeVisible();
});

test('deleting the current word repairs the original selection and an empty selection cannot trap resume',async({page})=>{
  test.setTimeout(60_000);await setup(page,inner,'dark',selectedWords.slice(0,2));await page.getByRole('button',{name:'Learn these words',exact:true}).click();const focus=page.locator('#maWordsFocus');
  await focus.getByRole('button',{name:'Ready to remember',exact:true}).click();const deleted=await focus.locator('.ma-vocabulary-glyph').innerText();
  await focus.getByRole('button',{name:'Save & exit',exact:true}).click();
  async function deleteSaved(written){
    const card=page.locator('.wordbank-entry').filter({has:page.locator('.wordbank-word-line .kana',{hasText:written})});
    await card.locator('summary').click();await card.getByRole('button',{name:'Delete '+written,exact:true}).click();await page.getByRole('button',{name:'Delete word',exact:true}).click();await expect(card).toHaveCount(0);
  }
  await deleteSaved(deleted);await page.goto('/');await settle(page);await expect(page.locator('#homeContinueAction')).toHaveAttribute('href',/session=bank/);await page.locator('#homeContinueAction').click();await settle(page);
  await expect(focus.getByRole('heading',{name:'Meet this word',exact:true})).toBeVisible();await expect(focus.locator('.ma-vocabulary-glyph')).not.toHaveText(deleted);
  const repaired=await page.evaluate(()=>ModeAtlasWordLessonState.read()['wordbank-course'].course);expect(repaired.selectionIds).toHaveLength(1);expect(repaired.wordIds).toEqual(repaired.selectionIds);
  const remaining=await focus.locator('.ma-vocabulary-glyph').innerText();await focus.getByRole('button',{name:'Save & exit',exact:true}).click();
  await page.getByRole('button',{name:'Learn these words',exact:true}).click();await expect(focus.locator('.ma-vocabulary-glyph')).toHaveText(remaining);await focus.getByRole('button',{name:'Save & exit',exact:true}).click();
  await deleteSaved(remaining);expect(await page.evaluate(()=>ModeAtlasWordBank.pendingCourse())).toBeNull();
  await page.goto('/wordbank/?view=bank&session=bank');await settle(page);await expect(focus).toContainText('Add a kana reading or a meaning');await expect(focus.getByRole('button',{name:'Restart with current words',exact:true})).toHaveCount(0);
  await focus.getByRole('button',{name:'Back to Word Bank',exact:true}).click();await expect(page.locator('#wordBankAddJumpBtn')).toBeVisible();await expect(page.locator('#wordBankLearnBtn')).toBeHidden();
});
