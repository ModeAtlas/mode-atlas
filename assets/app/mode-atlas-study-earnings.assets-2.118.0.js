/* Durable account-bound receipt outbox. Offline personal learning never waits
   for economic validation. Retries keep the original session and answer IDs. */
(function(root){
  'use strict';
  const KEY='modeAtlasEarningsOutbox',DAY=86400000;
  const user=()=>root.KanaCloudSync?.getUser?.()?.uid;
  const read=()=>root.ModeAtlasStorage.json(KEY,{});
  let busy=false,timer=null;
  function write(queue){if(!root.ModeAtlasStorage.setJSON(KEY,queue))throw Error('Practice rewards could not be queued on this device.');}
  function start(current,config){
    const uid=user();if(!uid)return;
    const queue=read();
    if(!queue[current.runId]){queue[current.runId]={uid,id:current.runId,config,startedAt:Date.now(),index:0,answers:[],complete:false};write(queue);}
  }
  function answer(current,item){
    const queue=read(),row=queue[current.runId];if(!row||row.uid!==user())return;
    row.answers.push({index:++row.index,kana:item.kana,answer:item.answer||'',elapsed:Date.now()-row.startedAt});
    write(queue);
    if(row.answers.length>=20)queueMicrotask(()=>void flush());else if(!timer)timer=setTimeout(()=>{timer=null;void flush();},15000);
  }
  function finish(current){const queue=read(),row=queue[current.runId];if(!row||row.uid!==user())return;row.complete=true;write(queue);void flush();}
  function pending(){return Object.values(read()).filter(row=>row.uid===user()&&(row.answers.length||row.complete)).length;}
  async function flush(){
    if(busy||!user()||root.navigator?.onLine===false)return;
    busy=true;clearTimeout(timer);timer=null;const uid=user();
    try{
      for(const item of Object.values(read())){
        if(item.uid!==uid||user()!==uid)continue;
        if(item.startedAt<Date.now()-7*DAY){const queue=read();delete queue[item.id];write(queue);continue;}
        let current=read()[item.id];
        while(current&&(current.answers.length||current.complete)&&user()===uid){
          const answers=current.answers.slice(0,20),complete=current.complete&&current.answers.length<=20;
          const result=await root.ModeAtlasSocial.call('earnStudy',{id:current.id,config:current.config,startedAt:current.startedAt,answers,complete},uid);
          if(user()!==uid)return;
          const queue=read(),live=queue[item.id];if(!live)break;
          live.answers=live.answers.filter(answer=>answer.index>result.index);
          if(result.done)delete queue[item.id];write(queue);current=queue[item.id];
        }
      }
      root.dispatchEvent(new CustomEvent('modeAtlasEarningsChanged'));
    }catch(error){root.ModeAtlasDiagnostics?.record('study-rewards',error);}
    finally{busy=false;}
  }
  for(const event of ['online','kanaCloudSyncStatusChanged'])root.addEventListener(event,()=>void flush());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush();});
  root.ModeAtlasEarnings=Object.freeze({start,answer,finish,flush,pending});
})(window);
