/* One bounded save envelope for both device transport and server projections. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ModeAtlasSaveLimits=factory();
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  // A manifest is at most 1 MB. Even worst-case four-byte UTF-8 characters in
  // all 32 parts remain below the 16 MiB decode budget (32×480000+1000000).
  const MAX_BYTES=16*1024*1024,MAX_PARTS=32,PART_BYTES=480000;
  const invalid=message=>Object.assign(new Error(message),{code:'invalid-account-save'});
  const size=text=>new TextEncoder().encode(text).length;
  function parse(text){
    if(typeof text!=='string'||size(text)>MAX_BYTES)throw invalid('This account section exceeds the save limit.');
    let depth=0,quoted=false,escaped=false,tokens=0;
    for(const char of text){
      if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
      if(char==='"'){quoted=true;continue;}
      if(char==='{'||char==='[')depth++;
      if(char==='}'||char===']')depth--;
      if(char==='{'||char==='['||char===','||char===':')tokens++;
      if(depth>32||tokens>500000)throw invalid('This account section is too complex to open safely.');
    }
    try{return JSON.parse(text);}catch{throw invalid('Invalid account JSON.');}
  }
  function envelope(data){
    const sections=data?.sections||{},entries=Object.entries(sections),ids=new Set();
    if(!data||typeof data!=='object'||Array.isArray(sections)||entries.length>32||data.storageVersion>2)throw invalid('Unsupported account save.');
    for(const [name,section]of entries){
      if(!/^[a-zA-Z]{1,32}$/.test(name)||['constructor','prototype','__proto__'].includes(name)||!section||typeof section!=='object'||Array.isArray(section))throw invalid('Invalid account section.');
      if(!section.storage)continue;
      const {format,parts}=section.storage;
      if(format!=='json-parts-v1'||!Array.isArray(parts)||!parts.length||parts.length>MAX_PARTS)throw invalid('Invalid account section.');
      for(const id of parts){
        if(typeof id!=='string'||!new RegExp('^section-'+name+'-(0|[1-9][0-9]{0,2})$').test(id)||Number(id.split('-').at(-1))>=MAX_PARTS||ids.has(id))throw invalid('Invalid account part.');
        ids.add(id);
      }
    }
    if(ids.size>MAX_PARTS)throw invalid('This account exceeds the cloud save limit.');
    let bytes=size(JSON.stringify(data));
    if(bytes>1000000)throw invalid('This account exceeds the cloud save limit.');
    let nodes=0;
    return {add(text){
      if(typeof text!=='string')throw invalid('An account section is missing.');
      const length=size(text);bytes+=length;
      if(length>PART_BYTES||bytes>MAX_BYTES)throw invalid('This account exceeds the cloud save limit. Your device copy has been kept.');
    },decode(text){
      const value=parse(text),pending=[[value,0]];
      while(pending.length){
        const [item,depth]=pending.pop();if(++nodes>1000000||depth>32)throw invalid('This account section is too complex to open safely.');
        if(item&&typeof item==='object')for(const child of Object.values(item)){
          if(pending.length+nodes>=1000000)throw invalid('This account section is too complex to open safely.');
          pending.push([child,depth+1]);
        }
      }
      return value;
    }};
  }
  return Object.freeze({envelope,parse,invalid,MAX_BYTES,MAX_PARTS,PART_BYTES});
});
