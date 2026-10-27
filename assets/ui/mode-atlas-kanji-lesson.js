/* Guided lesson rendering. The session controller alone changes lesson steps. */
(function(root){
  'use strict';
  const content=root.ModeAtlasKanjiContent,teaching=root.ModeAtlasKanjiTeaching,state=root.ModeAtlasKanjiState;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function mount(current,change,report){
    const entry=content.get(current.sequence[current.index]),lesson=teaching.lesson(entry),roman=state.read().settings.romaji,phase=current.lessonPhase||'teach';
    const view=el('section','ma-kanji-lesson');view.dataset.phase=phase;view.setAttribute('aria-label','Guided Kanji lesson');
    const button=(label,action,cls='ma-button ma-button--ghost')=>{const b=el('button',cls,label);b.type='button';b.addEventListener('click',()=>{try{action();}catch(error){report(error);}});return b;};
    const progress=el('ol','ma-kanji-lesson-steps');
    for(const [id,label]of [['teach','Meet'],['recognise','Meaning'],['reading','Reading']]){const step=el('li','',label);if(id===phase)step.setAttribute('aria-current','step');progress.append(step);}view.append(progress);
    const action=(label,fn)=>button(label,()=>{fn();change();},'ma-button ma-button--primary');
    const glyph=el('div','ma-kanji-glyph',phase==='reading'?lesson.word:entry.char);glyph.lang='ja';
    if(phase==='teach'){
      const hero=el('div','ma-kanji-lesson-hero'),copy=el('div');copy.append(el('h2','',lesson.meaning),el('p','ma-kanji-caption',`${entry.strokes} ${entry.strokes===1?'stroke':'strokes'} · N${entry.level}`));hero.append(glyph,copy);view.append(hero);
      const word=el('div','ma-kanji-spoken-word');
      if(lesson.word!==entry.char){const written=el('strong','',lesson.word);written.lang='ja';word.append(written,el('span','',lesson.gloss));}
      const reading=el('p','ma-kanji-focus-reading',roman?content.romaji(lesson.reading):lesson.reading);reading.lang=roman?'ja-Latn':'ja';word.append(reading);
      const audio=el('div','ma-kanji-listen-row'),toggle=button(roman?'Show kana':'Show romaji',()=>{state.settings({romaji:!roman});change();},'ma-kanji-text-button');toggle.setAttribute('aria-pressed',String(roman));
      audio.append(root.ModeAtlasPronunciation.controls(lesson.reading),toggle);word.append(audio);view.append(word);
      view.append(el('p','ma-kanji-memory-cue',lesson.cue));
      if(entry.context){
        const example=el('blockquote','ma-kanji-context'),japanese=el('p','',entry.context.text);japanese.lang='ja';
        example.append(japanese,el('p','ma-muted',entry.context.translation),root.ModeAtlasPronunciation.controls(entry.context.reading));view.append(example);
      }
      const family=el('div','ma-kanji-reading-family');
      family.append(el('span','',lesson.kind==='kun'?'Kun’yomi':lesson.kind==='on'?'On’yomi':'Word reading'));
      family.append(button('About readings',()=>root.ModeAtlasDialog.alert({title:'Why can a kanji sound different?',message:'Kun’yomi are native Japanese readings: 木 is き (ki), “tree”. On’yomi developed from Chinese readings: 木 is もく (moku) in 木曜日 (もくようび), “Thursday”. Both are Japanese pronunciations. Compounds often use on’yomi, but there are exceptions. Learn the sound with its word; you do not need every reading at once.',confirmLabel:'Got it'}),'ma-kanji-text-button'));view.append(family);
      const details=el('details','ma-kanji-lesson-details');details.append(el('summary','','More about this character'));
      const jp=el('p','',roman?content.romaji(lesson.japanese):lesson.japanese);jp.lang=roman?'ja-Latn':'ja';details.append(jp);
      const readings=el('dl','ma-kanji-readings');
      for(const [label,values]of [['On’yomi · Chinese origins',entry.on],['Kun’yomi · Japanese origins',entry.kun]]){
        if(!values.length)continue;readings.append(el('dt','',label),el('dd','',values.map(v=>roman?content.romaji(v.replace(/[.-]/g,'')):v).join(' · ')));
      }details.append(readings);
      if(entry.kun.some(v=>/[.-]/.test(v)))details.append(el('p','','A dot separates the kanji reading from kana written after it; a dash marks a reading used as part of a word.'));
      if(entry.meanings.length>1)details.append(el('p','',`Other meanings: ${entry.meanings.slice(1).join(' · ')}`));view.append(details);
      if(entry.contrasts?.length){
        const compare=el('details','ma-kanji-lesson-details');compare.append(el('summary','','Compare similar characters'));
        for(const item of entry.contrasts){const other=content.get(item.char);if(!other)continue;const word=content.pronunciation(other);compare.append(el('p','',item.note));const target=el('p','',`${word.prompt} · ${word.answers[0]} · ${word.gloss}`);compare.append(target);}
        view.append(compare);
      }
      const footer=el('div','ma-kanji-lesson-actions');footer.append(button('Save word',()=>{root.ModeAtlasWordBank.add({written:lesson.word,reading:lesson.reading,english:lesson.gloss});root.ModeAtlasToast?.show?.('Saved to Word Bank');}),button('Write it',()=>root.ModeAtlasHandwriting.open(entry.char)),action('Check meaning',()=>root.ModeAtlasKanjiSession.lessonStep()));view.append(footer);
    }else{
      view.append(el('h2','',phase==='recognise'?'What does it mean?':entry.example?'How do you read this word?':'How do you read this character?'),glyph);
      const feedback=current.lessonFeedback;
      if(feedback){
        const status=el('div','ma-kanji-feedback');status.dataset.result=feedback.correct?'correct':'incorrect';status.setAttribute('role','status');
        status.append(el('strong','',feedback.correct?(phase==='recognise'?'Meaning recognised':'Reading recognised'):'Let’s connect it again'));
        status.append(el('p','',phase==='recognise'?`${entry.char} · ${lesson.meaning}`:`${lesson.word} · ${roman?content.romaji(lesson.reading):lesson.reading}`));
        if(phase==='reading')status.append(root.ModeAtlasPronunciation.controls(lesson.reading));view.append(status);
        if(feedback.correct){view.append(action(phase==='recognise'?'Check reading':current.index+1===current.sequence.length?'Finish set':'Next kanji',()=>phase==='recognise'?root.ModeAtlasKanjiSession.lessonStep():root.ModeAtlasKanjiSession.next()));}
        else view.append(action('Review this lesson',()=>root.ModeAtlasKanjiSession.reviewLesson()));
      }else{
        const choices=el('div','ma-kanji-choices');
        for(const value of teaching.choices(entry.char,phase,current.runId+entry.char+phase)){
          const label=phase==='reading'&&roman?content.romaji(value):value,b=button(label,()=>{root.ModeAtlasKanjiSession.lessonAnswer(value);change();},'ma-kanji-choice');b.lang=phase==='reading'?(roman?'ja-Latn':'ja'):'en';choices.append(b);
        }view.append(choices,button('See the lesson again',()=>{root.ModeAtlasKanjiSession.reviewLesson();change();},'ma-kanji-text-button'));
      }
    }return view;
  }
  function course(char,{onWriting,onRomaji}={}){
    const entry=content.get(char),lesson=teaching.lesson(entry),data=root.ModeAtlasKanjiCourse,roman=state.read().settings.romaji;
    const view=el('section','ma-kanji-course-teaching'),shape=el('div','ma-kanji-shape'),word=el('div','ma-kanji-word');
    const glyph=el('div','ma-kanji-glyph',char);glyph.lang='ja';const shapeHeading=el('div','ma-kanji-shape-heading');shapeHeading.append(glyph,el('span','ma-kicker','Character'),el('h2','',lesson.meaning));shape.append(shapeHeading);
    const component=data.components[char],contrast=data.contrasts[char];
    if(component){const parts=el('div','ma-kanji-components');parts.setAttribute('aria-label','Shape components');for(const part of component.parts){const item=el('span','',part);item.lang='ja';parts.append(item);}shape.append(parts);}
    shape.append(el('p','ma-kanji-memory-cue',component?.note||lesson.cue));
    if(contrast){const pair=el('div','ma-kanji-contrast'),marks=el('div','',`${char}   ${contrast.other}`);marks.lang='ja';pair.append(marks,el('p','',contrast.note));shape.append(pair);}
    word.append(el('span','ma-kicker','Word'),el('h2','ma-kanji-word-written',lesson.word),el('p','ma-kanji-focus-reading',roman?content.romaji(lesson.reading):lesson.reading),el('p','ma-kanji-word-meaning',lesson.gloss),root.ModeAtlasPronunciation.controls(lesson.reading));
    const toggle=el('button','ma-kanji-text-button',roman?'Show kana':'Show romaji');toggle.type='button';toggle.addEventListener('click',()=>{state.settings({romaji:!roman});onRomaji?.();});word.append(toggle);
    if(onWriting){const write=el('button','ma-button ma-button--ghost','Try writing');write.type='button';write.addEventListener('click',()=>root.ModeAtlasHandwriting.open(char,{pronunciation:lesson.reading,onComplete:event=>{state.recordWriting(char,event);onWriting(event);}}));shape.append(write);}
    view.append(shape,word);return view;
  }
  root.ModeAtlasKanjiLesson=Object.freeze({mount,course});
})(window);
