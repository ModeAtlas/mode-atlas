/* Firestore account transport. Atomic revisions and bounded documents; no auth
   UI or learning policy. Callers supply the one active-account guard. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.ModeAtlasAccountTransport = factory(root);
})(typeof window === 'undefined' ? globalThis : window, function(root) {
  'use strict';
  const PART = 120000, INLINE = 24000, MAX_PARTS = 32;
  const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
  function create({db, doc, runTransaction, valid}) {
    const reference = uid => doc(db,'users',uid,'appData','kanaTrainer');
    const partRef = (uid,id) => doc(db,'users',uid,'appData','kanaTrainer','parts',id);
    const check = () => { if (!valid()) throw Error('The signed-in account changed before this save.'); };
    async function readIn(tx,uid) {
      const record = await tx.get(reference(uid)), raw = record.exists() ? record.data() : null, chunks = new Map();
      if (!raw) return {record,raw:null,data:null,chunks};
      if (raw.storageVersion > 2) throw Error('Update Mode Atlas to open this save.');
      const data = structuredClone(raw);
      const budget=root.ModeAtlasSaveLimits.envelope(data);
      for (const [name,section] of Object.entries(data.sections || {})) {
        if (section.storage) {
          if (section.storage.format !== 'json-parts-v1' || !Array.isArray(section.storage.parts) || section.storage.parts.length > MAX_PARTS) throw Error('This account save could not be opened.');
          let text = '';
          if(section.storage.parts.some(id=>!/^section-[a-zA-Z]+-\d+$/.test(id)))throw Error('Invalid account section.');
          for(let at=0;at<section.storage.parts.length;at+=20){
            const ids=section.storage.parts.slice(at,at+20),documents=await Promise.all(ids.map(id=>tx.get(partRef(uid,id))));
            for(const [index,id]of ids.entries()){
              const part=documents[index],chunk=part.exists()?part.data().text:undefined;budget.add(chunk);
              chunks.set(id,chunk);text+=chunk;
            }
          }
          section.data = budget.decode(text); delete section.storage;
        }
        if (name === 'kanji') section.data = {...section.data,state:await root.ModeAtlasKanjiCodec.unpack(section.data?.state)};
      }
      return {record,raw,data,chunks};
    }
    async function read(uid) {
      return runTransaction(db,async tx => {
        check(); const value = await readIn(tx,uid); check();
        return {exists:()=>!!value.data,data:()=>value.data,metadata:value.record.metadata};
      });
    }
    async function write(uid,local,{replace=false,latest=()=>local}={}) {
      return runTransaction(db,async tx => {
        check(); const previous = await readIn(tx,uid); check();
        const current = latest();
        let merged = replace ? {...current,generation:(Number(previous.data?.generation)||0)+1} : root.ModeAtlasSaveMerge.snapshot(current,previous.data || {});
        const values=value=>({generation:value?.generation||0,sections:Object.fromEntries(Object.entries(value?.sections||{}).map(([name,section])=>[name,section.data]))});
        if(!replace&&previous.raw?.storageVersion===2&&root.ModeAtlasSaveMerge.stable(values(merged))===root.ModeAtlasSaveMerge.stable(values(previous.data)))return previous.data;
        merged = {...merged,revision:(Number(previous.raw?.revision)||0)+1,storageVersion:2};
        const raw = structuredClone(merged), next = new Map();
        for (const [name,section] of Object.entries(raw.sections || {})) {
          if (name === 'kanji') section.data = {...section.data,state:await root.ModeAtlasKanjiCodec.pack(section.data?.state)};
          // Old histories are written first so new results change only the tail.
          if (['readingTests','writingTests','kanjiTests'].includes(name)) {
            const field = name === 'kanjiTests' ? 'items' : 'primary';
            if (Array.isArray(section.data?.[field])) section.data[field].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
          }
          const text = JSON.stringify(section.data || {});
          if (bytes(section.data) > INLINE) {
            const parts = [];
            for (let at=0;at<text.length;at+=PART) {
              const id = 'section-'+name+'-'+parts.length; parts.push(id); next.set(id,text.slice(at,at+PART));
            }
            const schemaVersion=Number(section.data?.state?.version)||0;
            section.data = {}; section.storage = {format:'json-parts-v1',parts,schemaVersion};
          }
        }
        if (next.size > MAX_PARTS || bytes(raw) > 750000) throw Error('This account has reached the cloud save limit. Your device copy is still here. Contact support before resetting or signing out.');
        const budget=root.ModeAtlasSaveLimits.envelope(raw);for(const text of next.values())budget.add(text);
        let changedBytes=0;
        for (const [id,text] of next) if (previous.chunks.get(id)!==text) changedBytes+=bytes({text});
        if (changedBytes > 8*1024*1024) throw Error('This save exceeds the cloud transfer limit. Your device copy is still here. Contact support before resetting or signing out.');
        check();
        for (const [id,text] of next) if (previous.chunks.get(id)!==text) tx.set(partRef(uid,id),{text});
        for (const id of previous.chunks.keys()) if (!next.has(id)) tx.delete(partRef(uid,id));
        tx.set(reference(uid),raw);
        return merged;
      });
    }
    return Object.freeze({read,write});
  }
  return Object.freeze({create});
});
