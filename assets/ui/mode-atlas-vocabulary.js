/* Words course and sessions. The personal Word Bank remains its existing owner. */
(function(root){
  'use strict';
  const model=root.ModeAtlasVocabulary;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;};
  const button=(label,action,primary=false)=>{const n=el('button','ma-button'+(primary?' ma-button--primary':' ma-button--ghost'),label);n.type='button';n.addEventListener('click',action);return n;};
  let script='kana',mode='decode',host=null,explicitSkill=false;
  function render(target){
    if(target)host=target;if(!host)return;
    let s=model.status(script,mode);
    if(!explicitSkill&&s.learned.length){const next=model.modes.find(skill=>s.unlocked[skill.id]&&s.learned.some(w=>model.evidence(w.id,skill.id,s.records).length&&model.schedule(w.id,skill.id,s.records).due<=Date.now()))||model.modes.find(skill=>s.unlocked[skill.id]&&s.learned.some(w=>!model.progress(w.id,s.records).achieved?.[skill.id]));if(next&&next.id!==mode){mode=next.id;s=model.status(script,mode);}}
    if(!s.unlocked[mode]){mode='decode';s=model.status(script,mode);}
    host.replaceChildren();
    const toolbar=el('div','ma-vocabulary-toolbar'),switcher=el('div','ma-vocabulary-switch');switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Word writing system');
    for(const [id,label]of [['kana','Kana'],['mixed','Kana + Kanji']]){const b=button(label,()=>{script=id;render();});b.setAttribute('aria-pressed',String(script===id));switcher.append(b);}toolbar.append(switcher);
    const select=el('select','ma-select');select.setAttribute('aria-label','Word skill');
    for(const skill of model.modes.filter(skill=>s.unlocked[skill.id])){const option=el('option','',skill.label);option.value=skill.id;select.append(option);}select.value=mode;select.addEventListener('change',()=>{mode=select.value;explicitSkill=true;render();});toolbar.append(select);host.append(toolbar);
    const next=el('section','ma-vocabulary-next'),copy=el('div'),actions=el('div','ma-action-row');
    copy.append(el('p','ma-kicker',`${s.eligible.length} words ready · ${s.learned.length} introduced`));
    if(!s.eligible.length){
      copy.append(el('h2','',script==='mixed'?'Build your first word pool':'Start with a few kana'),el('p','',script==='mixed'?'Meet more characters in Kana and Kanji to open words here.':'Learn the vowel row in Kana. Your first words will appear here.'));
      const link=el('a','ma-button ma-button--primary',script==='mixed'?'Continue learning':'Learn the vowel row');link.href='/kana/';actions.append(link);
    }else{
      const gaps=s.learned.some(w=>!model.progress(w.id,s.records).achieved?.[mode]);
      copy.append(el('h2','',s.due.length?'Your words are ready to revisit':gaps?model.modes.find(skill=>skill.id===mode).label:s.newWords.length?'Meet your next words':'Keep these words growing'));
      const primaryKind=s.due.length?'review':gaps?'practice':s.newWords.length?'learn':'practice';
      actions.append(button(primaryKind==='review'?`Review ${s.due.length} due`:primaryKind==='learn'?`Learn ${Math.min(5,s.newWords.length)} words`:'Practise your words',()=>open({kind:primaryKind,script,mode}),true));
      if(s.learned.length&&primaryKind!=='practice')actions.append(button('Practise',()=>open({kind:'practice',script,mode})));
      if(s.learned.length>=3)actions.append(button('Test yourself',()=>open({kind:'test',script,mode})));
    }
    next.append(copy,actions);host.append(next);
    const nextSkill=model.modes.find(skill=>!s.unlocked[skill.id]);if(nextSkill){const previous=model.modes[model.modes.indexOf(nextSkill)-1];host.append(el('p','ma-vocabulary-next-skill',`Next: ${nextSkill.label.toLowerCase()} · answer 3 different words in ${previous.label.toLowerCase()}.`));}
    if(s.learned.length){
      const progress=el('section','ma-vocabulary-progress');progress.append(el('h3','','Your word skills'));
      const grid=el('div','ma-vocabulary-skill-grid');for(const skill of model.modes.filter(skill=>s.unlocked[skill.id])){
        const count=s.learned.filter(w=>model.progress(w.id,s.records).achieved?.[skill.id]||model.evidence(w.id,skill.id,s.records).some(e=>e.quality===2)).length;
        const item=el('div');item.append(el('strong','',`${count} / ${s.learned.length}`),el('span','',skill.label));grid.append(item);
      }progress.append(grid);host.append(progress);
      const list=el('details','ma-vocabulary-list'),summary=el('summary','',`Explore ${s.learned.length} introduced words`),items=el('div','ma-vocabulary-word-grid');list.append(summary,items);
      for(const word of s.learned){const b=button((script==='mixed'?word.written:word.reading)+' · '+word.english,()=>open({kind:'learn',script,mode,words:[word]}));items.append(b);}host.append(list);
    }
    const history=model.history();if(history.length){const detail=el('details','ma-vocabulary-list'),list=el('ol','ma-vocabulary-history');detail.append(el('summary','','Recent test answers'),list);for(const answer of history.slice(0,10)){const item=el('li','',`${answer.word.reading} · ${model.modes.find(m=>m.id===answer.mode).label} · ${answer.quality===2?'Correct':'Revisit'}`);list.append(item);}host.append(detail);}
  }
  function open(options={}){
    const kind=options.kind||'practice',selectedScript=options.script||script;let selectedMode=kind==='learn'?'decode':options.mode||mode;
    if(kind==='review'&&!options.mode){const dueSkill=model.modes.find(skill=>model.status(selectedScript,skill.id).due.length&&model.unlocked()[skill.id]);if(dueSkill)selectedMode=dueSkill.id;}
    let queue=options.words||model.queue(selectedScript,selectedMode,kind);if(!queue.length)return;
    if(kind==='test'&&queue.length<3)return;
    queue=queue.map(word=>({word,retry:false}));const initial=queue.length,content=el('div','ma-vocabulary-session');let index=0,correctCount=0,active=true,answered=false,revealed=false,missed=[],checked=[];
    const title=kind==='learn'?'Learn words':kind==='test'?'Word test':'Word practice';
    function top(){const panel=content.closest('.ma-dialog');if(panel)panel.scrollTop=0;}
    function display(word){return selectedScript==='mixed'?word.written:word.reading;}
    function expected(word){return selectedMode==='meaning'?word.english:selectedMode==='produceKana'?word.reading:root.ModeAtlasJapanese.romaji(word.reading);}
    function next(){index++;if(index>=queue.length)finish();else if(kind==='learn'&&!queue[index].retry)meet();else question();}
    function error(err){root.ModeAtlasToast?.show?.(err.message||'Your answer could not be saved. Please try again.');}
    function meet(){
      const word=queue[index].word;content.removeAttribute('data-ma-session-complete');content.replaceChildren();
      const card=el('div','ma-vocabulary-meet'),writing=el('div'),meaning=el('div');const glyph=el('h2','ma-vocabulary-glyph',display(word));glyph.lang='ja';writing.append(glyph);
      if(selectedScript==='mixed'&&word.written!==word.reading)writing.append(el('p','ma-vocabulary-reading',word.reading));
      writing.append(root.ModeAtlasPronunciation.controls(word.reading));meaning.append(el('h3','',word.english),el('p','ma-muted',root.ModeAtlasJapanese.romaji(word.reading)));if(word.note)meaning.append(el('p','',word.note));card.append(writing,meaning);
      content.append(el('p','ma-kicker',`Meet · ${index+1} of ${initial}`),card,button('Try from memory',()=>{try{model.introduce(word.id);question();}catch(err){error(err);}},true));top();
    }
    function question(){
      root.ModeAtlasPronunciation.stop();answered=false;revealed=false;const word=queue[index].word;content.removeAttribute('data-ma-session-complete');content.replaceChildren();
      content.append(el('p','ma-kicker',`${kind==='test'?'Test':queue[index].retry?'Try again':'Recall'} · ${index+1} of ${queue.length}`));
      const skill=model.modes.find(m=>m.id===selectedMode),prompt=el('h2','ma-vocabulary-glyph',skill.prompt==='English'?word.english:display(word));prompt.lang=skill.prompt==='English'?'en':'ja';content.append(prompt);
      if(word.cue&&selectedMode==='meaning')content.append(el('p','ma-vocabulary-cue',word.cue));
      const form=el('form','ma-word-reading-form'),label=el('label','',`Your answer in ${skill.answer}`),input=el('input','ma-input');input.id='maVocabularyAnswer';label.htmlFor=input.id;input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=100;let composing=false;input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;});
      if(skill.answer==='kana')input.lang='ja';
      const submit=button(kind==='test'?'Submit answer':'Check answer',()=>form.requestSubmit(),true);
      form.append(label,input,submit);content.append(form);
      const feedback=el('p','ma-vocabulary-feedback');feedback.setAttribute('role','status');content.append(feedback);
      function check(skip=false){
        if(!active||answered||composing||(!skip&&!input.value.trim()))return;
        const correct=!skip&&model.answer(word.id,selectedMode,input.value);
        try{model.record(word.id,selectedMode,correct,{assisted:revealed,test:kind==='test'});}catch(err){error(err);return;}
        answered=true;checked.push({word,correct:correct&&!revealed});if(correct&&!revealed)correctCount++;else if(!missed.some(w=>w.id===word.id))missed.push(word);
        if(kind==='test'){next();return;}
        input.disabled=true;submit.disabled=true;feedback.textContent=correct&&!revealed?'Correct':`The answer is ${expected(word)}.`;
        if(!correct&&!queue[index].retry&&queue.length<initial+3)queue.push({word,retry:true});
        content.append(button(index+1===queue.length?'See results':'Continue',next,true));top();
      }
      form.addEventListener('submit',event=>{event.preventDefault();if(!event.isComposing)check();});
      content.append(button('I don’t know yet',()=>check(true)));
      if(kind!=='test')content.append(button('Show answer',()=>{if(answered)return;revealed=true;feedback.textContent=expected(word);input.focus({preventScroll:true});}));
      top();input.focus({preventScroll:true});
    }
    function finish(){
      content.setAttribute('data-ma-session-complete','');content.replaceChildren();root.ModeAtlasPronunciation.stop();
      content.append(el('h2','','Set complete'),el('p','ma-vocabulary-score',`${correctCount} / ${checked.length} recalled without help`));
      if(kind==='test'){const list=el('ul','ma-vocabulary-corrections');for(const item of checked){const row=el('li','',`${item.word.reading} → ${expected(item.word)} · ${item.correct?'Correct':'Revisit'}`);list.append(row);}content.append(list);}
      if(missed.length){content.append(el('p','',`Revisit: ${missed.map(w=>w.reading).join(' · ')}`),button('Revisit missed words',()=>{root.ModeAtlasDialog.close();setTimeout(()=>open({kind:'practice',mode:selectedMode,script:selectedScript,words:missed}),0);},true));}
      const unlocked=model.unlocked(),nextMode=model.modes.find(m=>m.id!==selectedMode&&unlocked[m.id]&&model.modes.indexOf(m)>model.modes.findIndex(m=>m.id===selectedMode));
      if(nextMode)content.append(button(nextMode.label,()=>{mode=nextMode.id;explicitSkill=false;root.ModeAtlasDialog.close();setTimeout(()=>open({kind:'practice',mode:nextMode.id,script:selectedScript}),0);},true));
      root.ModeAtlasLearningEvents?.emit(kind==='test'?'testCompleted':kind==='learn'?'lessonCompleted':'practiceCompleted','words');
      content.append(button('Back to Words',()=>root.ModeAtlasDialog.close(),true));top();
    }
    const close=()=>{active=false;root.ModeAtlasPronunciation.stop();root.ModeAtlasDialog.close(false);};root.addEventListener('modeAtlasAccountWillChange',close);
    if(kind==='learn')meet();else question();
    root.ModeAtlasDialog.feature({kicker:'Words',title,contentNode:content,size:'wide'}).finally(()=>{active=false;root.ModeAtlasPronunciation.stop();root.removeEventListener('modeAtlasAccountWillChange',close);render();});
  }
  root.ModeAtlasVocabularyUI=Object.freeze({render,open});
})(window);
