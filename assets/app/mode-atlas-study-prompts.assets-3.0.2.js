/* Shared deterministic prompt order, seeded by the server for verified runs.
   The seed binds the question order; it is not proof of human participation. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ModeAtlasStudyPrompts=factory();})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  function hash(value){let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
  function question(run,index){
    if(!run?.seed||!Number.isInteger(index)||index<1||index>4000)return '';
    const retry=run.retries?.find(row=>row.after<=index);if(retry)return retry.char;
    const pool=[...new Set(run.pool)],cycle=Math.floor((index-1)/pool.length);
    pool.sort((a,b)=>hash(run.seed+':'+cycle+':'+a)-hash(run.seed+':'+cycle+':'+b)||a.localeCompare(b));
    const count=run.mode==='comboKana'?Math.min(5,2+Math.floor((run.authorityStreak||0)/10)):1;
    return Array.from({length:count},(_,i)=>pool[(index-1+i)%pool.length]).join('');
  }
  function advance(run,index,char,correct){
    run.retries=(run.retries||[]).filter(row=>!(row.char===char&&row.after<=index));
    if(run.mode==='guided'&&run.branch!=='kanji'&&!correct&&!run.retries.some(row=>row.char===char))run.retries.push({char,after:index+3});
    run.authorityStreak=correct?(run.authorityStreak||0)+1:0;
  }
  return Object.freeze({question,advance});
});
