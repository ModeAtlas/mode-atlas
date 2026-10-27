/* Guided personal-word teaching and retrieval, in the shared full-page course.
   Freeform meanings are self-checked; only explicit answer keys are auto-graded. */
(function(root){
  'use strict';
  const model=root.ModeAtlasWordBank,KEY='wordbank-course';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
  const shuffle=list=>{const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  let currentController=null;
  function open({kind,ids,mount,onExit}={}){
    currentController?.close(false);
    const target=mount||document.getElementById('maWordsFocus')||el('div','ma-words-focus');
    const restore=[];
    if(!mount){
      if(!target.isConnected)document.querySelector('main').append(target);
      for(const node of [...target.parentElement.children])if(node!==target){restore.push([node,node.hidden]);node.hidden=true;}
      target.hidden=false;
    }
    let active=true,session=null,shell=null;
    const controller={close,get session(){return session;}};currentController=controller;
    function close(notify=false){
      if(!active)return;active=false;root.ModeAtlasPronunciation.stop();root.removeEventListener('modeAtlasAccountWillChange',accountChanged);
      target.replaceChildren();for(const [node,hidden]of restore)node.hidden=hidden;
      if(!mount)target.hidden=true;if(currentController===controller)currentController=null;if(notify)onExit?.();
    }
    const accountChanged=()=>close(false);root.addEventListener('modeAtlasAccountWillChange',accountChanged);
    function make(title,progress,complete=false){
      root.ModeAtlasPronunciation.stop();shell=root.ModeAtlasCourseUI.create({title,eyebrow:'Word Bank',progress,onExit:complete?undefined:()=>close(true),exitLabel:'Save & exit'});
      target.replaceChildren(shell.element);return shell;
    }
    function action(label,fn,primary=true){
      const button=shell.button(label,()=>{if(active)fn();},{primary});
      if(primary)shell.actions.append(button);
      else{if(!shell.support)shell.support=el('div','ma-word-review-support');shell.support.append(button);shell.body.append(shell.support);}
      return button;
    }
    function checkpoint(patch){
      session={...session,...patch,updatedAt:Date.now()};root.ModeAtlasWordLessonState.checkpoint(KEY,{course:session});
    }
    function change(fn){
      const before=session&&JSON.parse(JSON.stringify(session));
      try{root.ModeAtlasStorage.transaction(fn);return true;}catch(error){
        session=before;const task=session?.tasks[session.cursor],word=task&&model.read().find(item=>item.id===task.id);
        if(task&&(!word||model.snapshot(word,task.mode)!==task.snapshot))render();
        else shell.setStatus(error.message||'Your progress could not be saved. Please try again.',{tone:'error'});
        return false;
      }
    }
    function explain(word){
      const wrap=el('section','ma-word-explanation ma-vocabulary-meet'),japanese=el('div'),meaning=el('div'),written=el('h2','ma-vocabulary-glyph',word.written);written.lang='ja';japanese.append(written);wrap.append(japanese,meaning);
      if(word.reading){const reading=el('p','ma-vocabulary-reading',word.reading);reading.lang='ja';japanese.append(reading,el('p','ma-muted',word.romaji),root.ModeAtlasPronunciation.controls(word.reading));}
      if(word.english)meaning.append(el('p','',word.english));
      if(word.example){const example=el('p','',word.example);example.lang='ja';meaning.append(example);}
      if(word.exampleTranslation)meaning.append(el('p','ma-muted',word.exampleTranslation));
      return wrap;
    }
    function start(selectedKind,selectedIds,onlySkill){
      const all=model.read(),selected=Array.isArray(selectedIds)?all.filter(word=>selectedIds.includes(word.id)):all,selectionIds=selected.map(word=>word.id);
      let words=selected.filter(word=>model.availableSkills(word).length);
      if(selectedKind==='learn'){
        const untaught=new Set(model.untaught(selectionIds).map(word=>word.id));
        if(untaught.size)words=words.filter(word=>untaught.has(word.id));
      }
      if(selectedKind==='review')words=words.filter(word=>(onlySkill?[onlySkill]:model.SKILLS).some(skill=>model.availableSkills(word).includes(skill)&&word[model.reviewKey(skill)].due<=Date.now()));
      words=words.slice(0,selectedKind==='learn'?5:10);
      const tasks=[];
      if(selectedKind==='learn')for(const word of words)tasks.push({id:word.id,mode:'teach',snapshot:model.snapshot(word,'teach'),retry:false});
      for(const skill of onlySkill?[onlySkill]:selectedKind==='learn'?['reading','meaning']:['reading','meaning','listening']){
        let pool=shuffle(words.filter(word=>model.availableSkills(word).includes(skill)&&(selectedKind==='learn'||word[model.reviewKey(skill)].due<=Date.now())));
        if(pool.length>1&&tasks.at(-1)?.id===pool[0].id)pool.push(pool.shift());
        for(const word of pool)tasks.push({id:word.id,mode:skill,snapshot:model.snapshot(word,skill),retry:false});
      }
      make(selectedKind==='learn'?'Learn your words':'Review your words');
      if(!tasks.length){
        shell.body.append(el('p','',selected.some(word=>model.availableSkills(word).length)?'No reviews are due for these words.':'Add a kana reading or a meaning to your saved entries to start learning.'));
        if(selectedKind==='review'&&words.length)action('Learn these words',()=>start('learn',words.map(w=>w.id)));
        else action('Back to Word Bank',()=>close(true));return;
      }
      session={id:KEY,kind:selectedKind,script:'personal',wordIds:words.map(word=>word.id),selectionIds,tasks,cursor:0,phase:'active',results:[],startedAt:Date.now(),updatedAt:Date.now(),completedAt:0};
      if(change(()=>checkpoint({})))render();
    }
    function next(){if(change(()=>checkpoint({cursor:session.cursor+1,phase:'active'})))render();}
    function grade(word,task,correct){
      if(!active||session.phase!=='active'||session.tasks[session.cursor]!==task)return;
      if(change(()=>{
        model.review(word.id,correct,Date.now(),task.mode,{snapshot:task.snapshot,kind:session.kind==='learn'||task.retry?'learn':'review'});
        const results=[...session.results,{id:word.id,mode:task.mode,correct,assisted:!!task.retry}],tasks=[...session.tasks];
        // One later revisit follows corrective feedback. It cannot erase the first miss.
        if(!correct&&!task.retry)tasks.push({...task,retry:true,assisted:true});
        checkpoint({results,tasks,phase:'feedback'});
      }))render();
    }
    function complete(){
      const newlyFinished=!session.completedAt;
      if(newlyFinished&&!change(()=>checkpoint({completedAt:Date.now(),phase:'complete'})))return;
      make('Set complete',undefined,true);shell.element.dataset.maSessionComplete='';
      const first=session.results.filter(result=>!result.assisted),correct=first.filter(result=>result.correct).length;
      shell.body.append(el('h2','',`${correct} / ${first.length} first attempts`));
      const missed=[...new Set(first.filter(result=>!result.correct).map(result=>result.id))],items=model.read();
      if(missed.length)shell.body.append(el('p','',`Revisit: ${items.filter(word=>missed.includes(word.id)).map(word=>word.written).join(' · ')}`));
      else shell.body.append(el('p','',session.kind==='learn'?'Your next spaced reviews are scheduled.':'Your review schedule is up to date.'));
      if(!first.length)shell.body.append(el('p','ma-muted','No answers were recorded.'));
      const remaining=session.kind==='learn'?model.untaught(session.selectionIds||session.wordIds):[];
      if(remaining.length){
        shell.body.append(el('p','ma-muted',`${remaining.length} ${remaining.length===1?'word':'words'} left in this selection.`));
        action('Continue learning',()=>start('learn',session.selectionIds||session.wordIds));
      }
      action('Back to Word Bank',()=>close(true),!remaining.length);
      if(!remaining.length&&session.kind==='learn'&&items.some(word=>session.wordIds.includes(word.id)&&word.reading))action('Practise listening',()=>start('review',session.wordIds,'listening'),false);
      if(newlyFinished&&first.length)root.ModeAtlasLearningEvents?.emit(session.kind==='learn'?'lessonCompleted':'reviewCompleted','words');
    }
    function render(){
      if(!active||!session)return;
      const task=session.tasks[session.cursor];if(!task){complete();return;}
      const word=model.read().find(item=>item.id===task.id);
      make(task.mode==='teach'?'Meet this word':task.mode==='meaning'?'Recall the meaning':task.mode==='listening'?'Listen and type':'Read the word',{current:session.cursor,total:session.tasks.length});
      if(!word||model.snapshot(word,task.mode)!==task.snapshot){
        shell.setStatus(word?'This entry changed. Restart with its updated content.':'This entry was removed from your collection.',{tone:'warning'});
        const updated=model.pendingCourse();
        if(updated?.restartRequired)action('Restart with current words',()=>start(updated.kind,updated.selectionIds));
        action('Back to Word Bank',()=>close(true),!updated?.restartRequired);return;
      }
      if(task.mode==='teach'){
        shell.body.append(explain(word));
        if(!word.english)shell.body.append(el('p','ma-muted','Add a meaning in Word Bank to practise translation.'));
        else if(!word.reading)shell.body.append(el('p','ma-muted','Add a kana reading in Word Bank to practise reading and listening.'));
        action('Ready to remember',()=>{if(change(()=>{model.introduce(word.id,task.snapshot);checkpoint({cursor:session.cursor+1});}))render();});return;
      }
      if(session.phase==='feedback'){
        shell.body.append(explain(word));const last=session.results.at(-1);shell.setStatus(last?.correct?'Recorded.':'You will revisit this word after the other questions.',{tone:last?.correct?'success':'info'});action('Continue',next);return;
      }
      if(task.retry)shell.body.append(el('p','ma-kicker','Revisit after feedback'));
      if(task.mode!=='listening'){const prompt=el('h2','ma-vocabulary-glyph',word.written);prompt.lang='ja';shell.body.append(prompt);}
      if(task.mode==='meaning'&&!word.acceptedMeanings.length){
        shell.body.append(el('p','','Recall your saved meaning, then reveal it.'));
        action('Reveal',()=>{shell.body.replaceChildren(explain(word));shell.actions.replaceChildren();action('Remembered',()=>grade(word,task,true));action('Again',()=>grade(word,task,false),false);});return;
      }
      const form=el('form','ma-word-reading-form'),label=el('label','',task.mode==='meaning'?'Your English answer':'Your answer (kana or romaji)'),input=el('input','ma-input');
      input.id='maWordRecallInput';input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=200;label.htmlFor=input.id;
      let played=task.mode!=='listening',composing=false,unknown;
      const submit=action(task.mode==='meaning'?'Check meaning':'Check reading',()=>form.requestSubmit());submit.disabled=!played;
      if(task.mode==='listening'){
        const controls=root.ModeAtlasPronunciation.controls(word.reading,{onPlayback:ok=>{played=ok;submit.disabled=!ok;if(unknown)unknown.disabled=!ok;if(!ok)shell.setStatus('Audio is unavailable. You can skip this question without a listening result.');}});
        // Pronunciation examples name their reading; an unanswered listening
        // question must keep the same answer hidden from assistive technology.
        for(const button of controls.querySelectorAll('button')){button.setAttribute('aria-label',button.textContent);if(button.hasAttribute('title'))button.setAttribute('title',button.textContent);}
        shell.body.append(el('p','','Listen, then type the word.'),controls);
        action('Skip listening',next,false);
      }
      input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;});
      form.append(label,input);form.addEventListener('submit',event=>{event.preventDefault();if(event.isComposing||composing||!active||!played||!input.value.trim())return;grade(word,task,task.mode==='meaning'?model.matchesMeaning(input.value,word):root.ModeAtlasJapanese.matchesReading(input.value,word.reading));});shell.body.append(form);
      unknown=action('I don’t know yet',()=>{if(played)grade(word,task,false);},false);unknown.disabled=!played;
      if(task.mode!=='listening')input.focus({preventScroll:true});
    }
    const pending=model.pendingCourse();
    if(pending&&(!kind||kind===pending.kind)&&(!Array.isArray(ids)||(pending.selectionIds?.length?pending.selectionIds:pending.wordIds).every(id=>ids.includes(id)))){
      if(pending.restartRequired)start(pending.kind,pending.selectionIds);else{session=pending;render();}
    }
    else start(kind||(model.nextAction().kind==='learn'?'learn':'review'),ids);
    return controller;
  }
  root.ModeAtlasWordReview=Object.freeze({open});
})(window);
