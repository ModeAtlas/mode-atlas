/* Curated Words: a guided course destination and one full-page task at a time. */
(function(root){
  'use strict';
  const model=root.ModeAtlasVocabulary;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;};
  const button=(label,action,primary=false)=>root.ModeAtlasCourseUI.button(label,action,{primary});
  let host=null,onStart=null;
  function render(target,options={}){
    if(target)host=target;if(options.onStart)onStart=options.onStart;if(!host)return;
    const next=model.nextAction(),plan=model.plan(),saved=model.pending();host.replaceChildren();
    const card=el('section','ma-vocabulary-next'),copy=el('div');
    copy.append(el('h2','',next.title),el('p','',next.detail));
    const preview=[...new Set((saved?.tasks||plan.tasks).slice(0,3).map(t=>t.id))].map(id=>model.byId.get(id));
    if(preview.length){const words=el('p','ma-vocabulary-preview',preview.map(w=>model.preference()==='mixed'?w.written:w.reading).join('　'));words.lang='ja';copy.append(words);}
    card.append(copy);
    if(['empty','grow','complete'].includes(next.kind)){const link=el('a','ma-button ma-button--primary',next.label);link.href=next.href;card.append(link);}
    else card.append(button(next.label,()=>onStart?onStart({}):location.assign(next.href),true));
    host.append(card);
    const settings=el('details','ma-vocabulary-options');settings.append(el('summary','','Practice options'));
    const fieldset=el('fieldset','ma-vocabulary-script'),legend=el('legend','','Word spelling');fieldset.append(legend);
    for(const [id,label] of [['kana','Kana'],['mixed','Kana + Kanji']]){const b=button(label,()=>{model.setPreference(id);render();});b.setAttribute('aria-pressed',String(model.preference()===id));b.disabled=!!saved;fieldset.append(b);}settings.append(fieldset);
    if(saved)settings.append(el('p','ma-muted','Finish your current set to change its spelling.'));
    const records=model.status(model.preference()),skills=model.modes.filter(m=>records.unlocked[m.id]);
    if(records.learned.length){
      const label=el('label','ma-field__label','Response'),select=el('select','ma-select');select.id='maVocabularySkill';label.htmlFor=select.id;
      for(const skill of skills){const option=el('option','',skill.label);option.value=skill.id;select.append(option);}settings.append(label,select);
      const actions=el('div','ma-action-row');actions.append(button('Practise',()=>onStart?.({custom:true,script:model.preference(),mode:select.value,kind:'practice'})));
      if(records.learned.length>=3)actions.append(button('Check without hints',()=>onStart?.({custom:true,script:model.preference(),mode:select.value,kind:'test'})));
      settings.append(actions);
      if(saved){select.disabled=true;actions.querySelectorAll('button').forEach(control=>{control.disabled=true;});}
    }
    host.append(settings);
  }
  function open(options={}){
    const mount=options.mount||document.getElementById('maWordsFocus');
    let saved=options.sessionId&&model.session()?.id===options.sessionId?model.session():model.begin(options);
    if(!saved||!mount)return null;
    let active=true,shell=null,composing=false,hinted=false;
    const exit=()=>{close();options.onExit?.();};
    function close(){active=false;root.ModeAtlasPronunciation.stop();root.removeEventListener('modeAtlasAccountWillChange',exit);mount.replaceChildren();}
    function persist(action){if(!active)return;try{const previous=saved.phase;saved=action();if(previous!=='complete'&&saved.phase==='complete')root.ModeAtlasLearningEvents?.emit(['checkpoint','custom-test'].includes(saved.kind)?'testCompleted':saved.kind==='learn'?'lessonCompleted':'practiceCompleted','words');draw();}catch(error){shell.setStatus(error.message,{tone:'error'});}}
    const display=word=>saved.script==='mixed'?word.written:word.reading;
    const expected=(word,mode)=>mode==='meaning'?word.english:mode==='produceKana'?word.reading:root.ModeAtlasJapanese.romaji(word.reading);
    function draw(){
      if(!active)return;root.ModeAtlasPronunciation.stop();hinted=false;composing=false;
      const task=model.current(saved),word=task&&model.byId.get(task.id),complete=saved.phase==='complete';
      shell=root.ModeAtlasCourseUI.create({title:complete?'Set complete':task?.mode==='meet'?'Meet the word':model.modes.find(m=>m.id===task?.mode)?.label||'Learn words',eyebrow:['checkpoint','custom-test'].includes(saved.kind)?'Words · Checkpoint':'Learn words',progress:complete?null:{current:saved.cursor,total:saved.tasks.length},onExit:exit,exitLabel:complete?'Back to Learn words':'Save & exit'});
      mount.replaceChildren(shell.element);
      if(complete){
        shell.element.setAttribute('data-ma-session-complete','');
        const first=saved.results.filter(r=>!r.retry),correct=first.filter(r=>r.correct&&!r.assisted).length;
        shell.body.append(el('p','ma-vocabulary-score',`${correct} of ${first.length} first answers recalled without help`));
        const missed=first.filter(r=>!r.correct||r.assisted);
        if(missed.length){const list=el('ul','ma-vocabulary-corrections');for(const result of missed){const w=model.byId.get(result.id);list.append(el('li','',`${display(w)} → ${expected(w,result.mode)}`));}shell.body.append(list);}
        const next=model.nextAction();shell.body.append(el('p','',next.detail));
        if(['empty','grow','complete'].includes(next.kind)){const link=el('a','ma-button ma-button--primary',next.label);link.href=next.href;shell.actions.append(link);}
        else shell.actions.append(button(next.label,()=>{saved=model.begin();if(saved){options.onSession?.(saved);draw();}else exit();},true));
        return;
      }
      if(!word){shell.setStatus('This word is no longer available.',{tone:'error'});return;}
      if(task.mode==='meet'){
        const card=el('div','ma-vocabulary-meet'),writing=el('div'),meaning=el('div'),glyph=el('h2','ma-vocabulary-glyph',display(word));glyph.lang='ja';writing.append(glyph);
        if(saved.script==='mixed'&&word.written!==word.reading)writing.append(el('p','ma-vocabulary-reading',word.reading));
        writing.append(root.ModeAtlasPronunciation.controls(word.reading));meaning.append(el('h2','',word.english),el('p','ma-muted',root.ModeAtlasJapanese.romaji(word.reading)));if(word.note)meaning.append(el('p','',word.note));card.append(writing,meaning);shell.body.append(card);
        shell.actions.append(button('Continue',()=>persist(()=>model.advance(saved.id)),true));return;
      }
      const skill=model.modes.find(m=>m.id===task.mode),prompt=el('h2','ma-vocabulary-glyph',skill.prompt==='English'?word.english:display(word));prompt.lang=skill.prompt==='English'?'en':'ja';
      const question=el('div','ma-vocabulary-question'),promptGroup=el('div','ma-vocabulary-prompt');promptGroup.append(prompt);question.append(promptGroup);shell.body.append(question);
      if(word.cue&&task.mode==='meaning')promptGroup.append(el('p','ma-vocabulary-cue',word.cue));
      if(saved.phase==='feedback'){
        const result=saved.results.at(-1);
        if(!['checkpoint','custom-test'].includes(saved.kind))shell.setStatus(result.correct&&!result.assisted?'Correct':`Answer: ${expected(word,task.mode)}`,{tone:result.correct&&!result.assisted?'success':'info'});
        else shell.setStatus('Answer saved.');
        shell.actions.append(button(saved.cursor+1===saved.tasks.length?'See results':'Continue',()=>persist(()=>model.advance(saved.id)),true));return;
      }
      const form=el('form','ma-word-reading-form'),label=el('label','ma-field__label',`Your answer in ${skill.answer}`),input=el('input','ma-input');input.id='maVocabularyAnswer';label.htmlFor=input.id;input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=100;input.lang=skill.answer==='kana'?'ja':'en';
      input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;});form.append(label,input);question.append(form);
      function submit(skip=false){if(!active||composing||(!skip&&!input.value.trim()))return;persist(()=>model.respond(saved.id,input.value,{assisted:hinted,skip,cursor:saved.cursor}));}
      form.addEventListener('submit',event=>{event.preventDefault();if(!event.isComposing)submit();});
      shell.actions.append(button(['checkpoint','custom-test'].includes(saved.kind)?'Submit answer':'Check answer',()=>submit(),true));
      const support=el('div','ma-vocabulary-support');support.append(button('I don’t know yet',()=>submit(true)));
      if(!['checkpoint','custom-test'].includes(saved.kind))support.append(button('Show answer',()=>{hinted=true;shell.setStatus(expected(word,task.mode));input.focus({preventScroll:true});}));
      shell.body.append(support);
      input.focus({preventScroll:true});
    }
    root.addEventListener('modeAtlasAccountWillChange',exit);draw();return {close,session:saved};
  }
  root.ModeAtlasVocabularyUI=Object.freeze({render,open});
})(window);
