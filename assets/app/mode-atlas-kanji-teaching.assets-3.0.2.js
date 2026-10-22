/* Lesson content and recognition prompts. Session owns checkpoints; state owns
   completed introductions. Memory cues are learning aids, not etymologies. */
(function(root){
  'use strict';
  const content=root.ModeAtlasKanjiContent;
  const cues={
    '一':['One line, one. Follow it from left to right.','よこせんが ひとつ。いち です。'],
    '二':['Two lines, two. Notice that the lower line is longer.','よこせんが ふたつ。に です。'],
    '三':['Three lines, three. Keep the middle line short.','よこせんが みっつ。さん です。'],
    '人':['Picture a person standing on two legs.','ひとが たっている すがたを おもいうかべましょう。'],
    '日':['Picture the sun framed in a window. This character also means a day.','ひは、たいようや いちにちを あらわします。'],
    '月':['Moon or month. 月 on its own can mean the moon, read つき. In dates, readings change with the whole word.','つきです。よるの そらに みえます。'],
    '木':['Picture a tree: trunk in the middle, branches on either side.','まんなかが みき、りょうがわが えだです。'],
    '山':['Picture a mountain range with three peaks.','みっつの みねが ある やまを おもいうかべましょう。'],
    '川':['Picture three streams of water flowing down a river.','かわの みずが ながれる ようすを おもいうかべましょう。'],
    '水':['Picture water flowing out from the central stroke.','まんなかから みずが ながれる ようすを おもいうかべましょう。']
  };
  function lesson(entry){
    const pronunciation=content.pronunciation(entry),reading=entry.example?.kana||pronunciation.answers[0];
    const plain=reading.replace(/[.-]/g,'');
    const isOn=entry.on.some(v=>content.hira(v)===plain),isKun=entry.kun.some(v=>content.hira(v.replace(/[.-]/g,''))===plain);
    const kind=isKun?'kun':isOn?'on':'word';
    return {word:pronunciation.prompt,reading,meaning:entry.meanings[0],gloss:entry.example?.meanings[0]||entry.meanings[0],kind,
      cue:!entry.example?'Practise this character’s reading on its own.':entry.cue||cues[entry.char]?.[0]||`Find ${entry.char} inside ${pronunciation.prompt}. Say the whole word, then connect it with “${entry.example?.meanings[0]||entry.meanings[0]}”.`,
      japanese:cues[entry.char]?.[1]||`「${reading}」を こえに だして、かんじと いみを おぼえましょう。`};
  }
  function choices(char,phase,seed){
    if(phase==='recognise')return content.choices(char,seed);
    const answer=lesson(content.get(char)).reading,accepted=new Set(content.pronunciation(content.get(char)).answers);
    const others=content.entries().filter(e=>e.char!==char).sort((a,b)=>Number(a.level!==5)-Number(b.level!==5)||content.hash(seed+a.char)-content.hash(seed+b.char));
    const options=[answer];
    for(const entry of others){const value=lesson(entry).reading;if(!accepted.has(content.hira(value))&&!options.includes(value)){options.push(value);if(options.length===3)break;}}
    return options.sort((a,b)=>content.hash(seed+a)-content.hash(seed+b));
  }
  function grade(char,phase,answer){return content.grade(char,phase==='recognise'?'meaning':'pronunciation',answer);}
  root.ModeAtlasKanjiTeaching=Object.freeze({lesson,choices,grade});
})(window);
