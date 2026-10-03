/* Shared notification timing policy. Times are minutes after local midnight. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ModeAtlasNotificationRules=factory();})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const defaults=Object.freeze({reminderMinute:1200,quietStart:1320,quietEnd:540});
  const quiet=(minute,s)=>s.quietStart<s.quietEnd?minute>=s.quietStart&&minute<s.quietEnd:minute>=s.quietStart||minute<s.quietEnd;
  function valid(s){return !!s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).length===3&&Object.keys(defaults).every(key=>Number.isInteger(s[key])&&s[key]>=0&&s[key]<1440&&s[key]%15===0)&&s.quietStart!==s.quietEnd&&!quiet(s.reminderMinute,s);}
  const normalize=s=>({...valid(s)?s:defaults});
  const clocks=new Map();
  function clock(at,timeZone){
    if(!clocks.has(timeZone)){if(clocks.size>=32)clocks.delete(clocks.keys().next().value);clocks.set(timeZone,new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));}
    const parts=Object.fromEntries(clocks.get(timeZone).formatToParts(new Date(at)).map(part=>[part.type,part.value]));
    return {day:`${parts.year}-${parts.month}-${parts.day}`,minute:Number(parts.hour)*60+Number(parts.minute)};
  }
  function allowed(at,timeZone,input,evening=false){
    const s=normalize(input),{minute}=clock(at,timeZone);
    return !quiet(minute,s)&&(!evening||(minute>=s.reminderMinute&&minute<Math.min(1440,s.reminderMinute+120)));
  }
  function expiresAt(at,timeZone,input,evening=false){
    if(!allowed(at,timeZone,input,evening))return at;
    const day=clock(at,timeZone).day,limit=at+(evening?2:3)*3600000;
    // Walk actual instants so DST cannot extend an alert into quiet hours or
    // tomorrow. Formatting is cached and the walk is bounded to three hours.
    for(let next=Math.floor(at/60000)*60000+60000;next<=limit;next+=60000){if(clock(next,timeZone).day!==day||!allowed(next,timeZone,input,evening))return next;}
    return limit;
  }
  function overlaps(reminder,input){
    if(!reminder?.enabled)return false;
    const distance=Math.abs(reminder.hour*60+reminder.minute-normalize(input).reminderMinute);
    return Math.min(distance,1440-distance)<=60;
  }
  return Object.freeze({defaults,valid,normalize,quiet,clock,allowed,expiresAt,overlaps});
});
