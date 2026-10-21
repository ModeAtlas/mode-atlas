'use strict';
// The server reads the same partitioned save format as the web/iOS transport.
const cache=new WeakMap();
async function readSave(reader,snapshot){
  if(!snapshot?.exists)return {};
  let reads=cache.get(reader);if(!reads){reads=new WeakMap();cache.set(reader,reads);}
  if(reads.has(snapshot))return reads.get(snapshot);
  const pending=(async()=>{
    const data=structuredClone(snapshot.data());
    if(data.storageVersion>2)throw Error('Unsupported account storage version');
    for(const section of Object.values(data.sections||{})){
      if(!section.storage)continue;
      const {format,parts}=section.storage;
      if(format!=='json-parts-v1'||!Array.isArray(parts)||parts.length>350||parts.some(id=>!/^section-[a-zA-Z]+-\d+$/.test(id)))throw Error('Invalid account section');
      const docs=await reader.getAll(...parts.map(id=>snapshot.ref.collection('parts').doc(id)));
      if(docs.some(doc=>!doc.exists||typeof doc.data().text!=='string'))throw Error('Missing account section');
      section.data=JSON.parse(docs.map(doc=>doc.data().text).join(''));delete section.storage;
    }
    return data;
  })();
  reads.set(snapshot,pending);return pending;
}
function writeSection(tx,snapshot,name,section){
  const raw=structuredClone(snapshot.data()||{}),text=JSON.stringify(section.data||{}),parts=[];
  const next={...section};
  if(Buffer.byteLength(text)>24000){
    for(let at=0;at<text.length;at+=120000){const id='section-'+name+'-'+parts.length;parts.push(id);tx.set(snapshot.ref.collection('parts').doc(id),{text:text.slice(at,at+120000)});}
    next.data={};next.storage={format:'json-parts-v1',parts,schemaVersion:Number(section.data?.state?.version)||0};
  }
  for(const id of raw.sections?.[name]?.storage?.parts||[])if(!parts.includes(id))tx.delete(snapshot.ref.collection('parts').doc(id));
  tx.set(snapshot.ref,{...raw,storageVersion:2,revision:(raw.revision||0)+1,generation:raw.generation||0,updatedAt:section.updatedAt,sections:{...raw.sections,[name]:next}});
}
module.exports={readSave,writeSection};
