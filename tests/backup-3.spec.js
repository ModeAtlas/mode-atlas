const {test,expect}=require('@playwright/test');
test('Settings restore shows the actual contents, supports cancellation, then restores only after confirmation',async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');});
  await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  const backup=await page.evaluate(()=>{
    ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:4,wrong:2}});
    const backup=KanaCloudSync.createLearningBackup();
    ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:8,wrong:2}});
    return JSON.stringify(backup);
  });
  async function choose(){
    await page.evaluate(()=>ModeAtlasSettings.open());
    const chooser=page.waitForEvent('filechooser');
    await page.locator('[data-ma-restore-learning]').click();
    await(await chooser).setFiles({name:'learning.json',mimeType:'application/json',buffer:Buffer.from(backup)});
    const dialog=page.getByRole('dialog',{name:'Review learning backup'});
    await expect(dialog).toContainText('replaces');await expect(dialog).toContainText('Coins, purchases');return dialog;
  }
  await(await choose()).getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>ModeAtlasStorage.readModeJSON('reading','charStats',{})['あ'].correct)).toBe(8);
  await(await choose()).getByRole('button',{name:'Restore learning',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>ModeAtlasStorage.readModeJSON('reading','charStats',{})['あ'].correct)).toBe(4);
});
