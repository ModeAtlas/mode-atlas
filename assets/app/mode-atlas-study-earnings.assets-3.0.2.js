/* Durable account-bound receipt outbox. Offline personal learning never waits
   for economic validation. Retries keep the original session and answer IDs. */
(function(root){
  'use strict';
  const KEY='modeAtlasEarningsOutbox',DAY=86400000;
  const user=()=>root.KanaCloudSync?.getUser?.()?.uid;
  const read=()=>root.ModeAtlasStorage.json(KEY,{});
  let busy=false,timer=null;
  function write(queue){if(!root.ModeAtlasStorage.setJSON(KEY,queue))throw Error('Practice rewards could not be queued on this device.');}
  async function start(current,config){
    const uid=user();if(!uid||root.navigator?.onLine===false)return null;
    const existing=read()[current.runId];
    if(existing?.uid===uid&&existing.authority?.expiresAt>Date.now()){current.authority=existing.authority;return current.authority;}
    // Never turn an already-started local/offline run into a new verified run.
    if(current.answers?.length||current.items&&Object.keys(current.items).length)return null;
    try{
      let timeout;const authority=await Promise.race([root.ModeAtlasSocial.call('startStudy',{id:current.runId,config},uid),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Verified practice unavailable')),8000);})]).finally(()=>clearTimeout(timeout));
      if(user()!==uid)return null;
      current.authority=authority;
      const queue=read();queue[current.runId]={uid,id:current.runId,token:authority.token,config,startedAt:authority.startedAt,localStartedAt:Date.now(),index:0,answers:[],complete:false,authority};write(queue);return authority;
    }catch(error){current.earningsStatus='unverified';root.ModeAtlasDiagnostics?.record('study-start',error);return null;}
  }
  function question(current,index){return current.authority?.expiresAt>Date.now()?root.ModeAtlasStudyPrompts.question(current.authority,index):'';}
  function answer(current,item){
    const queue=read(),row=queue[current.runId];if(!row||row.uid!==user())return;
    row.answers.push({index:++row.index,kana:item.kana,answer:item.answer||'',elapsed:Date.now()-(row.localStartedAt||row.startedAt)});
    root.ModeAtlasStudyPrompts.advance(current.authority,row.index,item.kana,!!item.correct);row.authority=current.authority;
    write(queue);
    if(row.answers.length>=20)queueMicrotask(()=>void flush());else if(!timer)timer=setTimeout(()=>{timer=null;void flush();},15000);
  }
  function finish(current,completed=false){const queue=read(),row=queue[current.runId];if(!row||row.uid!==user())return;row.complete=true;row.completed=completed===true;write(queue);void flush();}
  function pending(){return Object.values(read()).filter(row=>row.uid===user()&&(row.answers.length||row.complete)).length;}
  async function flush(){
    if(busy||!user()||root.navigator?.onLine===false)return;
    busy=true;clearTimeout(timer);timer=null;const uid=user();let credited=false;
    try{
      for(const item of Object.values(read())){
        if(item.uid!==uid||user()!==uid)continue;
        if(!item.token||item.authority?.expiresAt<=Date.now()||item.startedAt<Date.now()-7*DAY){const queue=read();delete queue[item.id];write(queue);continue;}
        let current=read()[item.id];
        while(current&&(current.answers.length||current.complete)&&user()===uid){
          const answers=current.answers.slice(0,20),complete=current.complete&&current.answers.length<=20;
          const result=await root.ModeAtlasSocial.call('earnStudy',{id:current.id,token:current.token,config:current.config,startedAt:current.startedAt,answers,complete,completed:complete&&current.completed===true},uid);
          if(user()!==uid)return;
          credited=true;
          const queue=read(),live=queue[item.id];if(!live)break;
          live.answers=live.answers.filter(answer=>answer.index>result.index);
          if(result.done)delete queue[item.id];write(queue);current=queue[item.id];
        }
      }
    }catch(error){root.ModeAtlasDiagnostics?.record('study-rewards',error);}
    finally{busy=false;if(credited&&user()===uid)root.dispatchEvent(new CustomEvent('modeAtlasEarningsChanged'));}
  }
  root.addEventListener('online',()=>void flush());
  // Sync status changes for every locally saved answer. They are not a request
  // to bypass the 20-answer / 15-second receipt batch and refresh the wallet.
  let observedUser=user();
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{const next=user();if(next!==observedUser){observedUser=next;if(next)void flush();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush();});
  root.ModeAtlasEarnings=Object.freeze({start,question,answer,finish,flush,pending});
  queueMicrotask(()=>void flush());
})(window);
