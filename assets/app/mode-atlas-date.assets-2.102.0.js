/* Mode Atlas shared local-date helpers.
   Calendar-day keys are local-time based. The 4am update/reset day remains
   separately owned by mode-atlas-version-check.js / visit-flows.js. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.ModeAtlasDates = factory();
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
