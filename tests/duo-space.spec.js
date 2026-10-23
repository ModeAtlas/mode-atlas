const {test,expect}=require('@playwright/test');
const {outer,inner,portrait,prepare,settle}=require('./helpers/native-geometry');
const left={...outer,safeArea:{...outer.safeArea,left:84,right:0},occlusions:outer.occlusions.map(r=>({...r,x:outer.width-r.x-r.width}))};

async function geometry(page,value){
  await page.setViewportSize({width:value.width,height:value.height});
  await page.evaluate(next=>applyDuoGeometry(next),value);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function clearOfSystem(locator,layout){
  await expect(locator).toBeVisible();
  await expect.poll(()=>locator.evaluate((el,blocks)=>{
    const r=el.getBoundingClientRect();
    return !blocks.some(b=>r.right>b.x&&r.left<b.x+b.width&&r.bottom>b.y&&r.top<b.y+b.height);
  },layout.occlusions)).toBe(true);
}
async function systemIllustration(page,layout){
  // Evidence annotation only: Chromium cannot draw UIKit's actual status bar.
  await page.evaluate(layout=>{
    document.querySelectorAll('[data-test-system-region]').forEach(el=>el.remove());
    for(const r of layout.occlusions){const el=document.createElement('div');el.dataset.testSystemRegion='';el.setAttribute('aria-hidden','true');el.textContent='System\narea';
      Object.assign(el.style,{position:'fixed',left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px',background:'#000',color:'#fff',borderRadius:'22px',display:'grid',placeContent:'center',whiteSpace:'pre-line',textAlign:'center',font:'12px sans-serif',zIndex:'2147483647',pointerEvents:'none'});document.body.append(el);}
  },layout);
}

for(const [name,layout] of [['right',outer],['left',left],['wide',inner]])for(const theme of ['dark','light']){
  test(`${name} ${theme}: reading borrows the clear strip and protects system controls`,async({page},info)=>{
    await prepare(page,layout,theme);await page.goto('/reading/');await settle(page);await page.locator('#startBtn').click();
    await expect(page.locator('html')).toHaveAttribute('data-ma-expanded-practice','');
    await expect.poll(async()=>(await page.locator('.ma-trainer-card').boundingBox()).width).toBeGreaterThan(layout.width-48);
    for(const selector of ['#input','#skipKanaBtn','#pauseSessionBtn','#endSessionBtn','.ma-session-hud .scoreline','.ma-study-progress'])await clearOfSystem(page.locator(selector),layout);
    const keys=page.locator('.ma-ios-reading-keyboard__row').first();
    if(name!=='wide')expect((await keys.boundingBox()).width).toBeGreaterThan(layout.width-24);
    await systemIllustration(page,layout);await page.screenshot({path:info.outputPath('reading.png')});
    await page.locator('#input').evaluate(el=>{el.value='s';el.setSelectionRange(1,1);});
    const changed={...layout,occlusions:layout.occlusions.map(r=>({...r,height:320}))};
    await geometry(page,changed);await expect(page.locator('#input')).toHaveValue('s');
    for(const selector of ['#input','#skipKanaBtn','#pauseSessionBtn','#endSessionBtn'])await clearOfSystem(page.locator(selector),changed);
  });
  test(`${name} ${theme}: account uses the strip below its protected header`,async({page},info)=>{
    await prepare(page,layout,theme);await page.goto('/');await settle(page);await page.locator('#profileOpenBtn').click();
    const sheet=page.locator('#maAccountSheet');await expect(sheet).toBeVisible();
    if(name!=='wide')expect((await sheet.boundingBox()).width).toBeGreaterThan(layout.width-24);
    for(const button of await page.locator('.ma-account-header button,.ma-account-tab').all())await clearOfSystem(button,layout);
    expect((await page.locator('.ma-account-view:not([hidden])').boundingBox()).y).toBeGreaterThanOrEqual(Math.max(...layout.occlusions.map(r=>r.y+r.height)));
    await systemIllustration(page,layout);await page.screenshot({path:info.outputPath('profile.png')});
    await page.getByRole('tab',{name:'Settings',exact:true}).click();await clearOfSystem(page.locator('#maAccountClose'),layout);
    await page.locator('#maAccountClose').click();await expect(sheet).toBeHidden();
  });
}
test('word lessons use a wider dialog and preserve an answer across folding',async({page},info)=>{
  await prepare(page,outer);await page.goto('/wordbank/');await settle(page);
  await page.getByRole('button',{name:'Start lesson: Make a polite connection',exact:true}).click();
  const dialog=page.locator('.ma-dialog');expect((await dialog.boundingBox()).width).toBeGreaterThan(430);
  await clearOfSystem(dialog,outer);await systemIllustration(page,outer);await page.screenshot({path:info.outputPath('word-outer.png')});
  await geometry(page,inner);await systemIllustration(page,inner);
  const intro=await page.locator('.ma-word-lesson-intro').boundingBox(),context=await page.locator('.ma-word-lesson-context').boundingBox();
  expect(context.x).toBeGreaterThanOrEqual(intro.x+intro.width);await page.screenshot({path:info.outputPath('word-wide.png')});
  await page.getByRole('button',{name:'Try remembering it'}).click();await page.getByLabel('Reading (kana or romaji)',{exact:true}).fill('sumimasen');
  await geometry(page,outer);await expect(page.getByLabel('Reading (kana or romaji)',{exact:true})).toHaveValue('sumimasen');
  await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.locator('.ma-word-lesson h2')).toHaveText('ありがとうございます');
});
test('setup and handwriting dialogs use the unobstructed width',async({page},info)=>{
  await prepare(page,outer);await page.goto('/reading/');await settle(page);await page.locator('#modifiersTab').click();
  const setup=page.locator('#practiceSetupDialog');expect((await setup.boundingBox()).width).toBeGreaterThan(430);await clearOfSystem(setup,outer);
  await page.screenshot({path:info.outputPath('setup-dialog.png')});await page.locator('#practiceSetupDone').click();
  await page.goto('/kana/handwriting/?kana=あ');await expect(page.locator('.ma-handwriting-board')).toBeVisible();
  const hand=page.locator('.ma-handwriting');expect((await hand.boundingBox()).width).toBeGreaterThan(430);await clearOfSystem(hand,outer);
  await expect(page.locator('.ma-handwriting-board')).toBeInViewport({ratio:1});
  await systemIllustration(page,outer);await page.screenshot({path:info.outputPath('handwriting.png')});
});
test('resume checkpoint spans the setup grid and keeps Start reachable',async({page},info)=>{
  await prepare(page,outer);await page.goto('/reading/');await settle(page);await page.locator('#startBtn').click();await page.reload();await settle(page);
  const recovery=page.locator('#practiceRecovery');await expect(recovery).toBeVisible();
  const r=await recovery.boundingBox(),wrap=await page.locator('#startWrap').boundingBox();expect(r.width).toBeCloseTo(wrap.width,0);
  await expect(page.locator('#startBtn')).toBeInViewport({ratio:1});await page.screenshot({path:info.outputPath('resume.png')});
  await page.getByRole('button',{name:'Resume set',exact:true}).click();await expect(page.locator('body')).toHaveClass(/trainer-session-active/);
});
test('starting Home fills its illustration column in the tall inner window',async({page},info)=>{
  await prepare(page,portrait,'dark',false);await page.goto('/');await settle(page);
  await page.evaluate(()=>{ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:0,wrong:1}});dispatchEvent(new Event('modeAtlasCloudDataChanged'));});
  await expect(page.locator('body')).toHaveAttribute('data-ma-home-state','starting');
  await expect(page.locator('.atlas-home-learning__art')).toBeVisible();
  const copy=await page.locator('.atlas-home-learning__copy').boundingBox(),art=await page.locator('.atlas-home-learning__art').boundingBox();expect(art.x).toBeGreaterThanOrEqual(copy.x+copy.width);
  await page.screenshot({path:info.outputPath('home-portrait.png')});
});
test('wide Kanji teaching pairs the character with its reading and example',async({page},info)=>{
  await prepare(page,inner);await page.goto('/kanji/');await settle(page);await page.getByRole('button',{name:'Start as a beginner',exact:true}).click();await page.getByRole('button',{name:'Start learning',exact:true}).click();
  const hero=await page.locator('.ma-kanji-lesson-hero').boundingBox(),word=await page.locator('.ma-kanji-spoken-word').boundingBox();expect(word.x).toBeGreaterThanOrEqual(hero.x+hero.width);
  await page.screenshot({path:info.outputPath('kanji-wide.png')});
});
test('old shells and stale snapshots retain the safe boundary',async({page})=>{
  const old={...outer,reservedRegionsAvailable:false};await prepare(page,old);await page.goto('/reading/');await settle(page);await page.locator('#startBtn').click();
  await expect.poll(async()=>{const r=await page.locator('.ma-trainer-card').boundingBox();return r.x+r.width;}).toBeLessThanOrEqual(outer.width-outer.safeArea.right);
  await geometry(page,outer);await expect.poll(async()=>(await page.locator('.ma-trainer-card').boundingBox()).width).toBeGreaterThan(430);
  await page.setViewportSize({width:460,height:680});
  await expect.poll(async()=>{const r=await page.locator('.ma-trainer-card').boundingBox();return r.x+r.width;}).toBeLessThanOrEqual(460-84);
});
test('large text and a shorter window keep expanded overlays scrollable and unobstructed',async({page})=>{
  const short={...outer,height:580};await prepare(page,short);await page.goto('/');await settle(page);
  await page.evaluate(()=>{document.documentElement.style.setProperty('--ma-ios-text-scale','1.5');document.documentElement.setAttribute('data-ma-large-text','');dispatchEvent(new Event('modeAtlasTextSizeChanged'));});
  await page.locator('#profileOpenBtn').click();await clearOfSystem(page.locator('#maAccountClose'),short);
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  const settings=page.locator('#maAccount-settings');await settings.getByRole('button',{name:'Reset data',exact:true}).scrollIntoViewIfNeeded();
  await expect(settings.getByRole('button',{name:'Reset data',exact:true})).toBeInViewport({ratio:1});
  await settings.getByRole('button',{name:'Reset data',exact:true}).click();
  await clearOfSystem(page.locator('.ma-dialog'),short);await page.getByRole('button',{name:'Keep data',exact:true}).click();
  await page.locator('#maAccountClose').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('a system-region change without window resizing preserves handwriting and cancels only the unfinished stroke',async({page})=>{
  await prepare(page,outer);await page.goto('/kana/handwriting/?kana=あ');
  const board=page.locator('.ma-handwriting-board');await expect(board).toBeVisible();
  const points=await board.evaluate(board=>{const p=board.querySelector('.ma-handwriting-guide.is-next'),r=board.getBoundingClientRect(),length=p.getTotalLength();return Array.from({length:24},(_,i)=>{const at=p.getPointAtLength(length*i/23);return {x:r.x+at.x*r.width/109,y:r.y+at.y*r.height/109};});});
  await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y);await page.mouse.up();
  await expect(page.locator('.ma-handwriting-guide.is-done')).toHaveCount(1);
  for(const height of [160,440]){
    const before=await board.boundingBox();await page.mouse.move(before.x+40,before.y+40);await page.mouse.down();await page.mouse.move(before.x+50,before.y+50);
    await expect(page.locator('.ma-handwriting-ink')).toHaveCount(2);
    await page.evaluate(next=>applyDuoNativeGeometry(next),{...outer,occlusions:outer.occlusions.map(r=>({...r,height}))});
    const dimension=height===160?'y':'width';await expect.poll(async()=>(await board.boundingBox())[dimension]).not.toBe(before[dimension]);
    await expect(page.locator('.ma-handwriting-ink')).toHaveCount(1);await page.mouse.up();
    await expect(page.locator('.ma-handwriting-guide.is-done')).toHaveCount(1);
  }
});
