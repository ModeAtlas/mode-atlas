/* Japanese text conversion and accepted input. No storage or UI ownership. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.ModeAtlasJapanese = factory(root.ModeAtlasKanaData);
})(typeof window === 'undefined' ? globalThis : window, function(data) {
  'use strict';
  const hira = value => String(value || '').normalize('NFKC').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 96));
  const mappings = Object.fromEntries(Object.values(data.maps).flatMap(map => Object.entries(map).map(([k, v]) => [hira(k), v])));
  Object.assign(mappings, {'ぁ':'a', 'ぃ':'i', 'ぅ':'u', 'ぇ':'e', 'ぉ':'o', 'ゎ':'wa'});
  const pairs = Object.entries(mappings).sort((a, b) => b[0].length - a[0].length);
  const roman = new Map();
  for (const [kana, value] of pairs) if (!roman.has(value)) roman.set(value, kana);
  for (const [key, value] of Object.entries({ji:'じ',ja:'じゃ',ju:'じゅ',jo:'じょ',je:'じぇ',zu:'ず',di:'ぢ',du:'づ',dya:'ぢゃ',dyu:'ぢゅ',dyo:'ぢょ',si:'し',sya:'しゃ',syu:'しゅ',syo:'しょ',ti:'ち',tya:'ちゃ',tyu:'ちゅ',tyo:'ちょ',tu:'つ',hu:'ふ',wo:'を',wi:'うぃ',we:'うぇ',xa:'ぁ',xi:'ぃ',xu:'ぅ',xe:'ぇ',xo:'ぉ',xtsu:'っ',ltsu:'っ'})) roman.set(key, value);
  const romanPairs = [...roman].sort((a, b) => b[0].length - a[0].length);
  function romaji(value) {
    let input = hira(value), output = '', geminate = false;
    while (input) {
      if (input[0] === 'っ') { geminate = true; input = input.slice(1); continue; }
      if (input[0] === 'ー') {
        output += output.match(/[aeiou](?=[^aeiou]*$)/)?.[0] || 'ー';
        input = input.slice(1); continue;
      }
      const pair = pairs.find(([kana]) => input.startsWith(kana));
      if (!pair) { output += input[0]; input = input.slice(1); continue; }
      let chunk = pair[1];
      if (pair[0] === 'ん' && /^[あいうえおやゆよ]/.test(input.slice(1))) chunk = "n'";
      if (geminate && /^[bcdfghjklmpqrstvwxyz]/.test(chunk)) chunk = (chunk.startsWith('ch') ? 't' : chunk[0]) + chunk;
      geminate = false; output += chunk; input = input.slice(pair[0].length);
    }
    return output;
  }
  function kana(value) {
    let input = hira(value).trim().toLowerCase().replace(/\s+/g, ''), output = '';
    while (input) {
      if (/^tch/.test(input) || /^[bcdfghjklmpqrstvwxyz]/.test(input) && input[0] === input[1]) {
        output += 'っ'; input = input.slice(1); continue;
      }
      if (input[0] === 'n' && (input.length === 1 || input[1] === "'" || input[1] === 'n' || !/^[aeiouy]/.test(input.slice(1)))) {
        output += 'ん';
        input = input.slice(input[1] === "'" || input === 'nn' || input.startsWith('nn') && !/^[aeiouy]/.test(input.slice(2)) ? 2 : 1);
        continue;
      }
      const pair = romanPairs.find(([key]) => input.startsWith(key));
      if (pair) { output += pair[1]; input = input.slice(pair[0].length); }
      else { output += input[0]; input = input.slice(1); }
    }
    return output;
  }
  function matchesReading(answer, expected) {
    const input = hira(answer).trim().toLowerCase().replace(/\s+/g, '');
    const target = hira(expected).replace(/\s+/g, '');
    if (input === target || kana(input) === target) return true;
    // Roman input cannot distinguish ず/づ, じ/ぢ or a long-vowel mark.
    // Accept only the prompt's pronunciation, retaining strict direct-kana input.
    return /^[a-z']+$/.test(input) && romaji(kana(input)) === romaji(target);
  }
  return Object.freeze({hira, kana, romaji, matchesReading});
});
