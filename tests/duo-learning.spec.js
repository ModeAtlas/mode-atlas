const {test,expect}=require('@playwright/test');
async function setup(page){
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
 await page.addInitScript(()=>{
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
  for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
  localStorage.setItem('modeAtlasBranchToursSeen',JSON.stringify({kana:true,kanji:true,words:true}));
 });
}
async function insets(page,left,right){
 await page.evaluate(({left,right})=>{
  const root=document.documentElement;
  for(const [side,value]of Object.entries({left,right,top:24,bottom:16}))root.style.setProperty('--ma-safe-'+side,value+'px');
  dispatchEvent(new Event('resize'));
 },{left,right});
}
async function nativeGeometry(page,initial){
 await page.addInitScript(initial=>{
  let listener=()=>{};
  window.Capacitor.Plugins.ModeAtlasNative={
   getViewportLayout:async()=>initial,
   addListener:(name,callback)=>{if(name==='viewportLayoutChanged')listener=callback;return Promise.resolve({remove(){}});}
  };
  window.updateViewportFixture=layout=>{
   for(const [side,value]of Object.entries(layout.safeArea))document.documentElement.style.setProperty('--ma-safe-'+side,value+'px');
   listener(layout);
  };
 },initial);
}
const wideGeometry={width:960,height:680,safeArea:{top:12,right:84,bottom:20,left:0},occlusions:[{x:890,y:24,width:52,height:84}]};
test('expanded Kana keeps its next action visible and handwriting gives the board more space',async({page})=>{
 await setup(page);await page.setViewportSize({width:960,height:680});await nativeGeometry(page,wideGeometry);
 await page.goto('/kana/');await page.getByRole('button',{name:/Start lesson/}).click();await page.goto('/kana/?view=path');
 await page.evaluate(layout=>updateViewportFixture(layout),wideGeometry);
 const next=page.getByRole('button',{name:'Learn this row',exact:true});await expect(next).toBeVisible();
 const action=await next.boundingBox();expect(action.y+action.height).toBeLessThan(660);
 const current=await page.locator('.ma-kana-path-current').boundingBox(),path=await page.locator('.ma-kana-path-preview').boundingBox();expect(path.x).toBeGreaterThan(current.x+current.width);
 await next.click();await page.getByRole('button',{name:'See the strokes',exact:true}).click();
 const board=await page.locator('.ma-handwriting-board').boundingBox();expect(board.width).toBeGreaterThanOrEqual(340);
 const close=page.getByRole('button',{name:'Close',exact:true});await expect(close).toBeInViewport();await close.click();
 await expect(page.locator('.ma-kana-lesson-shape')).toHaveText('あ');
});
test('native dock shares the system side region, follows occlusions and moves back in portrait',async({page})=>{
 await setup(page);await page.setViewportSize({width:960,height:680});await nativeGeometry(page,wideGeometry);await page.goto('/');
 await page.evaluate(layout=>updateViewportFixture(layout),wideGeometry);
 await expect(page.locator('html')).toHaveAttribute('data-ma-shared-bar','');
 const bounds=()=>page.locator('.ma-ios-tabs').boundingBox();
 let dock=await bounds();expect(dock.x).toBeGreaterThanOrEqual(876);expect(dock.y).toBeGreaterThanOrEqual(108);
 let main=await page.locator('main').boundingBox();expect(main.x+main.width).toBeLessThanOrEqual(dock.x);
 // A Live Activity can grow without a viewport resize. No nav control may be
 // placed over its region, and the buttons must still have touch-size targets.
 await page.evaluate(layout=>updateViewportFixture({...layout,occlusions:[{x:878,y:10,width:80,height:250}]}),wideGeometry);
 await expect.poll(async()=>(await bounds()).y).toBeGreaterThanOrEqual(260);
 for(const link of await page.locator('.ma-ios-tab').all()){const r=await link.boundingBox();expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);expect(r.y+r.height).toBeLessThanOrEqual(660);}
 // Reclaim the bottom on the narrow outer display too, without deducting a
 // second rail from the already narrow content area.
 const outer={width:480,height:680,safeArea:{top:12,right:84,bottom:20,left:0},occlusions:[{x:406,y:24,width:60,height:130}]};
 await page.setViewportSize({width:480,height:680});await page.evaluate(layout=>updateViewportFixture(layout),outer);
 await expect(page.locator('html')).toHaveAttribute('data-ma-navigation','rail');
 main=await page.locator('main').boundingBox();expect(main.width).toBeGreaterThan(340);expect((await bounds()).x).toBeGreaterThanOrEqual(396);
 const portrait={width:680,height:960,safeArea:{top:48,right:0,bottom:24,left:0},occlusions:[]};
 await page.setViewportSize({width:680,height:960});await page.evaluate(layout=>updateViewportFixture(layout),portrait);
 await expect(page.locator('html')).toHaveAttribute('data-ma-navigation','bottom');
 expect((await bounds()).width).toBe(680);await expect(page.locator('html')).not.toHaveAttribute('data-ma-shared-bar','');
 // Split View can put the system region on the other edge.
 const left={...wideGeometry,safeArea:{...wideGeometry.safeArea,left:84,right:0},occlusions:[{x:12,y:24,width:52,height:84}]};
 await page.setViewportSize({width:960,height:680});await page.evaluate(layout=>updateViewportFixture(layout),left);
 await expect(page.locator('html')).toHaveAttribute('data-ma-rail-side','left');dock=await bounds();expect(dock.x+dock.width).toBeLessThanOrEqual(84);
 await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Close account menu',exact:true}).click();await expect(page.locator('#maAccountSheet')).toBeHidden();
});
test('expanded Home shows all branch cards without scrolling and Learn adapts to its content width',async({page},info)=>{
 await setup(page);await page.setViewportSize({width:960,height:680});await nativeGeometry(page,wideGeometry);await page.goto('/');
 await page.evaluate(layout=>updateViewportFixture(layout),wideGeometry);
 await expect(page.locator('#maLoadingScreen')).toBeHidden();
 const hero=await page.locator('.atlas-home-learning').boundingBox();expect(hero.height).toBeLessThan(310);
 const cards=page.locator('.ma-branch-tile');await expect(cards).toHaveCount(3);
 for(const card of await cards.all()){const r=await card.boundingBox();expect(r.y+r.height).toBeLessThanOrEqual(660);}
 await page.screenshot({path:info.outputPath('home-wide.png')});
 await page.locator('.ma-ios-tab').filter({hasText:'Learn'}).click();await page.evaluate(layout=>updateViewportFixture(layout),wideGeometry);
 await expect(page.getByRole('heading',{name:'Learn',exact:true})).toBeVisible();
 await page.setViewportSize({width:720,height:680});await insets(page,0,84);
 await expect.poll(()=>page.locator('.ma-branch-library').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(720);
});
for(const route of ['/','/learn/','/kana/','/kanji/','/kana/handwriting/','/reading/','/writing/','/results/','/results/kanji/','/progress/','/wordbank/','/friends/','/shop/']){
 test('resizable native surface '+route,async({page},info)=>{
  await setup(page);const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(route);await expect(page.locator('#maLoadingScreen')).toBeHidden();
  for(const [width,height,left,right]of [[390,680,0,44],[1040,780,0,52],[440,740,48,0],[740,390,28,0]]){
   await page.setViewportSize({width,height});await insets(page,left,right);
   await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   const rect=await page.locator('main').first().boundingBox();expect(rect.x).toBeGreaterThanOrEqual(left);expect(rect.x+rect.width).toBeLessThanOrEqual(width-right+1);
   const dock=await page.locator('.ma-ios-tabs').boundingBox();if(dock){expect(dock.x).toBeGreaterThanOrEqual(0);expect(dock.x+dock.width).toBeLessThanOrEqual(width+1);}
  }
  await page.setViewportSize({width:1040,height:780});await insets(page,0,52);
  await expect(page.locator('html')).toHaveAttribute('data-ma-navigation','rail');
  await page.screenshot({path:info.outputPath('expanded.png'),fullPage:true});expect(errors).toEqual([]);
 });
}
test('fold, close, reload and cloud snapshot preserve a lesson and its independent review',async({page})=>{
 await setup(page);await page.goto('/wordbank/?view=phrases');await page.getByRole('button',{name:'Start lesson: Make a polite connection',exact:true}).click();
 await page.getByRole('button',{name:'Try remembering it'}).click();await page.getByLabel('Reading (kana or romaji)',{exact:true}).fill('sumimasen');
 for(const size of [{width:1040,height:780},{width:400,height:680}]){await page.setViewportSize(size);await expect(page.getByLabel('Reading (kana or romaji)',{exact:true})).toHaveValue('sumimasen');}
 await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('.ma-word-lesson h2')).toHaveText('ありがとうございます');await page.locator('.ma-dialog__close').click();await page.reload();
 await page.getByRole('button',{name:'Continue lesson: Make a polite connection',exact:true}).click();await expect(page.locator('.ma-word-lesson h2')).toHaveText('ありがとうございます');
 const value=await page.evaluate(()=>({checkpoint:ModeAtlasWordLessonState.read().polite,snapshot:KanaCloudSync.debugLocalSnapshot(),word:ModeAtlasWordBank.read()[0]}));
 expect(value.checkpoint.index).toBe(1);expect(value.word.readingReview.last).toBeGreaterThan(0);expect(value.snapshot.sections.wordBank.data.lessons.polite.index).toBe(1);
});
test('account UI is fetched on activation and respects either side safe area',async({page})=>{
 await setup(page);const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
 expect(requests.some(url=>url.includes('account-bindings.'))).toBe(false);
 await page.locator('#profileOpenBtn').click();await expect(page.locator('#maAccountSheet')).toBeVisible();
 expect(requests.some(url=>url.includes('account-bindings.'))).toBe(true);
 for(const [left,right]of [[0,54],[54,0]]){await page.setViewportSize({width:420,height:720});await insets(page,left,right);const box=await page.locator('#maAccountSheet').boundingBox();expect(box.x).toBeGreaterThanOrEqual(left);expect(box.x+box.width).toBeLessThanOrEqual(420-right);}
 await page.setViewportSize({width:1040,height:780});await insets(page,0,52);
 await page.getByRole('tab',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Close account menu',exact:true}).click();await expect(page.locator('#maAccountSheet')).toBeHidden();
});
test('resizing preserves completed handwriting strokes and cancels only the unfinished stroke',async({page},info)=>{
 await setup(page);await page.goto('/kana/');await page.getByRole('button',{name:/Start lesson/}).click();
 await page.goto('/kana/handwriting/?kana=あ');await expect(page.locator('.ma-handwriting-board')).toBeVisible();
 const points=await page.locator('.ma-handwriting-board').evaluate(board=>{
  const p=board.querySelector('.ma-handwriting-guide.is-next'),box=board.getBoundingClientRect(),length=p.getTotalLength();
  return Array.from({length:24},(_,i)=>{const at=p.getPointAtLength(length*i/23);return {x:box.left+at.x*box.width/109,y:box.top+at.y*box.height/109};});
 });
 await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const point of points.slice(1))await page.mouse.move(point.x,point.y);await page.mouse.up();
 await expect(page.locator('.ma-handwriting-guide.is-done')).toHaveCount(1);
 const box=await page.locator('.ma-handwriting-board').boundingBox();await page.mouse.move(box.x+40,box.y+40);await page.mouse.down();await page.mouse.move(box.x+50,box.y+50);
 await page.setViewportSize({width:420,height:720});await insets(page,48,0);await page.mouse.up();
 await expect(page.locator('.ma-handwriting-guide.is-done')).toHaveCount(1);await expect(page.locator('.ma-handwriting-ink')).toHaveCount(1);
 const dialog=await page.locator('.ma-handwriting').boundingBox();expect(dialog.x).toBeGreaterThanOrEqual(48);expect(dialog.x+dialog.width).toBeLessThanOrEqual(420);
 await page.screenshot({path:info.outputPath('handwriting-resized.png')});
});
test('a production task requires a phrase and advances the recommended sequence',async({page})=>{
 await setup(page);await page.goto('/wordbank/');await page.evaluate(()=>ModeAtlasWordLessonState.checkpoint('drinks',{index:5,phase:'apply',application:1}));
 await page.goto('/wordbank/?lesson=drinks');await page.getByLabel('Your phrase (Japanese or romaji)').fill('お茶');await page.getByRole('button',{name:'Check answer',exact:true}).click();
 await expect(page.getByText('Try this: 水をください',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Try again',exact:true}).click();
 await page.getByLabel('Your phrase (Japanese or romaji)').fill('みずをください');await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Lesson complete',exact:true})).toBeVisible();expect(await page.evaluate(()=>ModeAtlasWordLessonState.read().drinks.completedAt)).toBeGreaterThan(0);
});
test('a due situation survives resize, backs up its schedule and advances after independent recall',async({page})=>{
 await setup(page);await page.goto('/wordbank/?view=phrases');
 await page.evaluate(()=>ModeAtlasWordLessonState.checkpoint('drinks',{phase:'complete',completedAt:Date.now()-2*86400000}));
 await page.getByRole('button',{name:'Use it again',exact:true}).click();
 await expect(page.getByRole('heading',{name:'You are at a café. Ask for coffee politely.'})).toBeVisible();
 const input=page.getByLabel('Your phrase (Japanese or romaji)');await input.fill('koohiー');
 await page.setViewportSize({width:1040,height:780});await expect(input).toHaveValue('koohiー');
 await input.fill('こーひーをください');await page.getByRole('button',{name:'Check answer',exact:true}).click();
 await expect(page.getByText('Correct',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Done',exact:true}).click();
 const saved=await page.evaluate(()=>({review:ModeAtlasWordLessonState.read().drinks.review,snapshot:KanaCloudSync.debugLocalSnapshot().sections.wordBank.data.lessons.drinks.review,now:Date.now()}));
 expect(saved.review.dueAt-saved.now).toBeGreaterThan(6*86400000);expect(saved.review.variant).toBe(1);expect(saved.snapshot).toEqual(saved.review);
 await page.reload();await expect(page.getByRole('button',{name:'Use it again',exact:true})).toHaveCount(0);
 await page.goto('/wordbank/?application=drinks');await expect(page.getByRole('heading',{name:'At breakfast, ask for milk politely.'})).toBeVisible();
 await page.evaluate(()=>dispatchEvent(new Event('modeAtlasAccountWillChange')));await expect(input).toHaveCount(0);
});
test('a hint or mistake schedules a near retry without claiming independent phrase recall',async({page})=>{
 await setup(page);await page.goto('/wordbank/');await page.evaluate(()=>ModeAtlasWordLessonState.checkpoint('places',{phase:'complete',completedAt:Date.now()-2*86400000}));
 await page.goto('/wordbank/?application=places');await page.getByText('Show a hint',{exact:true}).click();
 await page.getByLabel('Your phrase (Japanese or romaji)').fill('いりぐちはどこですか');await page.getByRole('button',{name:'Check answer',exact:true}).click();
 await expect(page.getByText('Try again without a hint next time.',{exact:true})).toBeVisible();
 const remaining=await page.evaluate(()=>ModeAtlasWordLessonState.read().places.review.dueAt-Date.now());expect(remaining).toBeGreaterThan(0);expect(remaining).toBeLessThanOrEqual(600000);
});
test('nearly full browser storage preserves the last save and recovers after space is freed',async({page})=>{
 await setup(page);await page.goto('/');
 const result=await page.evaluate(()=>{
  const key='charStats',before=JSON.stringify({'あ':{correct:1,wrong:0}});localStorage.setItem(key,before);
  let counter=0;
  for(const size of [65536,1024,32])for(let n=0;n<10000;n++){try{localStorage.setItem('quota-fixture-'+counter,'x'.repeat(size));counter++;}catch{break;}}
  const next={'あ':{correct:2,wrong:0,padding:'x'.repeat(512)}};let failed=false;
  try{ModeAtlasStorage.transaction(()=>ModeAtlasStorage.setJSON(key,next));}catch{failed=true;}
  const retained=localStorage.getItem(key)===before;
  for(let n=0;n<counter;n++)localStorage.removeItem('quota-fixture-'+n);
  ModeAtlasStorage.transaction(()=>ModeAtlasStorage.setJSON(key,next));
  return {failed,retained,recovered:ModeAtlasStorage.json(key,{}).あ.correct};
 });expect(result).toEqual({failed:true,retained:true,recovered:2});
});
test('Home grows from one attempt to an established learner without exposing empty statistics',async({page},info)=>{
 await setup(page);await page.setViewportSize({width:390,height:780});await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
 await expect(page.locator('body')).toHaveAttribute('data-ma-home-state','new');await page.screenshot({path:info.outputPath('home-new-phone.png'),fullPage:true});
 await page.evaluate(()=>{ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:0,wrong:1}});dispatchEvent(new Event('modeAtlasCloudDataChanged'));});
 await expect(page.locator('body')).toHaveAttribute('data-ma-home-state','starting');await expect(page.locator('.atlas-home-personal')).toBeHidden();
 await page.screenshot({path:info.outputPath('home-starting-phone.png'),fullPage:true});
 await page.evaluate(()=>{ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:60,wrong:2}});dispatchEvent(new Event('modeAtlasCloudDataChanged'));});
 await expect(page.locator('body')).toHaveAttribute('data-ma-home-state','returning');await expect(page.locator('.atlas-home-personal')).toBeVisible();
 await page.setViewportSize({width:1040,height:780});await insets(page,52,0);await page.screenshot({path:info.outputPath('home-returning-expanded.png'),fullPage:true});
});
