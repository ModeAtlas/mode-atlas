const {test,expect}=require('@playwright/test');
async function setup(page,{width=960,height=600,theme='light',audio=false}={}){
  await page.setViewportSize({width,height});await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.addInitScript(({theme,audio})=>{
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{speakJapanese:async()=>({played:audio}),stopSpeech:async()=>{}}}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasBranchToursSeen',JSON.stringify({kana:true,kanji:true,words:true}));localStorage.setItem('modeAtlasThemePreference',theme);
  },{theme,audio});await page.goto('/kana/');await expect(page.locator('#maLoadingScreen')).toBeHidden();await page.getByRole('button',{name:/Start lesson/}).click();
}
const checkCharacter=require('./helpers/kana-lesson');
test('a beginner learns a checked row, resumes it, then reaches a real practice set',async({page})=>{
  await setup(page);await checkCharacter(page,'あ','a',{wrong:true});await page.reload();await page.getByRole('button',{name:'Continue learning',exact:true}).click();await expect(page.locator('.ma-kana-lesson-shape')).toHaveText('い');
  for(const [char,roman]of [['い','i'],['う','u'],['え','e'],['お','o']])await checkCharacter(page,char,roman,{last:char==='お'});
  await expect(page.getByRole('heading',{name:'Your row is ready for practice'})).toBeVisible();
  const saved=await page.evaluate(()=>({checks:Object.keys(ModeAtlasKanaLearning.read().lessonChecks),audio:Object.keys(ModeAtlasKanaLearning.read().listeningChecks),stage:ModeAtlasKanaLearning.stage('あ'),next:ModeAtlasKanaLearning.path('hiragana','reading')[1].unlocked,xp:ModeAtlasProgress.getXP()}));
  expect(saved).toEqual({checks:['あ','い','う','え','お'],audio:[],stage:1,next:false,xp:0});
  await page.getByRole('link',{name:'Practise this row',exact:true}).click();await expect(page).toHaveURL(/\/reading\//);await expect(page.locator('#startBtn')).toBeEnabled();expect(await page.evaluate(()=>Object.keys(ModeAtlasKanaLearning.selection(ModeAtlasStorage.readModeJSON('reading','settings',{}),'reading'))).then(chars=>chars.sort())).toEqual(['あ','い','う','え','お']);
});
test('listening evidence requires successful audio and a correct discrimination answer',async({page})=>{
  await setup(page,{audio:true});await checkCharacter(page,'あ','a',{audio:true});expect(await page.evaluate(()=>!!ModeAtlasKanaLearning.read().listeningChecks['あ'])).toBe(true);
  await page.getByRole('button',{name:'Check this character',exact:true}).click();await page.locator('.ma-kana-lesson-choices').getByRole('button',{name:'い',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.locator('.ma-kana-lesson-choices button').first()).toBeDisabled();await page.getByRole('button',{name:'Continue without audio',exact:true}).click();await page.getByLabel('Type the sound in romaji').fill('i');await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('button',{name:'Next character',exact:true}).click();expect(await page.evaluate(()=>!!ModeAtlasKanaLearning.read().listeningChecks['い'])).toBe(false);
});
test('sound pattern introductions require their check and do not fabricate character mastery',async({page})=>{
  await setup(page);await checkCharacter(page,'あ','a');await page.getByRole('button',{name:'Back to Kana',exact:true}).click();await page.getByRole('button',{name:'Sound workshop',exact:true}).click();
  await expect(page.getByRole('button',{name:'Learn Small っ',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Learn Long vowels',exact:true}).click();await page.getByRole('button',{name:'Check this pattern',exact:true}).click();await page.getByRole('button',{name:'One beat',exact:true}).click();expect(await page.evaluate(()=>ModeAtlasKanaLearning.read().sounds.longVowels||0)).toBe(0);
  await page.getByRole('button',{name:'Two beats',exact:true}).click();expect(await page.evaluate(()=>!!ModeAtlasKanaLearning.read().sounds.longVowels)).toBe(true);expect(await page.evaluate(()=>ModeAtlasKanaLearning.stage('あ'))).toBe(1);
});
for(const [width,height,theme]of [[320,740,'light'],[844,390,'dark'],[960,600,'light'],[480,640,'dark']])test(`guided lesson fits ${width}x${height} ${theme}`,async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page,{width,height,theme});
  await page.getByRole('button',{name:'Check this character',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Check this character',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('kana-guided-lesson.png'),fullPage:true});
  await checkCharacter(page,'あ','a');expect(errors).toEqual([]);
});
test('larger text keeps guided character checks reachable on a short display',async({page},info)=>{
  await setup(page,{width:844,height:390,theme:'dark'});await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  const action=page.getByRole('button',{name:'Check this character',exact:true});await action.evaluate(node=>node.scrollIntoView({block:'center'}));await expect(action).toBeInViewport();expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath('kana-lesson-large-text.png')});await checkCharacter(page,'あ','a');await expect(page.locator('.ma-kana-lesson-shape')).toHaveText('い');
});
async function replaceAccount(page,selector){
  return page.evaluate(selector=>{
    window.__oldKanaControl=document.querySelector(selector);
    dispatchEvent(new Event('modeAtlasAccountWillChange'));
    ModeAtlasStorage.remove(ModeAtlasKanaLearning.KEY);ModeAtlasStorage.remove(ModeAtlasKanaLearning.UPDATED);
    ModeAtlasKanaLearning.start('beginner');return JSON.stringify(ModeAtlasKanaLearning.read());
  },selector);
}
test('a retained lesson completion control cannot write into a replacement account',async({page})=>{
  await setup(page);await page.getByRole('button',{name:'Check this character',exact:true}).click();await page.locator('.ma-kana-lesson-choices').getByRole('button',{name:'あ',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue without audio',exact:true}).click();await page.getByLabel('Type the sound in romaji').fill('a');await page.getByRole('button',{name:'Check answer',exact:true}).click();
  const before=await replaceAccount(page,'.ma-kana-lesson > .ma-button');await page.evaluate(()=>__oldKanaControl.click());expect(await page.evaluate(()=>JSON.stringify(ModeAtlasKanaLearning.read()))).toBe(before);expect(await page.evaluate(()=>Object.keys(ModeAtlasKanaLearning.read().lessonChecks))).toEqual([]);
});
test('a retained sound-workshop answer cannot write into a replacement account',async({page})=>{
  await setup(page);await checkCharacter(page,'あ','a');await page.getByRole('button',{name:'Back to Kana',exact:true}).click();await page.getByRole('button',{name:'Sound workshop',exact:true}).click();await page.getByRole('button',{name:'Learn Long vowels',exact:true}).click();await page.getByRole('button',{name:'Check this pattern',exact:true}).click();
  const before=await replaceAccount(page,'.ma-kana-sound-workshop > button:nth-of-type(2)');await expect(page.locator('.ma-dialog-layer')).toBeHidden();await page.evaluate(()=>__oldKanaControl.click());expect(await page.evaluate(()=>JSON.stringify(ModeAtlasKanaLearning.read()))).toBe(before);expect(await page.evaluate(()=>ModeAtlasKanaLearning.read().sounds)).toEqual({});
});
test('late playback from the old account cannot enable or record a listening answer',async({page})=>{
  await setup(page);await page.evaluate(()=>{Capacitor.Plugins.ModeAtlasNative.speakJapanese=()=>new Promise(resolve=>{window.__finishOldKanaAudio=resolve;});});
  await page.getByRole('button',{name:'Check this character',exact:true}).click();await page.locator('.ma-kana-lesson-choices').getByRole('button',{name:'あ',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Play sound',exact:true}).click();await page.waitForFunction(()=>typeof __finishOldKanaAudio==='function');
  const before=await replaceAccount(page,'.ma-kana-lesson-choices button');await page.evaluate(async()=>{__finishOldKanaAudio({played:true});await Promise.resolve();__oldKanaControl.click();});expect(await page.evaluate(()=>JSON.stringify(ModeAtlasKanaLearning.read()))).toBe(before);expect(await page.evaluate(()=>Object.keys(ModeAtlasKanaLearning.read().listeningChecks))).toEqual([]);
});
