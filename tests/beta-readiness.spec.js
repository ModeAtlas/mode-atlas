const {test,expect}=require('@playwright/test');
async function launch(page,path='/',firstUse=false){
  await page.setViewportSize({width:320,height:640});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(firstUse=>{
    window.feedbackDrafts=[];
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{
      getAppVersion:async()=>({version:'2.81.0',build:'2080001'}),
      composeFeedback:async draft=>{feedbackDrafts.push(draft);return {status:'cancelled'};}
    }}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasSound','off');localStorage.setItem('maWhatsNewSeen','beta');
    if(firstUse&&!localStorage.getItem('modeAtlasTourSeen')&&!sessionStorage.getItem('modeAtlasActiveTour'))sessionStorage.setItem('modeAtlasTourPending','1');
  },firstUse);
  await page.goto(path);await expect(page.locator('#maLoadingScreen')).toBeHidden();
}
test('first-use tour hands off to an unstarted ten-question set without a sign-in requirement',async({page})=>{
  await launch(page,'/',true);
  const tour=page.getByRole('dialog',{name:'A quick look around'});
  await expect(tour).toBeVisible();
  for(let i=0;i<6;i++)await tour.getByRole('button',{name:'Next',exact:true}).click();
  await page.evaluate(()=>document.documentElement.style.fontSize='22px');
  await expect(tour.getByRole('button',{name:'Try a short set'})).toBeVisible();
  const bounds=await tour.evaluate(node=>({left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right,width:innerWidth,overflow:node.scrollWidth-node.clientWidth}));
  expect(bounds.left).toBeGreaterThanOrEqual(0);expect(bounds.right).toBeLessThanOrEqual(bounds.width);expect(bounds.overflow).toBeLessThanOrEqual(1);
  await page.screenshot({path:test.info().outputPath('first-set-handoff.png')});
  await tour.getByRole('button',{name:'Try a short set'}).click();
  await expect(page).toHaveURL(/\/reading\/$/);
  await expect(page.locator('#startBtn')).toBeVisible();
  expect(await page.evaluate(()=>sessionStarted)).toBe(false);
  expect(await page.evaluate(()=>ModeAtlasProgress.getXP())).toBe(0);
  expect(await page.evaluate(()=>settings.practiceCount)).toBe(10);
  expect(await page.evaluate(()=>settings.hiraganaRows)).toEqual(['h_a']);
});
test('feedback previews safe details, requires opt-in and preserves its draft after cancel',async({page})=>{
  await launch(page);
  await page.evaluate(()=>{
    ModeAtlasDiagnostics.record('script',{name:'TypeError',message:'private@example.test token-secret'},{file:location.origin+'/assets/app/mode-atlas-tour.assets-2.81.0.js?uid=private-user',line:12});
    document.documentElement.style.fontSize='22px';ModeAtlasHelp.feedback();
  });
  const form=page.getByRole('dialog',{name:'Send feedback',exact:true});
  await expect(form.getByRole('checkbox')).not.toBeChecked();
  await form.getByLabel('Message',{exact:true}).fill('A layout issue I would like to report.');
  await form.getByText('View technical details',{exact:true}).click();
  await expect(form.locator('pre')).toContainText('TypeError');
  await form.getByRole('button',{name:'Continue to email'}).click();
  await expect(form.getByRole('status')).toContainText('still here');
  expect((await page.evaluate(()=>feedbackDrafts[0].body))).not.toContain('Technical details:');
  await form.getByRole('checkbox').check();
  await form.getByRole('button',{name:'Continue to email'}).click();
  await expect.poll(()=>page.evaluate(()=>feedbackDrafts.length)).toBe(2);
  const body=await page.evaluate(()=>feedbackDrafts[1].body);
  expect(body).toContain('(2080001)');expect(body).toContain('TypeError');expect(body).not.toMatch(/private@example|token-secret|private-user/);
  await expect(form.getByLabel('Message',{exact:true})).toHaveValue('A layout issue I would like to report.');
  expect(await form.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
  await page.screenshot({path:test.info().outputPath('feedback-large-text.png')});
});
test('paused cloud sync offers one retry and replaces the failure with confirmed status',async({page})=>{
  await launch(page);
  await page.evaluate(()=>{
    window.retryCalls=0;window.retryState={state:'paused',tone:'warning',text:'Sync paused · saved on this device',user:{uid:'fixture'},canRetry:true};
    window.KanaCloudSync={...KanaCloudSync,getSyncStatus:()=>retryState,syncNow:async()=>{retryCalls++;retryState={...retryState,state:'pending',text:'Sync pending',canRetry:false};dispatchEvent(new Event('kanaCloudSyncStatusChanged'));await new Promise(resolve=>{window.finishRetry=resolve;});retryState={...retryState,state:'cloud',tone:'ok',text:'Synced across devices'};dispatchEvent(new Event('kanaCloudSyncStatusChanged'));}};
    dispatchEvent(new Event('kanaCloudSyncStatusChanged'));ModeAtlasAccountNavigation.open('profile');
  });
  await page.getByRole('button',{name:'Retry sync',exact:true}).click();
  await expect(page.locator('#profileSyncSummary')).toHaveText('Sync pending');
  await expect(page.getByRole('button',{name:'Retry sync',exact:true})).toBeHidden();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>!!document.activeElement.closest('#maAccountSheet'))).toBe(true);
  expect(await page.evaluate(()=>retryCalls)).toBe(1);await page.evaluate(()=>finishRetry());
  await expect(page.locator('#profileSyncChip')).toHaveText('Synced');
});
test('native hardware input supports editing and uses the shared answer checker',async({page})=>{
  await launch(page,'/reading/?practice=10&starter=starter');await page.locator('#startBtn').click();
  await page.evaluate(()=>{currentChar='し';charMap['し']='shi';hiraganaEl.textContent='し';});
  const input=page.locator('#input');await input.focus();await page.keyboard.type('sh');await expect(input).toHaveValue('sh');
  await page.keyboard.press('Backspace');await expect(input).toHaveValue('s');
  await input.evaluate(node=>node.setSelectionRange(0,1));await page.keyboard.type('sh');await expect(input).toHaveValue('sh');
  await input.evaluate(node=>node.setSelectionRange(1,1));await page.keyboard.press('Delete');await expect(input).toHaveValue('s');
  expect(await page.evaluate(()=>sessionStats.answered)).toBe(0);
  await page.locator('.ma-ios-reading-keyboard [data-key="h"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.ma-ios-reading-keyboard [data-key="h"]')).toBeFocused();
  await expect(page.locator('.ma-ios-accessibility-status')).toContainText('Answer: sh');
  await page.keyboard.type('i');
  expect(await page.evaluate(()=>sessionStats.correct)).toBe(1);
});
