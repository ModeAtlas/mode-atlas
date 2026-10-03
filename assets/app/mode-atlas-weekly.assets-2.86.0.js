/* Live practice receipts. Personal/offline XP remains owned by Progress. */
(function(root){
  'use strict';
  const sessions=new Map();
  const user=()=>root.KanaCloudSync?.getUser?.()?.uid;
  function changed(current){root.dispatchEvent(new CustomEvent('modeAtlasWeeklyChanged',{detail:{runId:current.runId,...current.weekly}}));}
  function start(current,options){
    if(!user()||root.navigator?.onLine===false)return;
    if(sessions.has(current.runId))return;
    current.weeklyConfig=options;
    const previous=current.weekly;
    const state=previous?.owner===user()?previous:{owner:user(),status:'connecting',index:0,pending:[],earned:0,startedAt:Date.now()};
    current.weekly=state;
    const job={current,state,busy:false,timer:null,ready:null};sessions.set(current.runId,job);
    job.ready=root.ModeAtlasSocial.call('weeklyStart',{id:current.runId,...options},state.owner).then(result=>{
      if(user()!==state.owner)return;
      if(!result.enabled){state.status='disabled';state.pending=[];return;}
      if(state.token&&state.token!==result.token){state.pending=[];state.index=0;state.startedAt=Date.now();}
      state.token=result.token;state.expiresAt=result.expiresAt;state.status='live';
      state.earned=result.earned||0;
      state.index=Math.max(state.index,result.index);state.pending=state.pending.filter(item=>item.index>result.index);
      changed(current);
    }).catch(()=>{state.status='unavailable';state.pending=[];changed(current);});
  }
  async function flush(job){
    if(job.busy)return;
    job.busy=true;clearTimeout(job.timer);job.timer=null;
    try{
      await job.ready;
      const state=job.state;
      if(user()!==state.owner||state.status==='disabled'||state.status==='unavailable')return;
      if(Date.now()>=state.expiresAt){state.status='expired';state.pending=[];return;}
      while(state.pending.length&&user()===state.owner){
        const answers=state.pending.slice(0,root.ModeAtlasWeeklyRules.batchSize);
        const result=await root.ModeAtlasSocial.call('weeklySubmit',{token:state.token,answers},state.owner);
        if(user()!==state.owner)return;
        state.pending=state.pending.filter(item=>item.index>result.index);state.earned=result.runEarned;state.score=result.score;state.status='live';
      }
    }catch(error){
      const code=String(error?.code||'').replace(/^functions\//,'');
      job.state.status=['failed-precondition','invalid-argument','permission-denied'].includes(code)?'expired':'pending';
      if(job.state.status==='expired')job.state.pending=[];
    }finally{
      job.busy=false;changed(job.current);
      if(job.state.pending.length&&user()===job.state.owner)job.timer=setTimeout(()=>flush(job),15000);
      else if(job.finished)sessions.delete(job.current.runId);
    }
  }
  function answer(current,item){
    if(!sessions.has(current.runId)&&current.weeklyConfig)start(current,current.weeklyConfig);
    const job=sessions.get(current.runId),state=job?.state;
    if(!state||user()!==state.owner||['disabled','unavailable','expired'].includes(state.status))return;
    if(state.pending.length>=200){state.status='expired';state.pending=[];changed(current);return;}
    state.pending.push({index:++state.index,kana:String(item.kana),answer:String(item.answer||''),elapsed:Date.now()-state.startedAt});
    if(state.pending.length>=20)void flush(job);
    else if(!job.timer)job.timer=setTimeout(()=>{job.timer=null;void flush(job);},15000);
  }
  function finish(current){const job=sessions.get(current.runId);if(job){job.finished=true;void flush(job);}}
  function reset(){for(const job of sessions.values())clearTimeout(job.timer);sessions.clear();}
  root.addEventListener('modeAtlasAccountSignedOut',reset);
  root.addEventListener('online',()=>{for(const job of sessions.values())void flush(job);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const job of sessions.values())void flush(job);});
  root.ModeAtlasWeekly=Object.freeze({start,answer,finish});
})(window);
