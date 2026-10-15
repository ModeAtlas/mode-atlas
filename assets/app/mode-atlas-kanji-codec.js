/* Cloud representation only. Learning code and portable backups use the plain
   schema. Compressing cumulative evidence leaves room for multiple devices in
   the account document; completion markers remain readable by weekly services. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasKanjiCodec=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const LIMIT=16*1024*1024,ENCODING='gzip-base64-v1';
  async function transform(bytes,kind){
    const Constructor=kind==='pack'?root.CompressionStream:root.DecompressionStream;
    if(!Constructor)throw new Error('Update your browser to sync this Kanji save. Your progress is still saved on this device.');
    const reader=new root.Blob([bytes]).stream().pipeThrough(new Constructor('gzip')).getReader();
    const chunks=[];let size=0;
    try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT)throw new Error('This Kanji save is too large to open.');chunks.push(value);}}
    finally{await reader.cancel();reader.releaseLock();}
    const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
  }
  async function pack(input){
    const state=root.ModeAtlasKanjiState.normalize(input),chars=new Set(Object.values(state.sources).flatMap(source=>Object.keys(source)));
    for(const char of chars)if(root.ModeAtlasKanjiState.completed(state,char))state.completions[char]||=state.updatedAt||Date.now();
    if(!chars.size)return {...state,evidence:null};
    const bytes=await transform(new TextEncoder().encode(JSON.stringify(state.sources)),'pack');
    let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    return {...state,sources:{},evidence:{encoding:ENCODING,data:root.btoa(binary)}};
  }
  async function unpack(input){
    if(!input?.evidence)return root.ModeAtlasKanjiState.normalize(input);
    const {encoding,data}=input.evidence;
    if(encoding!==ENCODING||typeof data!=='string'||data.length>LIMIT)throw new Error('This Kanji save needs a newer version of Mode Atlas.');
    const bytes=Uint8Array.from(root.atob(data),c=>c.charCodeAt(0));
    const sources=JSON.parse(new TextDecoder().decode(await transform(bytes,'unpack')));
    return root.ModeAtlasKanjiState.normalize({...input,sources});
  }
  return Object.freeze({pack,unpack});
});
