const {test,expect}=require('@playwright/test');
const course=require('./helpers/kana-course');
async function setup(page,{width=960,height=600,theme='light',audio=true,geometry=null,large=false}={}){
 await page.setViewportSize({width,height});await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 await page.addInitScript(({theme,audio,geometry,large})=>{window.__spoken=[];window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{getViewportLayout:async()=>geometry||{width:innerWidth,height:innerHeight,safeArea:{top:0,right:0,bottom:0,left:0},occlusions:[]},speakJapanese:async({text})=>{window.__spoken.push(text);return {played:audio};},stopSpeech:async()=>{}}}};for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');localStorage.setItem('modeAtlasBranchToursSeen',JSON.stringify({kana:true,kanji:true,words:true}));localStorage.setItem('modeAtlasThemePreference',theme);document.addEventListener('DOMContentLoaded',()=>{if(geometry)for(const [side,value]of Object.entries(geometry.safeArea))document.documentElement.style.setProperty('--ma-safe-'+side,value+'px');if(large){document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');}},{once:true});},{theme,audio,geometry,large});
 await page.goto('/kana/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
}
async function expectTeachingContent(page){
 await expect(page.locator('.ma-kana-teaching-visual .ma-kana-task-glyph')).toBeInViewport({ratio:1});
 await expect(page.getByRole('button',{name:'Listen: あ',exact:true})).toBeInViewport({ratio:1});
 await expect(page.getByRole('button',{name:'Slower: あ',exact:true})).toBeInViewport({ratio:1});
 await expect(page.locator('.ma-kana-teaching-sound')).toBeInViewport({ratio:1});
 await expect(page.locator('.ma-kana-teaching-shape>strong')).toBeInViewport({ratio:1});
}
test('a beginner finishes real teaching, independent row check, reload and the next course step',async({page})=>{
 test.setTimeout(100000);await setup(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();await course.task(page);await course.task(page);
 const before=await page.evaluate(()=>ModeAtlasKanaLearning.courseSession().index);await page.reload();await expect(page.locator('.ma-course-view[data-task]')).toBeVisible();expect(await page.evaluate(()=>ModeAtlasKanaLearning.courseSession().index)).toBe(before);
 await course.session(page);await expect(page.getByRole('heading',{name:'Learn え · お',exact:true})).toBeVisible();expect(await page.evaluate(()=>ModeAtlasKanaLearning.courseRows('hiragana')[0].checked)).toBe(false);
 await page.getByRole('button',{name:'Start lesson',exact:true}).click();await course.session(page);await expect(page.getByRole('heading',{name:'Check your A row',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start row check',exact:true}).click();await course.session(page);
 await expect(page.getByRole('heading',{name:'Row check complete',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Learn か · き · く',exact:true})).toBeVisible();expect(await page.evaluate(()=>ModeAtlasKanaLearning.courseRows('hiragana')[0].checked)).toBe(true);
 await page.getByRole('button',{name:'Save & exit',exact:true}).click();await expect(page.getByRole('button',{name:'Learning path',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Learn か · き · く',exact:true})).toBeVisible();
});
test('audio checks need a different target from the previous answer and hide answer-bearing labels',async({page})=>{
 test.setTimeout(60000);await setup(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();let previous='',checked=0;
 while(await page.locator('.ma-course-view[data-task]').count()){
   const kind=await page.locator('.ma-course-view').getAttribute('data-task');
   if(kind==='listen'){
     await expect(page.locator('.ma-kana-task-glyph,.ma-kana-task-reading,.ma-kana-task-cue')).toHaveCount(0);
     await expect(page.getByRole('button',{name:'Play sound',exact:true})).toBeVisible();await page.getByRole('button',{name:'Play sound',exact:true}).click();const spoken=await page.evaluate(()=>__spoken.at(-1));expect(spoken).not.toBe(previous);checked++;previous=spoken;
     await page.getByRole('group',{name:'Answer choices'}).getByRole('button',{name:spoken,exact:true}).click();await page.getByRole('button',{name:/^(Continue|Finish session)$/}).click();
   }else{if(kind==='read'||kind==='teach')previous=await page.locator('.ma-kana-task-glyph').textContent();else if(kind==='match'||kind==='recall'){const r=await page.locator('.ma-kana-task-reading').textContent();previous=Object.keys(course.roman).find(c=>course.roman[c]===r);}await course.task(page);}
 }expect(checked).toBeGreaterThan(1);
});
test('a correction keeps its first miss and needs an independent later set',async({page})=>{
 test.setTimeout(60000);await setup(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();while(await page.locator('.ma-course-view').getAttribute('data-task')!=='read')await course.task(page);
 const char=await page.locator('.ma-kana-task-glyph').textContent();await course.task(page,{wrong:true});let receipt=await page.evaluate(char=>ModeAtlasKanaLearning.read().course.records['reading:'+char],char);expect(receipt.at(-1).correct).toBe(false);
 await course.session(page);receipt=await page.evaluate(char=>ModeAtlasKanaLearning.read().course.records['reading:'+char],char);expect(receipt.some(r=>!r.correct)).toBe(true);expect(receipt.some(r=>r.correct&&r.assisted)).toBe(true);await page.getByRole('button',{name:/^Revisit \d+ kana$/}).click();await course.session(page);receipt=await page.evaluate(char=>ModeAtlasKanaLearning.read().course.records['reading:'+char],char);expect(receipt.some(r=>r.correct&&!r.assisted)).toBe(true);
});
test('a row check cannot pass by correcting every failed original answer',async({page})=>{
 test.setTimeout(100000);await setup(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();await course.session(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();await course.session(page);await page.getByRole('button',{name:'Start row check',exact:true}).click();
 let count=0;while(await page.locator('.ma-course-view[data-task]').count()){const repair=await page.locator('.ma-course-heading>.ma-kicker').textContent()==='Correction practice';await course.task(page,{wrong:!repair});if(++count>100)throw Error('Corrected assessment did not end');}
 await expect(page.getByRole('heading',{name:'Keep building this row',exact:true})).toBeVisible();expect(await page.evaluate(()=>ModeAtlasKanaLearning.courseRows('hiragana')[0].checked)).toBe(false);await page.getByRole('button',{name:'Try a fresh row check',exact:true}).click();await course.session(page);await expect(page.getByRole('heading',{name:'Row check complete',exact:true})).toBeVisible();
});
test('path opens in place, browser Back preserves script, and there is no last-character completion shortcut',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();await course.task(page);await page.getByRole('button',{name:'Save & exit',exact:true}).click();await page.getByRole('button',{name:'Learning path',exact:true}).click();await page.getByRole('button',{name:'Katakana',exact:true}).click();await page.locator('[data-row="katakana:base:a"]').click();await expect(page.locator('.ma-course-title')).toHaveText('A row');await page.goBack();await expect(page.getByRole('button',{name:'Katakana',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.ma-kana-lesson-tile')).toHaveCount(0);expect(await page.evaluate(()=>ModeAtlasKanaLearning.read().course.passed)).toEqual({});
});
for(const [width,height,theme]of [[393,852,'light'],[430,640,'dark'],[844,390,'dark'],[960,600,'light']])test(`course task and overview are usable at ${width}x${height} ${theme}`,async({page},info)=>{
 await setup(page,{width,height,theme});await page.getByRole('button',{name:'Start lesson',exact:true}).click();await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeInViewport({ratio:1});await expectTeachingContent(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('kana-course-teaching.png'),fullPage:true});await page.getByRole('button',{name:'Save & exit',exact:true}).click();await expect(page.getByRole('button',{name:'Continue session',exact:true})).toBeInViewport({ratio:1});await expect(page.getByRole('button',{name:'Learning path',exact:true})).toBeInViewport({ratio:1});await page.screenshot({path:info.outputPath('kana-course-overview.png'),fullPage:true});
});
test('silent study does not create listening receipts',async({page})=>{test.setTimeout(60000);await setup(page,{audio:false});await page.getByRole('button',{name:'Start lesson',exact:true}).click();await course.session(page,{silent:true});expect(await page.evaluate(()=>Object.keys(ModeAtlasKanaLearning.read().listeningChecks))).toEqual([]);});
test('old-account actions and late audio cannot answer for a replacement account',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();while(await page.locator('.ma-course-view').getAttribute('data-task')!=='listen')await course.task(page);
 await page.evaluate(()=>{Capacitor.Plugins.ModeAtlasNative.speakJapanese=()=>new Promise(resolve=>window.__finishAudio=resolve);});await page.getByRole('button',{name:'Play sound',exact:true}).click();
 const before=await page.evaluate(()=>{window.__oldAnswer=document.querySelector('[data-answer]');dispatchEvent(new Event('modeAtlasAccountWillChange'));ModeAtlasStorage.remove(ModeAtlasKanaLearning.KEY);ModeAtlasKanaLearning.start();return JSON.stringify(ModeAtlasKanaLearning.read());});
 await page.evaluate(async()=>{__finishAudio({played:true});await Promise.resolve();__oldAnswer.disabled=false;__oldAnswer.click();});expect(await page.evaluate(()=>JSON.stringify(ModeAtlasKanaLearning.read()))).toBe(before);
});

for(const [theme,large]of [['light',false],['dark',false],['dark',true]])test(`protected 432px native course keeps its task action visible ${theme} large=${large}`,async({page},info)=>{
 const geometry={width:432,height:640,reservedRegionsAvailable:true,safeArea:{top:12,right:84,bottom:20,left:0},occlusions:[{x:358,y:24,width:60,height:130}]};await setup(page,{width:432,height:640,theme,geometry,large});await page.getByRole('button',{name:'Start lesson',exact:true}).click();await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeInViewport({ratio:1});await expectTeachingContent(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await page.getByRole('button',{name:'Continue',exact:true}).evaluate(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return b===hit||b.contains(hit);})).toBe(true);await page.screenshot({path:info.outputPath('kana-native-protected.png'),fullPage:true});
});
test('short wide teaching retains useful content at 150 percent text',async({page},info)=>{
 await setup(page,{width:960,height:440,theme:'dark',large:true});await page.getByRole('button',{name:'Start lesson',exact:true}).click();await expectTeachingContent(page);await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeInViewport({ratio:1});await page.screenshot({path:info.outputPath('kana-short-wide-large.png'),fullPage:true});
});

test('the real course reaches sound contrasts, cumulative checkpoint and the Kanji invitation',async({page})=>{
 test.setTimeout(100000);await setup(page);await page.getByRole('button',{name:'Start lesson',exact:true}).click();
 for(let n=0;n<10;n++){
  await course.session(page);const pattern=await page.getByRole('heading',{name:'Long vowels',exact:true}).count();
  if(pattern){await page.getByRole('button',{name:'Learn long vowels',exact:true}).click();break;}
  await page.locator('.ma-course-actions button').click();if(n===9)throw Error('Sound unit never appeared');
 }
 expect(await page.locator('.ma-course-view').getAttribute('data-task')).toBe('patternTeach');await course.session(page);await expect(page.getByRole('heading',{name:'Pattern introduced',exact:true})).toBeVisible();const saved=await page.evaluate(()=>ModeAtlasKanaLearning.read());expect(saved.sounds.longVowels).toBeGreaterThan(0);expect(saved.course.patternListening.longVowels).toBeGreaterThan(0);expect(await page.evaluate(()=>__spoken)).toEqual(expect.arrayContaining(['いい','く','こう','けい']));
 for(let n=0;n<4;n++){await page.locator('.ma-course-actions button').click();await course.session(page);if(await page.getByRole('heading',{name:'Your first three rows',exact:true}).count())break;if(n===3)throw Error('Checkpoint did not follow three checked rows');}
 expect(await page.evaluate(()=>ModeAtlasKanaLearning.courseStatus().kanjiReady)).toBe(false);await page.getByRole('button',{name:'Start checkpoint',exact:true}).click();await course.session(page);await expect(page.getByRole('heading',{name:'Checkpoint complete',exact:true})).toBeVisible();expect(await page.evaluate(()=>ModeAtlasKanaLearning.courseStatus().kanjiReady)).toBe(true);await page.getByRole('button',{name:'Save & exit',exact:true}).click();await expect(page.getByRole('link',{name:'Try Kanji',exact:true})).toBeVisible();
});
