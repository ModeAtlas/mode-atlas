const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
  await require('./helpers/returning-tours')(page);
  await page.route(/^https?:\/\//,route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
});

test('the shipped policy blocks injected scripts and inline handlers while normal app code runs',async({page})=>{
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').count()).toBe(1);
  await page.evaluate(()=>{
    window.injected=false;const script=document.createElement('script');script.textContent='window.injected=true';document.body.append(script);
    const button=document.createElement('button');button.setAttribute('onclick','window.injected=true');document.body.append(button);button.click();
  });
  expect(await page.evaluate(()=>window.injected)).toBe(false);
  await page.locator('#profileOpenBtn').click();await expect(page.locator('#maAccountSheet')).toBeVisible();
});

test('guest reports need explicit opt-in, contain limited summaries and withdraw on account change',async({page})=>{
  await page.evaluate(()=>{
    window.usageCalls=[];ModeAtlasAppCheck={ready:()=>true};
    KanaCloudSync.getUser=()=>null;KanaCloudSync.getFirebaseApp=async()=>({});
    ModeAtlasFirebase={load:async()=>({getFunctions:()=>({}),httpsCallable:()=>async data=>{usageCalls.push(data);return {data:{accepted:true,deleted:true}};}})};
  });
  expect(await page.evaluate(()=>usageCalls.length)).toBe(0);
  await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Share guest learning',exact:true}).click();
  const consent=page.getByRole('dialog').last();await expect(consent).toContainText('typed answers');
  await consent.getByRole('button',{name:'Share guest learning',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>usageCalls.filter(row=>row.action==='report').length)).toBe(1);
  const data=await page.evaluate(()=>usageCalls[0]);expect(data.id).toMatch(/^[a-f0-9]{64}$/);expect(Object.keys(data.snapshot).sort()).toEqual(['attempts','branch','correct','funnel','funnelBranches','funnelStartDay','introduced','kana','level','platform','version','xp']);
  await page.evaluate(()=>dispatchEvent(new CustomEvent('modeAtlasAccountWillChange')));
  await expect.poll(()=>page.evaluate(()=>usageCalls.filter(row=>row.action==='delete').length)).toBe(1);
  expect(await page.evaluate(()=>ModeAtlasUsage.enabled())).toBe(false);
});
