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
    return {seen,sounds:learning.sounds||{}};
  }
  function knownKanji(){const s=root.ModeAtlasKanjiState.read();return new Set([...Object.keys(s.introductions),...Object.keys(s.lessons),...Object.keys(s.completions),...Object.values(s.sources).flatMap(source=>Object.entries(source).filter(([,item])=>['meaning','pronunciation'].some(skill=>(item[skill]?.[0]||0)+(item[skill]?.[1]||0)>0)).map(([char])=>char))]);}
  function pool(script='kana'){
    const {seen,sounds}=knownKana(),units=[...root.ModeAtlasKanaData.collections.all].sort((a,b)=>b.length-a.length),kanji=knownKanji();
    return data.filter(word=>{
      let reading=word.reading;
      while(reading){
        if(/^[っッ]/.test(reading)){if(!sounds.sokuon)return false;reading=reading.slice(1);continue;}
        if(reading[0]==='ー'){if(!sounds.longVowels)return false;reading=reading.slice(1);continue;}
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
  function introduce(id,at=Date.now()){
    if(!byId.has(id)||!pool().some(w=>w.id===id))throw Error('Learn this word’s kana first.');
    const old=progress(id);state.checkpoint(key(id),{vocabulary:{...old,learnedAt:old.learnedAt||at}});
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
  return Object.freeze({modes,data,byId,pool,knownKana,knownKanji,progress,evidence,schedule,unlocked,status,introduce,answer,record,queue,history});
});
