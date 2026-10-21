/* Mode Atlas shared local-date helpers.
   Calendar-day keys are local-time based. The 4am update/reset day remains
   separately owned by mode-atlas-version-check.js / visit-flows.js. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else {
    root.ModeAtlasDates = factory();
    if(!root.document?.addEventListener)return;
    // One calendar boundary for visible goals and summaries. A suspended app
    // checks on return; an open page needs only its next local-midnight timer.
    let day=root.ModeAtlasDates.localDateKey(),timer;
    function check(){
      clearTimeout(timer);
      const next=root.ModeAtlasDates.localDateKey();
      if(next!==day){const previous=day;day=next;root.dispatchEvent(new CustomEvent('modeAtlasDayChanged',{detail:{previous,day}}));}
      if(root.document?.hidden)return;
      const midnight=new Date();midnight.setHours(24,0,0,0);
      timer=setTimeout(check,Math.max(1,midnight.getTime()-Date.now()));
    }
    root.addEventListener('pageshow',check);
    root.document?.addEventListener('visibilitychange',check);
    root.addEventListener('modeAtlasAppStateChanged',event=>{if(event.detail.isActive)check();else clearTimeout(timer);});
    check();
  }
})(typeof self !== 'undefined' ? self : globalThis, function ModeAtlasDateHelpers(){
  'use strict';

  function asDate(value){
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : new Date();
    if ((typeof value !== 'string' && typeof value !== 'number') || value === '') return new Date();
    var parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function localDateKey(value){
    var d = asDate(value);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function shiftLocalDateKey(value, deltaDays){
    var d = asDate(value);
    d.setDate(d.getDate() + Number(deltaDays || 0));
    return localDateKey(d);
  }

  function shiftDateKey(day,delta){
    const d=new Date(day+'T12:00:00Z');
    d.setUTCDate(d.getUTCDate()+Number(delta||0));
    return d.toISOString().slice(0,10);
  }
  function dateKeyInTimeZone(value,timeZone){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(asDate(value));
    const fields=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    return `${fields.year}-${fields.month}-${fields.day}`;
  }
  return Object.freeze({
    shiftDateKey, dateKeyInTimeZone,
    localDateKey: localDateKey,
    shiftLocalDateKey: shiftLocalDateKey
  });
});
