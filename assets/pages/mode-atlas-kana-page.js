/* Kana course navigation and focused tasks. Custom drills retain their existing
   trainer, scoring and settings owners. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanaLearning');if(!host)return;
  const L=root.ModeAtlasKanaLearning,P=root.ModeAtlasKanaPlacement,Store=root.ModeAtlasStorage;
  let view='learn',script='hiragana',skill='reading',unit='',placement=null,placementSetup=false,placementKeyboard=null,practiceSettings=null,accountGeneration=0,rendering=false;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function run(action){try{action();}catch(error){root.ModeAtlasToast?.show?.(error.message);const status=host.querySelector('[role=status]')||el('p','ma-status ma-status--error');status.setAttribute('role','status');status.textContent=error.message;if(!status.parentNode)host.append(status);}}
  function button(label,action,primary=false){const generation=accountGeneration,b=el('button','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);b.type='button';b.addEventListener('click',()=>{if(generation===accountGeneration)run(action);});return b;}
  function link(label,href,primary=false){const a=el('a','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);a.href=href;return a;}
  function navigate(href){root.ModeAtlasVersionFile?.navigate?root.ModeAtlasVersionFile.navigate(href):location.assign(href);}
  function segmented(label,items,value,onChange){const group=el('div','ma-kana-segments');group.setAttribute('role','group');group.setAttribute('aria-label',label);for(const [id,text]of items){const b=button(text,()=>onChange(id));b.setAttribute('aria-pressed',String(id===value));group.append(b);}return group;}
  function title(kicker,heading,copy){const h=el('header','ma-kana-page-heading');h.append(el('span','ma-kicker',kicker),el('h1','',heading));if(copy)h.append(el('p','ma-kana-muted',copy));host.append(h);return h;}
  function readRoute(){const previousSkill=skill,q=new URLSearchParams(location.search);view=['learn','path','unit','practice','mastery','tests','course'].includes(q.get('view'))?q.get('view'):'learn';script=L.scripts.includes(q.get('script'))?q.get('script'):L.read().course.script;skill=[...L.skills,'both'].includes(q.get('skill'))?q.get('skill'):'reading';unit=q.get('unit')||'';if(previousSkill!==skill)practiceSettings=null;}
  function go(next,{replace=false,row=''}={}){
    L.leaveCourse();placement=null;placementSetup=false;
    history.replaceState({...history.state,maKana:true,scroll:root.scrollY},'');
    const q=new URLSearchParams({view:next,script});q.set('skill',skill);if(row)q.set('unit',row);
    history[replace?'replaceState':'pushState']({maKana:true,returnView:view,scroll:0},'','/kana/?'+q);readRoute();if(rendering)queueMicrotask(()=>run(render));else render();root.scrollTo({top:0,behavior:'instant'});
  }
  function chooseView(next){go(next);}
  function back(){L.leaveCourse();if(history.state?.maKana&&history.state.returnView)history.back();else go('learn',{replace:true});}
  function frame(heading,eyebrow='',progress,kind='task'){
    const generation=accountGeneration,f=root.ModeAtlasCourseUI.create({title:heading,eyebrow,progress,kind,onExit:()=>{if(generation===accountGeneration)back();},exitLabel:view==='course'?'Save & exit':'Back'});host.append(f.element);return f;
  }
  function startBeginner(){L.start('beginner');script='hiragana';L.beginCourse({script});go('course');}
  function openPlacement(){placement=P.read();placementSetup=!placement||placement.finished;if(placementSetup)placement=null;render();}
  function nextRow(direction=skill,alphabet=script,state=L.read(),evidence=L.snapshot()){const rows=L.path(alphabet,direction,state,evidence);return rows.find(row=>row.unlocked&&!row.complete)||rows.at(-1);}
  function welcome(){
    title('Kana','Start with five sounds','Build your first row, one small lesson at a time.');
    const preview=el('p','ma-kana-next-chars','あ い う え お');preview.lang='ja';host.append(preview);
    const actions=el('div','ma-kana-start-options');actions.append(button('Start lesson',startBeginner,true),button('Find my starting point',openPlacement));host.append(actions);
  }
  function assessSetup(){
    title('Starting point','Which scripts do you know?','A few questions to find your first row.');
    let selected='hiragana';const switcher=segmented('Placement scripts',[['hiragana','Hiragana'],['katakana','Katakana'],['both','Both']],selected,value=>{selected=value;for(const b of switcher.children)b.setAttribute('aria-pressed',String(b.textContent===(value==='both'?'Both':value==='hiragana'?'Hiragana':'Katakana')));});
    host.append(switcher,button('Begin check',()=>{placement=Store.transaction(()=>P.begin(selected==='both'?L.scripts:[selected]));placementSetup=false;render();},true),button('Start as a beginner',startBeginner));
  }
  function renderPlacement(){
    const generation=accountGeneration;
    if(placement.finished){
      title('Starting point','Your learning path is ready',`${placement.answered} questions answered`);
      const list=el('div','ma-kana-placement-summary');const state=L.read(),evidence=L.snapshot();
      for(const track of placement.tracks){const rows=L.path(track.script,track.skill,state,evidence).filter(r=>r.group==='base'),next=rows.find(r=>r.unlocked&&!r.complete)||rows.at(-1);list.append(el('p','',`${track.script==='hiragana'?'Hiragana':'Katakana'} · ${L.names[track.skill]}: ${next.name}`));}
      host.append(list,button('Open my learning path',()=>{placement=null;Store.remove(P.KEY);go('learn',{replace:true});},true));return;
    }
    const q=P.question(placement);if(!q){placement=P.finish(placement);render();return;}
    title('Starting point',`${L.names[q.skill]} · ${q.script==='hiragana'?'Hiragana':'Katakana'}`,`${placement.answered} answered · ${q.row.name}`);
    host.lastElementChild.classList.add('ma-kana-assessment-heading');
    const stage=el('section','ma-kana-check');stage.setAttribute('aria-label','Placement question');let focusTarget=null;
    const prompt=el('div','ma-kana-check-prompt',q.skill==='reading'?q.char:q.roman);prompt.lang=q.skill==='reading'?'ja':'en';stage.append(prompt);
    if(q.skill==='reading'){
      const form=el('form'),input=el('input','ma-input');form.className='ma-kana-placement-form';
      input.setAttribute('aria-label','Reading answer');input.autocomplete='off';input.spellcheck=false;input.autocapitalize='none';input.maxLength=20;input.placeholder='Type the sound';input.enterKeyHint='go';
      if(placement.feedback){input.value=q.roman;input.disabled=true;}
      form.append(input);
      if(placement.feedback){const feedback=el('p','ma-kana-check-feedback',placement.feedback.correct?'Correct':`${q.char} is ${q.roman}. Let’s check another character from this row.`);feedback.setAttribute('role','status');form.append(feedback);}
      if(root.ModeAtlasIOSKeyboard){const keys=el('div','ma-kana-placement-keyboard');form.append(keys);placementKeyboard=root.ModeAtlasIOSKeyboard.mount({input,container:keys,onSubmit:()=>form.requestSubmit()});}
      const actions=el('div','ma-kana-check-actions'),submit=el('button','ma-button ma-button--primary',placement.feedback?'Continue':'Check answer');submit.type='submit';actions.append(submit);
      if(!placement.feedback)actions.append(button('I don’t know yet',()=>{placement=Store.transaction(()=>P.answer(placement,''));render();}));form.append(actions);
      form.addEventListener('submit',event=>{event.preventDefault();if(generation!==accountGeneration||event.isComposing)return;if(placement.feedback||input.value.trim())run(()=>{placement=Store.transaction(()=>placement.feedback?P.advance(placement):P.answer(placement,input.value));render();});});stage.append(form);
      focusTarget=placement.feedback?submit:input;
    }else if(placement.feedback){
      stage.append(el('p','ma-kana-check-feedback',placement.feedback.correct?'Correct':`${q.char} is ${q.roman}. Let’s check another character from this row.`));
      stage.append(button('Continue',()=>{placement=Store.transaction(()=>P.advance(placement));render();},true));
    }else{
      const choices=el('div','ma-kana-placement-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Kana answers');
      for(const char of P.choices(placement))choices.append(button(char,()=>{placement=Store.transaction(()=>P.answer(placement,char));render();}));stage.append(choices);
    }
    if(q.skill!=='reading'&&!placement.feedback)stage.append(button('I don’t know yet',()=>{placement=Store.transaction(()=>P.answer(placement,''));render();}));
    const finish=button('Finish with my progress so far',()=>{placement=Store.transaction(()=>P.finish(placement));render();});finish.className='ma-kana-text-action ma-kana-placement-finish';host.append(stage,finish);focusTarget?.focus({preventScroll:true});
  }
  function launch(options={}){const s=L.beginCourse({script,...options});if(s){root.ModeAtlasLearningEvents?.emit('lessonStarted','kana');go('course');}else go('practice');}
  function overview(){
    const action=L.nextAction(script),state=L.read(),rows=L.courseRows(script),done=rows.filter(r=>r.established).length;
    const heading=title('Kana',script==='hiragana'?'Your Hiragana course':'Your Katakana course');heading.classList.add('ma-kana-overview-heading');const art=el('img','ma-kana-course-art');art.src='/assets/illustrations/kana-scene.svg';art.alt='';art.width=100;art.height=80;heading.append(art);
    const current=el('section','ma-kana-course-next');current.append(el('span','ma-kicker',`Row ${Math.min(done+1,rows.length)} of ${rows.length}`),el('h2','',action.title),el('p','ma-kana-muted',action.detail));
    current.append(button(action.label,()=>action.kind==='complete'?go('practice'):launch(),true));host.append(current);
    const nav=el('nav','ma-kana-course-links');nav.setAttribute('aria-label','Kana course');nav.append(button('Learning path',()=>go('path')),button('Custom practice',()=>go('practice')));host.append(nav);
    const readiness=L.courseStatus('hiragana');if(readiness.kanjiReady&&!root.ModeAtlasLearningExperience?.readiness?.()?.kanji.started){const invite=el('p','ma-kana-course-invite');invite.append(document.createTextNode('Your foundation is ready. '),link('Try Kanji','/kanji/'));host.append(invite);}
  }
  function learningPath(){
    const f=frame('Your learning path','Kana',null,'path');
    f.body.append(segmented('Kana script',[['hiragana','Hiragana'],['katakana','Katakana']],script,value=>{script=value;go('path',{replace:true});}));
    const rows=L.courseRows(script),next=rows.find(r=>!r.established);
    for(const groupId of [...new Set(rows.map(r=>r.group))]){
      const group=el('section','ma-kana-course-unit-group'),groupRows=rows.filter(r=>r.group===groupId);group.append(el('h2','',groupRows[0].groupName));
      for(const row of groupRows){const b=button('',()=>go('unit',{row:row.id}));b.className='ma-kana-course-unit';b.dataset.row=row.id;b.disabled=!row.unlocked&&!row.established;if(next?.id===row.id)b.setAttribute('aria-current','step');
        b.append(el('strong','',row.name),el('span','ma-kana-course-unit-chars',row.chars.join(' ')),el('small','',row.checked?'Row check complete':row.established?'Established progress':row.unlocked?`${row.encountered} / ${row.chars.length} introduced`:'Coming next'));group.append(b);
      }f.body.append(group);
      if(groupId==='base')for(const p of L.patterns().filter(p=>p.script===script)){const b=button(p.title,()=>go('unit',{row:p.id}));b.disabled=!p.prerequisites.every(c=>L.seen(c));b.classList.add('ma-kana-pattern-unit');f.body.append(b);}
    }
    const tools=el('nav','ma-kana-course-links');tools.append(button('Mastery map',()=>go('mastery')),button('Full script tests',()=>go('tests')),button('Check my starting point',openPlacement));f.body.append(tools);
  }
  function unitView(){
    const row=L.courseRows(script).find(r=>r.id===unit),p=L.patterns().find(p=>p.id===unit);
    if(!row&&!p){go('path',{replace:true});return;}
    const f=frame(row?.name||p.title,script==='hiragana'?'Hiragana':'Katakana',null,'path');
    if(p){f.body.append(el('p','',p.prerequisites.every(c=>L.seen(c))?'Hear how the spelling changes the rhythm.':'Meet the prerequisite characters first.'));const start=button('Start sound lesson',()=>launch({unit:p.id}),true);start.disabled=!p.prerequisites.every(c=>L.seen(c));f.actions.append(start);return;}
    const chars=el('p','ma-kana-next-chars',row.chars.join(' '));chars.lang='ja';f.body.append(chars);
    f.body.append(el('p','',row.checked?'You checked this row. Keep it fresh with mixed practice.':row.established?'Your previous progress is preserved. Revisit teaching or check the row.':'Meet the characters, practise them together, then check the whole row.'));
    const steps=el('ol','ma-kana-unit-progress');for(const label of [`${row.encountered} / ${row.chars.length} introduced`,row.checked?'Row check complete':'Read + Recall check', 'Mixed review'])steps.append(el('li','',label));f.body.append(steps);
    const start=button(row.encountered<row.chars.length?'Learn this row':'Check this row',()=>launch({unit:row.id,kind:row.encountered<row.chars.length?'lesson':'check'}),true);start.disabled=!row.unlocked&&!row.established;f.actions.append(start);
    f.body.append(link('Optional handwriting',L.practiceUrl('handwriting',row.chars)));
  }
  function renderCourse(){
    let session=L.courseSession();if(!session||session.script!==script){session=L.beginCourse({script});if(!session){go('learn',{replace:true});return;}}
    if(session.complete){courseRecap(session);return;}
    const generation=accountGeneration,task=session.queue[session.index],pattern=task.kind.startsWith('pattern')?L.patternTask(task):null;
    const labels={teach:'Meet the character',match:'Find the character',read:'Read the character',recall:'Recall the shape',listen:'Listen and choose',patternTeach:pattern?.title,patternListen:'Hear the difference',patternApply:'Use the spelling'};
    const f=frame(labels[task.kind],task.repair?'Correction practice':session.kind==='check'?'Row check':session.kind==='checkpoint'?'Checkpoint':session.kind==='review'?'Mixed review':task.supported?'Guided practice':'Kana lesson',{current:session.index,total:session.queue.length});f.element.dataset.task=task.kind;
    let played=false;
    const valid=()=>{const now=L.courseSession();return generation===accountGeneration&&now?.id===session.id&&now.index===session.index;};
    const answer=(value,options={})=>{if(!valid())return;L.answerCourse(value,options);render();};
    const advance=()=>{if(!valid())return;L.advanceCourse();render();root.scrollTo({top:0,behavior:'instant'});};
    const audio=(target,assessment=false)=>{const controls=root.ModeAtlasPronunciation.controls(target,{onPlayback:ok=>{if(!valid())return;played=ok;if(assessment){for(const b of f.body.querySelectorAll('[data-answer]'))b.disabled=!ok;f.setStatus(ok?'Choose what you heard.':'Audio is unavailable. Continue with visual practice.');}}});if(assessment)for(const [i,b]of [...controls.children].entries())b.setAttribute('aria-label',i?'Play sound slowly':'Play sound');return controls;};
    const glyph=(char,cls='ma-kana-task-glyph')=>{const g=el('div',cls,char);g.lang='ja';return g;};
    if(session.feedback){
      const feedback=session.feedback,teaching=['teach','patternTeach'].includes(task.kind);
      if(!teaching){const solution=pattern?.answer|| (task.kind==='read'?L.map[task.char]:task.char);f.body.append(glyph(pattern?String(solution):task.char));
        f.setStatus(feedback.skipped?'Listening skipped. Your visual practice continues.':feedback.correct?(task.repair?'Practice complete. Try it again in a fresh set.':feedback.assisted?'Good. We will revisit it without support.':'Correct.'):pattern?.correction||`${task.char} is ${L.map[task.char]}. You will meet it again later.`,{tone:feedback.correct?'success':'info'});
        if(!pattern&&!feedback.skipped)f.body.append(el('p','ma-kana-task-reading',L.map[task.char]));
      }
      f.actions.append(button(session.index===session.queue.length-1?'Finish session':'Continue',advance,true));return;
    }
    if(task.kind==='teach'){
      const teaching=root.ModeAtlasKanaCoaching.teach(task.char),layout=el('div','ma-kana-teaching'),visual=el('div','ma-kana-teaching-visual'),copy=el('div','ma-kana-teaching-copy');visual.append(glyph(task.char),el('strong','ma-kana-task-reading',L.map[task.char]),audio(task.char));for(const key of ['sound','shape']){const paragraph=el('p','ma-kana-teaching-'+key);paragraph.append(el('strong','',key==='sound'?'Sound. ':'Shape. '),document.createTextNode(teaching[key]));copy.append(paragraph);}copy.append(button('Try the strokes',()=>root.ModeAtlasHandwriting.open(task.char,{pronunciation:task.char})));layout.append(visual,copy);f.body.append(layout);f.actions.append(button('Continue',()=>{answer('');L.advanceCourse();render();},true));return;
    }
    if(task.kind==='patternTeach'){
      for(const teaching of pattern.teaching){const example=el('section','ma-kana-pattern-example');example.append(el('p','ma-kana-pattern-spelling',teaching.example),el('p','',teaching.text));for(const word of teaching.comparison||[teaching.audio])if(word)example.append(audio(word));f.body.append(example);}f.actions.append(button('Try the pattern',()=>{answer('');L.advanceCourse();render();},true));return;
    }
    if(task.kind==='read'){
      f.body.append(glyph(task.char));const form=el('form','ma-kana-task-form'),label=el('label','','Type the sound in romaji'),input=el('input','ma-input');input.id='kanaCourseAnswer';label.htmlFor=input.id;input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=20;input.enterKeyHint='go';const submit=el('button','ma-button ma-button--primary','Check answer');submit.type='submit';form.id='kanaCourseForm';submit.setAttribute('form',form.id);form.append(label,input);form.addEventListener('submit',event=>{event.preventDefault();if(event.isComposing||!input.value.trim())return;answer(input.value);});f.body.append(form);f.actions.append(submit);
      if(session.helped)f.setStatus(`${task.char} is ${L.map[task.char]}. This attempt uses support.`);else f.actions.append(button('Show a hint',()=>{L.helpCourse();render();}));return;
    }
    const listening=['listen','patternListen'].includes(task.kind);
    if(listening){f.body.append(el('p','','Play the sound, then choose its spelling.'),audio(pattern?.audio||task.char,true));f.actions.append(button('Study without audio',()=>answer('',{skipAudio:true})));}
    else if(pattern)f.body.append(el('p','ma-kana-task-prompt',pattern.prompt));
    else f.body.append(el('p','',task.kind==='match'?'Find this sound. Use the cue if you need it.':'Choose the kana for this sound.'),el('strong','ma-kana-task-reading',L.map[task.char]));
    if(task.supported)f.body.append(el('p','ma-kana-task-cue',`${task.char} → ${L.map[task.char]}`));
    const choices=el('div','ma-kana-task-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Answer choices');
    for(const option of task.choices.length?task.choices:pattern?.options||[]){const b=button(option,()=>answer(option,{played}));b.dataset.answer='';b.disabled=listening;b.lang='ja';choices.append(b);}f.body.append(choices);
  }
  function courseRecap(session){
    const row=L.rowById.get(session.unit),action=L.nextAction(script),errors=session.results.filter(r=>(!r.correct||r.assisted)&&!r.skipped&&!session.queue[r.index].repair&&!session.queue[r.index].supported&&!['teach','patternTeach'].includes(session.queue[r.index].kind)).length;
    const heading=session.kind==='check'?(session.passed?'Row check complete':'Keep building this row'):session.kind==='checkpoint'?(session.passed?'Checkpoint complete':'A few characters to revisit'):session.kind==='pattern'?(session.passed?'Pattern introduced':'Try this pattern again'):'Session complete';
    const f=frame(heading,row?.name||'Kana');
    if(row)f.body.append(el('p','ma-kana-next-chars',session.chars.join(' ')));
    f.body.append(el('p','',errors?`${errors} first attempts needed support. Your corrections stay separate from independent answers.`:'You finished this set. Later reviews will help it stick.'));
    if(session.audioSkipped)f.body.append(el('p','ma-kana-muted','Visual practice saved. Listening remains available.'));
    f.body.append(el('h2','',action.title));f.actions.append(button(action.label,()=>{if(action.kind==='complete'){go('practice');return;}L.beginCourse({script});render();root.scrollTo({top:0,behavior:'instant'});},true));
  }
  function settingsForPractice(){
    if(practiceSettings)return practiceSettings;
    const saved=Store.readModeJSON(skill==='both'?'reading':skill,'settings',{}),next=nextRow();
    const previous=saved.kanaSelection&&Object.keys(L.selection(saved,skill)).length?saved:{};
    practiceSettings={practiceCount:20,feedbackStyle:'learn',hint:false,srs:true,endless:false,speedRun:false,timeTrial:false,dailyChallenge:false,testMode:false,comboKana:false,focusWeak:false,confusableKana:false,...previous,kanaRows:previous.kanaRows||[next.id],kanaSelection:true};
    practiceSettings.kanaDirection=skill;
    if(skill==='both'&&(practiceSettings.dailyChallenge||practiceSettings.testMode||practiceSettings.comboKana))practiceSettings=root.ModeAtlasKanaPractice.forFamily(practiceSettings,'practice',skill);
    if(practiceSettings.testMode&&!L.testScripts(skill).includes(practiceSettings.kanaTestScript))practiceSettings=root.ModeAtlasKanaPractice.forFamily(practiceSettings,'practice',skill);
    return practiceSettings;
  }
  function openSession(){
    const settings=settingsForPractice(),pool=settings.testMode?L.testPool(settings,skill):L.selection(settings,skill);
    if(!Object.keys(pool).length)throw new Error('Choose at least one available row.');
    const owner=skill==='both'?'reading':skill;
    if(!Store.writeModeJSON(owner,'settings',settings))throw new Error('Your session settings could not be saved. Please try again.');
    root.KanaCloudSync?.markSectionUpdated?.(owner);navigate('/'+(skill==='writing'?'writing':'reading')+'/?start=1');
  }
  function practise(){
    const f=frame('Custom practice','Kana',null,'path');
    f.body.append(segmented('Kana skill',['reading','writing','both','handwriting'].map(id=>[id,L.names[id]]),skill,value=>{skill=value;practiceSettings=null;go('practice',{replace:true});}));
    if(skill==='handwriting'){f.body.append(el('p','','Trace, then try a blank canvas.'),link('Open handwriting',L.practiceUrl('handwriting',nextRow().chars),true));return;}
    f.body.append(root.ModeAtlasKanaPractice.render({skill,getSettings:settingsForPractice,onChange:next=>{practiceSettings=next;render();},targetFields:true}));f.actions.append(button('Start practice',openSession,true));
  }
  function tests(){
    if(skill==='handwriting')skill='reading';const f=frame('Full script tests','Kana',null,'path');f.body.append(segmented('Test skill',[['reading','Read'],['writing','Recall']],skill,value=>{skill=value;render();}));
    for(const id of L.scripts){const name=id==='hiragana'?'Hiragana':'Katakana',row=el('section','ma-kana-test-row');row.append(el('h2','',name));if(L.testScripts(skill).includes(id))row.append(link('Start '+name+' test','/'+(skill==='writing'?'writing':'reading')+'/?mode=test&script='+id,true));else row.append(el('p','','Check every basic row, or establish its practice skills, to open this test.'));f.body.append(row);}f.body.append(link('View results','/results/'));
  }
  function mastery(){title('Kana','Your mastery map');host.append(root.ModeAtlasKanaMastery.render((char,detail)=>{
    const scroll=root.scrollY;host.replaceChildren(button('Back to mastery map',()=>{render();requestAnimationFrame(()=>{root.scrollTo({top:scroll,behavior:'instant'});host.querySelector(`[data-ma-mastery-kana="${char}"]`)?.focus({preventScroll:true});});}),detail);root.scrollTo({top:0,behavior:'instant'});
  }));}
  function render(){
    if(rendering)return;rendering=true;const rowOpen=host.querySelector('.ma-kana-row-picker')?.open,focus=host.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
    try{placementKeyboard?.destroy();placementKeyboard=null;host.replaceChildren();document.body.dataset.maKanaExperience=view==='course'?'guided':'course';
      if(placementSetup){assessSetup();return;}if(placement){renderPlacement();return;}
      if(!L.read().startedAt){welcome();return;}
      if(view==='course')renderCourse();else if(view==='path')learningPath();else if(view==='unit')unitView();else if(view==='practice')practise();else if(view==='mastery')mastery();else if(view==='tests')tests();else overview();
    }finally{rendering=false;if(view==='practice'){if(rowOpen)host.querySelector('.ma-kana-row-picker')?.setAttribute('open','');if(focus)[...host.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focus)?.focus({preventScroll:true});}}
  }
  host.addEventListener('click',event=>{const a=event.target.closest('.ma-kana-picker-path');if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();go('path');});
  let refreshQueued=false;
  function refresh(){if(view==='course'||placement||placementSetup||refreshQueued||rendering)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;run(()=>{L.initialize();render();});});}
  root.addEventListener('popstate',()=>{L.leaveCourse();placement=null;placementSetup=false;readRoute();render();requestAnimationFrame(()=>root.scrollTo({top:history.state?.scroll||0,behavior:'instant'}));});
  root.addEventListener('modeAtlasCloudDataChanged',()=>{if(view==='course')render();else refresh();});root.addEventListener('modeAtlasKanaLearningChanged',refresh);
  root.addEventListener('modeAtlasAccountWillChange',()=>{accountGeneration++;L.leaveCourse();placementKeyboard?.destroy();placementKeyboard=null;placement=null;placementSetup=false;host.replaceChildren(el('p','','Updating your learning space…'));});
  document.addEventListener('ma:ui-refresh',refresh);run(()=>{L.initialize();readRoute();render();});
})(window);
