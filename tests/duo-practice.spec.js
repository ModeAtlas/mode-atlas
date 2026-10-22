const {test,expect}=require('@playwright/test');

// These are window stress cases matching the proportions of the reported
// screenshots, not device specifications. UIKit geometry is simulated here.
const outer={width:480,height:680,safeArea:{top:12,right:84,bottom:20,left:0},occlusions:[{x:406,y:24,width:60,height:130}]};
const inner={width:960,height:680,safeArea:{top:12,right:84,bottom:20,left:0},occlusions:[{x:890,y:24,width:52,height:84}]};
async function prepare(page,geometry=inner,theme='dark'){
  await require('./helpers/kana-fixture')(page);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.setViewportSize({width:geometry.width,height:geometry.height});
  await page.addInitScript(({geometry,theme})=>{
    let listener=()=>{};
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{
      getViewportLayout:async()=>geometry,
      addListener:(name,cb)=>{if(name==='viewportLayoutChanged')listener=cb;return Promise.resolve({remove(){}});}
    }}};
    window.applyDuoGeometry=next=>{
      for(const [side,value]of Object.entries(next.safeArea))document.documentElement.style.setProperty('--ma-safe-'+side,value+'px');
      listener(next);dispatchEvent(new Event('resize'));
    };
    document.addEventListener('DOMContentLoaded',()=>applyDuoGeometry(geometry),{once:true});
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasThemePreference',theme);
    localStorage.setItem('modeAtlasSound','off');
    for(const key of ['settings','reverseSettings'])localStorage.setItem(key,JSON.stringify({hiraganaRows:['h_a','h_ka','h_sa'],katakanaRows:[],hint:false,srs:false,keyboardMode:false,choiceCount:8}));
  },{geometry,theme});
}
async function settle(page){
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(()=>document.fonts.ready);
}
async function reachable(locator,{bottom}={}){
  await expect(locator).toBeVisible();
  await expect.poll(()=>locator.evaluate((el,bottom)=>{
    const r=el.getBoundingClientRect(),limit=bottom??innerHeight;
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return r.top>=0&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=limit+1&&r.width>=44&&r.height>=44&&(hit===el||el.contains(hit));
  },bottom)).toBe(true);
}
async function sessionFits(page){
  const keyboard=page.locator('.ma-ios-reading-keyboard:not(.ma-ios-reading-keyboard--inline)');
  const bottom=await keyboard.isVisible()?(await keyboard.boundingBox()).y:await page.evaluate(()=>innerHeight);
  for(const id of ['skipKanaBtn','pauseSessionBtn','endSessionBtn'])await reachable(page.locator('#'+id),{bottom});
  const prompt=page.locator('.ma-trainer-prompt-wrap'),r=await prompt.boundingBox();
  expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(bottom);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}

for(const theme of ['dark','light'])for(const [label,geometry]of [['outer',outer],['inner',inner]]){
  test(`${label} ${theme}: setup and reading actions fit without scrolling`,async({page},info)=>{
    await prepare(page,geometry,theme);await page.goto('/reading/');await settle(page);
    for(const id of ['startBtn','kanaHintsQuick','modifiersTab','profileOpenBtn'])await reachable(page.locator('#'+id));
    const links=page.locator('.ma-ios-tabs__links'),nav=await page.locator('.ma-ios-tabs').boundingBox(),group=await links.boundingBox();
    expect(Math.abs((group.y+group.height/2)-(nav.y+nav.height/2))).toBeLessThan(2);
    for(const link of await page.locator('.ma-ios-tab').all()){const r=await link.boundingBox();expect(r.height).toBeGreaterThanOrEqual(64);await reachable(link);}
    await page.screenshot({path:info.outputPath(`setup-${label}-${theme}.png`)});
    await page.locator('#startBtn').click();await sessionFits(page);
    await reachable(page.locator('#input'),{bottom:(await page.locator('.ma-ios-reading-keyboard').boundingBox()).y});
    if(label==='inner'){
      const p=await page.locator('.ma-trainer-prompt-wrap').boundingBox(),answer=await page.locator('.ma-trainer-answer-wrap').boundingBox();
      expect(answer.x).toBeGreaterThan(p.x+p.width);
      expect((await page.locator('.ma-trainer-card').boundingBox()).width).toBeGreaterThan(800);
    }
    await page.screenshot({path:info.outputPath(`reading-${label}-${theme}.png`)});
    await page.locator('#pauseSessionBtn').click();await expect(page.locator('.ma-ios-reading-keyboard')).toBeHidden();
    await reachable(page.locator('#pauseSessionBtn'));await page.locator('#pauseSessionBtn').click();await sessionFits(page);
    await page.locator('#skipKanaBtn').click();await expect(page.locator('#studyFeedback')).toBeVisible();
    await reachable(page.locator('#studyFeedbackContinue'));await page.locator('#studyFeedbackContinue').click();await sessionFits(page);
    await page.locator('#endSessionBtn').click();await expect(page.locator('.ma-study-summary')).toBeVisible();
  });
}
for(const [label,geometry]of [['outer',outer],['inner',inner]]){
  test(`${label}: eight writing answers and all session actions remain visible`,async({page},info)=>{
    await prepare(page,geometry);await page.goto('/writing/');await settle(page);await reachable(page.locator('#startBtn'));await page.locator('#startBtn').click();
    await expect(page.locator('.choice-btn')).toHaveCount(8);
    for(const choice of await page.locator('.choice-btn').all())await reachable(choice);
    await sessionFits(page);await page.screenshot({path:info.outputPath(`writing-${label}.png`)});
    await page.locator('#pauseSessionBtn').click();await reachable(page.locator('#pauseSessionBtn'));await page.locator('#pauseSessionBtn').click();await sessionFits(page);
  });
  test(`${label}: Kanji cards and their text stay inside their columns`,async({page},info)=>{
    await prepare(page,geometry);await page.goto('/kanji/');await settle(page);
    await page.getByRole('button',{name:'Start as a beginner',exact:true}).click();
    await reachable(page.getByRole('button',{name:'Start learning',exact:true}));
    for(const selector of ['.ma-kanji-teaching','.ma-kanji-intro','.ma-kanji-first-ten']){
      expect(await page.locator(selector).evaluate(el=>el.scrollWidth<=el.clientWidth+1),selector).toBe(true);
    }
    const intro=await page.locator('.ma-kanji-intro').boundingBox(),practice=await page.locator('.ma-kanji-first-ten').boundingBox();
    expect(practice.x>=intro.x+intro.width||practice.y>=intro.y+intro.height).toBe(true);
    await page.screenshot({path:info.outputPath(`kanji-${label}.png`)});
    await page.getByRole('button',{name:'Start learning',exact:true}).click();await expect(page.locator('.ma-kanji-lesson')).toBeVisible();
    for(const button of await page.locator('.ma-kanji-lesson-actions button').all())await reachable(button);
  });
}
test('folding mid-answer preserves the question and keeps the complete frame above the keyboard',async({page})=>{
  await prepare(page,inner);await page.goto('/reading/');await settle(page);await page.locator('#startBtn').click();
  const question=await page.locator('#hiragana').textContent();
  await page.locator('#input').evaluate(el=>{el.value='s';el.setSelectionRange(1,1);});
  for(const geometry of [outer,inner,outer]){
    await page.setViewportSize({width:geometry.width,height:geometry.height});await page.evaluate(next=>applyDuoGeometry(next),geometry);
    await expect(page.locator('#input')).toHaveValue('s');await expect(page.locator('#hiragana')).toHaveText(question);await sessionFits(page);
  }
  await page.locator('.ma-ios-reading-keyboard__key--delete').click();await expect(page.locator('#input')).toHaveValue('');
});
for(const mode of ['reading','writing'])for(const selected of ['dailyChallenge','testMode','speedRun','timeTrial','endless']){
  test(`${mode} ${selected}: the outer view keeps the live score, question and controls visible`,async({page})=>{
    await prepare(page,outer);await page.goto('/'+mode+'/');await settle(page);
    await page.evaluate(selected=>ModeAtlasTrainerControls.selectMode(selected),selected);
    await reachable(page.locator('#startBtn'));await page.locator('#startBtn').click();await sessionFits(page);
    for(const score of await page.locator('.score-pill:visible').all())await expect(score).toBeInViewport({ratio:1});
  });
}
test('large text and a short window allow every action to scroll clear of the keyboard',async({page})=>{
  await prepare(page,outer);await page.goto('/reading/');await settle(page);
  await page.evaluate(()=>{document.documentElement.style.setProperty('--ma-ios-text-scale','1.5');document.documentElement.setAttribute('data-ma-large-text','');dispatchEvent(new Event('modeAtlasTextSizeChanged'));});
  await page.locator('#startBtn').click();
  const geometry={...outer,height:580};await page.setViewportSize({width:480,height:580});await page.evaluate(next=>applyDuoGeometry(next),geometry);
  for(const id of ['skipKanaBtn','pauseSessionBtn','endSessionBtn']){
    await page.locator('#'+id).evaluate(el=>el.scrollIntoView({block:'center'}));
    await reachable(page.locator('#'+id),{bottom:(await page.locator('.ma-ios-reading-keyboard').boundingBox()).y});
  }
});
for(const mode of ['reading','writing'])test(`${mode}: long character sequences fit the question column`,async({page})=>{
  await prepare(page,outer);await page.goto('/'+mode+'/');await settle(page);
  await page.evaluate(()=>{ModeAtlasTrainerControls.selectMode('free');settings.comboKana=true;settings.hiraganaRows=['h_sa'];onSettingsChanged();});
  await page.locator('#startBtn').click();await page.evaluate(()=>{streak=25;nextCharacter();});
  for(const geometry of [outer,inner]){
    await page.setViewportSize({width:geometry.width,height:geometry.height});await page.evaluate(next=>applyDuoGeometry(next),geometry);
    const prompt=page.locator(mode==='reading'?'#hiragana':'#prompt');
    expect(await prompt.evaluate(el=>el.scrollWidth<=el.parentElement.clientWidth+1)).toBe(true);
    await sessionFits(page);
  }
});
test('mixed practice releases the keyboard space for Recall answers',async({page})=>{
  await prepare(page,outer);await page.goto('/reading/');await settle(page);
  await page.evaluate(()=>{settings.kanaDirection='both';onSettingsChanged();});await page.locator('#startBtn').click();
  await page.evaluate(()=>{selectAnswerMode('writing');presentPracticeDirection();});
  await expect(page.locator('#mixedRecallChoices')).toBeVisible();await expect(page.locator('.ma-ios-reading-keyboard')).toBeHidden();
  for(const choice of await page.locator('#mixedRecallChoices button').all())await reachable(choice);
  await sessionFits(page);
});

const routes=['/','/learn/','/kana/','/kana/?view=path','/kana/?view=practice','/kana/?view=mastery','/kana/?view=tests','/kana/handwriting/','/reading/','/writing/','/kanji/','/results/','/results/kanji/','/progress/','/wordbank/','/friends/','/shop/','/kanji/sources/','/privacy/','/terms/'];
for(const route of routes)test('Duo content fits its columns: '+route,async({page},info)=>{
  await prepare(page,outer);await page.goto(route);await settle(page);
  for(const [label,geometry]of [['outer',outer],['inner',inner]]){
    await page.setViewportSize({width:geometry.width,height:geometry.height});await page.evaluate(next=>applyDuoGeometry(next),geometry);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const clipped=await page.locator('main').evaluateAll(mains=>mains.flatMap(main=>[...main.querySelectorAll('h1,h2,h3,p,label,button,select')]).filter(el=>{
      const c=getComputedStyle(el);return el.getClientRects().length&&el.clientWidth>0&&c.overflowX==='visible'&&el.scrollWidth>el.clientWidth+2;
    }).map(el=>({tag:el.tagName,id:el.id,class:el.className,text:el.textContent.slice(0,60),width:el.clientWidth,content:el.scrollWidth})));
    expect(clipped,label+' '+route).toEqual([]);
    await page.screenshot({path:info.outputPath(`${label}.png`)});
  }
});
