/* Kanji results are separate from the Kana result schema and its renderers. */
(function(root){
  'use strict';
  const KEY='modeAtlasKanjiTests',UPDATED='modeAtlasKanjiTestsUpdatedAt';
  const number=v=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
  function normalize(value){
    const rows=Array.isArray(value)?value:[];
    const unique=new Map();
    for(const item of rows){
      if(!item||!/^[a-zA-Z0-9-]{8,100}$/.test(item.id)||!['pronunciation','meaning','match'].includes(item.mode)||![1,2,3,4,5].includes(item.level)||!number(item.at)||!Array.isArray(item.answers))continue;
      const answers=item.answers.filter(a=>root.ModeAtlasKanjiState.levels.get(a?.char)===item.level&&typeof a.correct==='boolean').slice(0,40).map(a=>({char:a.char,correct:a.correct,answer:String(a.answer||'').slice(0,160),elapsed:Math.min(300000,number(a.elapsed))}));
      if(!answers.length)continue;
      const row={id:item.id,mode:item.mode,level:item.level,at:number(item.at),answers};
      const old=unique.get(row.id);if(!old||JSON.stringify(row)>JSON.stringify(old))unique.set(row.id,row);
    }
    return [...unique.values()].sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id)).slice(0,30);
  }
  function read(){return normalize(root.ModeAtlasStorage.json(KEY,[]));}
  function merge(a,b){return normalize([...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]);}
  function add(result){
    const records=merge(read(),[result]);
    if(!root.ModeAtlasStorage.setJSON(KEY,records))throw new Error('This test could not be saved on your device.');
    root.ModeAtlasStorage.set(UPDATED,String(Date.now()));root.KanaCloudSync?.scheduleSync?.(900);return records;
  }
  root.ModeAtlasKanjiResults=Object.freeze({KEY,UPDATED,normalize,read,merge,add});
})(window);
