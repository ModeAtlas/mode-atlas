/* Mode Atlas shared local-date helpers.
   Calendar-day keys are local-time based. The 4am update/reset day remains
   separately owned by mode-atlas-version-check.js / visit-flows.js. */
(function ModeAtlasDateHelpers(root){
  'use strict';
  if (root.ModeAtlasDates) return;

  function asDate(value){
    if (value instanceof Date) return new Date(value.getTime());
    if (value == null || value === '') return new Date();
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

  root.ModeAtlasDates = Object.freeze({
    localDateKey: localDateKey,
    shiftLocalDateKey: shiftLocalDateKey
  });
})(typeof self !== 'undefined' ? self : window);
