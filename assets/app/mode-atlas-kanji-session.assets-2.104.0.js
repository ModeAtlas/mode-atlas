/* Kanji session lifecycle. Shared storage transactions commit evidence, XP and
   checkpoints together; UI and dictionary owners do not persist session state. */
(function(root){
  'use strict';
  const KEY='modeAtlasKanjiCheckpoint',state=root.ModeAtlasKanjiState,content=root.ModeAtlasKanjiContent;
  const storage=root.ModeAtlasStorage;
  let active=null,questionStarted=0;
  const owner=()=>root.KanaCloudSync?.getUser?.()?.uid||storage.get('modeAtlasLastUserId','guest')||'guest';
  const id=()=>root.crypto?.randomUUID?.()||'kanji-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const modes=['learn','pronunciation','meaning','match'];
  function write(){if(!storage.setJSON(KEY,active))throw new Error('Your session could not be saved on this device.');}
  function checkpoint(){
    if(!active||active.owner!==owner())return;
    if(questionStarted&&!active.feedback&&!active.paused)active.questionElapsed+=Math.max(0,Date.now()-questionStarted);
    questionStarted=0;write();
  }
  function saved(){
    const value=storage.json(KEY,null);
    if(!value||value.version!==1||value.owner!==owner()||!modes.includes(value.mode)||!Number.isFinite(value.at)||Date.now()-value.at>7*86400000||value.at>Date.now()+60000||value.finished||!state.allowed(value.level)||!/^[a-zA-Z0-9-]{8,100}$/.test(value.runId)||!Number.isFinite(value.questionElapsed)||value.questionElapsed<0||!Number.isFinite(value.xp)||value.xp<0)return null;
    if(!Array.isArray(value.sequence)||!value.sequence.length||value.sequence.length>40||value.sequence.some(c=>state.levels.get(c)!==value.level)||!Number.isInteger(value.index)||value.index<0||value.index>=value.sequence.length||!Array.isArray(value.answers)||value.mode!=='learn'&&value.answers.length!==value.index+Number(!!value.feedback))return null;
    const run=root.ModeAtlasProgress.readState().runs[value.runId];
    if(value.mode!=='learn'&&(!run||run.done||run.answers!==value.answers.length))return null;
    if(value.answers.some((a,i)=>a?.char!==value.sequence[i]||typeof a.correct!=='boolean'||typeof a.answer!=='string'||a.answer.length>160||!Number.isFinite(a.elapsed)||a.elapsed<0))return null;
    value.pool=[...value.sequence];
    return value;
  }
  function start({mode='learn',level=5,count=10,focus='all',test=false,chars=[]}={}){
    const current=state.read();
    if(!modes.includes(mode)||!state.allowed(level,current))throw new Error('Complete the previous level to open this one.');
    const band=root.ModeAtlasKanjiCurriculum.find(b=>b.level===level),runId=id(),skill=mode==='pronunciation'?'pronunciation':'meaning';
    let pool=[...band.chars];
    if(chars.length)pool=pool.filter(c=>chars.includes(c));
    if(focus==='due')pool=pool.filter(c=>{const m=state.metrics(current,c,skill);return m.last&&m.due<=Date.now();});
    if(focus==='new')pool=pool.filter(c=>!current.lessons[c]);
    if(!pool.length)throw new Error(focus==='due'?'No reviews are due in this level. Choose All kanji to keep practising.':'There are no characters in this selection.');
    pool.sort((a,b)=>{
      if(!test&&focus==='all'){
        const aDone=state.completed(current,a),bDone=state.completed(current,b);
        if(aDone!==bDone)return Number(aDone)-Number(bDone);
        const seenA=mode==='learn'?current.lessons[a]||0:state.metrics(current,a,skill).last;
        const seenB=mode==='learn'?current.lessons[b]||0:state.metrics(current,b,skill).last;
        if(seenA!==seenB)return seenA-seenB;
      }
      return content.hash(runId+a)-content.hash(runId+b);
    });
    const sequence=pool.slice(0,Math.min(pool.length,[5,10,20,40].includes(count)?count:10));
    active={version:1,owner:owner(),runId,mode,level,test:!!test&&mode!=='learn',sequence,pool:sequence,index:0,answers:[],feedback:null,questionElapsed:0,paused:false,hinted:false,everAssisted:mode==='match',xp:0,bestStreak:0,streak:0,at:Date.now(),finished:false};
    storage.transaction(()=>{if(mode!=='learn')root.ModeAtlasProgress.startRun(runId);write();});
    if(mode!=='learn')root.ModeAtlasWeekly.start(active,{branch:'kanji',pool:sequence,direction:mode,mode:test?'testMode':'guided',hints:mode==='match'});
    questionStarted=Date.now();return active;
  }
  function resume(){
    active=saved();if(!active)return null;active.paused=false;questionStarted=Date.now();
    if(active.mode!=='learn')root.ModeAtlasWeekly.start(active,{branch:'kanji',pool:active.pool,direction:active.mode,mode:active.test?'testMode':'guided',hints:active.mode==='match'});
    write();return active;
  }
  function ensure(){
    if(!active||active.finished||active.owner!==owner())throw new Error('This session has ended. Start a new one.');
    // Finish any interrupted journal before accepting input. The persisted
    // checkpoint, including the original answer, wins over stale in-memory UI.
    storage.transaction(()=>{});
    const committed=storage.json(KEY,null);
    if(committed?.runId===active.runId&&(committed.index>active.index||committed.answers?.length>active.answers.length||committed.finished)){active=committed;questionStarted=0;}
  }
  function hint(){ensure();if(active.test||active.mode==='learn'||active.feedback||active.paused)return false;active.hinted=true;active.everAssisted=true;write();return true;}
  function answer(value,skip=false){
    ensure();if(active.feedback||active.paused||active.mode==='learn')return null;
    const before=structuredClone(active),char=active.sequence[active.index],at=Date.now();
    const elapsed=active.questionElapsed+(questionStarted?Math.max(0,at-questionStarted):0),correct=!skip&&content.grade(char,active.mode,value);
    const item={char,answer:skip?'':String(value).slice(0,160),correct,elapsed:Math.min(elapsed,300000)};
    try{
      storage.transaction(()=>{
        const assisted=active.hinted||active.mode==='match',skill=active.mode==='pronunciation'?'pronunciation':'meaning';
        state.record({char,skill,runId:active.runId,index:active.index+1,correct,assisted,elapsed,at});
        const reward=root.ModeAtlasProgress.recordKanjiAnswer({runId:active.runId,index:active.index+1,correct,assisted,skill,poolSize:new Set(active.sequence).size,at});
        active.xp+=reward.xp;active.answers.push(item);active.feedback=item;active.streak=correct?active.streak+1:0;active.bestStreak=Math.max(active.bestStreak,active.streak);active.questionElapsed=elapsed;write();
      });
    }catch(error){active=before;throw new Error('Your device could not finish saving this answer. Free some storage, then try again.',{cause:error});}
    questionStarted=0;
    // Hinted answers are submitted as empty so the server cannot award an
    // unassisted rate while preserving the live receipt sequence.
    root.ModeAtlasWeekly.answer(active,{kana:char,answer:active.hinted?'':item.answer});
    // Keep pending live receipts with the already-committed answer. A storage
    // error here must not invite the learner to earn that answer again.
    storage.setJSON(KEY,active);
    root.dispatchEvent(new CustomEvent('modeAtlasKanjiChanged'));return item;
  }
  function next(){
    ensure();if(active.paused||active.mode!=='learn'&&!active.feedback)return active;
    const before=structuredClone(active);
    try{storage.transaction(()=>{
      if(active.mode==='learn')state.lesson(active.sequence[active.index]);
      active.index++;
      if(active.index===active.sequence.length){
        active.finished=true;
        if(active.mode!=='learn'){
          const correct=active.answers.filter(x=>x.correct).length;
          const reward=root.ModeAtlasProgress.finishRun({runId:active.runId,branch:'kanji',direction:'kanji-'+active.mode,mode:active.test?'testMode':'guided',count:active.sequence.length,poolSize:active.sequence.length,answered:active.answers.length,correct,unique:new Set(active.sequence).size,bestStreak:active.bestStreak,completed:true,assisted:active.everAssisted,hintsEnabled:active.mode==='match'});
          active.xp+=reward.xp;
          if(active.test)root.ModeAtlasKanjiResults.add({id:active.runId,at:Date.now(),level:active.level,mode:active.mode,answers:active.answers});
        }
        write();
      }else{active.feedback=null;active.hinted=false;active.questionElapsed=0;write();}
    });}catch(error){active=before;throw error;}
    if(active.finished)root.ModeAtlasWeekly.finish(active);
    questionStarted=active.finished?0:Date.now();root.dispatchEvent(new CustomEvent('modeAtlasKanjiChanged'));return active;
  }
  function pause(){if(!active||active.finished||active.paused)return;checkpoint();active.paused=true;write();}
  function play(){ensure();active.paused=false;questionStarted=Date.now();write();}
  function discard(){if(active)root.ModeAtlasWeekly.finish(active);active=null;questionStarted=0;storage.remove(KEY);}
  for(const event of ['modeAtlasAccountWillChange','modeAtlasAccountSignedOut','modeAtlasDataCleared'])root.addEventListener(event,()=>{active=null;questionStarted=0;});
  root.addEventListener('pagehide',checkpoint);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();root.dispatchEvent(new CustomEvent('modeAtlasKanjiPaused'));}});
  root.ModeAtlasKanjiSession=Object.freeze({start,resume,saved,current:()=>active,hint,answer,next,pause,play,discard,checkpoint});
})(window);
