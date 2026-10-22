/* Rendering only; checkpoints, vocabulary and review schedules have separate owners. */
(function(root){
  'use strict';
  const state=root.ModeAtlasWordLessonState;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const jp=(tag,text)=>{const node=el(tag,'',text);node.lang='ja';return node;};
  const normalize=value=>String(value).normalize('NFKC').replace(/[\s。、！？.!?]/g,'');
  const matches=(value,answers)=>answers.some(answer=>normalize(value)===normalize(answer)||root.ModeAtlasJapanese.matchesReading(normalize(value),normalize(answer)));
  const nextDate=at=>new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(at);
  function open(unit){
    const saved=state.read()[unit.id];
    let index=saved?.phase==='complete'?0:saved?.index||0;
    let phase=saved?.phase==='complete'?'meet':saved?.phase||'meet';
    let application=saved?.phase==='complete'?0:saved?.application||0;
    let active=true,completed=false;
    const host=el('div','ma-word-lesson');
    function checkpoint(patch,saveWord){
      const next=root.ModeAtlasStorage.transaction(()=>{
        saveWord?.();
        return state.checkpoint(unit.id,{index,phase,application,...patch});
      });
      index=next.index;phase=next.phase;application=next.application;
    }
    function button(label,action,primary=true){
      const node=el('button','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);
      node.type='button';node.addEventListener('click',()=>{
        if(!active||node.disabled)return;
        node.disabled=true;
        try{action();}catch(error){node.disabled=false;root.ModeAtlasToast?.show?.(error.message);}
      });return node;
    }
    function show(){
      root.ModeAtlasPronunciation.stop();host.replaceChildren();
      if(index>=unit.words.length){transfer();return;}
      const word=unit.words[index];
      host.append(el('p','ma-kicker',`${index+1} of ${unit.words.length} · ${phase==='meet'?'Meet the word':'Recall the reading'}`));
      if(phase==='meet'){
        host.append(jp('h2',word.written),jp('p',word.reading),el('p','',word.english),root.ModeAtlasPronunciation.controls(word.reading),jp('blockquote',word.example),el('p','ma-muted',word.exampleTranslation));
        host.append(button('Try remembering it',()=>{
          checkpoint({phase:'recall'},()=>root.ModeAtlasWordBank.add(word));show();
        }));
        return;
      }
      host.append(jp('h2',word.written));
      answerForm('Reading (kana or romaji)',value=>root.ModeAtlasJapanese.matchesReading(value,word.reading),word.reading,correct=>{
        checkpoint({index:index+1,phase:index+1>=unit.words.length?'apply':'meet'},()=>{
          const item=root.ModeAtlasWordBank.read().find(item=>item.written===word.written&&root.ModeAtlasJapanese.matchesReading(item.reading,word.reading));
          if(item)root.ModeAtlasWordBank.review(item.id,correct,Date.now(),'reading');
        });show();
      });
      host.append(button('Show me again',()=>{checkpoint({phase:'meet'});show();},false));
    }
    function answerForm(labelText,matches,model,continueWith){
      const form=el('form','ma-word-reading-form'),label=el('label','',labelText),input=el('input','ma-input');
      input.id='maWordLessonAnswer';label.htmlFor=input.id;input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=200;
      const check=el('button','ma-button ma-button--primary','Check answer');check.type='submit';form.append(label,input,check);host.append(form);
      let composing=false;
      input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;});
      form.addEventListener('submit',event=>{
        event.preventDefault();if(composing||event.isComposing||!input.value.trim()||!active||check.disabled)return;
        check.disabled=true;const correct=matches(input.value);
        const feedback=el('p','',correct?'Correct':`Try this: ${model}`);feedback.setAttribute('role','status');host.append(feedback);
        host.append(button(correct||phase==='recall'?'Continue':'Try again',()=>{
          if(correct)continueWith(true);
          else{continueWith(false);}
        }));
      });input.focus({preventScroll:true});
    }
    function transfer(){
      host.replaceChildren(el('p','ma-kicker',`Use it · ${application+1} of 2`));
      if(application===0){
        host.append(el('h2','',unit.transfer.prompt));
        unit.transfer.choices.forEach((choice,i)=>{
          const node=button(choice,()=>{
            host.querySelectorAll('button').forEach(button=>{button.disabled=true;});
            const correct=i===unit.transfer.answer,status=el('p','',unit.transfer.explanation);status.setAttribute('role','status');host.append(status);
            host.append(button(correct?'Use it in a new situation':'Try again',()=>{
              if(correct)checkpoint({application:1});transfer();
            }));
          });if(/[ぁ-龯]/.test(choice))node.lang='ja';host.append(node);
        });return;
      }
      const task=unit.production;
      host.append(el('h2','',task.prompt));
      const pattern=el('details');pattern.append(el('summary','','See the pattern'),jp('p',task.pattern),el('p','',task.hint));host.append(pattern);
      answerForm('Your phrase (Japanese or romaji)',value=>matches(value,task.answers),task.answers[0],correct=>{
        if(correct)finish();else transfer();
      });
    }
    function finish(){
      checkpoint({phase:'complete',completedAt:Date.now()});completed=true;
      root.ModeAtlasLearningEvents?.emit('lessonCompleted','words');
      const next=state.next(root.ModeAtlasWordLessonsData),tip=el('details');tip.append(el('summary','','Usage tip'),el('p','',unit.note));
      host.replaceChildren(el('h2','','Lesson complete'),el('p','',unit.outcome),tip);
      host.append(el('p','ma-muted','Use it again: '+nextDate(state.read()[unit.id].review.dueAt)));
      const review=el('a','ma-button ma-button--primary','Review these words');review.href='/wordbank/?review=1';host.append(review);
      if(next)host.append(button('Next: '+next.title,()=>{root.ModeAtlasDialog.close();setTimeout(()=>open(next),0);},false));
      const chars=[...new Set(unit.words.flatMap(word=>[...word.written]).filter(char=>root.ModeAtlasKanjiState.levels.has(char)))];
      if(chars.length){const link=el('a','ma-button ma-button--ghost','Meet the kanji: '+chars.slice(0,4).join(' '));link.href='/kanji/?char='+encodeURIComponent(chars[0]);host.append(link);}
      host.append(button('Back to Word Bank',()=>root.ModeAtlasDialog.close(),false));
    }
    const close=()=>{active=false;root.ModeAtlasPronunciation.stop();root.ModeAtlasDialog.close(false);};
    checkpoint({index,phase,application});root.ModeAtlasLearningEvents?.emit('lessonStarted','words');
    root.addEventListener('modeAtlasAccountWillChange',close);
    root.ModeAtlasDialog.feature({kicker:'Useful Japanese',title:unit.title,contentNode:host}).finally(()=>{
      if(!completed)root.ModeAtlasLearningEvents?.emit('lessonExited','words');
      active=false;root.ModeAtlasPronunciation.stop();root.removeEventListener('modeAtlasAccountWillChange',close);
      document.querySelectorAll('[data-ma-word-lessons]').forEach(render);
    });show();
  }
  function review(unit){
    const saved=state.read()[unit.id];
    if(!saved?.completedAt)return open(unit);
    const task=unit.reviewTasks[saved.review.variant],host=el('div','ma-word-lesson');
    let active=true,completed=false;
    function question(){
      host.replaceChildren(el('p','ma-kicker','Recall and use'),el('h2','',task.prompt));
      const form=el('form','ma-word-reading-form'),label=el('label','','Your phrase (Japanese or romaji)'),input=el('input','ma-input');
      input.id='maPhraseReviewAnswer';label.htmlFor=input.id;input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=200;
      const check=el('button','ma-button ma-button--primary','Check answer');check.type='submit';
      const hint=el('details');hint.append(el('summary','','Show a hint'),el('p','',task.hint));
      // A hinted answer is practice, not independent retrieval: retry soon.
      let hinted=false,composing=false;hint.addEventListener('toggle',()=>{if(hint.open)hinted=true;});
      input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;});
      form.append(label,input,check);host.append(form,hint);
      form.addEventListener('submit',event=>{
        event.preventDefault();if(!active||composing||event.isComposing||check.disabled||!input.value.trim())return;
        check.disabled=true;const correct=matches(input.value,task.answers);
        let schedule;
        try{schedule=state.review(unit.id,correct&&!hinted);}
        catch(error){check.disabled=false;root.ModeAtlasToast?.show?.(error.message);return;}
        const feedback=el('p','',correct?'Correct':`Try this: ${task.answers[0]}`);feedback.setAttribute('role','status');host.append(feedback);
        if(!correct){
          const retry=el('button','ma-button ma-button--primary','Try again');retry.type='button';retry.addEventListener('click',question);host.append(retry);return;
        }
        completed=true;root.ModeAtlasLearningEvents?.emit('reviewCompleted','words');
        host.append(el('p','ma-muted','Use it again: '+nextDate(schedule.dueAt)));
        if(hinted)host.append(el('p','ma-muted','Try again without a hint next time.'));
        const due=state.due().find(id=>id!==unit.id),next=root.ModeAtlasWordLessonsData.find(item=>item.id===due);
        const done=el('button','ma-button ma-button--primary',next?'Next situation':'Done');done.type='button';
        done.addEventListener('click',()=>{root.ModeAtlasDialog.close();if(next)setTimeout(()=>review(next),0);});host.append(done);
      });input.focus({preventScroll:true});
    }
    const close=()=>{active=false;root.ModeAtlasDialog.close(false);};
    root.addEventListener('modeAtlasAccountWillChange',close);root.ModeAtlasLearningEvents?.emit('lessonStarted','words');
    root.ModeAtlasDialog.feature({kicker:'Useful Japanese',title:unit.title,contentNode:host}).finally(()=>{
      if(!completed)root.ModeAtlasLearningEvents?.emit('lessonExited','words');active=false;
      root.removeEventListener('modeAtlasAccountWillChange',close);document.querySelectorAll('[data-ma-word-lessons]').forEach(render);
    });question();
  }
  function render(host){
    if(!host)return;
    host.replaceChildren(el('h2','','Short lessons'));
    const progress=state.read(),next=state.next(root.ModeAtlasWordLessonsData);
    const due=state.due(),ready=root.ModeAtlasWordLessonsData.find(unit=>unit.id===due[0]);
    if(ready){
      const card=el('section','ma-word-lesson-card'),button=el('button','ma-button ma-button--primary','Use it again');button.type='button';button.addEventListener('click',()=>review(ready));
      card.append(el('h3','','A situation to revisit'),el('p','',ready.title),button);host.append(card);
    }
    const grid=el('div','ma-word-lessons-grid'),more=el('details','ma-word-lessons-more');more.append(el('summary','','All lessons'));
    for(const unit of root.ModeAtlasWordLessonsData){
      const saved=progress[unit.id],resume=saved?.startedAt&&saved.phase!=='complete',completed=!!saved?.completedAt;
      const card=el('section','ma-word-lesson-card'),label=resume?'Continue lesson':completed?'Practise again':'Start lesson';
      const button=el('button','ma-button '+(unit===next&&!ready?'ma-button--primary':'ma-button--ghost'),label);button.type='button';button.setAttribute('aria-label',label+': '+unit.title);button.addEventListener('click',()=>open(unit));
      card.append(el('h3','',unit.title),el('p','',unit.outcome),el('small','',resume?`${Math.min(saved.index+1,5)} of 5 words · Place saved`:completed?'Completed · Recall and use again':'5 words · About 5 minutes'),button);
      (unit===next&&!ready?host:grid).append(card);
    }
    if(!next)host.append(el('p','','Six everyday situations practised. Keep them fresh with word reviews.'));
    more.append(grid);host.append(more);
  }
  root.ModeAtlasWordLessons=Object.freeze({render,open,review});
})(window);
