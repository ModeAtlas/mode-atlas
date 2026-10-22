/* Opt-in, guest-only reporting. One idle snapshot per minute at most; never
   registered on answer events. Identity changes cancel pending work. */
(function(root){
  'use strict';
  const KEY='modeAtlasUsageConsent',REMOVED='modeAtlasUsageRemoval',FUNNEL='modeAtlasUsageFunnel';
  const eventNames=['lessonStarted','lessonCompleted','practiceCompleted','reviewCompleted','lessonExited','saveFailed','saveRecovered','day2Return','day7Return'];
  function funnel(){try{return JSON.parse(read(FUNNEL)||'{}');}catch{return {};}}
  const branchName=value=>value==='words'?'wordbank':['kana','kanji','wordbank'].includes(value)?value:'other';
  function event(name,branch=root.ModeAtlasBranches?.current?.()){
    if(!read(KEY)||root.KanaCloudSync?.getUser?.()||!eventNames.includes(name))return;
    const value=funnel();value.counts||={};value.counts[name]=Math.min(100000,(value.counts[name]||0)+1);
    const key=branchName(branch);value.branches||={};value.branches[key]||={};
    value.branches[key][name]=Math.min(100000,(value.branches[key][name]||0)+1);
    if(name==='lessonStarted')value.active=key;
    if(name==='lessonCompleted'||name==='lessonExited'||name==='reviewCompleted')value.active=false;
    write(FUNNEL,JSON.stringify(value));
  }
  function visit(){
    if(!read(KEY)||root.KanaCloudSync?.getUser?.())return;
    const value=funnel(),day=Math.floor(Date.now()/86400000);value.firstDay??=day;value.counts||={};
    if(day-value.firstDay===1)value.counts.day2Return=1;if(day-value.firstDay===6)value.counts.day7Return=1;
    write(FUNNEL,JSON.stringify(value));
  }
  let epoch=0,timer=0,last=0;
  const read=key=>{try{return localStorage.getItem(key)||'';}catch{return '';}};
  const write=(key,value)=>{try{if(value)localStorage.setItem(key,value);else localStorage.removeItem(key);}catch{}};
  const available=()=>root.ModeAtlasAppCheck?.ready()===true&&!root.KanaCloudSync?.getUser?.();
  function refreshSettings(){
    for(const button of document.querySelectorAll('[data-ma-usage-settings]')){
      button.hidden=!available()&&!read(KEY)&&!read(REMOVED);
      const label=button.querySelector('span');if(label)label.textContent=read(KEY)?'Guest learning sharing: on':read(REMOVED)?'Guest report removal pending':'Share guest learning';
    }
  }
  function snapshot(){
    const p=root.ModeAtlasProgress?.getSummary()||{},known=new Set(root.ModeAtlasKanaData?.collections.all||[]),seen=new Set();let correct=0,attempts=0;
    for(const mode of ['reading','writing'])for(const [char,row]of Object.entries(root.ModeAtlasStorage?.readModeJSON(mode,'charStats',{})||{})){
      if(!known.has(char))continue;
      const right=Math.max(0,Number(row?.correct)||0),wrong=Math.max(0,Number(row?.wrong)||0);
      if(right+wrong)seen.add(char);correct+=right;attempts+=right+wrong;
    }
    let branch=location.pathname.split('/').filter(Boolean)[0]||'atlas';if(branch==='index.html')branch='atlas';if(['reading','writing','kana'].includes(branch))branch='kana';
    if(!['atlas','learn','kana','kanji','wordbank','progress','friends','shop'].includes(branch))branch='other';
    const events=funnel();
    return {platform:root.ModeAtlasEnv?.isNativeApp?'ios':'web',version:root.ModeAtlasVersion,level:p.level||1,xp:p.xp||0,kana:[...seen],introduced:Object.keys(root.ModeAtlasKanaLearning?.read()?.introduced||{}).filter(char=>known.has(char)),correct,attempts,branch,funnelStartDay:events.firstDay??Math.floor(Date.now()/86400000),funnel:Object.fromEntries(eventNames.map(name=>[name,events.counts?.[name]||0])),funnelBranches:Object.fromEntries(['kana','kanji','wordbank','other'].map(branch=>[branch,Object.fromEntries(eventNames.map(name=>[name,events.branches?.[branch]?.[name]||0]))]))};
  }
  async function transport(){
    const app=await root.KanaCloudSync.getFirebaseApp({allowGuest:true});
    const sdk=await root.ModeAtlasFirebase.load('functions');
    return sdk.httpsCallable(sdk.getFunctions(app,root.ModeAtlasSocialConfig.region),'modeAtlasUsage',{timeout:15000});
  }
  async function removePending(){
    const id=read(REMOVED);if(!id||!root.ModeAtlasAppCheck?.ready()||navigator.onLine===false)return;
    try{await(await transport())({action:'delete',id});if(read(REMOVED)===id)write(REMOVED,'');refreshSettings();}catch{/* Retry on the next visit or connection. */}
  }
  async function report(){
    const id=read(KEY),ticket=epoch;if(!id||!available()||navigator.onLine===false||Date.now()-last<60000)return;
    last=Date.now();
    try{
      const send=await transport();if(ticket!==epoch||read(KEY)!==id||!available())return;
      const value=snapshot();await send({action:'report',id,snapshot:value});
    }catch{/* Optional telemetry must never interrupt study or sync. */}
  }
  function stop(){
    epoch++;clearTimeout(timer);timer=0;
    const id=read(KEY);write(KEY,'');write(FUNNEL,'');if(id)write(REMOVED,id);refreshSettings();void removePending();
  }
  function schedule(){
    clearTimeout(timer);if(!read(KEY)||!available())return;
    timer=setTimeout(()=>{if(document.visibilityState==='visible')void report();schedule();},65000);
  }
  async function settings(){
    const enabled=!!read(KEY),pending=!!read(REMOVED);
    if(pending&&!enabled){
      await removePending();await root.ModeAtlasFeedback.alert({title:read(REMOVED)?'Removal pending':'Report removed',message:read(REMOVED)?'Sharing has stopped. Removal will retry when this device can connect and verify the app. The report also expires after 30 days without updates.':'This device’s guest learning report has been removed.',confirmLabel:'OK'});return;
    }
    if(!enabled&&!available())return;
    const approved=await root.ModeAtlasFeedback.confirm({title:enabled?'Stop sharing guest learning?':'Help improve Mode Atlas?',message:enabled?'This stops reports and requests removal of this device’s shared summary. If you are offline, removal resumes when you reconnect.':`Share your level, XP, Kana introduced and practised, answer totals, last branch visited, lesson/practice/review completion counts by learning branch, unfinished lesson exits, storage failures/recoveries and whether this device returns on day 2 or day 7. Reports use a random device identifier, expire after 30 days and contain no name, email, word-bank entries or typed answers. You can stop and request removal here.${pending?' A previous removal request is still pending.':''}`,confirmLabel:enabled?'Stop & remove':'Share guest learning',cancelLabel:'Cancel'});
    if(!approved)return;
    if(enabled)stop();else{
      await removePending();if(read(REMOVED))return;
      const bytes=crypto.getRandomValues(new Uint8Array(32));write(KEY,Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''));visit();refreshSettings();last=0;void report();schedule();
    }
  }
  root.addEventListener('modeAtlasAccountWillChange',stop);
  root.ModeAtlasLearningEvents.subscribe(({type,branch})=>event(type,branch));
  root.addEventListener('modeAtlasDataCleared',stop);
  root.addEventListener('pagehide',()=>{const active=funnel().active;if(active)event('lessonExited',active);});
  root.addEventListener('online',()=>{void removePending();void report();});
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{if(root.KanaCloudSync?.getUser?.()&&read(KEY))stop();refreshSettings();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void report();});
  document.addEventListener('click',event=>{if(event.target.closest('[data-ma-usage-settings]'))void settings();});
  root.ModeAtlasUsage=Object.freeze({event,visit,available,enabled:()=>!!read(KEY),pendingRemoval:()=>!!read(REMOVED),stop,refreshSettings});
  setTimeout(()=>{void removePending();if(read(KEY)){visit();if(root.__maRecoveredPractice)event('saveRecovered');void report();schedule();}delete root.__maRecoveredPractice;},5000);
})(window);
