const {test,expect}=require('@playwright/test');
const path=require('node:path');
async function setup(page){
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
 await page.route(/mode-atlas-fonts-web.*\.css/,route=>route.fulfill({path:path.join(__dirname,'../assets/css/mode-atlas-fonts-native.css'),contentType:'text/css'}));
 await page.addInitScript(()=>{for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');localStorage.setItem('modeAtlasSound','off');});
 await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
}
test('normal backups preview, restore and reject foreign owners without importing private account state',async({page})=>{
 await setup(page);const value=await page.evaluate(async()=>{
  ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:4,wrong:2}});
  localStorage.setItem('modeAtlasEarningsOutbox',JSON.stringify({privateReceipt:true}));
  const backup=KanaCloudSync.createLearningBackup(),preview=KanaCloudSync.previewLearningBackup(backup);
  ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:8,wrong:2}});
  const restored=await KanaCloudSync.importLearningBackup(backup);let error='';try{await KanaCloudSync.importLearningBackup({...backup,owner:'another-account'});}catch(e){error=e.message;}
  const previousOwner=localStorage.getItem('modeAtlasLastUserId');localStorage.setItem('modeAtlasLastUserId','account-after-guest');
  const guestPreview=KanaCloudSync.previewLearningBackup({...backup,owner:'guest'});if(previousOwner===null)localStorage.removeItem('modeAtlasLastUserId');else localStorage.setItem('modeAtlasLastUserId',previousOwner);
  return {backup,preview,guestPreview,restored,error,reading:ModeAtlasStorage.readModeJSON('reading','charStats',{}),outbox:localStorage.getItem('modeAtlasEarningsOutbox')};
 });
 expect(value.guestPreview.summary.willImport).toBeGreaterThan(0);expect(value.preview.summary.willImport).toBeGreaterThan(0);expect(value.reading['あ'].correct).toBe(4);expect(value.error).toContain('another account');expect(JSON.stringify(value.backup)).not.toContain('privateReceipt');expect(value.outbox).toContain('privateReceipt');
 await page.evaluate(()=>ModeAtlasSettings.open());await expect(page.locator('[data-ma-export-learning]')).toBeVisible();await expect(page.locator('[data-ma-restore-learning]')).toBeVisible();
});
test('optional funnel collects nothing before consent, bounds counts and erases on withdrawal',async({page})=>{
 await setup(page);const result=await page.evaluate(()=>{
  ModeAtlasUsage.event('lessonStarted');const before=localStorage.getItem('modeAtlasUsageFunnel');
  localStorage.setItem('modeAtlasUsageConsent','a'.repeat(64));ModeAtlasUsage.visit();ModeAtlasUsage.event('lessonStarted');ModeAtlasUsage.event('lessonCompleted');ModeAtlasUsage.event('typed-answer');
  const collected=JSON.parse(localStorage.getItem('modeAtlasUsageFunnel'));ModeAtlasUsage.stop();return {before,collected,after:localStorage.getItem('modeAtlasUsageFunnel')};
 });expect(result.before).toBeNull();expect(result.collected.counts).toEqual({lessonStarted:1,lessonCompleted:1});expect(result.after).toBeNull();
});
test('optional interfaces load only on demand and remain keyboard reachable',async({page})=>{
 const requested=[];page.on('request',request=>requested.push(request.url()));await setup(page);
 expect(requested.some(url=>/mode-atlas-(avatar-ui|social-ui|kana-mastery|kanji-mastery)\.[^/]*\.js$/.test(url))).toBe(false);
 await page.evaluate(()=>ModeAtlasFeatures.openMasteryMap('kana'));await expect(page.locator('.ma-kana-mastery-map')).toBeVisible();
 await page.keyboard.press('Escape');await page.evaluate(()=>ModeAtlasAvatarUI.open());await expect(page.getByRole('tab',{name:'Appearance'}).or(page.getByRole('button',{name:'Appearance',exact:true}))).toBeVisible();
});
for(const route of ['/','/learn/','/kana/','/kanji/','/kana/handwriting/','/reading/','/writing/','/results/','/results/kanji/','/progress/','/wordbank/','/friends/','/shop/','/privacy/','/terms/'])test('page coverage '+route,async({page},info)=>{
 await setup(page);await page.evaluate(()=>{ModeAtlasKanaLearning.start('existing');ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:8,wrong:2}});localStorage.setItem('maWhatsNewSeen',String(ModeAtlasVersion));});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(route);await expect(page.locator('#maLoadingScreen')).toBeHidden();
 await expect(page.locator('main')).toBeVisible();await page.addStyleTag({content:'html { font-size: 20px !important; }'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:info.outputPath('large-text.png'),fullPage:true});expect(errors).toEqual([]);
});

test('a large local answer uses a compact recovery journal and survives interruption',async({page},info)=>{
 await setup(page);const result=await page.evaluate(()=>{
  const state={sources:Object.fromEntries(Array.from({length:12000},(_,i)=>['record'+i,{correct:10,wrong:2,padding:'preserved history '.repeat(8)}])),updatedAt:1};
  ModeAtlasStorage.setJSON('modeAtlasKanji',state);const before=localStorage.getItem('modeAtlasKanji');
  const native=Storage.prototype.setItem;let interrupted=false,journalBytes=0;
  Storage.prototype.setItem=function(key,value){if(key==='modeAtlasPracticeTransaction')journalBytes=String(value).length;if(key==='modeAtlasKanji'&&!interrupted){interrupted=true;throw Error('Interrupted storage write');}return native.call(this,key,value);};
  state.sources.record100.correct++;state.updatedAt=2;let error='';const start=performance.now();
  try{ModeAtlasStorage.transaction(()=>ModeAtlasStorage.setJSON('modeAtlasKanji',state));}catch(e){error=e.message;}finally{Storage.prototype.setItem=native;}
  const pending=localStorage.getItem('modeAtlasPracticeTransaction'),unchanged=localStorage.getItem('modeAtlasKanji')===before;
  ModeAtlasStorage.transaction(()=>{});const after=ModeAtlasStorage.json('modeAtlasKanji',{});
  return {elapsed:performance.now()-start,bytes:before.length,journalBytes,error,unchanged,pending:!!pending,correct:after.sources.record100.correct,preserved:after.sources.record11000.padding,cleared:localStorage.getItem('modeAtlasPracticeTransaction')===null};
 });
 expect(result.bytes).toBeGreaterThan(1500000);expect(result.journalBytes).toBeLessThan(2000);expect(result.unchanged).toBe(true);expect(result.pending).toBe(true);expect(result.correct).toBe(11);expect(result.preserved).toContain('preserved history');expect(result.cleared).toBe(true);
 await require('node:fs/promises').writeFile(info.outputPath('large-save-metrics.json'),JSON.stringify(result,null,2));
});
