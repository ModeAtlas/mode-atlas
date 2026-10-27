const {test,expect}=require('@playwright/test');
const {settle}=require('./helpers/native-geometry');
const kana=require('./helpers/kana-course');
// User-reported usable window proportions, not an assertion of device specs.
const closed={width:432,height:640,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:358,y:60,width:52,height:100}]};
const short={width:960,height:440,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:24,left:0},occlusions:[{x:886,y:20,width:52,height:100}]};
async function setup(page,geometry=closed,theme='light',scale=1){
  await page.setViewportSize({width:geometry.width,height:geometry.height});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.addInitScript(({geometry,theme,scale})=>{
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{getViewportLayout:async()=>geometry,addListener:()=>Promise.resolve({remove(){}})}}};
    // Dismiss nonfunctional onboarding/legal chrome only; no practice settings,
    // character exposure, scores, schedules or earned rows are prepopulated.
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasThemePreference',theme);localStorage.setItem('modeAtlasSound','off');
    document.addEventListener('DOMContentLoaded',()=>{
      for(const [side,value]of Object.entries(geometry.safeArea))document.documentElement.style.setProperty('--ma-safe-'+side,value+'px');
      document.documentElement.style.setProperty('--ma-ios-text-scale',String(scale));document.documentElement.toggleAttribute('data-ma-large-text',scale>1);
      dispatchEvent(new Event('resize'));
    },{once:true});
    window.__spoken=[];
  },{geometry,theme,scale});
}
async function open(page,route){await page.goto(route);await settle(page);await page.evaluate(()=>{window.__documentMarker='same document';window.AtlasPlatform={...window.AtlasPlatform,speakJapanese:async text=>{window.__spoken.push(text);return {played:true};}};});}
async function bounds(page,geometry){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const problems=await page.locator('main').evaluate((main,geometry)=>{
    const visibleRect=node=>{const raw=node.getBoundingClientRect(),r={left:Math.max(0,raw.left),right:Math.min(innerWidth,raw.right),top:Math.max(0,raw.top),bottom:Math.min(innerHeight,raw.bottom)};
      for(let p=node.parentElement;p;p=p.parentElement){const style=getComputedStyle(p),box=p.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(style.overflowX)){r.left=Math.max(r.left,box.left);r.right=Math.min(r.right,box.right);}if(/hidden|auto|scroll|clip/.test(style.overflowY)){r.top=Math.max(r.top,box.top);r.bottom=Math.min(r.bottom,box.bottom);}}return r;};
    const controls=[...main.querySelectorAll('button,a,input,select,summary')].filter(n=>{const r=visibleRect(n);return r.right>r.left&&r.bottom>r.top&&getComputedStyle(n).visibility!=='hidden';});
    const issue=[];
    for(const control of controls){const r=visibleRect(control),label=(control.textContent||control.getAttribute('aria-label')||control.tagName).trim().slice(0,55);
      if(control.scrollWidth>control.clientWidth+2)issue.push('text overflow: '+label);
      if(geometry.occlusions.some(b=>r.right>b.x&&r.left<b.x+b.width&&r.bottom>b.y&&r.top<b.y+b.height))issue.push('system overlap: '+label);
    }
    for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
      if(controls[i].contains(controls[j])||controls[j].contains(controls[i]))continue;
      const a=visibleRect(controls[i]),b=visibleRect(controls[j]);
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)issue.push('controls overlap: '+controls[i].textContent.trim().slice(0,30)+' / '+controls[j].textContent.trim().slice(0,30));
    }
    return issue;
  },geometry);
  expect(problems).toEqual([]);
}
async function visibleAction(locator,geometry){
  // Assert initial geometry before Playwright's click could scroll it into view.
  await expect(locator).toBeInViewport({ratio:1});const box=await locator.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(geometry.safeArea.top);
  expect(box.y+box.height).toBeLessThanOrEqual(geometry.height-geometry.safeArea.bottom+1);
  expect(await locator.evaluate(node=>{const r=node.getBoundingClientRect();return [[r.left+r.width/2,r.top+r.height/2],[r.left+r.width/2,r.top+4],[r.left+r.width/2,r.bottom-4],[r.left+4,r.top+r.height/2],[r.right-4,r.top+r.height/2]].every(([x,y])=>{const top=document.elementFromPoint(x,y);return top===node||node.contains(top);});})).toBe(true);
}
async function headerVisible(page){
  const header=page.locator('.ma-course-header');await expect(header).toBeInViewport({ratio:1});
  expect((await header.boundingBox()).y).toBeGreaterThanOrEqual(0);
}
async function contrast(locator){
  return locator.evaluate(node=>{
    const rgba=value=>{const values=value.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];return [values[0],values[1],values[2],values[3]??1];};
    const blend=(front,back)=>[...front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3])),1];
    const ancestors=[];for(let n=node;n;n=n.parentElement)ancestors.unshift(n);
    let bg=[255,255,255,1];for(const n of ancestors)bg=blend(rgba(getComputedStyle(n).backgroundColor),bg);
    const fg=blend(rgba(getComputedStyle(node).color),bg);
    const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
}
for(const [name,geometry]of [['closed',closed],['short',short]])for(const theme of ['light','dark'])for(const scale of [1,1.5])test(`first actions and teaching: ${name}, ${theme}, ${scale}x`,async({page},info)=>{
  await setup(page,geometry,theme,scale);
  await open(page,'/kana/');await visibleAction(page.getByRole('button',{name:'Start lesson',exact:true}),geometry);await bounds(page,geometry);
  await page.getByRole('button',{name:'Start lesson',exact:true}).click();
  const next=page.getByRole('button',{name:'Continue',exact:true});await visibleAction(next,geometry);await headerVisible(page);await bounds(page,geometry);
  expect(await contrast(next)).toBeGreaterThanOrEqual(4.5);
  // Hover the already-visible target without an automation-induced scroll.
  const nextBox=await next.boundingBox();await page.mouse.move(nextBox.x+nextBox.width/2,nextBox.y+nextBox.height/2);
  expect(await contrast(next)).toBeGreaterThanOrEqual(4.5);await headerVisible(page);
  await page.screenshot({path:info.outputPath(`kana-teach-${name}-${theme}-${scale}.png`),animations:'disabled'});
  await open(page,'/kanji/');await visibleAction(page.getByRole('button',{name:'Start as a beginner',exact:true}),geometry);await bounds(page,geometry);
  await page.getByRole('button',{name:'Start as a beginner',exact:true}).click();const kanjiStart=page.locator('.ma-kanji-current .ma-button--primary');await visibleAction(kanjiStart,geometry);await kanjiStart.click();
  await visibleAction(page.locator('.ma-course-actions .ma-button--primary').last(),geometry);await headerVisible(page);await bounds(page,geometry);
  const shapeHeading=await page.locator('.ma-kanji-shape-heading').evaluate(node=>{const glyph=node.querySelector('.ma-kanji-glyph'),range=document.createRange();range.selectNodeContents(glyph);const ink=range.getBoundingClientRect(),label=node.querySelector('h2').getBoundingClientRect();return {glyphRight:ink.right,labelLeft:label.left};});
  expect(shapeHeading.glyphRight).toBeLessThanOrEqual(shapeHeading.labelLeft);
  await page.screenshot({path:info.outputPath(`kanji-teach-${name}-${theme}-${scale}.png`),animations:'disabled'});
  await open(page,'/wordbank/');await expect(page.locator('[data-words-hub] a')).toHaveCount(2);await visibleAction(page.locator('[data-words-hub] a').last(),geometry);await bounds(page,geometry);
  await page.screenshot({path:info.outputPath(`words-hub-${name}-${theme}-${scale}.png`),animations:'disabled'});
});

test('Kana path and unit details replace content in place and Back preserves script',async({page})=>{
  await setup(page);await open(page,'/kana/');await page.getByRole('button',{name:'Start lesson',exact:true}).click();await page.getByRole('button',{name:'Save & exit',exact:true}).click();
  await page.getByRole('button',{name:'Learning path',exact:true}).click();await expect(page.getByRole('heading',{name:'Your learning path',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Katakana',exact:true}).click();await page.locator('.ma-kana-course-unit:enabled').first().click();
  await expect(page.locator('.ma-course-view')).toHaveCount(1);await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>window.__documentMarker)).toBe('same document');
  await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByRole('button',{name:'Katakana',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.goBack();await expect(page.getByRole('button',{name:'Learning path',exact:true})).toBeVisible();expect(await page.evaluate(()=>window.__documentMarker)).toBe('same document');
});

test('Words separates course and bank and preserves destination through browser Back',async({page})=>{
  await setup(page);await open(page,'/wordbank/');await expect(page.locator('[data-words-hub] a')).toHaveCount(2);
  await page.locator('[data-words-hub]').getByRole('link',{name:/^Learn words\b/}).click();await expect(page).toHaveURL(/view=course/);
  for(const name of ['Add word','Review words','Word Bank settings'])await expect(page.getByRole('button',{name,exact:true})).toBeHidden();
  await expect(page.locator('#searchInput')).toBeHidden();await expect(page.locator('[data-ma-word-lessons]')).toBeHidden();await expect(page.getByRole('link',{name:'Continue Kana',exact:true})).toBeVisible();
  await page.goBack();await page.locator('[data-words-hub]').getByRole('link',{name:/^Word Bank\b/}).click();await expect(page).toHaveURL(/view=bank/);await expect(page.getByRole('button',{name:'Add word',exact:true})).toBeVisible();await expect(page.locator('[data-ma-vocabulary]')).toBeHidden();
  await page.goBack();await expect(page.locator('[data-words-hub]')).toBeVisible();
});

for(const theme of ['light','dark'])test(`selected Words spelling keeps readable normal and hover colours: ${theme}`,async({page})=>{
  await setup(page,closed,theme);await open(page,'/wordbank/?view=course');
  await page.getByText('Practice options',{exact:true}).click();
  const selected=page.getByRole('button',{name:'Kana',exact:true});await expect(selected).toHaveAttribute('aria-pressed','true');
  expect(await contrast(selected)).toBeGreaterThanOrEqual(4.5);await selected.hover();expect(await contrast(selected)).toBeGreaterThanOrEqual(4.5);
  await page.getByRole('button',{name:'Kana + Kanji',exact:true}).click();await page.getByText('Practice options',{exact:true}).click();
  const mixed=page.getByRole('button',{name:'Kana + Kanji',exact:true});await expect(mixed).toHaveAttribute('aria-pressed','true');await mixed.hover();expect(await contrast(mixed)).toBeGreaterThanOrEqual(4.5);
});

test('a fresh learner teaches, checks and reaches the next row using visible tasks',async({page},info)=>{
  test.setTimeout(120000);await setup(page,short,'dark');await open(page,'/kana/');await page.getByRole('button',{name:'Start lesson',exact:true}).click();
  let lessons=0,listening=0;const observed=[];
  for(let rounds=0;rounds<8;rounds++){
    while(await page.locator('.ma-course-view[data-task]').count()){
      const kind=await page.locator('.ma-course-view[data-task]').getAttribute('data-task');
      if(kind==='teach'){
        const char=await page.locator('.ma-kana-task-glyph').textContent();observed.push(char);
        if(char==='か'){
          expect(new Set(observed)).toEqual(new Set(['あ','い','う','え','お','か']));expect(lessons).toBeGreaterThanOrEqual(2);expect(listening).toBeGreaterThan(0);
          const saved=await page.evaluate(()=>ModeAtlasKanaLearning.courseRows('hiragana')[0]);expect(saved.checked).toBe(true);
          await page.screenshot({path:info.outputPath('real-journey-next-row.png'),animations:'disabled'});return;
        }
      }
      if(kind==='listen'){
        listening++;await expect(page.locator('.ma-kana-task-glyph,.ma-kana-task-reading,.ma-kana-task-cue')).toHaveCount(0);
        await expect(page.getByRole('button',{name:'Play sound',exact:true})).toHaveCount(1);
        await expect(page.getByRole('group',{name:'Answer choices'}).getByRole('button').first()).toBeDisabled();
      }
      await kana.task(page);
    }
    lessons++;await expect(page.locator('.ma-course-actions .ma-button--primary')).toHaveCount(1);await page.locator('.ma-course-actions .ma-button--primary').click();
  }
  throw Error('The learner never reached the next row after completing the visible course tasks.');
});

for(const branch of ['Kana','Words'])test(`${branch} keeps an unfinished typed answer through a keyboard-sized viewport and back`,async({page},info)=>{
  test.setTimeout(90000);await setup(page,short,'dark');await open(page,'/kana/');await page.getByRole('button',{name:'Start lesson',exact:true}).click();
  let input;
  if(branch==='Kana'){
    for(let i=0;i<30&&!await page.getByLabel('Type the sound in romaji').count();i++)await kana.task(page);
    input=page.getByLabel('Type the sound in romaji');
  }else{
    // Earn the eligible word pool through real teaching, then enter Words.
    await kana.session(page);await page.getByRole('button',{name:'Save & exit',exact:true}).click();
    await open(page,'/wordbank/');await page.locator('[data-words-hub]').getByRole('link',{name:/^Learn words\b/}).click();await settle(page);
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    for(let i=0;i<8&&!await page.locator('#maVocabularyAnswer').count();i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
    input=page.locator('#maVocabularyAnswer');
  }
  await expect(input).toBeVisible();await input.fill('a');
  const before={position:await page.locator('.ma-course-position').textContent(),prompt:await page.locator(branch==='Kana'?'.ma-kana-task-glyph':'.ma-vocabulary-glyph').textContent()};
  const reduced={...short,height:300};await page.setViewportSize({width:reduced.width,height:reduced.height});
  await input.scrollIntoViewIfNeeded();await expect(input).toHaveValue('a');await expect(input).toBeInViewport({ratio:1});
  await visibleAction(page.getByRole('button',{name:'Check answer',exact:true}),reduced);await headerVisible(page);await bounds(page,reduced);
  expect(await page.locator('.ma-course-position').textContent()).toBe(before.position);expect(await page.locator(branch==='Kana'?'.ma-kana-task-glyph':'.ma-vocabulary-glyph').textContent()).toBe(before.prompt);
  await page.screenshot({path:info.outputPath(`${branch.toLowerCase()}-reduced-viewport.png`),animations:'disabled'});
  await page.setViewportSize({width:short.width,height:short.height});await expect(input).toHaveValue('a');await visibleAction(page.getByRole('button',{name:'Check answer',exact:true}),short);await headerVisible(page);
  expect(await page.locator('.ma-course-position').textContent()).toBe(before.position);
});
