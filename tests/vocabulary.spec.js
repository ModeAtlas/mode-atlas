const {test,expect}=require('@playwright/test');
const {prepare,settle,inner}=require('./helpers/native-geometry');
const closed={width:432,height:640,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:358,y:60,width:52,height:100}]};
const landscape={width:640,height:432,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:570,y:12,width:52,height:136}]};
async function setup(page,{seen=true,geometry=inner,theme='light',view='',largeText=false}={}){
 await prepare(page,geometry,theme);await page.addInitScript(seen=>localStorage.setItem('modeAtlasKanaLearning',JSON.stringify({startedAt:1,startKind:'beginner',introduced:seen?Object.fromEntries([...'あいうえお'].map(c=>[c,1])):{}})),seen);
 if(largeText)await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.setProperty('--ma-ios-text-scale','1.5');document.documentElement.setAttribute('data-ma-large-text','');},{once:true}));
 await page.goto('/wordbank/'+(view?'?view='+view:''));await settle(page);
}
const words=[{kana:'あい',romaji:'ai',english:'love'},{kana:'いえ',romaji:'ie',english:'house'},{kana:'うえ',romaji:'ue',english:'above'}];
async function answerCurrent(page,wrong=false){
 const prompt=await page.locator('#maWordsFocus .ma-vocabulary-glyph').textContent();const input=page.locator('#maVocabularyAnswer'),label=await page.locator('label[for=maVocabularyAnswer]').textContent();const word=words.find(w=>w.kana===prompt||w.english===prompt);
 expect(word).toBeTruthy();await input.fill(wrong?'wrong':label.includes('English')?word.english:label.includes('kana')?word.kana:word.romaji);
 await page.getByRole('button',{name:/^(Check answer|Submit answer)$/}).click();
}
async function finishSession(page,{missFirst=false}={}){
 let answers=0;for(let i=0;i<40;i++){
  if(await page.getByRole('heading',{name:'Set complete',exact:true}).count())return answers;
  if(await page.locator('#maVocabularyAnswer').count()){await answerCurrent(page,missFirst&&answers===0);answers++;}
  else await page.getByRole('button',{name:/^(Continue|See results)$/}).click();
 }throw Error('Session never completed');
}
async function startCourse(page){await page.getByRole('button',{name:'Continue',exact:true}).click();}
test('Words has exactly two destinations, real navigation, and no bank controls in its course',async({page})=>{
 await setup(page,{seen:false});await expect(page.locator('[data-words-hub] a')).toHaveCount(2);await expect(page.getByRole('button',{name:'Add word',exact:true})).toBeHidden();
 await page.getByRole('link',{name:/^Learn words /}).click();await expect(page).toHaveURL(/view=course/);await expect(page.getByRole('link',{name:'Continue Kana',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add word',exact:true})).toBeHidden();await expect(page.locator('.wordbank-overview')).toHaveCount(0);await expect(page.locator('[data-word-section]')).toHaveCount(0);
 await page.goBack();await expect(page.locator('[data-words-hub]')).toBeVisible();await page.getByRole('link',{name:/^Word Bank /}).click();await expect(page).toHaveURL(/view=bank/);await expect(page.getByRole('button',{name:'Add word',exact:true})).toBeVisible();await expect(page.locator('[data-ma-vocabulary]')).toBeHidden();
 await page.goto('/wordbank/?view=phrases');await settle(page);await expect(page.locator('[data-ma-word-lessons]')).toBeVisible();await expect(page.locator('[data-words-hub]')).toBeHidden();
});
test('a learner completes teaching and all four independent response skills through Continue',async({page})=>{
 await setup(page,{view:'course'});await startCourse(page);
 for(const [i,expected]of ['romaji','English','romaji','kana'].entries()){
  if(i===0){for(const w of words){await expect(page.locator('.ma-vocabulary-glyph')).toHaveText(w.kana);await expect(page.locator('.ma-vocabulary-meet')).toContainText(w.english);await page.getByRole('button',{name:'Continue',exact:true}).click();}}
  await expect(page.getByLabel('Your answer in '+expected,{exact:true})).toBeVisible();expect(await finishSession(page)).toBe(3);await expect(page.locator('.ma-vocabulary-score')).toHaveText('3 of 3 first answers recalled without help');
  if(i<3)await page.getByRole('button',{name:'Continue',exact:true}).click();
 }
 expect(await page.evaluate(()=>ModeAtlasVocabulary.modes.map(m=>ModeAtlasVocabulary.evidence('love',m.id).length))).toEqual([1,1,1,1]);await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Back to Learn words',exact:true}).click();await expect(page.locator('[data-ma-vocabulary]')).toBeVisible();await expect(page.locator('.ma-vocabulary-next')).toContainText('Meet your next words');
});
test('unfinished teaching and answered feedback resume exactly across reload and Back',async({page})=>{
 await setup(page,{view:'course'});await startCourse(page);await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.ma-vocabulary-glyph')).toHaveText('いえ');await page.reload();await settle(page);await expect(page.locator('.ma-vocabulary-glyph')).toHaveText('いえ');
 await page.getByRole('button',{name:'Save & exit',exact:true}).click();await expect(page.locator('.ma-vocabulary-next')).toContainText('Continue your words');await page.getByRole('button',{name:'Continue lesson',exact:true}).click();await expect(page.locator('.ma-vocabulary-glyph')).toHaveText('いえ');
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await answerCurrent(page);await expect(page.locator('.ma-course-status')).toHaveText('Correct');await page.reload();await settle(page);await expect(page.locator('.ma-course-status')).toHaveText('Correct');expect(await page.evaluate(()=>ModeAtlasVocabulary.evidence('love','decode').length)).toBe(1);
 await page.goBack();await expect(page.locator('[data-ma-vocabulary]')).toBeVisible();
});
test('IME confirmation never grades and corrections return after other words without inflating first answers',async({page})=>{
 await setup(page,{view:'course'});await startCourse(page);for(let i=0;i<3;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
 const input=page.getByLabel('Your answer in romaji',{exact:true});await input.fill('ai');await input.dispatchEvent('compositionstart');await page.getByRole('button',{name:'Check answer',exact:true}).click();await expect(input).toBeVisible();expect(await page.evaluate(()=>ModeAtlasVocabulary.evidence('love','decode').length)).toBe(0);await input.dispatchEvent('compositionend');
 await answerCurrent(page,true);await expect(page.locator('.ma-course-status')).toHaveText('Answer: ai');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.ma-vocabulary-glyph')).toHaveText('いえ');
 await finishSession(page);await expect(page.locator('.ma-vocabulary-score')).toHaveText('2 of 3 first answers recalled without help');expect(await page.evaluate(()=>ModeAtlasVocabulary.evidence('love','decode').map(e=>e.quality))).toEqual([0,2]);
});
for(const [name,geometry]of [['closed',closed],['landscape',landscape],['inner',inner]])for(const theme of ['light','dark'])test(`Words hub and focused course use ${name} ${theme} with larger text`,async({page},info)=>{
 await setup(page,{geometry,theme,largeText:true});
 await page.screenshot({path:info.outputPath(`words-hub-${name}-${theme}.png`),animations:'disabled'});await expect(page.locator('[data-words-hub] a').last()).toBeInViewport();await expect.poll(()=>page.locator('[data-words-hub] a').last().evaluate(node=>{const r=node.getBoundingClientRect(),points=[[r.x+r.width/2,r.y+4],[r.x+r.width/2,r.bottom-4],[r.x+4,r.y+r.height/2],[r.right-4,r.y+r.height/2]];return points.every(([x,y])=>node.contains(document.elementFromPoint(x,y)));})).toBe(true);
 await page.getByRole('link',{name:/^Learn words /}).click();await settle(page);await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeInViewport();
 await page.locator('.ma-vocabulary-options summary').click();const chosen=page.getByRole('button',{name:'Kana',exact:true});await chosen.hover();const colors=await chosen.evaluate(n=>({fg:getComputedStyle(n).color,bg:getComputedStyle(n).backgroundColor}));expect(colors.fg).not.toBe(colors.bg);await page.locator('.ma-vocabulary-options summary').click();
 await startCourse(page);await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath(`words-lesson-${name}-${theme}.png`),animations:'disabled'});
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('button',{name:'Check answer',exact:true})).toBeInViewport();await page.getByLabel('Your answer in romaji',{exact:true}).fill('a');const contentBounds=await page.locator('.ma-course-body').boundingBox();for(const locator of [page.locator('#maVocabularyAnswer'),page.locator('.ma-vocabulary-glyph')]){const r=await locator.boundingBox();expect(r.y).toBeGreaterThanOrEqual(contentBounds.y-1);expect(r.y+r.height).toBeLessThanOrEqual(contentBounds.y+contentBounds.height+1);}const bounds=await page.getByRole('button',{name:'Check answer',exact:true}).boundingBox();expect(bounds.y+bounds.height).toBeLessThanOrEqual(geometry.height-geometry.safeArea.bottom+2);await page.screenshot({path:info.outputPath(`words-question-${name}-${theme}.png`),animations:'disabled'});
});
test('mixed words teach their full reading and synced eligibility does not replace an active lesson',async({page})=>{
 await setup(page,{view:'course'});await page.evaluate(()=>{const s=ModeAtlasKanjiState.read();s.introductions.家=Date.now();ModeAtlasKanjiState.save(s);});
 await page.locator('.ma-vocabulary-options summary').click();await page.getByRole('button',{name:'Kana + Kanji',exact:true}).click();await startCourse(page);await expect(page.locator('.ma-vocabulary-glyph')).toHaveText('家');await expect(page.locator('.ma-vocabulary-reading')).toHaveText('いえ');
 const before=await page.locator('#maWordsFocus').textContent();await page.evaluate(()=>{const s=ModeAtlasKanaLearning.read();s.introduced.き=1;ModeAtlasKanaLearning.save(s);dispatchEvent(new CustomEvent('modeAtlasCloudDataChanged',{detail:{sections:['kanaLearning']}}));});await expect(page.locator('#maWordsFocus')).toHaveText(before);
});
test('generic review deep links select due meaning instead of an empty decoding queue',async({page})=>{
 await setup(page,{view:'course'});await startCourse(page);await finishSession(page);await page.getByRole('button',{name:'Continue',exact:true}).click();await finishSession(page);
 await page.evaluate(()=>{const row=ModeAtlasWordLessonState.read()['vocab-love'];row.vocabulary.schedules.meaning.due=Date.now()-1;ModeAtlasWordLessonState.checkpoint('vocab-love',row);});
 await page.goto('/wordbank/?vocabulary=review');await settle(page);await expect(page.getByLabel('Your answer in English',{exact:true})).toBeVisible();await expect(page.locator('.ma-vocabulary-glyph')).toHaveText('あい');
});
test('account changes remove the old task and late answer submission cannot change saved evidence',async({page})=>{
 await setup(page,{view:'course'});await startCourse(page);for(let i=0;i<3;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Your answer in romaji',{exact:true}).fill('ai');
 await page.evaluate(()=>{window.oldWordForm=document.querySelector('#maVocabularyAnswer').form;dispatchEvent(new CustomEvent('modeAtlasAccountWillChange'));oldWordForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 await expect(page.locator('#maWordsFocus')).toBeHidden();expect(await page.evaluate(()=>ModeAtlasVocabulary.evidence('love','decode').length)).toBe(0);await expect(page).not.toHaveURL(/session=/);
});
