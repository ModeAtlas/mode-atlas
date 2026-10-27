const {test,expect}=require('@playwright/test');
const {prepare,settle,inner}=require('./helpers/native-geometry');
const closed={width:432,height:640,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:358,y:60,width:52,height:100}]};
const landscape={width:640,height:432,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:570,y:12,width:52,height:136}]};
async function setup(page,{seen=true,geometry=inner,theme='light'}={}){
 await prepare(page,geometry,theme);await page.addInitScript(seen=>localStorage.setItem('modeAtlasKanaLearning',JSON.stringify({startedAt:1,startKind:'beginner',introduced:seen?Object.fromEntries([...'あいうえお'].map(c=>[c,1])):{}})),seen);
 await page.goto('/wordbank/');await settle(page);
}
async function decode(page){const glyph=await page.locator('.ma-vocabulary-glyph').textContent();return page.evaluate(g=>ModeAtlasJapanese.romaji(g),glyph);}
async function introduce(page){await page.evaluate(()=>{for(const w of ModeAtlasVocabulary.pool().slice(0,5)){ModeAtlasVocabulary.introduce(w.id);ModeAtlasVocabulary.record(w.id,'decode',true);}ModeAtlasVocabularyUI.render();});}
test('Words starts with seen characters and keeps the personal bank and phrase lessons separate',async({page})=>{
 await setup(page,{seen:false});await expect(page.getByRole('link',{name:'Learn the vowel row',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Learn 5 words',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'My word bank',exact:true}).click();await expect(page.locator('.wordbank-library')).toBeVisible();await expect(page.locator('[data-ma-vocabulary]')).toBeHidden();
 await page.getByRole('button',{name:'Phrase lessons',exact:true}).click();await expect(page.locator('[data-ma-word-lessons]')).toBeVisible();await expect(page.locator('.wordbank-library')).toBeHidden();
 await page.getByRole('button',{name:'Learn words',exact:true}).click();await expect(page.locator('[data-ma-word-lessons]')).toBeHidden();
});
test('a five-word lesson checks recall, offers meaning next and saves independent progress',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Learn 5 words',exact:true}).click();
 for(let i=0;i<5;i++){
  await page.getByRole('button',{name:'Try from memory',exact:true}).click();await page.getByLabel('Your answer in romaji',{exact:true}).fill(await decode(page));await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await expect(page.locator('.ma-vocabulary-feedback')).toHaveText('Correct');await page.getByRole('button',{name:i===4?'See results':'Continue',exact:true}).click();
 }
 await expect(page.locator('.ma-vocabulary-score')).toHaveText('5 / 5 recalled without help');await page.getByRole('button',{name:'Recall the meaning',exact:true}).click();await expect(page.getByLabel('Your answer in English',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.reload();await settle(page);await expect(page.getByLabel('Word skill')).toHaveValue('meaning');
 expect(await page.evaluate(()=>ModeAtlasWordLessonState.vocabularyOverview().introduced)).toBe(5);expect(await page.evaluate(()=>ModeAtlasVocabulary.evidence('love','meaning').length)).toBe(0);
});
test('IME composition never submits, tests preserve mistakes and revisit uses the missed words only',async({page})=>{
 await setup(page);await introduce(page);await page.getByLabel('Word skill').selectOption('decode');await page.getByRole('button',{name:'Test yourself',exact:true}).click();
 const input=page.getByLabel('Your answer in romaji',{exact:true});await input.fill(await decode(page));await input.dispatchEvent('compositionstart');await page.getByRole('button',{name:'Submit answer',exact:true}).click();await expect(page.locator('.ma-vocabulary-session .ma-kicker')).toContainText('1 of 5');await input.dispatchEvent('compositionend');
 let missed='';for(let i=0;i<5;i++){if(i===0)missed=await page.locator('.ma-vocabulary-glyph').textContent();await page.getByLabel('Your answer in romaji',{exact:true}).fill(i===0?'wrong':await decode(page));await page.getByRole('button',{name:'Submit answer',exact:true}).click();}
 await expect(page.locator('.ma-vocabulary-score')).toHaveText('4 / 5 recalled without help');await expect(page.locator('.ma-vocabulary-corrections li')).toHaveCount(5);
 await page.getByRole('button',{name:'Revisit missed words',exact:true}).click();await expect(page.locator('.ma-vocabulary-glyph')).toHaveText(missed);await expect(page.locator('.ma-vocabulary-session .ma-kicker')).toContainText('1 of 1');
 expect(await page.evaluate(()=>ModeAtlasVocabulary.history().filter(x=>x.quality!==2).length)).toBe(1);
});
for(const [name,geometry]of [['closed',closed],['landscape',landscape],['inner',inner]])for(const theme of ['light','dark'])test(`Words course and lesson fit ${name} ${theme} with larger text`,async({page},info)=>{
 await setup(page,{geometry,theme});await page.evaluate(()=>{document.documentElement.style.setProperty('--ma-ios-text-scale','1.4');document.documentElement.setAttribute('data-ma-large-text','');});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.getByRole('button',{name:'Learn 5 words',exact:true}).click();const panel=page.locator('.ma-dialog');expect(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
 const action=page.getByRole('button',{name:'Try from memory',exact:true});await action.scrollIntoViewIfNeeded();await expect(action).toBeInViewport();await page.screenshot({path:info.outputPath(`words-${name}-${theme}.png`),animations:'disabled'});await action.click();
 const input=page.getByLabel('Your answer in romaji',{exact:true});await input.scrollIntoViewIfNeeded();await expect(input).toBeInViewport();expect(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
});
test('all four skills use their correct input, and mixed words teach the whole reading',async({page})=>{
 await setup(page);await page.evaluate(()=>{
  for(const word of ModeAtlasVocabulary.pool().slice(0,5))ModeAtlasVocabulary.introduce(word.id);
  for(const mode of ['decode','meaning','produceRoman'])for(const id of ['love','house','above'])ModeAtlasVocabulary.record(id,mode,true);
  ModeAtlasVocabularyUI.render();
 });
 for(const [mode,label]of [['decode','romaji'],['meaning','English'],['produceRoman','romaji'],['produceKana','kana']]){
  await page.getByLabel('Word skill').selectOption(mode);await page.getByRole('button',{name:'Practise your words',exact:true}).click();
  const prompt=await page.locator('.ma-vocabulary-glyph').textContent();const expected=await page.evaluate(({mode,prompt})=>{const word=ModeAtlasVocabularyData.find(w=>mode.startsWith('produce')?w.english===prompt:w.reading===prompt);return mode==='meaning'?word.english:mode==='produceKana'?word.reading:ModeAtlasJapanese.romaji(word.reading);},{mode,prompt});
  await page.getByLabel('Your answer in '+label,{exact:true}).fill(expected);await page.getByRole('button',{name:'Check answer',exact:true}).click();await expect(page.locator('.ma-vocabulary-feedback')).toHaveText('Correct');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 }
 await page.getByRole('button',{name:'Kana + Kanji',exact:true}).click();await expect(page.locator('.ma-vocabulary-next')).toContainText('0 words ready');
 await page.evaluate(()=>{const s=ModeAtlasKanjiState.read();s.introductions.家=Date.now();ModeAtlasKanjiState.save(s);ModeAtlasVocabularyUI.render();});await page.locator('.ma-vocabulary-list').first().locator('summary').click();await page.getByRole('button',{name:'家 · house',exact:true}).click();await expect(page.locator('.ma-vocabulary-glyph')).toHaveText('家');await expect(page.locator('.ma-vocabulary-reading')).toHaveText('いえ');
});
test('Words review links open the due skill even when decoding is not due',async({page})=>{
 await setup(page);await page.evaluate(()=>{
  for(const id of ['love','house','above'])ModeAtlasVocabulary.introduce(id);
  for(const mode of ['decode','meaning','produceRoman','produceKana'])for(const id of ['love','house','above'])ModeAtlasVocabulary.record(id,mode,true);
  const saved=ModeAtlasWordLessonState.read(),record=saved['vocab-love'];record.vocabulary.schedules.meaning.due=Date.now()-1;ModeAtlasWordLessonState.checkpoint('vocab-love',record);
 });
 await page.goto('/wordbank/?vocabulary=review');await settle(page);await expect(page.getByLabel('Your answer in English',{exact:true})).toBeVisible();await expect(page.locator('.ma-vocabulary-session .ma-kicker')).toContainText('1 of 1');await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByLabel('Word skill')).toHaveValue('meaning');await expect(page.getByRole('button',{name:'Review 1 due',exact:true})).toBeVisible();
});
test('synced character knowledge refreshes the word pool without replacing active practice',async({page})=>{
 await setup(page,{seen:false});await expect(page.locator('.ma-vocabulary-next')).toContainText('0 words ready');
 await page.evaluate(()=>{const s=ModeAtlasKanaLearning.read();s.introduced=Object.fromEntries([...'あいうえお'].map(c=>[c,1]));ModeAtlasKanaLearning.save(s);dispatchEvent(new CustomEvent('modeAtlasCloudDataChanged',{detail:{sections:['kanaLearning']}}));});
 await page.getByRole('button',{name:'Learn 5 words',exact:true}).click();const before=await page.locator('.ma-vocabulary-session').textContent();
 await page.evaluate(()=>{const s=ModeAtlasKanaLearning.read();s.introduced.き=1;ModeAtlasKanaLearning.save(s);dispatchEvent(new CustomEvent('modeAtlasCloudDataChanged',{detail:{sections:['kanaLearning']}}));});await expect(page.locator('.ma-vocabulary-session')).toHaveText(before);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();expect(await page.evaluate(()=>ModeAtlasVocabulary.pool().some(w=>w.id==='station'))).toBe(true);
});
