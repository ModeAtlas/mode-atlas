/* Curated single-word learning. Decoding, meaning and production keep independent
   evidence in the existing synced WordLessonState; no parallel save store. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.ModeAtlasVocabulary=factory(root);})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const modes=Object.freeze([
    {id:'decode',label:'Read the word',prompt:'kana',answer:'romaji'},
    {id:'meaning',label:'Recall the meaning',prompt:'kana',answer:'English'},
    {id:'produceRoman',label:'Recall the reading',prompt:'English',answer:'romaji'},
    {id:'produceKana',label:'Write the word',prompt:'English',answer:'kana'}
  ]);
  const data=root.ModeAtlasVocabularyData,state=root.ModeAtlasWordLessonState;
  const byId=new Map(data.map(word=>[word.id,word]));
  const key=id=>'vocab-'+id;
  function knownKana(){
    const learning=root.ModeAtlasKanaLearning.read(),evidence=root.ModeAtlasKanaLearning.snapshot(),seen=new Set(Object.keys(learning.introduced));
    for(const skill of ['reading','writing']){
      for(const [char,row]of Object.entries(evidence[skill+'Stats']||{}))if((row.correct||0)+(row.wrong||0)>0)seen.add(char);
      for(const [char,stage]of Object.entries(learning.earned[skill]||{}))if(stage>0)seen.add(char);
      for(const row of root.ModeAtlasKanaLearning.rows)if(learning.placed[skill]?.[row.id])row.chars.forEach(char=>seen.add(char));
    }
    return {seen,sounds:learning.sounds||{},newCourse:!!learning.course?.startedAt,legacyLongVowels:learning.course?.legacyLongVowels===true};
  }
  function knownKanji(){const s=root.ModeAtlasKanjiState.read();return new Set([...Object.keys(s.introductions),...Object.keys(s.lessons),...Object.keys(s.completions),...Object.values(s.sources).flatMap(source=>Object.entries(source).filter(([,item])=>['meaning','pronunciation'].some(skill=>(item[skill]?.[0]||0)+(item[skill]?.[1]||0)>0)).map(([char])=>char))]);}
  function pool(script='kana'){
    const {seen,sounds,newCourse,legacyLongVowels}=knownKana(),units=[...root.ModeAtlasKanaData.collections.all].sort((a,b)=>b.length-a.length),kanji=knownKanji();
    return data.filter(word=>{
      let reading=word.reading;
      while(reading){
        if(/^[っッ]/.test(reading)){if(!sounds.sokuon)return false;reading=reading.slice(1);continue;}
        if(reading[0]==='ー'){if(!sounds.katakanaLength&&!(sounds.longVowels&&(!newCourse||legacyLongVowels)))return false;reading=reading.slice(1);continue;}
        const unit=units.find(char=>reading.startsWith(char));if(!unit||!seen.has(unit))return false;reading=reading.slice(unit.length);
      }
      return script!=='mixed'||[...word.written].filter(char=>/\p{Script=Han}/u.test(char)).every(char=>kanji.has(char));
    });
  }
  function progress(id,records=state.read()){return records[key(id)]?.vocabulary||{};}
  function evidence(id,mode,records){return state.events(progress(id,records)[mode]);}
  function schedule(id,mode,records){return progress(id,records).schedules?.[mode]||state.vocabularySchedule(evidence(id,mode,records));}
  function unlocked(records=state.read()){
    const counts={};
    for(const mode of modes)counts[mode.id]=data.filter(word=>records[key(word.id)]?.vocabulary?.achieved?.[mode.id]||state.events(records[key(word.id)]?.vocabulary?.[mode.id]).some(e=>e.quality===2)).length;
    return {decode:true,meaning:counts.decode>=3,produceRoman:counts.meaning>=3,produceKana:counts.produceRoman>=3};
  }
  function status(script='kana',mode='decode',now=Date.now()){
    const eligible=pool(script),records=state.read(),learned=eligible.filter(w=>records[key(w.id)]?.vocabulary?.learnedAt);
    const due=learned.filter(w=>{const e=state.events(records[key(w.id)].vocabulary[mode]);return e.length&&schedule(w.id,mode,records).due<=now;});
    return {eligible,learned,due,newWords:eligible.filter(w=>!records[key(w.id)]?.vocabulary?.learnedAt),unlocked:unlocked(records),records};
  }
  function introduce(id,at=Date.now(),{script='kana'}={}){
    if(!byId.has(id)||!pool(script).some(w=>w.id===id))throw Error('Meet this word’s characters first.');
    const old=progress(id);state.checkpoint(key(id),{vocabulary:{...old,learnedAt:old.learnedAt||at,formIntroducedAt:script==='mixed'?old.formIntroducedAt||at:old.formIntroducedAt||0}});
  }
  function answer(id,mode,value){
    const word=byId.get(id);if(!word||!modes.some(m=>m.id===mode))return false;
    let input=String(value||'').normalize('NFKC').trim();
    const readings=mode.startsWith('produce')?(word.readings||[word.reading]):[word.reading];
    if(mode==='meaning'){const clean=s=>String(s).normalize('NFKC').toLowerCase().trim().replace(/^[\s]*(?:a|an|the|to)\s+/,'').replace(/[.!?]+$/,'').replace(/\s+/g,' ');return word.answers.some(s=>clean(s)===clean(input));}
    if(mode==='produceKana')return /^[ぁ-ゖァ-ヺー\s]+$/.test(input)&&readings.some(reading=>root.ModeAtlasJapanese.hira(input).replace(/\s+/g,'')===root.ModeAtlasJapanese.hira(reading));
    if(/^[a-zA-ZāīūēōĀĪŪĒŌ'\s]+$/.test(input)){
      const fold=s=>s.toLowerCase().replace(/[āīūēō]/g,c=>({ā:'aa',ī:'ii',ū:'uu',ē:'ee',ō:'oo'}[c])).replace(/ou/g,'oo').replace(/\s+/g,'');
      return readings.some(reading=>root.ModeAtlasJapanese.matchesReading(input,reading)||(/[āīūēō]/i.test(input)&&fold(input)===fold(root.ModeAtlasJapanese.romaji(reading))));
    }return false;
  }
  function record(id,mode,correct,{assisted=false,test=false,at=Date.now(),eventId}={}){
    if(!byId.has(id)||!modes.some(m=>m.id===mode)||!unlocked()[mode]||!pool().some(w=>w.id===id)||!progress(id).learnedAt)throw Error('Learn this word and unlock this skill first.');
    const old=progress(id),idValue=eventId||root.crypto?.randomUUID?.()||Math.random().toString(36).slice(2);
    const encoded=at.toString(36)+':'+(correct?(assisted?1:2):0)+':'+(test?'t':'p')+':'+idValue;
    root.ModeAtlasStorage.transaction(()=>{
      const previous=schedule(id,mode),quality=correct&&!assisted,early=previous.due>at;let level=previous.level,due=previous.due;
      if(!quality){level=0;due=at+600000;}else if(!early){level=Math.min(5,level+1);due=at+[0,86400000,259200000,604800000,1209600000,2592000000][level];}
      state.checkpoint(key(id),{vocabulary:{...old,[mode]:state.mergeEvents(old[mode],encoded),achieved:{...old.achieved,[mode]:quality?Math.max(old.achieved?.[mode]||0,at):old.achieved?.[mode]||0},schedules:{...old.schedules,[mode]:{level,due,last:Math.max(at,(previous.last||0)+1)}}}});
      root.ModeAtlasProgress?.recordHabit?.({branch:'wordbank',id:'vocabulary-'+id,at});
    });
    root.ModeAtlasVisitFlows?.recordActivity?.('wordBank');
  }
  function queue(script,mode,kind='practice'){
    const s=status(script,mode);if(!s.unlocked[mode])return [];
    const words=kind==='learn'?s.newWords.slice(0,5):kind==='review'?s.due.slice(0,10):s.learned;
    if(kind==='learn'||kind==='review')return words;
    if(kind==='test'){const shuffled=[...words];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}return shuffled.slice(0,10);}
    return [...words].sort((a,b)=>{const ae=evidence(a.id,mode,s.records),be=evidence(b.id,mode,s.records);return (ae.length?schedule(a.id,mode,s.records).due:0)-(be.length?schedule(b.id,mode,s.records).due:0)||data.indexOf(a)-data.indexOf(b);}).slice(0,10);
  }
  function history(){const records=state.read();return data.flatMap(w=>modes.flatMap(mode=>evidence(w.id,mode.id,records).filter(e=>e.kind==='t').map(e=>({...e,word:w,mode:mode.id})))).sort((a,b)=>b.at-a.at).slice(0,30);}
  const COURSE='vocabulary-course';
  const preference=()=>state.read()[COURSE]?.preferences?.script||'kana';
  function setPreference(script){state.checkpoint(COURSE,{preferences:{...state.read()[COURSE]?.preferences,script:script==='mixed'?'mixed':'kana'}});}
  const session=()=>state.read()[COURSE]?.course||null;
  function pending(){const saved=session();return saved&&saved.phase!=='complete'&&saved.tasks.length?saved:null;}
  function plan(){
    const script=preference(),s=status(script),due=[];
    const newForms=script==='mixed'?s.learned.filter(w=>w.written!==w.reading&&!progress(w.id,s.records).formIntroducedAt).slice(0,3):[];
    if(newForms.length)return {kind:'learn',script,tasks:[...newForms.map(w=>({id:w.id,mode:'meet'})),...newForms.map(w=>({id:w.id,mode:'decode'}))],title:'Meet these Kanji spellings',detail:'Connect familiar words to their Kanji spellings and readings.'};
    const last=session(),repair=last?.phase==='complete'?[...new Map(last.results.filter(r=>(!r.correct||r.assisted)&&evidence(r.id,r.mode,s.records).at(-1)?.quality!==2).map(r=>[r.id+':'+r.mode,{id:r.id,mode:r.mode}])).values()].filter(t=>s.learned.some(w=>w.id===t.id)):[];
    if(repair.length)return {kind:'practice',script,tasks:repair.slice(0,8),title:'Revisit the tricky words',detail:'Try the words that need another look.'};
    for(const word of s.learned)for(const skill of modes)if(s.unlocked[skill.id]&&evidence(word.id,skill.id,s.records).length&&schedule(word.id,skill.id,s.records).due<=Date.now())due.push({id:word.id,mode:skill.id});
    if(due.length)return {kind:'review',script,tasks:due.sort((a,b)=>schedule(a.id,a.mode,s.records).due-schedule(b.id,b.mode,s.records).due).slice(0,8),title:'Revisit your words',detail:'Recall words from earlier learning.'};
    for(const skill of modes.filter(m=>s.unlocked[m.id])){
      const words=s.learned.filter(w=>!progress(w.id,s.records).achieved?.[skill.id]).slice(0,3);
      if(words.length)return {kind:'practice',script,tasks:words.map(w=>({id:w.id,mode:skill.id})),title:skill.label,detail:skill.id==='decode'?'Read the words you have met.':skill.id==='meaning'?'Connect their spellings to their meanings.':skill.id==='produceRoman'?'Recall a Japanese word from its meaning.':'Recall the Japanese spelling from its meaning.'};
    }
    const ready=s.learned.filter(w=>modes.every(m=>progress(w.id,s.records).achieved?.[m.id]));
    const checked=(state.read()[COURSE]?.preferences?.checkpointed||[]).filter(id=>byId.has(id)),block=ready.filter(w=>!checked.includes(w.id)).slice(0,6);
    if(block.length===6||(block.length&&ready.length===data.length)){
      const earlier=ready.filter(w=>checked.includes(w.id)).slice(-Math.max(2,4-block.length)),milestone=checked.length+block.length;
      return {kind:'checkpoint',script,milestone,finalCheckpoint:block.length<6,milestoneIds:block.map(w=>w.id),tasks:[...block,...earlier].map((w,i)=>({id:w.id,mode:modes[i%4].id})),title:'Put your words together',detail:'Check your recent words alongside earlier learning.'};
    }
    const words=s.newWords.slice(0,3);
    if(words.length)return {kind:'learn',script,tasks:[...words.map(w=>({id:w.id,mode:'meet'})),...words.map(w=>({id:w.id,mode:'decode'}))],title:s.learned.length?'Meet your next words':'Learn your first words',detail:'Meet a small set, then read it from memory.'};
    if(s.learned.length)return {kind:s.eligible.length===data.length?'complete':'grow',script,tasks:[],title:s.eligible.length===data.length?'Foundation words complete':'Ready for more words',detail:s.eligible.length===data.length?'Return for spaced reviews, or choose a custom practice.':script==='mixed'?'Meet more characters to open another small set.':'Meet more kana to open another small set.'};
    return {kind:'empty',script,tasks:[],title:script==='mixed'?'Meet the characters first':'Start with a few kana',detail:script==='mixed'?'Use Kana words while you build your Kanji knowledge.':'Learn the vowel row to begin using it in words.'};
  }
  function nextAction(){
    const saved=pending(),next=plan(),empty=next.kind==='empty'&&!saved,kana=root.ModeAtlasKanaLearning;
    if(empty&&next.script==='mixed'&&pool('kana').length)return {kind:'empty',title:'Start with kana words',label:'Use Kana words',detail:'Add Kanji spellings as you meet their characters.',href:'/wordbank/?view=course&script=kana',branchId:'words'};
    if(!saved&&next.kind==='complete')return {...next,label:'Explore learning',href:'/learn/',branchId:'words'};
    if(!saved&&next.kind==='grow'){
      const kanji=next.script==='mixed'&&pool('kana').length>pool('mixed').length;
      return {...next,label:kanji?'Continue Kanji':'Continue Kana',href:kanji?root.ModeAtlasKanjiState.nextAction?.().href||'/kanji/':kana.nextAction?.().href||'/kana/',branchId:kanji?'kanji':'kana'};
    }
    const kanaHref=empty&&kana.read()?.startedAt?kana.nextAction?.().href||'/kana/':'/kana/';
    return {kind:saved?'resume':next.kind,title:saved?'Continue your words':next.title,label:saved?'Continue lesson':empty?'Continue Kana':'Continue',detail:saved?'Pick up at your saved step.':next.detail,href:empty?kanaHref:'/wordbank/?view=course&session=course',branchId:empty?'kana':'words'};
  }
  function saveSession(value){return state.checkpoint(COURSE,{course:{...value,updatedAt:Date.now()}}).course;}
  function begin(options={}){
    const old=pending();if(old)return old;
    let next=plan();
    if(options.custom){
      const script=options.script||preference(),mode=options.mode||'decode',kind=options.kind||'practice';
      const words=options.words||queue(script,mode,kind==='test'?'test':'practice');
      next={script,kind:kind==='test'?'custom-test':'practice',tasks:words.map(w=>({id:w.id,mode}))};
      const newForms=script==='mixed'?words.filter(w=>w.written!==w.reading&&!progress(w.id).formIntroducedAt).slice(0,3):[];
      if(newForms.length)next={script,kind:'learn',tasks:[...newForms.map(w=>({id:w.id,mode:'meet'})),...newForms.map(w=>({id:w.id,mode:'decode'}))]};
    }
    if(!next.tasks.length)return null;
    return saveSession({id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),kind:next.kind,script:next.script,milestone:next.milestone||0,milestoneIds:next.milestoneIds||[],finalCheckpoint:next.finalCheckpoint===true,wordIds:[...new Set(next.tasks.map(t=>t.id))],tasks:next.tasks,cursor:0,phase:'task',results:[],startedAt:Date.now(),completedAt:0});
  }
  function current(saved=session()){return saved?.tasks[saved.cursor]||null;}
  function advance(id){
    const saved=session();if(!saved||saved.id!==id||saved.phase==='complete')return saved;
    const task=current(saved);if(task?.mode!=='meet'&&saved.phase!=='feedback')return saved;
    const cursor=saved.cursor+1,complete=cursor>=saved.tasks.length;
    return root.ModeAtlasStorage.transaction(()=>{
      if(task?.mode==='meet'){
        introduce(task.id,Date.now(),{script:saved.script});
        const visit=()=>root.ModeAtlasVisitFlows?.recordActivity?.('wordBank');
        if(root.ModeAtlasStorage.afterCommit)root.ModeAtlasStorage.afterCommit(visit);else visit();
      }
      const covered=saved.tasks.length===saved.results.length&&saved.tasks.every((task,index)=>{const result=saved.results[index];return result?.id===task.id&&result.mode===task.mode&&result.correct&&!result.assisted;});
      const blockSize=saved.milestoneIds?.length||0,blockCovered=(blockSize===6||(saved.finalCheckpoint&&blockSize>0&&blockSize<6))&&new Set(saved.milestoneIds).size===blockSize&&saved.milestoneIds.every(id=>saved.tasks.some(t=>t.id===id))&&modes.every(mode=>saved.tasks.some(t=>t.mode===mode.id));
      if(complete&&saved.kind==='checkpoint'&&saved.milestone&&covered&&blockCovered){
        const preferences=state.read()[COURSE]?.preferences;
        const checkpointed=[...new Set([...(preferences?.checkpointed||[]),...saved.milestoneIds])];
        state.checkpoint(COURSE,{preferences:{...preferences,script:saved.script,checkpointWords:checkpointed.length,checkpointed}});
      }
      return saveSession({...saved,cursor,phase:complete?'complete':'task',completedAt:complete?Date.now():0});
    });
  }
  function respond(id,value,{assisted=false,skip=false,cursor}={}){
    const saved=session(),task=current(saved);if(!saved||saved.id!==id||saved.phase!=='task'||!task||task.mode==='meet'||(cursor!==undefined&&saved.cursor!==cursor))return saved;
    const correct=!skip&&answer(task.id,task.mode,value),helped=assisted||task.assisted,results=[...saved.results,{...task,correct,assisted:helped}],tasks=[...saved.tasks];
    // Corrections are tested again only after intervening words. With a single
    // available word a retry remains assisted and cannot become earned evidence.
    const assessment=['checkpoint','custom-test'].includes(saved.kind);
    if((!correct||helped)&&!assessment&&!task.retry){
      const fillers=saved.wordIds.filter(wordId=>wordId!==task.id).slice(0,2);
      const remaining=tasks.length-saved.cursor-1;
      if(remaining<2)for(const wordId of fillers.slice(0,2-remaining))tasks.push({id:wordId,mode:task.mode,retry:true});
      tasks.push({...task,retry:true,assisted:tasks.length-saved.cursor-1<2});
    }
    return root.ModeAtlasStorage.transaction(()=>{
      record(task.id,task.mode,correct,{assisted:helped,test:assessment,eventId:saved.id+'-'+saved.cursor});
      return saveSession({...saved,tasks,results,phase:'feedback'});
    });
  }
  return Object.freeze({modes,data,byId,pool,knownKana,knownKanji,progress,evidence,schedule,unlocked,status,introduce,answer,record,queue,history,preference,setPreference,session,pending,plan,nextAction,begin,current,advance,respond});
});
