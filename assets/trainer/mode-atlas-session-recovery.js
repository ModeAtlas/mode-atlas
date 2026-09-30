/* Device-only guided-set checkpoints. Answer commits use the storage journal. */
(function ModeAtlasSessionRecovery(root){
  'use strict';
  const key=mode=>'modeAtlasPracticeCheckpoint:'+mode;
  const owner=()=>root.KanaCloudSync?.getUser?.()?.uid||root.ModeAtlasStorage.get('modeAtlasLastUserId','guest')||'guest';
  function validate(value,mode){
    if(!value||value.version!==1||value.mode!==mode||value.owner!==owner()||Date.now()-value.at>7*86400000)return null;
    const stats=value.sessionStats,study=stats?.study,run=root.ModeAtlasProgress.readState().runs[study?.runId];
    if(!run||run.done||run.answers!==stats.answered||study.mode!=='guided'||![10,20,30].includes(study.count)||stats.answered>study.count||stats.answered<0)return null;
    return value;
  }
  function read(mode){return validate(root.ModeAtlasStorage.json(key(mode),null),mode);}
  function discard(mode){root.ModeAtlasStorage.remove(key(mode));document.getElementById('practiceRecovery')?.remove();}
  function capture(state,mode){
    if(!state.sessionStarted||state.sessionStats?.study?.mode!=='guided'||state.sessionStats.study.owner!==owner())return;
    const elapsed=root.ModeAtlasSessionControls?.activeElapsed?.()??Math.max(0,Date.now()-state.sessionStats.startTime);
    root.ModeAtlasStorage.setJSON(key(mode),{version:1,mode,owner:owner(),at:Date.now(),settings:state.settings,sessionStats:state.sessionStats,streak:state.streak,
      elapsed,pendingKana:state.sessionStats.study.questionAnswered?'':state.currentChar||''});
  }
  function render(mode,start){
    const host=document.getElementById('startWrap');if(!host)return;
    host.querySelector('#practiceRecovery')?.remove();const data=read(mode);if(!data)return;
    const card=document.createElement('div');card.id='practiceRecovery';card.className='ma-practice-recovery';
    const text=document.createElement('p');text.textContent=`Your ${data.sessionStats.study.count}-question set · ${data.sessionStats.answered} answered`;
    const resume=document.createElement('button');resume.type='button';resume.className='ma-button ma-button--primary';resume.textContent='Resume set';
    resume.addEventListener('click',()=>{const next=read(mode);if(next){card.remove();start(next);}else discard(mode);});
    const clear=document.createElement('button');clear.type='button';clear.className='ma-button ma-button--ghost';clear.textContent='Discard set';clear.addEventListener('click',()=>discard(mode));
    card.append(text,resume,clear);host.prepend(card);
  }
  root.ModeAtlasSessionRecovery=Object.freeze({accountId:owner,validate,read,discard,capture,render});
})(window);
