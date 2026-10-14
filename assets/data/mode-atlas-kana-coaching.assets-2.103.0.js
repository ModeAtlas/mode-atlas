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
  root.ModeAtlasKanaCoaching = Object.freeze({reading, explain, contrasts});
})(window);
