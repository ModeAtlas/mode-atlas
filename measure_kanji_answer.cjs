/* Local Chromium session-path probe, not a physical iPhone benchmark.
   Run with PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH when using a system browser.
   Optional MODE_ATLAS_KANJI_BASELINE routes a previous state owner for comparison. */
const {chromium}=require('@playwright/test');
const path=require('node:path');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
(async()=>{
 const server=spawn('python3',['-m','http.server','4175','--bind','127.0.0.1'],{cwd:__dirname,stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:4175/');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  if(process.env.MODE_ATLAS_KANJI_BASELINE)await page.route(/mode-atlas-kanji-state\.assets-.*\.js$/,route=>route.fulfill({path:process.env.MODE_ATLAS_KANJI_BASELINE,contentType:'text/javascript'}));
  await page.goto('http://127.0.0.1:4175/kanji/');await page.waitForFunction(()=>!!window.ModeAtlasKanjiSession);
  await page.evaluate(()=>{
   const at=Date.now(),chars=ModeAtlasKanjiCurriculum.flatMap(b=>[...b.chars]);
   const fixture=ModeAtlasKanjiState.normalize({version:2,entry:{mode:'confident',bands:[5,4,3,2,1],at},sources:Object.fromEntries(Array.from({length:3},(_,device)=>['device-'+device,Object.fromEntries(chars.map(char=>[char,{pronunciation:[80,12,70,5,160000,at,at+86400000,6,'2026-10-01,2026-10-08,2026-10-15,2026-10-22',''],meaning:[80,12,70,5,160000,at,at+86400000,6,'2026-10-01,2026-10-08,2026-10-15,2026-10-22','']}]))])),updatedAt:at});
   ModeAtlasStorage.setJSON('modeAtlasKanji',fixture);ModeAtlasKanjiSession.start({mode:'meaning',level:5,count:20});
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  const result=await page.evaluate(()=>{
   const samples=[];for(let i=0;i<20;i++){
    const run=ModeAtlasKanjiSession.current(),answer=ModeAtlasKanjiContent.get(run.sequence[run.index]).meanings[0],start=performance.now();
    ModeAtlasKanjiSession.answer(answer);const answered=performance.now();ModeAtlasKanjiSession.next();samples.push({answer:answered-start,next:performance.now()-answered});
   }
   return {samples,bytes:localStorage.getItem('modeAtlasKanji').length*2,answers:ModeAtlasProgress.getLifetimeCorrect(),pending:localStorage.getItem('modeAtlasPracticeTransaction')};
  });
  const {profile}=await cdp.send('Profiler.stop');const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const counts={};
  for(const id of profile.samples||[]){const frame=nodes.get(id)?.callFrame;if(frame){const key=frame.functionName+' '+frame.url.split('/').at(-1)+':'+(frame.lineNumber+1);counts[key]=(counts[key]||0)+1;}}
  result.hotspots=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20);result.runtime='Local Chromium, full session answer and next calls; no UI render or physical-device result';
  const sorted=result.samples.slice(4).map(row=>row.answer).sort((a,b)=>a-b);result.medianMs=(sorted[7]+sorted[8])/2;result.p95Ms=sorted[Math.ceil(.95*sorted.length)-1];result.warmupAnswers=4;
  const target=process.argv[2]||path.join(__dirname,'test-results/kanji-answer-timings.json');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({bytes:result.bytes,medianMs:result.medianMs,p95Ms:result.p95Ms,answers:result.answers,pending:result.pending}));
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
