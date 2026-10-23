const {test,expect}=require('@playwright/test');

const {outer,inner,portrait,views,prepare,settle}=require('./helpers/native-geometry');

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

for(const theme of ['dark','light'])for(const [label,geometry]of views){
  test(`${label} ${theme}: setup and reading actions fit without scrolling`,async({page},info)=>{
    await prepare(page,geometry,theme);await page.goto('/reading/');await settle(page);
    for(const id of ['startBtn','kanaHintsQuick','modifiersTab','profileOpenBtn'])await reachable(page.locator('#'+id));
    const links=page.locator('.ma-ios-tabs__links'),nav=await page.locator('.ma-ios-tabs').boundingBox(),group=await links.boundingBox();
    if(label!=='portrait')expect(Math.abs((group.y+group.height/2)-(nav.y+nav.height/2))).toBeLessThan(2);
    for(const link of await page.locator('.ma-ios-tab').all()){const r=await link.boundingBox();expect(r.height).toBeGreaterThanOrEqual(label==='portrait'?49:64);await reachable(link);}
    for(const name of ['learn','progress','friends'])await expect(page.locator(`.ma-ios-tab[href="/${name}/"] use`)).toHaveAttribute('href',`/assets/mode-atlas-icons.svg#icon-nav-${name}`);
    await page.screenshot({path:info.outputPath(`setup-${label}-${theme}.png`)});
    await page.locator('#startBtn').click();await sessionFits(page);
    await reachable(page.locator('#input'),{bottom:(await page.locator('.ma-ios-reading-keyboard').boundingBox()).y});
    if(label==='inner'){
      const p=await page.locator('.ma-trainer-prompt-wrap').boundingBox(),answer=await page.locator('.ma-trainer-answer-wrap').boundingBox();
      expect(answer.x).toBeGreaterThan(p.x+p.width);
      expect((await page.locator('.ma-trainer-card').boundingBox()).width).toBeGreaterThan(800);
    }
    if(label==='portrait'){
      const prompt=await page.locator('.ma-trainer-prompt-wrap').boundingBox(),answer=await page.locator('.ma-trainer-answer-wrap').boundingBox();
      expect(answer.y).toBeGreaterThanOrEqual(prompt.y+prompt.height);
      await expect.poll(()=>page.evaluate(()=>{
        const card=document.querySelector('.ma-trainer-card').getBoundingClientRect();
        const top=parseFloat(getComputedStyle(document.body).paddingTop),bottom=document.querySelector('.ma-ios-reading-keyboard').getBoundingClientRect().top-12;
        return Math.abs(card.top+card.height/2-(top+bottom)/2);
      })).toBeLessThan(8);
    }
    await page.screenshot({path:info.outputPath(`reading-${label}-${theme}.png`)});
    await page.locator('#pauseSessionBtn').click();await expect(page.locator('.ma-ios-reading-keyboard')).toBeHidden();
    await reachable(page.locator('#pauseSessionBtn'));await page.locator('#pauseSessionBtn').click();await sessionFits(page);
    await page.locator('#skipKanaBtn').click();await expect(page.locator('#studyFeedback')).toBeVisible();
    await reachable(page.locator('#studyFeedbackContinue'));await page.locator('#studyFeedbackContinue').click();await sessionFits(page);
    await page.locator('#endSessionBtn').click();await expect(page.locator('.ma-study-summary')).toBeVisible();
  });
}
for(const [label,geometry]of views){
  test(`${label}: eight writing answers and all session actions remain visible`,async({page},info)=>{
    await prepare(page,geometry);await page.goto('/writing/');await settle(page);await reachable(page.locator('#startBtn'));await page.locator('#startBtn').click();
    await expect(page.locator('.choice-btn')).toHaveCount(8);
    for(const choice of await page.locator('.choice-btn').all())await reachable(choice);
    const dock=await page.locator('.ma-ios-tabs').boundingBox(),exit=await page.locator('.ma-ios-tabs #studyNavShowBtn').boundingBox();
    expect(Math.abs(exit.x+exit.width/2-(dock.x+dock.width/2))).toBeLessThan(2);
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
  for(const geometry of [outer,portrait,inner,outer]){
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
  for(const [label,geometry]of views){
    await page.setViewportSize({width:geometry.width,height:geometry.height});await page.evaluate(next=>applyDuoGeometry(next),geometry);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(route==='/'&&label==='inner'){
      const hero=await page.locator('.atlas-home-learning').boundingBox(),personal=await page.locator('.atlas-home-personal').boundingBox();
      expect(personal.x).toBeGreaterThanOrEqual(hero.x+hero.width);
      for(const card of await page.locator('.ma-branch-tile').all())await expect(card).toBeInViewport({ratio:1});
    }
    const clipped=await page.locator('main').evaluateAll(mains=>mains.flatMap(main=>[...main.querySelectorAll('h1,h2,h3,p,label,button,select')]).filter(el=>{
      const c=getComputedStyle(el);return el.getClientRects().length&&el.clientWidth>0&&c.overflowX==='visible'&&el.scrollWidth>el.clientWidth+2;
    }).map(el=>({tag:el.tagName,id:el.id,class:el.className,text:el.textContent.slice(0,60),width:el.clientWidth,content:el.scrollWidth})));
    expect(clipped,label+' '+route).toEqual([]);
    await page.screenshot({path:info.outputPath(`${label}.png`)});
  }
});

for(const [view,geometry]of views)for(const [skill,label,route]of [['reading','Read','reading'],['writing','Recall','writing'],['both','Read + Recall','reading']])test(`${view}: Kana starts the chosen ${label} session once`,async({page})=>{
  await prepare(page,geometry);await page.goto('/kana/?view=practice');await settle(page);
  await page.getByRole('button',{name:label,exact:true}).click();
  await reachable(page.getByRole('button',{name:'Adjust this session',exact:true}));
  await reachable(page.getByRole('button',{name:'Start practice',exact:true}));
  await page.getByRole('button',{name:'Start practice',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/'+route+'/$'));await expect(page.locator('body')).toHaveClass(/trainer-session-active/);
  expect(await page.evaluate(()=>settings.kanaDirection)).toBe(skill);await sessionFits(page);
  const before=await page.evaluate(()=>({char:currentChar,run:sessionStats.study.runId}));
  await page.evaluate(()=>document.dispatchEvent(new Event('ma:trainer-ready')));
  expect(await page.evaluate(()=>({char:currentChar,run:sessionStats.study.runId}))).toEqual(before);
});

test('web navigation retains the approved destination illustrations',async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto('/learn/');await settle(page);
  for(const name of ['learn','progress','friends','shop'])await expect(page.locator(`.ma-nav__link[href="/${name}/"] use`)).toHaveAttribute('href',`/assets/mode-atlas-icons.svg#icon-nav-${name}`);
});
