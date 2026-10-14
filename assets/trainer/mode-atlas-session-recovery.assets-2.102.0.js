/* Device-only checkpoints for finite, untimed practice. The answer journal
   commits progress and its checkpoint together; a resume continues that run. */
(function ModeAtlasSessionRecovery(root){
  'use strict';
  const key=mode=>'modeAtlasPracticeCheckpoint:'+mode;
  const owner=()=>root.KanaCloudSync?.getUser?.()?.uid||root.ModeAtlasStorage.get('modeAtlasLastUserId','guest')||'guest';
  const supported=new Set(['guided','dailyChallenge','testMode']);
  const whole=value=>Number.isInteger(value)&&value>=0;
  function validate(value,mode){
    if(!value||![1,2].includes(value.version)||value.mode!==mode||value.owner!==owner()||!Number.isFinite(value.at)||Date.now()-value.at>7*86400000)return null;
    const stats=value.sessionStats,study=stats?.study,run=root.ModeAtlasProgress.readState().runs[study?.runId];
    if(!run||run.done||!supported.has(study?.mode)||study.owner!==owner()||run.answers!==stats.answered)return null;
    if(![stats.answered,stats.correct,stats.wrong,value.streak].every(whole)||stats.correct+stats.wrong!==stats.answered)return null;
    if(!Number.isFinite(value.elapsed)||value.elapsed<0||!value.settings||root.ModeAtlasPracticeModes.selected(value.settings)!==study.mode)return null;
    if(study.mode==='guided'){
      if(![10,20,30].includes(study.count)||stats.answered>study.count)return null;
    }else{
      if(value.version!==2||!Array.isArray(value.sequence)||!value.sequence.length||stats.answered>value.sequence.length)return null;
      const kana=new Set(root.ModeAtlasKanaData.collections.all);
      if(value.sequence.length>kana.size||value.sequence.some(char=>!kana.has(char)))return null;
      if(study.mode==='testMode'&&new Set(value.sequence).size!==value.sequence.length)return null;
      if(value.pendingKana&&value.pendingKana!==value.sequence[stats.answered])return null;
      // Daily challenges belong to their original local calendar day. An old
      // checkpoint must never become today's official attempt.
      if(study.mode==='dailyChallenge'&&(value.sequence.length!==20||study.dateKey!==root.getTodayKey()))return null;
    }
    if(value.version===2&&(!Number.isFinite(value.questionElapsed)||value.questionElapsed<0))return null;
    return value;
  }
  function read(mode){return validate(root.ModeAtlasStorage.json(key(mode),null),mode);}
  function discard(mode){root.ModeAtlasStorage.remove(key(mode));document.getElementById('practiceRecovery')?.remove();}
  function capture(state,mode){
    const study=state.sessionStats?.study;
    if(!state.sessionStarted||!supported.has(study?.mode)||study.owner!==owner())return;
    const elapsed=root.ModeAtlasSessionControls?.activeElapsed?.()??Math.max(0,Date.now()-state.sessionStats.startTime);
    const pendingKana=study.questionAnswered?'':state.currentChar||'';
    const questionElapsed=pendingKana?(root.ModeAtlasSessionControls?.questionElapsed?.()??Math.max(0,Date.now()-state.charStartTime)):0;
    root.ModeAtlasStorage.setJSON(key(mode),{version:2,mode,owner:owner(),at:Date.now(),settings:state.settings,sessionStats:state.sessionStats,streak:state.streak,
      elapsed,questionElapsed,pendingKana,sequence:study.mode==='dailyChallenge'?state.dailySequence:study.mode==='testMode'?state.testSequence:[]});
  }
  function render(mode,start){
    const host=document.getElementById('startWrap');if(!host)return;
    host.querySelector('#practiceRecovery')?.remove();const data=read(mode);if(!data)return;
    const current=data.sessionStats.study,kind=current.mode;
    const name=kind==='dailyChallenge'?'Daily Challenge':kind==='testMode'?'Test Mode':`${current.count}-question set`;
    const total=kind==='guided'?current.count:data.sequence.length;
    const action=kind==='dailyChallenge'?'challenge':kind==='testMode'?'test':'set';
    const card=document.createElement('div');card.id='practiceRecovery';card.className='ma-practice-recovery';
    const text=document.createElement('p');text.textContent=`${name} · ${data.sessionStats.answered} answered of ${total}`;
    const resume=document.createElement('button');resume.type='button';resume.className='ma-button ma-button--primary';resume.textContent=`Resume ${action}`;
    resume.addEventListener('click',()=>{const next=read(mode);if(next){card.remove();start(next);}else discard(mode);});
    const clear=document.createElement('button');clear.type='button';clear.className='ma-button ma-button--ghost';clear.textContent=`Discard ${action}`;clear.addEventListener('click',()=>discard(mode));
    card.append(text,resume,clear);host.prepend(card);
  }
  root.ModeAtlasSessionRecovery=Object.freeze({accountId:owner,validate,read,discard,capture,render});
})(window);
