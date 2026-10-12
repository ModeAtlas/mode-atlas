/* Shared competition calendar and prize policy. Scores and awards are server-owned. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ModeAtlasWeeklyRules=factory();
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const prizes=Object.freeze([500,300,150]);
  function period(at=Date.now()){
    const date=new Date(at);date.setUTCHours(0,0,0,0);
    date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
    const startAt=date.getTime();return {id:date.toISOString().slice(0,10),startAt,endAt:startAt+7*86400000};
  }
  return Object.freeze({period,prizes,minimumScore:100,minimumPlayers:2,dailyCap:20000,runLifetime:3600000,batchSize:20});
});
