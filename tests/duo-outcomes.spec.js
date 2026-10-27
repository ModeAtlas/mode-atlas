const {test,expect}=require('@playwright/test');
const {prepare,settle,inner,portrait}=require('./helpers/native-geometry');
const closed={width:432,height:640,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:358,y:60,width:52,height:100}]};
const landscape={width:640,height:432,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:570,y:12,width:52,height:136}]};
const views=[['closed',closed],['landscape',landscape],['inner',inner],['tall',portrait]];
async function centred(page,g){
  const panel=page.locator('.ma-dialog');await expect(panel).toBeVisible();await expect(page.locator('.ma-dialog-layer')).toHaveCSS('opacity','1');
  await expect.poll(async()=>{const b=await panel.boundingBox();return Math.abs(b.y+b.height/2-(g.safeArea.top+g.height-g.safeArea.bottom)/2);}).toBeLessThan(2);
  const b=await panel.boundingBox();expect(b.x).toBeGreaterThanOrEqual(g.safeArea.left+11);expect(b.x+b.width).toBeLessThanOrEqual(g.width-g.safeArea.right-11);
  expect(b.y).toBeGreaterThanOrEqual(g.safeArea.top+11);expect(b.y+b.height).toBeLessThanOrEqual(g.height-g.safeArea.bottom-11);
  expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  const close=panel.getByRole('button',{name:'Close dialog'});await close.scrollIntoViewIfNeeded();await expect(close).toBeInViewport();
}
for(const [label,g]of views)for(const theme of ['light','dark'])test(`${label} ${theme}: a completed set and level-up are centred and scroll to every action`,async({page},info)=>{
  test.setTimeout(60000);await prepare(page,g,theme);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/writing/?practice=10');await settle(page);
  await page.locator('#startBtn').click();
  for(let i=0;i<10;i++){
    await expect.poll(()=>page.evaluate(()=>!locked)).toBe(true);
    const answer=await page.evaluate(correct=>correct?currentChar:currentChoices.find(k=>k!==currentChar),i<7);
    await page.locator('.choice-btn').getByText(answer,{exact:true}).click();
    if(i>=7&&i<9)await page.locator('#studyFeedbackContinue').click();
  }
  // The final mistake may need its explicit teaching step before completion.
  if(await page.locator('#studyFeedbackContinue').isVisible())await page.locator('#studyFeedbackContinue').click();
  if(await page.locator('.ma-level-up-card').count())await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.locator('.ma-study-summary__stats')).toContainText('70%');await centred(page,g);
  if(label==='inner'||label==='tall'){
    const a=await page.locator('.ma-study-summary__learning').boundingBox(),b=await page.locator('.ma-study-summary__reward').boundingBox();expect(b.x).toBeGreaterThanOrEqual(a.x+a.width);
  }
  await page.screenshot({path:info.outputPath(`summary-${label}-${theme}.png`),animations:'disabled'});
  await page.getByRole('button',{name:'Done',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Done',exact:true})).toBeInViewport();await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.evaluate(()=>{ModeAtlasProgressUI.queueLevelUp({previousLevel:4,level:5,levelRequirement:400,levelXp:100});void ModeAtlasProgressUI.naturalBreak();});await expect(page.locator('.ma-level-up-card')).toBeVisible();await centred(page,g);
  await page.screenshot({path:info.outputPath(`level-${label}-${theme}.png`),animations:'disabled'});
  const next=page.getByRole('button',{name:'Continue',exact:true});await next.scrollIntoViewIfNeeded();await expect(next).toBeInViewport();await next.click();await expect(page.locator('.ma-dialog-layer')).toBeHidden();
});
for(const scale of [1,1.5])test(`results survive rotation and ${scale}x text without losing their content`,async({page},info)=>{
  await prepare(page,inner);await page.goto('/reading/?practice=10');await settle(page);await page.locator('#startBtn').click();await page.locator('#endSessionBtn').click();await expect(page.locator('.ma-study-summary')).toBeVisible();
  await page.evaluate(scale=>{document.documentElement.style.setProperty('--ma-ios-text-scale',scale);document.documentElement.toggleAttribute('data-ma-large-text',scale>1);},scale);
  const content=await page.locator('.ma-study-summary').textContent();
  for(const g of [closed,landscape,portrait,inner]){
    await page.setViewportSize({width:g.width,height:g.height});await page.evaluate(g=>applyDuoGeometry(g),g);await centred(page,g);await expect(page.locator('.ma-study-summary')).toHaveText(content);
    await page.getByRole('button',{name:'Done',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Done',exact:true})).toBeInViewport();
  }
  await page.screenshot({path:info.outputPath(`results-text-${scale}.png`),animations:'disabled'});
});
for(const theme of ['light','dark'])for(const scale of [1,1.5])test(`rewards toggle order preserves type sizes and selected rewards: ${theme}, ${scale}x`,async({page},info)=>{
  await prepare(page,inner,theme);await page.addInitScript(()=>{Capacitor.Plugins.ModeAtlasNative.setAppIcon=async()=>true;});
  await page.goto('/progress/?tab=rewards');await settle(page);
  await page.evaluate(scale=>{document.documentElement.style.setProperty('--ma-ios-text-scale',scale);document.documentElement.toggleAttribute('data-ma-large-text',scale>1);},scale);
  await page.evaluate(()=>{ModeAtlasRewardAccess={...ModeAtlasRewardAccess,current:()=>({allCustom:true,grants:[]})};ModeAtlasRewardsUI.refresh();});
  await expect(page.locator('[data-reward-category=wardrobe]')).toBeVisible();
  const headings=page.locator('.ma-reward-category__heading');
  async function sizes(){return headings.evaluateAll(nodes=>nodes.map(node=>[...node.children].map(el=>{const range=document.createRange();range.selectNodeContents(el);return {font:getComputedStyle(el).fontSize,line:getComputedStyle(el).lineHeight,adjust:getComputedStyle(el).getPropertyValue('-webkit-text-size-adjust'),glyphHeight:Math.max(0,...[...range.getClientRects()].map(rect=>rect.height))};})));}
  const original=await sizes();expect(original.length).toBeGreaterThanOrEqual(4);
  const saved=await page.evaluate(()=>JSON.stringify(ModeAtlasProgress.readSnapshot().appearance));
  for(const type of ['banners','frames','themes','frames','wardrobe','banners','themes','icons','wardrobe','icons','banners','banners']){
    await page.locator(`[data-reward-category="${type}"]>summary`).click();expect(await sizes()).toEqual(original);
  }
  // Desktop WebKit is built without iOS text autosizing. Still check rendered
  // glyph sizes there; assert the percentage where the engine supports it.
  if(await page.evaluate(()=>CSS.supports('-webkit-text-size-adjust','100%')))expect(original.every(row=>row.every(value=>value.adjust==='100%'))).toBe(true);
  expect(new Set(original.map(row=>row[0].font)).size).toBe(1);expect(await page.evaluate(()=>JSON.stringify(ModeAtlasProgress.readSnapshot().appearance))).toBe(saved);
  for(const g of [closed,landscape,inner]){await page.setViewportSize({width:g.width,height:g.height});await page.evaluate(g=>applyDuoGeometry(g),g);expect(await sizes()).toEqual(original);expect(await page.locator('.ma-collection-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}
  await page.locator('.ma-reward-category').evaluateAll(nodes=>nodes.forEach(el=>el.open=false));
  await page.locator('.ma-reward-studio').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`rewards-${theme}-${scale}.png`),animations:'disabled'});
});

for(const [label,g]of [['closed',closed],['landscape',landscape]])test(`Word Bank completion uses the full-page safe area: ${label}`,async({page})=>{
  await prepare(page,g);await page.addInitScript(()=>localStorage.setItem('kanaWordBank',JSON.stringify([{id:'nihon',written:'日本',reading:'にほん',english:'Japan'}])));
  await page.goto('/wordbank/?view=bank');await settle(page);await page.getByRole('button',{name:'Review words',exact:true}).click();
  const course=page.locator('#maWordsFocus');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Your answer (kana or romaji)',{exact:true}).fill('nihon');await page.getByRole('button',{name:'Check reading',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  await course.getByRole('button',{name:'Reveal',exact:true}).click();await course.getByRole('button',{name:'Remembered',exact:true}).click();await course.getByRole('button',{name:'Continue',exact:true}).click();await course.getByRole('button',{name:'Skip listening',exact:true}).click();
  await expect(course).toContainText('Set complete');const done=course.getByRole('button',{name:'Back to Word Bank',exact:true});await expect(done).toBeInViewport({ratio:1});
  const b=await done.boundingBox();expect(b.y).toBeGreaterThanOrEqual(g.safeArea.top);expect(b.y+b.height).toBeLessThanOrEqual(g.height-g.safeArea.bottom);expect(b.x+b.width).toBeLessThanOrEqual(g.width-g.safeArea.right);
  expect(await course.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await done.click();await expect(course).toBeHidden();await expect(page.locator('.wordbank-library')).toBeVisible();
});
