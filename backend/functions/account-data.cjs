'use strict';
// The server reads the same partitioned save format as the web/iOS transport.
const cache=new WeakMap();
const limits=require('./shared/mode-atlas-save-limits.js');
async function readSave(reader,snapshot){
  if(!snapshot?.exists)return {};
  let reads=cache.get(reader);if(!reads){reads=new WeakMap();cache.set(reader,reads);}
  if(reads.has(snapshot))return reads.get(snapshot);
  const pending=(async()=>{
    let data;try{data=structuredClone(snapshot.data());}catch{throw limits.invalid('Unsupported account data.');}
    const budget=limits.envelope(data);
    for(const section of Object.values(data.sections||{})){
      if(!section.storage)continue;
      const {format,parts}=section.storage;
      const chunks=[];
      for(let at=0;at<parts.length;at+=20){
        const docs=await reader.getAll(...parts.slice(at,at+20).map(id=>snapshot.ref.collection('parts').doc(id)));
        for(const doc of docs){const text=doc.exists?doc.data().text:undefined;budget.add(text);chunks.push(text);}
      }
      section.data=budget.decode(chunks.join(''));delete section.storage;
    }
    return data;
  })();
  reads.set(snapshot,pending);return pending;
}
function writeSection(tx,snapshot,name,section){
  const raw=structuredClone(snapshot.data()||{}),text=JSON.stringify(section.data||{}),parts=[];
  const next={...section};
  if(Buffer.byteLength(text)>24000){
    for(let at=0;at<text.length;at+=120000){const id='section-'+name+'-'+parts.length;parts.push(id);}
    next.data={};next.storage={format:'json-parts-v1',parts,schemaVersion:Number(section.data?.state?.version)||0};
  }
  const manifest={...raw,storageVersion:2,revision:(raw.revision||0)+1,generation:raw.generation||0,updatedAt:section.updatedAt,sections:{...raw.sections,[name]:next}};
  const budget=limits.envelope(manifest);limits.parse(text);
  for(let i=0;i<parts.length;i++){const chunk=text.slice(i*120000,(i+1)*120000);budget.add(chunk);tx.set(snapshot.ref.collection('parts').doc(parts[i]),{text:chunk});}
  for(const id of raw.sections?.[name]?.storage?.parts||[])if(!parts.includes(id))tx.delete(snapshot.ref.collection('parts').doc(id));
  tx.set(snapshot.ref,manifest);
}
async function skipInvalidSave(task,uid){
  try{await task();return true;}catch(error){
    if(error.code!=='invalid-account-save')throw error;
    console.warn('Invalid account save rejected',{uid});return false;
  }
}
module.exports={readSave,writeSection,skipInvalidSave};
