/* Kanji session lifecycle. Shared storage transactions commit evidence, XP and
   checkpoints together; UI and dictionary owners do not persist session state. */
(function(root){
  'use strict';
  const KEY='modeAtlasKanjiCheckpoint',state=root.ModeAtlasKanjiState,content=root.ModeAtlasKanjiContent;
  const storage=root.ModeAtlasStorage;
  let active=null,questionStarted=0;
  const owner=()=>root.KanaCloudSync?.getUser?.()?.uid||storage.get('modeAtlasLastUserId','guest')||'guest';
  const id=()=>root.crypto?.randomUUID?.()||'kanji-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const modes=['learn','pronunciation','meaning','match','course'];
  function write(){if(!storage.setJSON(KEY,active))throw new Error('Your session could not be saved on this device.');}
  function checkpoint(){
    if(!active||active.owner!==owner())return;
    if(questionStarted&&!active.feedback&&!active.paused)active.questionElapsed+=Math.max(0,Date.now()-questionStarted);
    questionStarted=0;write();
  }
  function saved(){
    const value=storage.json(KEY,null);
    if(!value||value.version!==1||value.owner!==owner()||!modes.includes(value.mode)||!Number.isFinite(value.at)||Date.now()-value.at>7*86400000||value.at>Date.now()+60000||value.finished||!state.allowed(value.level)||!/^[a-zA-Z0-9-]{8,100}$/.test(value.runId)||!Number.isFinite(value.questionElapsed)||value.questionElapsed<0||!Number.isFinite(value.xp)||value.xp<0)return null;
    if(!Array.isArray(value.sequence)||!value.sequence.length||value.sequence.length>(value.mode==='course'?200:40)||value.sequence.some(c=>state.levels.get(c)!==value.level)||!Number.isInteger(value.index)||value.index<0||value.index>=value.sequence.length||!Array.isArray(value.answers)||!['learn','course'].includes(value.mode)&&value.answers.length!==value.index+Number(!!value.feedback))return null;
    const run=root.ModeAtlasProgress.readState().runs[value.runId];
    if(!['learn','course'].includes(value.mode)&&(!run||run.done||run.answers!==value.answers.length))return null;
    if(value.answers.some((a,i)=>(value.mode==='course'?!value.sequence.includes(a?.char):a?.char!==value.sequence[i])||typeof a.correct!=='boolean'||typeof a.answer!=='string'||a.answer.length>160||!Number.isFinite(a.elapsed)||a.elapsed<0))return null;
    if(value.mode==='course'&&(!root.ModeAtlasKanjiCourse?.get(value.unitId)||!['lesson','checkpoint','review'].includes(value.courseKind)||!Array.isArray(value.tasks)||value.tasks.length!==value.sequence.length||value.tasks.some((task,i)=>task.char!==value.sequence[i]||!['teach','recognition','retrieve'].includes(task.kind)||task.kind!=='teach'&&!state.evidenceSkills.includes(task.skill))))return null;
    if(value.mode==='learn'){
      value.lessonPhase=['teach','recognise','reading'].includes(value.lessonPhase)?value.lessonPhase:'teach';
      const feedback=value.lessonFeedback;
      if(feedback&&(typeof feedback.answer!=='string'||feedback.answer.length>160||typeof feedback.correct!=='boolean'))return null;
    }
    value.pool=[...value.sequence];
    return value;
  }
  function start({mode='learn',level=5,count=10,focus='all',test=false,chars=[]}={}){
    const current=state.read();
    if(!modes.includes(mode)||mode==='course'||!state.allowed(level,current))throw new Error('Complete the previous level to open this one.');
    const band=root.ModeAtlasKanjiCurriculum.find(b=>b.level===level),runId=id(),skill=mode==='pronunciation'?'pronunciation':'meaning';
    let pool=state.studyPool(level,current);
    if(mode==='learn'&&chars.length)pool=[...band.chars];
    if(mode!=='learn'&&!test)pool=pool.filter(c=>state.encountered(current,c));
    if(mode!=='learn'&&test&&!['placement','confident'].includes(current.entry.mode))pool=pool.filter(c=>state.encountered(current,c));
    if(chars.length)pool=pool.filter(c=>chars.includes(c));
    if(focus==='due')pool=pool.filter(c=>{const m=state.metrics(current,c,skill);return m.last&&m.due<=Date.now();});
    if(focus==='new'&&mode==='learn')pool=pool.filter(c=>!state.introduced(current,c));
    if(!pool.length)throw new Error(focus==='due'?'No reviews are due in this level. Choose All kanji to keep practising.':mode==='learn'?'There are no new characters in this selection. Choose All kanji to revisit a lesson.':'Learn a few characters first, then practise their meanings and readings.');
    const lessonOrder=mode==='learn'?new Map([...(band.intro||''),...[...band.chars].filter(c=>!band.intro?.includes(c)).sort((a,b)=>content.get(a).strokes-content.get(b).strokes)].map((char,index)=>[char,index])):null;
    pool.sort((a,b)=>{
      if(mode==='learn'){
        const doneA=state.introduced(current,a),doneB=state.introduced(current,b);
        if(doneA!==doneB)return Number(doneA)-Number(doneB);
        return lessonOrder.get(a)-lessonOrder.get(b);
      }
      if(!test&&focus==='all'){
        const aDone=state.completed(current,a),bDone=state.completed(current,b);
        if(aDone!==bDone)return Number(aDone)-Number(bDone);
        const seenA=state.metrics(current,a,skill).last,seenB=state.metrics(current,b,skill).last;
        if(seenA!==seenB)return seenA-seenB;
      }
      return content.hash(runId+a)-content.hash(runId+b);
    });
    const sequence=pool.slice(0,Math.min(pool.length,[5,10,20,40].includes(count)?count:10));
    active={version:1,startLevel:root.ModeAtlasProgress.getSummary().level,achievementStart:root.ModeAtlasFeatures?.achievementSnapshot?.()||[],owner:owner(),runId,mode,level,focus,test:!!test&&mode!=='learn',sequence,pool:sequence,index:0,answers:[],feedback:null,questionElapsed:0,paused:false,hinted:false,everAssisted:mode==='match',xp:0,bestStreak:0,streak:0,at:Date.now(),finished:false,lessonPhase:'teach',lessonFeedback:null};
    storage.transaction(()=>{if(mode!=='learn')root.ModeAtlasProgress.startRun(runId);write();});

    if(mode==='learn')root.ModeAtlasLearningEvents?.emit('lessonStarted','kanji');
    questionStarted=Date.now();return active;
  }
  function startCourse({unitId,kind='lesson',chars=[]}={}){
    const unit=root.ModeAtlasKanjiCourse.get(unitId),current=state.read();
    if(!unit||!['lesson','checkpoint','review'].includes(kind))throw new Error('Choose a course unit.');
    const runId=id(),targets=[...unit.chars],selected=chars.length?[...new Set(chars)].filter(c=>targets.includes(c)||state.levels.get(c)===5&&state.encountered(current,c)).slice(0,6):targets;
    if(!selected.length)throw new Error('Choose a character from this unit.');
    if(kind!=='lesson'&&!targets.every(c=>state.introduced(current,c)))throw new Error('Meet every character in this unit before its check.');
    const mix=[...selected];
    if(kind==='checkpoint'){
      const previous=root.ModeAtlasKanjiCourse.units.slice(0,unit.index).reverse().flatMap(u=>[...u.chars]);
      for(const char of previous)if(mix.length<selected.length+2&&!mix.includes(char)&&state.encountered(current,char))mix.push(char);
    }
    for(const candidate of root.ModeAtlasKanjiCourse.units.flatMap(u=>[...u.chars]))if(mix.length<3&&!mix.includes(candidate)&&state.encountered(current,candidate))mix.push(candidate);
    const ordered=[...mix].sort((a,b)=>content.hash(runId+a)-content.hash(runId+b)),tasks=[];
    if(kind==='lesson'){
      for(const char of selected)tasks.push({kind:'teach',char});
      for(const char of [...selected].reverse())tasks.push({kind:'recognition',char,skill:'meaning'});
    }
    const recentChars=new Set(tasks.slice(-2).map(task=>task.char)),first=ordered.findIndex(char=>!recentChars.has(char));
    if(first>0)ordered.unshift(...ordered.splice(first,1));
    // Every skill revisits a character after other characters. No answer-key
    // order from teaching or recognition is reused as a shortcut.
    for(const skill of ['meaning','pronunciation','wordMeaning'])for(const char of ordered)tasks.push({kind:'retrieve',char,skill,first:true});
    active={version:1,owner:owner(),runId,mode:'course',level:5,unitId,courseKind:kind,targets,sequence:tasks.map(t=>t.char),tasks,index:0,answers:[],feedback:null,questionElapsed:0,paused:false,hinted:false,everAssisted:false,xp:0,at:Date.now(),finished:false};
    write();questionStarted=Date.now();root.ModeAtlasLearningEvents?.emit(kind==='review'?'reviewStarted':'lessonStarted','kanji');return active;
  }
  function courseAnswer(value,skip=false){
    ensure();if(active.mode!=='course'||active.feedback||active.paused)return null;
    const task=active.tasks[active.index];if(task.kind==='teach')return null;
    const before=structuredClone(active),at=Date.now(),elapsed=Math.min(300000,active.questionElapsed+(questionStarted?at-questionStarted:0));
    const assisted=active.hinted||task.kind==='recognition'||!!task.retry,correct=!skip&&content.grade(task.char,task.skill,value);
    const item={char:task.char,skill:task.skill,answer:skip?'':String(value).slice(0,160),correct,assisted,first:!!task.first&&!task.retry,elapsed};
    try{storage.transaction(()=>{
      state.record({char:task.char,skill:task.skill,runId:active.runId,index:active.index+1,correct,assisted,elapsed,at});
      if(task.kind==='retrieve'&&!task.retry)root.ModeAtlasProgress.recordHabit({branch:'kanji',id:active.runId+':'+active.index,at});
      active.answers.push(item);active.feedback=item;active.questionElapsed=elapsed;
      if(task.kind==='retrieve'&&(!correct||active.hinted)&&!task.retry){
        const retry={...task,first:false,retry:true},remaining=active.tasks.slice(active.index+1);
        let location=active.index+3;
        if(remaining.length<2){
          const fillers=[...new Set(active.sequence)].filter(char=>char!==task.char).slice(0,2);
          for(const char of fillers)active.tasks.push({kind:'retrieve',char,skill:task.skill,first:false,retry:true});
          location=active.tasks.length;
        }
        active.tasks.splice(Math.min(location,active.tasks.length),0,retry);active.sequence=active.tasks.map(t=>t.char);
      }
      write();
    });}catch(error){active=before;throw error;}
    questionStarted=0;return item;
  }
  function courseNext(){
    ensure();if(active.mode!=='course'||active.paused)return;
    const task=active.tasks[active.index];if(task.kind!=='teach'&&!active.feedback)return;
    const before=structuredClone(active);
    try{storage.transaction(()=>{
      if(task.kind==='teach')state.introduction(task.char);
      active.index++;active.feedback=null;active.hinted=false;active.questionElapsed=0;
      if(active.index>=active.tasks.length){active.finished=true;active.outcome=state.finishCourse({unitId:active.unitId,kind:active.courseKind,answers:active.answers});}
      write();
    });}catch(error){active=before;throw error;}
    questionStarted=Date.now();root.ModeAtlasVisitFlows?.recordActivity('kanji');
    if(active.finished)root.ModeAtlasLearningEvents?.emit(active.courseKind==='review'?'reviewCompleted':active.courseKind==='lesson'?'lessonCompleted':'practiceCompleted','kanji');return active;
  }
  function resume(){
    active=saved();if(!active)return null;active.paused=false;questionStarted=Date.now();
    if(active.mode==='learn'&&!active.finished)root.ModeAtlasLearningEvents?.emit('lessonStarted','kanji');
    write();return active;
  }
  async function authorize(){
    const current=active;if(!current||['learn','course'].includes(current.mode))return;
    await root.ModeAtlasWeekly.start(current,{branch:'kanji',pool:current.pool,direction:current.mode,mode:current.test?'testMode':'guided',hints:current.mode==='match'});
    if(active!==current||current.owner!==owner())return;
    if(current.authority)current.sequence=current.sequence.map((char,index)=>root.ModeAtlasEarnings.question(current,index+1)||char);
    questionStarted=Date.now();write();
  }
  function ensure(){
    if(!active||active.finished||active.owner!==owner())throw new Error('This session has ended. Start a new one.');
    // Finish any interrupted journal before accepting input. The persisted
    // checkpoint, including the original answer, wins over stale in-memory UI.
    storage.transaction(()=>{});
    const committed=storage.json(KEY,null);
    if(committed?.runId===active.runId&&(committed.index>active.index||committed.answers?.length>active.answers.length||committed.finished||(committed.lessonRevision||0)>(active.lessonRevision||0))){active=committed;questionStarted=0;}
  }
  function hint(){ensure();if(active.test||active.mode==='learn'||active.feedback||active.paused)return false;active.hinted=true;active.everAssisted=true;write();return true;}
  function answer(value,skip=false){
    if(active?.mode==='course')return courseAnswer(value,skip);
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
    root.ModeAtlasWeekly.answer(active,{kana:char,answer:active.hinted?'':item.answer,correct:correct&&!active.hinted});
    // Keep pending live receipts with the already-committed answer. A storage
    // error here must not invite the learner to earn that answer again.
    storage.setJSON(KEY,active);
    root.dispatchEvent(new CustomEvent('modeAtlasKanjiChanged'));return item;
  }
  function changeLesson(change){
    const before=structuredClone(active);
    try{storage.transaction(()=>{change();active.lessonRevision=(active.lessonRevision||0)+1;write();});}
    catch(error){active=before;throw error;}
  }
  function lessonStep(){
    ensure();if(active.mode!=='learn'||active.paused)return;
    if(active.lessonPhase!=='teach'&&!(active.lessonPhase==='recognise'&&active.lessonFeedback?.correct))return;
    changeLesson(()=>{active.lessonPhase=active.lessonPhase==='teach'?'recognise':'reading';active.lessonFeedback=null;});
  }
  function lessonAnswer(answer){
    ensure();if(active.mode!=='learn'||active.paused||active.lessonPhase==='teach'||active.lessonFeedback)return;
    const char=active.sequence[active.index];
    changeLesson(()=>{active.lessonFeedback={answer:String(answer).slice(0,160),correct:root.ModeAtlasKanjiTeaching.grade(char,active.lessonPhase,answer)};});
  }
  function reviewLesson(){ensure();if(active.mode!=='learn'||active.paused)return;changeLesson(()=>{active.lessonPhase='teach';active.lessonFeedback=null;});}
  function next(){
    if(active?.mode==='course')return courseNext();
    ensure();if(active.paused||active.mode!=='learn'&&!active.feedback)return active;
    if(active.mode==='learn'&&(active.lessonPhase!=='reading'||!active.lessonFeedback?.correct))return active;
    const before=structuredClone(active);
    try{storage.transaction(()=>{
      if(active.mode==='learn')state.introduction(active.sequence[active.index]);
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
      }else{active.feedback=null;active.hinted=false;active.questionElapsed=0;active.lessonPhase='teach';active.lessonFeedback=null;write();}
    });}catch(error){active=before;throw error;}
    root.ModeAtlasVisitFlows?.recordActivity('kanji');
    if(active.finished)root.ModeAtlasWeekly.finish(active,true);
    questionStarted=active.finished?0:Date.now();root.dispatchEvent(new CustomEvent('modeAtlasKanjiChanged'));return active;
  }
  function pause(){if(!active||active.finished||active.paused)return;checkpoint();active.paused=true;write();}
  function play(){ensure();active.paused=false;questionStarted=Date.now();write();}
  function discard(){if(active)root.ModeAtlasWeekly.finish(active);active=null;questionStarted=0;storage.remove(KEY);}
  for(const event of ['modeAtlasAccountWillChange','modeAtlasAccountSignedOut','modeAtlasDataCleared'])root.addEventListener(event,()=>{active=null;questionStarted=0;});
  root.addEventListener('pagehide',checkpoint);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();root.dispatchEvent(new CustomEvent('modeAtlasKanjiPaused'));}});
  root.ModeAtlasKanjiSession=Object.freeze({start,startCourse,resume,authorize,saved,current:()=>active,hint,answer,lessonStep,lessonAnswer,reviewLesson,next,pause,play,discard,checkpoint});
})(window);
