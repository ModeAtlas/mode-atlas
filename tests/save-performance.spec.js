/* Engineering timings, not an iPhone benchmark. Run on a device before claiming
   the input latency budget. Optional baseline replaces only the storage owner. */
const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
test('mature Kanji save reports median/p95 and preserves untouched history',async({page},info)=>{
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
 if(process.env.MODE_ATLAS_STORAGE_BASELINE)await page.route(/mode-atlas-storage\.assets-.*\.js$/,route=>route.fulfill({path:process.env.MODE_ATLAS_STORAGE_BASELINE,contentType:'text/javascript'}));
 await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
 const timings=await page.evaluate(()=>{
  const at=Date.now(),characters=ModeAtlasKanjiCurriculum.flatMap(b=>[...b.chars]);
  const state=ModeAtlasKanjiState.normalize({version:2,sources:Object.fromEntries(Array.from({length:3},(_,device)=>['device-'+device,Object.fromEntries(characters.map(char=>[char,{pronunciation:[80,12,70,5,160000,at,at+86400000,6,'2026-10-01,2026-10-08,2026-10-15,2026-10-22',''],meaning:[80,12,70,5,160000,at,at+86400000,6,'2026-10-01,2026-10-08,2026-10-15,2026-10-22','']}]))])),updatedAt:at});
  ModeAtlasStorage.setJSON('modeAtlasKanji',state);const bytes=localStorage.getItem('modeAtlasKanji').length*2,samples=[];
  for(let i=0;i<24;i++){
   state.sources['device-0']['一'].pronunciation[0]++;state.updatedAt++;
   const started=performance.now();ModeAtlasStorage.transaction(()=>ModeAtlasStorage.setJSON('modeAtlasKanji',state));samples.push(performance.now()-started);
  }
  const sorted=samples.slice(4).sort((a,b)=>a-b),saved=ModeAtlasStorage.json('modeAtlasKanji',{});
  return {bytes,samples:samples.slice(4),medianMs:sorted[10],p95Ms:sorted[18],changed:saved.sources['device-0']['一'].pronunciation[0],untouched:saved.sources['device-2']['一'].pronunciation[0],pending:localStorage.getItem('modeAtlasPracticeTransaction')};
 });
 expect(timings.changed).toBe(104);expect(timings.untouched).toBe(80);expect(timings.pending).toBeNull();
 await fs.writeFile(info.outputPath('save-timings.json'),JSON.stringify(timings,null,2));console.log('SAVE_TIMINGS',JSON.stringify({bytes:timings.bytes,medianMs:timings.medianMs,p95Ms:timings.p95Ms}));
});
