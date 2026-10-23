const {test,expect}=require('@playwright/test');
const {inner,portrait,prepare,settle}=require('./helpers/native-geometry');

// Screenshot-proportion stress cases, not asserted hardware specifications.
const closed={width:432,height:640,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:358,y:60,width:52,height:100}]};
const landscape={width:640,height:432,reservedRegionsAvailable:true,safeArea:{top:0,right:84,bottom:36,left:0},occlusions:[{x:570,y:12,width:52,height:136}]};
const left={...landscape,safeArea:{...landscape.safeArea,left:84,right:0},occlusions:landscape.occlusions.map(r=>({...r,x:landscape.width-r.x-r.width}))};

async function resize(page,layout){
  await page.setViewportSize({width:layout.width,height:layout.height});
  await page.evaluate(layout=>applyDuoGeometry(layout),layout);
}
async function reachable(locator,layout,minHeight=44){
  await expect.poll(()=>locator.evaluate((el,{layout,minHeight})=>{
    const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    const blocked=layout.occlusions.some(b=>r.right>b.x&&r.left<b.x+b.width&&r.bottom>b.y&&r.top<b.y+b.height);
    return r.width>=44&&r.height>=minHeight&&r.top>=0&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight-layout.safeArea.bottom+1&&!blocked&&(hit===el||el.contains(hit));
  },{layout,minHeight})).toBe(true);
}
async function annotation(page,layout){
  await page.evaluate(layout=>{
    for(const b of layout.occlusions){const el=document.createElement('div');el.textContent='System\narea';el.setAttribute('aria-hidden','true');
      Object.assign(el.style,{position:'fixed',left:b.x+'px',top:b.y+'px',width:b.width+'px',height:b.height+'px',zIndex:2147483647,background:'#000',color:'#fff',borderRadius:'18px',font:'11px sans-serif',display:'grid',placeContent:'center',textAlign:'center',whiteSpace:'pre-line',pointerEvents:'none'});document.body.append(el);}
  },layout);
}
async function shop(page){
  await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Shop',exact:true}).click();
  await expect(page.locator('#maAccount-shop .ma-shop-content')).toBeVisible();
  await expect(page.getByRole('tab',{name:'Shop',exact:true})).toHaveAttribute('aria-selected','true');
  await page.evaluate(()=>{
    const wallet={...ModeAtlasShop.current(),status:'ready',balance:250,tokenBalance:3070};
    window.ModeAtlasShop={...ModeAtlasShop,current:()=>wallet};dispatchEvent(new Event('modeAtlasShopChanged'));
  });
}

for(const theme of ['dark','light'])for(const [name,layout]of [['closed',closed],['landscape',landscape]]){
  test(`shop ${name} ${theme}: balances scroll away and products own the panel`,async({page},info)=>{
    await prepare(page,layout,theme);await page.goto('/kana/?view=practice');await settle(page);await shop(page);
    const panel=page.locator('#maAccount-shop'),header=panel.locator('.ma-shop-header');
    await expect(panel.locator('[data-ma-coin-balance]')).toHaveText('250');
    expect((await header.boundingBox()).height).toBeLessThan(125);
    for(const control of [panel.locator('[data-ma-purchase-coins]'),panel.getByRole('link',{name:'See full shop'}),panel.getByRole('button',{name:'How to earn Study Tokens'})])await reachable(control,layout);
    await panel.locator('[data-ma-purchase-coins]').click();await expect(page.locator('.ma-dialog__title')).toHaveText('500 Atlas Coins');await page.getByRole('button',{name:'Got it',exact:true}).click();
    await annotation(page,layout);await page.screenshot({path:info.outputPath('shop-top.png')});
    await panel.evaluate(el=>{el.scrollTop=el.scrollHeight;});
    await expect.poll(async()=>{const h=await header.boundingBox(),p=await panel.boundingBox();return h.y+h.height<=p.y;}).toBe(true);
    await page.screenshot({path:info.outputPath('shop-scrolled.png')});
    const item=panel.locator('[data-ma-shop-product="streak-freeze"]');await item.scrollIntoViewIfNeeded();await reachable(item,layout);await item.click();
    await expect(page.locator('.ma-dialog__title')).toHaveText('Streak Freeze');await page.locator('.ma-dialog__close').click();
    await panel.evaluate(el=>{el.scrollTop=0;});await panel.getByRole('link',{name:'See full shop'}).click();await expect(page).toHaveURL(/\/shop\/$/);
  });
}
for(const theme of ['dark','light'])for(const [name,layout]of [['right',landscape],['left',left]]){
  test(`closed landscape ${name} ${theme}: rail and Kana Start fit together`,async({page},info)=>{
    await prepare(page,layout,theme);await page.goto('/kana/?view=practice');await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-ma-navigation','rail');
    await expect(page.locator('html')).toHaveAttribute('data-ma-shared-bar','');
    await expect(page.locator('html')).toHaveAttribute('data-ma-compact-rail','');
    for(const link of await page.locator('.ma-ios-tab').all())await reachable(link,layout,52);
    for(const name of ['learn','progress','friends'])await expect(page.locator(`.ma-ios-tab[href="/${name}/"] use`)).toHaveAttribute('href',`/assets/mode-atlas-icons.svg#icon-nav-${name}`);
    await reachable(page.getByRole('button',{name:'Start practice',exact:true}),layout);
    expect((await page.locator('.ma-kana-navigation').boundingBox()).height).toBeLessThanOrEqual(52);
    for(const element of await page.locator('.ma-kana-practice-intro,.ma-kana-session,.ma-kana-practice-skills button').all())expect(await element.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await annotation(page,layout);await page.screenshot({path:info.outputPath('kana-landscape.png')});
    await page.getByRole('button',{name:'Recall',exact:true}).click();await reachable(page.getByRole('button',{name:'Start practice',exact:true}),layout);
    await page.getByRole('button',{name:'Start practice',exact:true}).click();await expect(page).toHaveURL(/\/writing\//);await expect(page.locator('body')).toHaveClass(/trainer-session-active/);
  });
}
test('growing system UI moves the rail inside the safe area without overlap',async({page})=>{
  await prepare(page,landscape);await page.goto('/');await settle(page);
  const grown={...landscape,occlusions:[{x:570,y:12,width:52,height:270}]};
  await page.evaluate(layout=>applyDuoNativeGeometry(layout),grown);
  await expect(page.locator('html')).not.toHaveAttribute('data-ma-shared-bar','');
  await expect(page.locator('html')).toHaveAttribute('data-ma-navigation','rail');
  for(const link of await page.locator('.ma-ios-tab').all())await reachable(link,grown,64);
  const dock=await page.locator('.ma-ios-tabs').boundingBox();expect(dock.x+dock.width).toBeLessThanOrEqual(landscape.width-landscape.safeArea.right);
});
test('an explicitly clear native gutter hosts the rail; missing evidence keeps it safe',async({page})=>{
  const clear={...landscape,occlusions:[]};await prepare(page,clear);await page.goto('/');await settle(page);
  await expect(page.locator('html')).toHaveAttribute('data-ma-shared-bar','');
  expect((await page.locator('.ma-ios-tabs').boundingBox()).x).toBeGreaterThanOrEqual(556);
  await page.evaluate(layout=>applyDuoNativeGeometry({...layout,reservedRegionsAvailable:false}),clear);
  await expect(page.locator('html')).not.toHaveAttribute('data-ma-shared-bar','');
  const dock=await page.locator('.ma-ios-tabs').boundingBox();expect(dock.x+dock.width).toBeLessThanOrEqual(556);
});
test('rotation preserves skill and hints while wide, tall and narrow layouts reflow',async({page},info)=>{
  await prepare(page,closed);await page.goto('/kana/?view=practice');await settle(page);
  await page.getByRole('button',{name:'Read + Recall',exact:true}).click();await page.getByRole('button',{name:'Hints off',exact:true}).click();
  for(const layout of [landscape,inner,portrait,closed]){
    await resize(page,layout);await expect(page.getByRole('button',{name:'Read + Recall',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('button',{name:'Hints on',exact:true})).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath(`kana-${layout.width}x${layout.height}.png`)});
  }
});
for(const [name,layout]of [['landscape',landscape],['narrow',{width:320,height:568,reservedRegionsAvailable:true,safeArea:{top:0,right:0,bottom:20,left:0},occlusions:[]}]]){
  test(`large text ${name}: bottom fallback and shop content stay reachable`,async({page},info)=>{
    await prepare(page,layout,'light');await page.goto('/kana/?view=practice');await settle(page);
    await page.evaluate(()=>{document.documentElement.style.setProperty('--ma-ios-text-scale','1.5');document.documentElement.setAttribute('data-ma-large-text','');dispatchEvent(new Event('modeAtlasTextSizeChanged'));});
    await expect(page.locator('html')).toHaveAttribute('data-ma-navigation','bottom');
    const start=page.getByRole('button',{name:'Start practice',exact:true});await start.evaluate(el=>el.scrollIntoView({block:'center'}));await reachable(start,layout);
    await page.locator('#profileOpenBtn').scrollIntoViewIfNeeded();await shop(page);
    const panel=page.locator('#maAccount-shop');
    for(const control of [panel.getByRole('button',{name:'How to earn Study Tokens'}),panel.locator('[data-ma-purchase-coins]'),panel.getByRole('link',{name:'See full shop'})]){await control.evaluate(el=>el.scrollIntoView({block:'center'}));await reachable(control,layout);}
    await panel.evaluate(el=>{el.scrollTop=el.scrollHeight;});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:info.outputPath('shop-large-text.png')});
  });
}
