/* Original, concise recognition notes. Readings come from the canonical kana
   maps; this file owns explanations only. Sources are recorded in the release doc. */
(function ModeAtlasKanaCoaching(root){
  'use strict';
  const contrasts = Object.freeze([
    {chars:['シ','ツ'], note:'Look at the two short marks: シ places them down the left side; ツ places them across the top.'},
    {chars:['ソ','ン'], note:'Compare where the strokes begin: ソ lines up near the top; ン lines up along the left side.'},
    {chars:['ぬ','め'], note:'Look at the lower right. ぬ finishes with a small loop; め has no small finishing loop.'},
    {chars:['ね','れ'], note:'Follow the right-hand end. ね curls into a small loop; れ sweeps out without that loop.'},
    {chars:['わ','ね'], note:'Both start with a vertical stroke. わ has a broad rounded right side; ね ends in a smaller loop.'},
    {chars:['メ','ヌ'], note:'メ is two crossing strokes. ヌ has an extra turn across the top.'},
    {chars:['ク','タ'], note:'タ has a short mark inside the shape. ク leaves that space open.'}
  ].map(item => Object.freeze({...item, chars: Object.freeze(item.chars)})));
  function reading(kana){
    const maps = root.ModeAtlasKanaData?.maps || {};
    for (const map of Object.values(maps)) if (map[kana]) return map[kana];
    return '';
  }
  function explain(kana){
    const contrast = contrasts.find(item => item.chars.includes(kana));
    if (contrast) return {chars: contrast.chars, note: contrast.note};
    if (/[ゃゅょャュョ]/.test(kana)) return {chars:[kana], note:'The small kana joins the sound before it. Read the combination as one unit.'};
    return {chars:[kana], note:'Look at the shape and say the reading once before you continue.'};
  }
  const vowelSounds=Object.freeze({a:'Open your mouth for a short “ah”. Keep the vowel steady.',i:'A short, steady “ee” sound. Avoid stretching it into two beats.',u:'A short “oo” sound with relaxed lips, less rounded than English “oo”.',e:'A steady “eh”. Keep it short rather than sliding into “ay”.',o:'A steady “oh”. Avoid adding an extra “w” sound at the end.'});
  const specialSounds=Object.freeze({wo:'を is normally pronounced o. Kana charts often write wo to distinguish it from お.',shi:'Keep the tongue near the roof of your mouth for “shi”; listen for the soft hiss.',chi:'Start with the sound in “cheese”, then keep the vowel short.',tsu:'Start with “ts” as in “cats”, followed by a short Japanese u.',fu:'Blow gently between both lips; avoid pressing your teeth into your lower lip.',r:'The Japanese r is a light tap of the tongue, rather than the English r or l.',n:'ん takes a beat of its own. Its exact sound changes with the following sound.'});
  const shapeHints=Object.freeze({'あ':'Look for the short top stroke, the upright and the large crossing loop.','い':'Two separate strokes: a longer one on the left and a shorter one on the right.','う':'A short mark sits above the rounded main stroke.','え':'A short mark sits above an angular bend and a sweeping bottom.','お':'Notice the small separate mark on the upper right.','ア':'An angular top stroke and a long diagonal stroke.','イ':'A sloping first stroke crosses a longer, nearly vertical stroke.','ウ':'A short top mark sits above the roof-like main shape.','エ':'Two horizontal lines joined by an upright.','オ':'A horizontal line crosses the central stroke; the last stroke slopes left.'});
  function teach(kana){
    const roman=reading(kana),base=roman.replace(/[^a-z]/g,''),contrast=explain(kana);
    let sound=specialSounds[base]||(base.startsWith('r')?specialSounds.r:null)||vowelSounds[base];
    if(!sound)sound=/[ゃゅょャュョ]/.test(kana)?'Join the small kana to the preceding sound. The pair takes one beat.':/[がぎぐげござじずぜぞだぢづでどばびぶべぼガギグゲゴザジズゼゾダヂヅデドバビブベボ]/.test(kana)?'The two small marks voice the consonant. Compare it with the same shape without those marks.':/[ぱぴぷぺぽパピプペポ]/.test(kana)?'The small circle changes the h-row sound to a p sound.':`Listen to ${roman}, then echo it once. Keep the vowel steady and the sound to one beat.`;
    return {sound,shape:shapeHints[kana]||(contrast.chars.length>1?contrast.note:'Watch the stroke order. Trace the shape once, then close the guide and picture where the first stroke begins.')};
  }
  function matches(kana,answer){
    const input=String(answer||'').trim();
    return /^[a-z']+$/i.test(input)&&(root.ModeAtlasJapanese.matchesReading(input,kana)||['を','ヲ'].includes(kana)&&input.toLowerCase()==='o');
  }
  root.ModeAtlasKanaCoaching = Object.freeze({reading, explain, contrasts,teach,matches});
})(window);
