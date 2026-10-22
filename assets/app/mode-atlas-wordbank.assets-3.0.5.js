/* Personal vocabulary model. The page renders this owner; sync merges its IDs. */
(function(root, factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasWordBank=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const KEY='kanaWordBank',DELETED='modeAtlasWordBankDeleted';
  const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  const clean=value=>String(value||'').normalize('NFKC').trim();
  const hash=value=>{let n=2166136261;for(const c of value)n=Math.imul(n^c.codePointAt(0),16777619);return (n>>>0).toString(36);};
  const reading=value=>/^[ぁ-ゖァ-ヺー\s]+$/.test(value)?clean(value).replace(/\s+/g,''):'';
  const schedule=value=>({level:Math.max(0,Math.min(8,number(value?.level))),due:number(value?.due),last:number(value?.last)});
  function normalize(input){
    const map=new Map();
    for(const item of Array.isArray(input)?input:[]){
      if(!item||typeof item!=='object'||typeof(item.written??item.kana)!=='string')continue;
      const written=clean(item.written||item.kana).slice(0,200);if(!written)continue;
      let id=typeof item.id==='string'&&item.id.length>0&&item.id.length<=128?item.id:'word-'+hash(written+'|'+(item.createdAt||''));
      if(map.has(id)&&map.get(id).written!==written)id=id+'-'+hash(written);
      if(['__proto__','constructor','prototype'].includes(id))continue;
      const kana=reading(item.reading||written),text=key=>typeof item[key]==='string'?item[key]:'';
      map.set(id,{id,written,reading:kana,romaji:kana?root.ModeAtlasJapanese.romaji(kana):'',english:text('english').slice(0,1000),example:text('example').slice(0,2000),exampleTranslation:text('exampleTranslation').slice(0,2000),notes:text('notes').slice(0,10000),favorite:item.favorite===true,createdAt:text('createdAt'),updatedAt:text('updatedAt'),
        review:schedule(item.review),readingReview:schedule(item.readingReview),listeningReview:schedule(item.listeningReview)});
    }
    return [...map.values()];
  }
  function read(){return normalize(root.ModeAtlasStorage.json(KEY,[]));}
  function save(input){
    const previous=read(),next=normalize(input),ids=new Set(next.map(row=>row.id));
    const deleted=root.ModeAtlasStorage.json(DELETED,{});
    for(const row of previous)if(!ids.has(row.id))deleted[row.id]=Date.now();
    root.ModeAtlasStorage.transaction(()=>{
      if(!root.ModeAtlasStorage.setJSON(KEY,next)||!root.ModeAtlasStorage.setJSON(DELETED,deleted))throw Error('Your word could not be saved.');
      root.ModeAtlasStorage.set('kanaWordBankUpdatedAt',String(Date.now()));
    });
    root.KanaCloudSync?.markSectionUpdated?.('wordBank');root.KanaCloudSync?.scheduleSync?.();
    // A successful addition is activity for reminders/widgets. Study-day credit
    // remains exclusive to completed retrieval in review().
    if(next.some(row=>!previous.some(old=>old.id===row.id)))root.ModeAtlasVisitFlows?.recordActivity('wordBank');
    root.dispatchEvent?.(new CustomEvent('modeAtlasWordsChanged'));return next;
  }
  function add({written,reading:kana='',english='',example='',exampleTranslation='',notes=''}={}){
    const items=read(),existing=items.find(item=>item.written===clean(written)&&item.reading===(reading(kana)||reading(written)));
    if(existing)return existing;
    const at=new Date().toISOString(),row={id:root.crypto?.randomUUID?.()||'word-'+Date.now()+'-'+Math.random().toString(36).slice(2),written,reading:kana,english,example,exampleTranslation,notes,createdAt:at,updatedAt:at};
    const next=save([row,...items]);return next.find(item=>item.id===row.id);
  }
  const reviewKey=skill=>skill==='reading'?'readingReview':skill==='listening'?'listeningReview':'review';
  function due(at=Date.now(),skill='all'){
    const ready=(item,kind)=>(kind==='meaning'?item.english:item.reading)&&item[reviewKey(kind)].due<=at;
    return read().filter(item=>skill==='all'?['meaning','reading','listening'].some(kind=>ready(item,kind)):ready(item,skill)).sort((a,b)=>a[reviewKey(skill)].due-b[reviewKey(skill)].due);
  }
  function review(id,remembered,at=Date.now(),skill='meaning'){
    const items=read(),row=items.find(item=>item.id===id);if(!row)return;
    const schedule=row[reviewKey(skill)],early=schedule.last&&schedule.due>at;
    if(!remembered)schedule.level=0;else if(!early)schedule.level=Math.min(8,schedule.level+1);
    if(!remembered||!early)schedule.due=at+[60000,600000,86400000,259200000,604800000,1209600000,2592000000,5184000000,7776000000][schedule.level];
    schedule.last=at;row.updatedAt=new Date(Math.max(at,Date.parse(row.updatedAt)+1||0)).toISOString();
    root.ModeAtlasStorage.transaction(()=>{save(items);root.ModeAtlasProgress?.recordHabit?.({branch:'wordbank',id:'word-'+hash(row.id),at});});
    root.ModeAtlasVisitFlows?.recordActivity('wordBank');
  }
  return Object.freeze({KEY,DELETED,normalize,read,save,add,due,review,reviewKey});
});
