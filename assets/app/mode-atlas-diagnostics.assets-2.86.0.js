/* Bounded, local technical events. Never store exception messages, stacks,
   account data, input, URL parameters or progress. Sending is opt-in in Help. */
(function ModeAtlasDiagnostics(root){
  'use strict';
  if(root.ModeAtlasDiagnostics)return;
  const key='modeAtlasDiagnostics',limit=20,lifetime=86400000;
  const kinds=new Set(['script','promise','resource','cloud-sync','friends','feedback','sharing']);
  const names=new Set(['Error','TypeError','ReferenceError','RangeError','SyntaxError','AbortError','TimeoutError','QuotaExceededError','SecurityError']);
  const codes=new Set(['permission-denied','unavailable','resource-exhausted','deadline-exceeded','failed-precondition','unauthenticated','offline','auth/network-request-failed','auth/user-token-expired']);
  const pages=new Set(['atlas','kana','reading','writing','results','wordbank','privacy','terms','achievements']);
  const labels=Object.freeze({atlas:'Atlas',kana:'Kana',reading:'Reading practice',writing:'Writing practice',results:'Results',wordbank:'Word Bank',privacy:'Privacy Policy',terms:'Terms of Use',achievements:'Achievements',other:'Mode Atlas'});
  function screen(){
    const raw=root.ModeAtlasPageName?.()||location.pathname.split('/').filter(Boolean).at(-1)||'atlas';
    const name=({ 'index.html':'atlas','default.html':'reading','reverse.html':'writing','test.html':'results' })[raw]||raw.replace(/\.html$/,'');
    return pages.has(name)?name:'other';
  }
  function file(value){
    try{const url=new URL(value,location.href),name=url.pathname.split('/').at(-1);
      return url.origin===location.origin&&name.length<=110&&/^(mode-atlas-[a-z-]+|cloud-sync)(\.assets-\d+\.\d+\.\d+)?\.js$/.test(name)?name:'';
    }catch{return '';}
  }
  function clean(value){
    if(!value||!kinds.has(value.kind)||!Number.isFinite(value.at)||Date.now()-value.at>lifetime||value.at>Date.now()+60000)return null;
    return {kind:value.kind,at:value.at,screen:pages.has(value.screen)?value.screen:'other',name:names.has(value.name)?value.name:'Error',code:codes.has(value.code)?value.code:'',file:file(value.file||''),line:Math.max(0,Math.min(999999,Math.trunc(Number(value.line)||0))),count:Math.max(1,Math.min(99,Math.trunc(Number(value.count)||1)))};
  }
  let entries=[];
  try{const saved=JSON.parse(sessionStorage.getItem(key)||'[]');if(Array.isArray(saved))entries=saved.slice(-limit).map(clean).filter(Boolean);}catch{}
  function persist(){try{sessionStorage.setItem(key,JSON.stringify(entries));}catch{}}
  persist();
  function record(kind,error={},source={}){
    if(!kinds.has(kind))return;
    const item=clean({kind,at:Date.now(),screen:screen(),name:error?.name,code:error?.code,file:source.file,line:source.line,count:1});
    entries=entries.filter(value=>Date.now()-value.at<lifetime);
    const last=entries.at(-1);
    if(last&&['kind','screen','name','code','file','line'].every(field=>last[field]===item[field])&&item.at-last.at<60000){last.count=Math.min(99,last.count+1);last.at=item.at;}
    else entries.push(item);
    entries=entries.slice(-limit);persist();
  }
  function snapshot(){const count=entries.length;entries=entries.filter(value=>Date.now()-value.at<lifetime);if(entries.length!==count)persist();return entries.map(value=>({...value}));}
  function report(){return snapshot().slice(-6).map(value=>`${new Date(value.at).toISOString()} ${value.screen} ${value.kind} ${value.name}${value.code?' '+value.code:''}${value.file?' '+value.file+':'+value.line:''} ×${value.count}`).join('\n').slice(0,1500)||'No recent technical errors recorded.';}
  function clear(){entries=[];try{sessionStorage.removeItem(key);}catch{}}
  let notified=false;
  function notify(){
    if(notified)return;notified=true;
    const show=()=>root.ModeAtlasFeedback?.toast('Something didn’t finish. Try again, or send feedback from Settings if it keeps happening.','warning',6000);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
  }
  root.addEventListener('error',event=>{
    if(event.target!==root){const asset=file(event.target?.src);if(asset)record('resource',{}, {file:asset});return;}
    record('script',event.error,{file:event.filename,line:event.lineno});notify();
  },true);
  root.addEventListener('unhandledrejection',event=>{if(event.reason?.name==='AbortError')return;record('promise',event.reason);notify();});
  for(const event of ['modeAtlasAccountWillChange','modeAtlasAccountSignedOut','modeAtlasDataReset'])root.addEventListener(event,clear);
  root.ModeAtlasDiagnostics=Object.freeze({record,snapshot,report,screen,screenLabel:()=>labels[screen()],clear});
})(window);
