/* Kanji owns its course navigation; the shared shell presents one task at a time. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanjiContent');if(!host)return;
  const state=root.ModeAtlasKanjiState,content=root.ModeAtlasKanjiContent,session=root.ModeAtlasKanjiSession,course=root.ModeAtlasKanjiCourse,placement=root.ModeAtlasKanjiPlacement;
  const main=host.closest('main'),names={learn:'Learn',pronunciation:'Reading',meaning:'Character meaning',wordMeaning:'Word meaning',match:'Meaning Match'};
  let keyboard=null,composing=false,assessment=placement.read(),authorizing=null,level=state.read().settings.level,count=5,focus='all',mode='pronunciation';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const button=(label,action,cls='ma-button ma-button--ghost')=>{const n=el('button',cls,label);n.type='button';n.addEventListener('click',()=>safely(action));return n;};
  const link=(label,href)=>{const n=el('a','ma-button ma-button--ghost',label);n.href=href;return n;};
  const heading=text=>el('h2','',text);
  function report(error){root.ModeAtlasDialog.alert({title:'Couldn’t continue',message:error.message||String(error)});}
  function safely(action){try{const result=action();if(result?.catch)result.catch(report);return result;}catch(error){report(error);}}
  function url(view,unit){const u=new URL(location.href);u.search='';if(view!=='overview')u.searchParams.set('view',view);if(unit)u.searchParams.set('unit',unit);return u;}
  function navigate(view,unit,{replace=false}={}){
    const from=new URLSearchParams(location.search).get('view')||'overview';
    history.replaceState({...history.state,kanjiScroll:scrollY},'',location.href);
    history[replace?'replaceState':'pushState']({kanjiChild:!replace,kanjiFromView:from,kanjiScroll:0},'',url(view,unit));render();scrollTo(0,0);
  }
  function leave(){
    if(session.current()&&!session.current().finished)session.pause();
    if(history.state?.kanjiChild)history.back();else navigate('overview',null,{replace:true});
  }
  function shell(title,{eyebrow='Kanji',progress,kind='task',exitLabel='Back to Kanji',onExit=leave}={}){
    keyboard?.destroy();keyboard=null;root.ModeAtlasPronunciation.stop();host.replaceChildren();main.dataset.view='focused';
    const panel=root.ModeAtlasCourseUI.create({title,eyebrow,progress,kind,exitLabel,onExit});host.append(panel.element);if(kind==='task'){scrollTo(0,0);requestAnimationFrame(()=>{if(panel.element.isConnected)scrollTo(0,0);});}return panel;
  }
  function select(label,options,value,change){const wrap=el('label','ma-kanji-select'),input=el('select');wrap.append(el('span','',label),input);for(const [key,text]of options){const o=el('option','',text);o.value=key;input.append(o);}input.value=value;input.addEventListener('change',()=>change(input.value));return wrap;}
  function entry(){
    const panel=shell('Where would you like to begin?',{onExit:()=>location.assign('/learn/'),exitLabel:'Back to Learn'}),ready=root.ModeAtlasLearningExperience?.readiness?.().kanji;
    if(ready&&!ready.recommended)panel.body.append(el('p','ma-muted','A few familiar Hiragana rows will help.'),link('Continue Kana','/kana/'));
    panel.body.append(el('p','','Learn useful characters and words in small guided units.'));
    panel.actions.append(button('Start as a beginner',()=>{state.enter('beginner');navigate('overview',null,{replace:true});},'ma-button ma-button--primary'),button('Check my starting point',()=>{assessment=placement.begin();navigate('assessment');}));
    panel.body.append(button('I’m confident in Kanji',async()=>{if(await root.ModeAtlasDialog.confirm({title:'Browse every Kanji band?',message:'Open the full library and assessment tests. Your course will still use what you have actually studied.',confirmLabel:'Open library'})){state.enter('confident',[5,4,3,2,1]);navigate('library',null,{replace:true});}}));
  }
  function showCourse(){
    if(!state.entered()){entry();return;}
    keyboard?.destroy();keyboard=null;root.ModeAtlasPronunciation.stop();host.replaceChildren();main.dataset.view='overview';main.removeAttribute('data-session');
    const current=state.read(),next=state.nextAction(current),unit=course.get(next.unitId),saved=session.saved(),card=el('section','ma-kanji-current');
    const copy=el('div','ma-kanji-current-copy'),art=el('img','ma-kanji-current-art');art.src='/assets/illustrations/kanji-scene.svg';art.alt='';art.width=480;art.height=300;
    copy.append(el('p','ma-kicker',saved?'Your saved session':unit?`Foundations · Unit ${unit.index+1} of ${course.units.length}`:'Foundations'),heading(saved?course.get(saved.unitId)?.title||'Your Kanji practice':next.title),el('p','',saved?'Pick up at the task you left.':next.detail));card.append(copy,art);
    const start=button(saved?'Resume':next.label,()=>continueCourse(),'ma-button ma-button--primary');card.append(start);host.append(card);
    const nav=el('nav','ma-kanji-secondary');nav.setAttribute('aria-label','Kanji course tools');nav.append(button('Learning path',()=>navigate('path')),button('Custom practice',()=>navigate('practice')),button('Character library',()=>navigate('library')));host.append(nav);
  }
  function continueCourse(){
    const saved=session.saved();if(saved){session.resume();navigate('session');return;}
    const next=state.nextAction();if(next.kind==='complete'){navigate('path');return;}
    session.startCourse({unitId:next.unitId,kind:next.kind==='learn'?'lesson':next.kind});navigate('session');
  }
  function startUnit(unit,kind){session.startCourse({unitId:unit.id,kind});navigate('session');}
  function pathView(unitId){
    const current=state.read(),next=state.nextAction(current),unit=course.get(unitId);
    const panel=shell(unit?unit.title:'Your Kanji path',{kind:'path',exitLabel:unit?'Back to path':'Back to Kanji',onExit:unit&&!history.state?.kanjiChild?()=>navigate('path',null,{replace:true}):leave});
    if(unit){
      const status=state.courseStatus(unit,current);panel.body.append(el('p','',unit.goal));
      const progress=el('dl','ma-kanji-unit-evidence');for(const [label,value]of [['Introduced',status.introduced?'All characters met':'Not yet'],['Unit check',status.checked?'Passed':'Not passed'],['Delayed review',status.retained?'Recalled on a later day':status.checked?'Scheduled for a later day':'After your unit check']])progress.append(el('dt','',label),el('dd','',value));panel.body.append(progress);
      const chars=el('div','ma-kanji-library-grid');for(const char of unit.chars)chars.append(button(char,()=>navigate('character',char)));panel.body.append(chars);
      const available=unit.index===0||state.courseStatus(course.units[unit.index-1],current).checked;
      if(available||status.introduced)panel.actions.append(button(status.introduced?'Check this unit':'Learn this unit',()=>startUnit(unit,status.introduced?'checkpoint':'lesson'),'ma-button ma-button--primary'));
      else panel.body.append(el('p','ma-muted','Continue the current unit to reach this one.'));
      return;
    }
    const list=el('ol','ma-kanji-unit-list');
    for(const item of course.units){const status=state.courseStatus(item,current),row=el('li'),control=button('',()=>navigate('path',item.id));control.append(el('span','ma-kanji-unit-number',String(item.index+1)),el('strong','',item.title),el('small','',status.retained?'Reviewed later':status.checked?'Check passed':item.id===next.unitId?'Current unit':status.introduced?'Introduced':'Ahead'));if(item.id===next.unitId)control.setAttribute('aria-current','step');row.append(control);list.append(row);}panel.body.append(list);
    panel.actions.append(button('Review progress',()=>navigate('progress')),button('Advanced library',()=>navigate('library')));
  }
  function progressView(){
    const panel=shell('Your Kanji evidence',{kind:'path'}),current=state.read();
    for(const [label,count]of [['Units introduced',course.units.filter(u=>state.courseStatus(u,current).introduced).length],['Unit checks passed',course.units.filter(u=>state.courseStatus(u,current).checked).length],['Units recalled on a later day',course.units.filter(u=>state.courseStatus(u,current).retained).length]])panel.body.append(el('p','',`${label}: ${count} / ${course.units.length}`));
    panel.body.append(el('p','ma-muted','Your previously earned character progress is retained. Course checks and delayed reviews are recorded separately.'),link('Previous test results','/results/kanji/'));
  }
  function library(char){
    const panel=shell(char?`${char} · Character library`:'Character library',{kind:'path',exitLabel:char?history.state?.kanjiFromView==='path'?'Back to unit':'Back to library':'Back to Kanji',onExit:char&&!history.state?.kanjiChild?()=>navigate('library',null,{replace:true}):leave});
    if(char){
      const entry=content.get(char);if(!entry)return;panel.body.append(root.ModeAtlasKanjiLesson.course(char,{onWriting:()=>panel.setStatus('Writing practice saved.'),onRomaji:()=>library(char)}));
      const details=el('details','ma-kanji-lesson-details');details.append(el('summary','','Other dictionary readings and meanings'));
      details.append(el('p','',`On’yomi: ${entry.on.join(' · ')||'—'}`),el('p','',`Kun’yomi: ${entry.kun.join(' · ')||'—'}`),el('p','',entry.meanings.join(' · ')));panel.body.append(details);
      panel.actions.append(button('Learn this character',()=>{session.start({mode:'learn',level:entry.level,chars:[char],count:5});navigate('session');},'ma-button ma-button--primary'),button('Save word',()=>{const lesson=root.ModeAtlasKanjiTeaching.lesson(entry);root.ModeAtlasWordBank.add({written:lesson.word,reading:lesson.reading,english:lesson.gloss});panel.setStatus('Saved to Word Bank.');}));return;
    }
    panel.body.append(select('Study band',state.summary().map(b=>[b.level,`N${b.level} · ${b.name}${b.unlocked?'':' · locked'}`]),level,value=>{level=Number(value);state.settings({level});library();}));
    if(level!==5)panel.body.append(el('p','ma-muted','Explore dictionary lessons and custom practice. Guided units currently cover Foundations.'));
    if(!state.allowed(level)){panel.body.append(el('p','','Check your starting point to open this band.'),button('Check my starting point',()=>{assessment=placement.begin();navigate('assessment');}));return;}
    const restored=history.state?.kanjiLibrary,search=el('input','ma-input');search.type='search';search.placeholder='Find a character or meaning';search.setAttribute('aria-label','Find a character or meaning');search.value=restored?.level===level?restored.query||'':'';panel.body.append(search);const grid=el('div','ma-kanji-library-grid');let limit=restored?.level===level?Math.max(120,Math.min(1500,restored.limit||120)):120;
    const more=button('Show more characters',()=>{limit+=120;draw();});panel.body.append(grid,more);
    function draw(){const query=search.value.trim().toLowerCase(),matches=content.entries().filter(e=>e.level===level&&(!query||e.char.includes(query)||e.meanings.some(m=>m.toLowerCase().includes(query))));grid.replaceChildren();for(const entry of matches.slice(0,limit))grid.append(button(entry.char,()=>navigate('character',entry.char)));more.hidden=matches.length<=limit;history.replaceState({...history.state,kanjiLibrary:{level,query:search.value,limit}},'',location.href);}
    search.addEventListener('input',()=>{limit=120;draw();});draw();panel.body.append(link('Learning sources','/kanji/sources/'));
  }
  function practice(){
    const panel=shell('Custom practice',{kind:'path'}),current=state.read(),options=el('div','ma-kanji-practice-options');
    options.append(select('Study band',state.summary().filter(b=>b.unlocked).map(b=>[b.level,`N${b.level} · ${b.name}`]),level,v=>{level=Number(v);state.settings({level});practice();}),select('Task',[['pronunciation','Word reading'],['meaning','Character meaning'],['match','Meaning recognition'],['learn','Revisit lessons']],mode,v=>mode=v),select('Set length',[[5,'5 characters'],[10,'10 characters'],[20,'20 characters'],[40,'40 characters']],count,v=>count=Number(v)),select('Selection',[['all','Encountered characters'],['due','Due reviews']],focus,v=>focus=v));panel.body.append(options);
    const known=state.studyPool(level,current).filter(c=>state.encountered(current,c));
    if(!known.length)panel.body.append(el('p','','Meet a course unit or a library character before practising.'));
    const start=button('Start practice',()=>{session.start({mode,level,count,focus,chars:mode==='learn'?known:[]});navigate('session');},'ma-button ma-button--primary');start.disabled=!known.length;panel.actions.append(start);
    const tests=el('details','ma-kanji-lesson-details');tests.append(el('summary','','Tests and starting point'));
    tests.append(button('Check my starting point',()=>{assessment=placement.begin();navigate('assessment');}),button('Reading test',()=>{session.start({mode:'pronunciation',level,count:20,test:true});navigate('session');}),button('Meaning test',()=>{session.start({mode:'meaning',level,count:20,test:true});navigate('session');}),link('Previous results','/results/kanji/'));
    if(['placement','confident'].includes(current.entry.mode))tests.append(el('p','ma-muted','Assessment tests can include unfamiliar characters from the selected band.'));panel.body.append(tests);
  }
  function answerForm(panel,label,onAnswer,{japanese=false,nativeKeyboard=false}={}){
    const form=el('form','ma-kanji-answer ma-kanji-course-form'),caption=el('label','',label),input=el('input');form.id='maKanjiCourseAnswer';input.id='maKanjiAnswer';caption.htmlFor=input.id;input.autocomplete='off';input.autocapitalize='off';input.spellcheck=false;input.setAttribute('autocorrect','off');input.maxLength=160;input.lang=japanese?'ja':'en';input.placeholder=japanese?'Kana or romaji':'';
    const check=el('button','ma-button ma-button--primary','Check answer');check.type='submit';check.setAttribute('form',form.id);form.append(caption,input);panel.actions.prepend(check);
    let composing=false;input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);form.addEventListener('submit',event=>{event.preventDefault();if(!composing&&input.value.trim())safely(()=>onAnswer(input.value));});panel.body.append(form);
    if(nativeKeyboard&&root.ModeAtlasIOSKeyboard){const keys=el('div','ma-kana-placement-keyboard');panel.body.append(keys);keyboard=root.ModeAtlasIOSKeyboard.mount({input,container:keys,onSubmit:()=>form.requestSubmit()});}
    if(!root.AtlasPlatform?.isNative)input.focus({preventScroll:true});return input;
  }
  function showAssessment(){
    if(!assessment||assessment.done){assessment=null;root.ModeAtlasStorage.remove(placement.KEY);navigate('overview',null,{replace:true});return;}
    const q=placement.question(assessment),entry=content.get(q.char),reading=content.pronunciation(entry),panel=shell('Find your starting point',{eyebrow:`Kanji · N${assessment.band}`,progress:{current:assessment.index,total:8},onExit:()=>{assessment=placement.finish(assessment);showAssessment();},exitLabel:'Finish here'});
    panel.body.append(el('div','ma-kanji-glyph',q.skill==='pronunciation'?reading.prompt:q.char));
    if(assessment.feedback){panel.setStatus(assessment.feedback.correct?'Correct':q.skill==='pronunciation'?reading.answers.join(' · '):entry.meanings.join(' · '));panel.actions.append(button('Continue',()=>{assessment=placement.next(assessment);showAssessment();},'ma-button ma-button--primary'));}
    else{answerForm(panel,q.skill==='pronunciation'?'Kana or romaji answer':'English meaning',value=>{assessment=placement.answer(assessment,value);showAssessment();},{japanese:q.skill==='pronunciation',nativeKeyboard:true});panel.body.append(button('I don’t know yet',()=>{assessment=placement.answer(assessment,'');showAssessment();}));}
  }
  function showGuided(current){
    const unit=course.get(current.unitId);
    if(current.paused){const panel=shell(unit.title,{exitLabel:'Save & exit'});panel.body.append(el('p','','Your place is saved.'));panel.actions.append(button('Resume',()=>{session.play();showSession();},'ma-button ma-button--primary'));return;}
    if(current.finished){
      const panel=shell(current.courseKind==='lesson'?'Unit introduced':current.outcome?.passed?current.courseKind==='review'?'Review complete':'Unit check passed':'Keep practising this unit',{eyebrow:unit.title,exitLabel:'Back to Kanji'});
      panel.element.classList.add('ma-kanji-recap');const answers=current.answers.filter(a=>a.first),correct=answers.filter(a=>a.correct&&!a.assisted),missed=[...new Set(answers.filter(a=>!a.correct||a.assisted).map(a=>a.char))];
      panel.body.append(el('p','ma-kanji-recap-score',`${correct.length} / ${answers.length} first attempts`));
      if(current.courseKind==='lesson')panel.body.append(el('p','','Next is a separate check of this unit.'));
      else if(current.outcome?.passed)panel.body.append(el('p','',current.courseKind==='review'?'This review is saved separately from your first unit check.':'Your first check is saved. A later review will check what stays with you.'));
      if(missed.length&&!current.outcome?.passed){panel.body.append(el('p','',`Revisit ${missed.join(' · ')} before another check.`));panel.actions.append(button('Practise missed items',()=>{session.startCourse({unitId:unit.id,kind:'lesson',chars:missed});showSession();},'ma-button ma-button--primary'));}
      else if(current.courseKind==='lesson')panel.actions.append(button('Check this unit',()=>{session.startCourse({unitId:unit.id,kind:'checkpoint'});showSession();},'ma-button ma-button--primary'));
      else panel.actions.append(button('Continue',()=>{session.discard();continueCourseFromSession();},'ma-button ma-button--primary'));
      return;
    }
    const task=current.tasks[current.index],lesson=root.ModeAtlasKanjiTeaching.lesson(content.get(task.char)),panel=shell(unit.title,{eyebrow:current.courseKind==='review'?'Kanji · Delayed review':current.courseKind==='checkpoint'?'Kanji · Unit check':'Kanji · Guided lesson',progress:{current:current.index,total:current.tasks.length},exitLabel:'Save & exit'});
    if(task.kind==='teach'){
      panel.body.append(root.ModeAtlasKanjiLesson.course(task.char,{onWriting:()=>panel.setStatus('Writing practice saved.'),onRomaji:showSession}));
      panel.actions.append(button('Continue',()=>{session.next();showSession();},'ma-button ma-button--primary'));return;
    }
    const exercise=el('section','ma-kanji-exercise');panel.body.append(exercise);
    const title=task.kind==='recognition'?'Choose its meaning':task.skill==='meaning'?'Character meaning':task.skill==='pronunciation'?'Read this word':'Word meaning';
    exercise.append(heading(title));const glyph=el('div','ma-kanji-glyph',task.skill==='meaning'?task.char:lesson.word);glyph.lang='ja';exercise.append(glyph);
    if(task.skill==='pronunciation')exercise.append(el('p','ma-kanji-caption',lesson.gloss));
    if(task.retry)exercise.append(el('p','ma-kicker','Another try · correction practice'));
    const accepted=task.skill==='meaning'?[lesson.meaning]:task.skill==='pronunciation'?[lesson.reading]:content.wordMeanings(content.get(task.char));
    if(current.feedback||current.hinted){
      const feedback=el('div','ma-kanji-feedback');feedback.dataset.result=current.feedback?(current.feedback.correct?'correct':'incorrect'):'hint';feedback.setAttribute('role','status');feedback.append(el('strong','',current.feedback?(current.feedback.correct?'Correct':'Let’s connect it again'):'Study this answer'),el('p','',accepted[0]));
      if(task.skill==='pronunciation')feedback.append(root.ModeAtlasPronunciation.controls(lesson.reading));exercise.append(feedback);
    }
    if(current.feedback){panel.actions.append(button(current.index+1===current.tasks.length?'Finish unit':'Continue',()=>{session.next();showSession();},'ma-button ma-button--primary'));return;}
    if(task.kind==='recognition'){
      const values=[...new Set([...unit.chars].map(c=>root.ModeAtlasKanjiTeaching.lesson(content.get(c)).meaning))].sort((a,b)=>content.hash(current.runId+current.index+a)-content.hash(current.runId+current.index+b)),choices=el('div','ma-kanji-choices');
      for(const value of values)choices.append(button(value,()=>{session.answer(value);showSession();},'ma-kanji-choice'));exercise.append(choices);
    }else answerForm({...panel,body:exercise},task.skill==='pronunciation'?'Your kana answer':'Your English answer',value=>{session.answer(value);showSession();},{japanese:task.skill==='pronunciation'});
    const help=el('div','ma-kanji-help-actions');
    if(current.courseKind==='lesson'&&task.kind==='retrieve'&&!current.hinted)help.append(button('Show answer',()=>{session.hint();showSession();},'ma-kanji-text-button'));
    help.append(button('I don’t know yet',()=>{session.answer('',true);showSession();},'ma-kanji-text-button'));exercise.append(help);
  }
  function continueCourseFromSession(){
    const next=state.nextAction();if(next.kind==='complete'){navigate('path',null,{replace:true});return;}
    session.startCourse({unitId:next.unitId,kind:next.kind==='learn'?'lesson':next.kind});showSession();
  }
  function question(entry,current){
    const view=el('div','ma-kanji-question'),pronounced=content.pronunciation(entry);
    const prompt=current.mode==='pronunciation'?pronounced.prompt:entry.char;
    const caption=current.mode==='pronunciation'?(pronounced.kind==='on'?'Give one on’yomi reading in kana':'Write this word in kana'):current.mode==='meaning'?'Give one English meaning':'Which meaning fits?';
    view.append(heading(caption));const glyph=el('div','ma-kanji-glyph',prompt);glyph.lang='ja';view.append(glyph);
    if(current.mode==='pronunciation'&&pronounced.kind==='word'){
      view.append(el('p','ma-kanji-caption',pronounced.gloss));
      if(prompt!==entry.char)view.append(el('p','ma-kanji-caption',`Focus character: ${entry.char}`));
    }
    const revealed=current.feedback||current.hinted;
    if(revealed){
      const accepted=current.mode==='pronunciation'?pronounced.answers:entry.meanings;
      const feedback=el('div','ma-kanji-feedback');feedback.dataset.result=current.feedback?(current.feedback.correct?'correct':'incorrect'):'hint';feedback.setAttribute('role','status');
      feedback.append(el('strong','',current.feedback?(current.feedback.correct?'Correct':'Keep this one in mind'):'A little help'),el('p','',accepted.join(' · ')));
      if(current.feedback&&!current.feedback.correct&&current.feedback.answer)feedback.append(el('small','',`Your answer: ${current.feedback.answer}`));
      if(current.mode==='pronunciation')feedback.append(el('small','',pronounced.gloss),root.ModeAtlasPronunciation.controls(entry.example?.kana||pronounced.answers[0]));view.append(feedback);
    }
    if(!current.feedback){
      if(current.mode==='match'){
        const choices=el('div','ma-kanji-choices');
        for(const answer of content.choices(entry.char,current.runId+current.index))choices.append(button(answer,()=>safely(()=>{session.answer(answer);showSession();}),'ma-kanji-choice'));view.append(choices);
      }else{
        const form=el('form','ma-kanji-answer'),label=el('label','',current.mode==='pronunciation'?'Your kana answer':'Your English answer'),input=el('input');
        input.id='maKanjiAnswer';input.type='text';input.maxLength=160;input.autocomplete='off';input.autocapitalize='off';input.spellcheck=false;input.setAttribute('autocorrect','off');input.enterKeyHint='done';label.htmlFor=input.id;input.lang=current.mode==='pronunciation'?'ja':'en';
        const preview=el('p','ma-kanji-input-preview');preview.id='maKanjiConverted';input.setAttribute('aria-describedby',preview.id);
        const update=()=>{preview.textContent=current.mode==='pronunciation'&&!composing&&input.value?content.kana(input.value):'';};
        input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>{composing=false;update();});input.addEventListener('input',update);
        const check=el('button','ma-button ma-button--primary','Check answer');check.type='submit';
        form.addEventListener('submit',event=>{event.preventDefault();if(composing||!input.value.trim())return;safely(()=>{session.answer(input.value);showSession();});});
        input.addEventListener('keydown',event=>{if(event.isComposing||event.keyCode===229){if(event.key==='Enter')event.preventDefault();}});
        form.append(label,input,preview,check);view.append(form);
      }
      const tools=el('div','ma-kanji-actions');
      if(!current.test&&current.mode!=='match'&&!current.hinted)tools.append(button('Show answer',()=>{session.hint();showSession();},'ma-kanji-text-button'));
      tools.append(button('Skip',()=>safely(()=>{session.answer('',true);showSession();}),'ma-kanji-text-button'));view.append(tools);
    }return view;
  }
  async function showSession(){
    const candidate=session.current();
    if(candidate&&!['learn','course'].includes(candidate.mode)&&!candidate.authorizationAttempted){
      if(authorizing===candidate)return;authorizing=candidate;
      try{await session.authorize();}catch(error){report(error);}finally{candidate.authorizationAttempted=true;authorizing=null;}
      if(session.current()!==candidate)return;
    }
    const current=session.current();if(!current){showCourse();return;}main.dataset.session=current.mode;
    if(current.mode==='course'){showGuided(current);return;}
    const panel=shell(current.finished?'Set complete':names[current.mode],{eyebrow:`Kanji · N${current.level}${current.test?' · Test':''}`,progress:current.finished?null:{current:current.index,total:current.sequence.length},exitLabel:current.finished?'Back to Kanji':'Save & exit'});
    if(current.finished){
      panel.element.classList.add('ma-kanji-recap');const correct=current.answers.filter(x=>x.correct).length;
      panel.body.append(el('p','ma-kanji-recap-score',current.mode==='learn'?`${current.sequence.length} kanji introduced`:`${correct} / ${current.answers.length} correct`));
      root.ModeAtlasProgressUI.renderSessionReward(panel.body,{...current,xpGain:current.xp});void root.ModeAtlasProgressUI.completeSession(current);
      if(current.test)panel.body.append(link('View results','/results/kanji/'));
      const missed=current.answers.filter(a=>!a.correct).map(a=>a.char);
      if(missed.length)panel.actions.append(button('Revisit mistakes',()=>{session.start({mode:'learn',level:current.level,chars:missed,count:40});showSession();},'ma-button ma-button--primary'));
      else panel.actions.append(button('Continue course',()=>{session.discard();continueCourseFromSession();},'ma-button ma-button--primary'));return;
    }
    if(current.paused){panel.body.append(el('p','','Your place is saved.'));panel.actions.append(button('Resume',()=>{session.play();showSession();},'ma-button ma-button--primary'));return;}
    const entry=content.get(current.sequence[current.index]);panel.body.append(current.mode==='learn'?root.ModeAtlasKanjiLesson.mount(current,showSession,report):question(entry,current));
    if(current.mode!=='learn'&&current.feedback)panel.actions.append(button(current.index+1===current.sequence.length?'Finish set':'Continue',()=>{session.next();showSession();},'ma-button ma-button--primary'));
  }
  function render(){
    const params=new URLSearchParams(location.search),view=params.get('view')||'overview',unit=params.get('unit');
    main.removeAttribute('data-session');
    if(view==='session'){
      if(!session.current()||session.current().paused){if(!session.resume()){showCourse();return;}}
      void showSession();
    }else if(view==='assessment')showAssessment();else if(view==='path')pathView(unit);else if(view==='practice')practice();else if(view==='library')library();else if(view==='character')library(unit);else if(view==='progress')progressView();else showCourse();
  }
  root.addEventListener('popstate',()=>{if(session.current()&&!session.current().finished)session.pause();render();requestAnimationFrame(()=>scrollTo(0,history.state?.kanjiScroll||0));});
  root.addEventListener('modeAtlasKanjiPaused',()=>{if(new URLSearchParams(location.search).get('view')==='session'&&session.current())showSession();});
  root.addEventListener('modeAtlasAccountWillChange',()=>{keyboard?.destroy();assessment=null;host.replaceChildren(el('p','','Updating your learning space…'));});
  root.addEventListener('modeAtlasCloudDataChanged',()=>{if(new URLSearchParams(location.search).get('view')!=='session')render();});
  async function boot(){
    try{
      await content.load();const params=new URLSearchParams(location.search),requested=Number(params.get('level'));if([1,2,3,4,5].includes(requested)&&state.allowed(requested))level=requested;
      if(params.has('continue')||params.has('resume')){if(session.saved())session.resume();else{const next=state.nextAction();if(next.kind==='complete'){navigate('path',null,{replace:true});return;}if(!state.entered()){entry();return;}session.startCourse({unitId:next.unitId,kind:next.kind==='learn'?'lesson':next.kind});}navigate('session',null,{replace:true});return;}
      if(params.has('learn')){if(!state.entered()){entry();return;}continueCourse();return;}
      if(params.has('test')&&['pronunciation','meaning','match'].includes(params.get('test'))){session.start({mode:params.get('test'),level,test:true,count:20});navigate('session',null,{replace:true});return;}
      if(['pronunciation','meaning'].includes(params.get('practice'))){session.start({mode:params.get('practice'),level,focus:params.get('focus')==='due'?'due':'all',count:10});navigate('session',null,{replace:true});return;}
      if(params.has('chars')||params.has('char')){const chars=[...(params.get('chars')||params.get('char'))].filter(c=>state.levels.has(c));if(chars.length){level=state.levels.get(chars[0]);session.start({mode:Object.keys(names).includes(params.get('mode'))?params.get('mode'):'learn',level,chars,count:40});navigate('session',null,{replace:true});return;}}
      render();
    }catch(error){host.replaceChildren(el('p','',error.message),button('Back to Kanji',()=>navigate('overview',null,{replace:true})),button('Retry',boot));}
  }
  void boot();
})(window);
