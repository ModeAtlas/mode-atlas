/* Kana branch navigation and learning path. Curriculum, assessments, practice
   configuration and mastery each have a shared owner outside this page. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanaLearning');if(!host)return;
  const L=root.ModeAtlasKanaLearning,P=root.ModeAtlasKanaPlacement,Store=root.ModeAtlasStorage;
  const params=new URLSearchParams(location.search);
  let view=['learn','path','practice','mastery','tests'].includes(params.get('view'))?params.get('view'):'learn';
  let script=L.scripts.includes(params.get('script'))?params.get('script'):'hiragana',skill=[...L.skills,'both'].includes(params.get('skill'))?params.get('skill'):'reading';
  let lesson=null,placement=null,placementSetup=false,practiceSettings=null,customizing=false,placementKeyboard=null,accountGeneration=0;
  let allTools=params.get('tools')==='all'||view!=='learn',followJourney=!params.has('skill');
  const guided=()=>!allTools&&root.ModeAtlasLearningExperience.snapshot().kana.guided;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function run(action){try{action();}catch(error){root.ModeAtlasToast?.show?.(error.message);const status=host.querySelector('[role=status]')||el('p','ma-status ma-status--error');status.setAttribute('role','status');status.textContent=error.message;if(!status.parentNode)host.append(status);}}
  function button(label,action,primary=false){const generation=accountGeneration,b=el('button','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);b.type='button';b.addEventListener('click',()=>{if(generation===accountGeneration)run(action);});return b;}
  function link(label,href,primary=false){const a=el('a','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);a.href=href;return a;}
  function navigate(href){root.ModeAtlasVersionFile?.navigate?root.ModeAtlasVersionFile.navigate(href):location.assign(href);}
  function segmented(label,items,value,onChange){const group=el('div','ma-kana-segments');group.setAttribute('role','group');group.setAttribute('aria-label',label);for(const [id,text]of items){const b=button(text,()=>onChange(id));b.setAttribute('aria-pressed',String(id===value));group.append(b);}return group;}
  function title(kicker,heading,copy){const h=el('header','ma-kana-page-heading');h.append(el('span','ma-kicker',kicker),el('h1','',heading));if(copy)h.append(el('p','ma-kana-muted',copy));host.append(h);return h;}
  function url(){const q=new URLSearchParams({view,script,skill});history.replaceState(null,'','/kana/?'+q);}
  function chooseView(next){if(lesson)root.ModeAtlasLearningEvents?.emit('lessonExited','kana');view=next;lesson=null;placement=null;placementSetup=false;practiceSettings=null;url();render();root.scrollTo({top:0,behavior:'instant'});}
  function openPlacement(){placement=P.read();if(placement&&!placement.finished){render();return;}placement=null;placementSetup=true;render();}
  function startBeginner(){followJourney=true;L.start('beginner');root.ModeAtlasLearningEvents?.emit('lessonStarted','kana');placement=null;placementSetup=false;view='learn';script='hiragana';skill='reading';lesson={row:nextRow(),index:0};url();render();}
  function exploreTools(){allTools=true;if(!L.read().startedAt)L.start('beginner');render();}
  function toolsLink(){const b=button('Explore all Kana tools',exploreTools);b.className='ma-kana-text-action';return b;}
  function welcome(){
    title('Hiragana','Your first five kana');
    const preview=el('p','ma-kana-next-chars','あ い う え お');preview.lang='ja';host.append(preview);
    const options=el('div','ma-kana-start-options');
    const beginner=button('Start lesson',startBeginner,true);beginner.append(el('small','','Shape, sound and a short check'));
    options.append(beginner);host.append(options);
    const experienced=el('details','ma-kana-disclosure'),summary=el('summary','','Already know some Kana?');
    experienced.append(summary,button('Take a starting-point test',openPlacement),toolsLink());host.append(experienced);
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
      host.append(list,button('Open my learning path',()=>{placement=null;Store.remove(P.KEY);chooseView('learn');},true));return;
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
  function renderLesson(){
    const generation=accountGeneration;
    if(lesson.complete){
      title('Kana · Row lesson','Your row is ready for practice');
      const card=el('section','ma-kana-next');card.append(el('h2','',lesson.row.name),el('p','ma-kana-next-chars',lesson.row.chars.join(' ')),el('p','ma-kana-muted','Next, read these characters without hints. Familiar characters join your growing practice pool.'));
      const actions=el('div','ma-kana-actions');actions.append(link('Practise this row',L.practiceUrl('reading',lesson.row.chars,{hints:'off',practice:'10'}),true),link('Try the strokes',L.practiceUrl('handwriting',lesson.row.chars)));
      card.append(actions);host.append(card,button('Back to Kana',()=>{lesson=null;render();}));return;
    }
    const char=lesson.row.chars[lesson.index],roman=L.map[char],step=lesson.step||'meet';
    title(`${lesson.row.name} · ${lesson.index+1} of ${lesson.row.chars.length}`,{meet:'Meet the character',recognise:'Find the shape',listen:'Connect sound and shape',recall:'Remember the reading'}[step]);
    const panel=el('section','ma-kana-lesson');panel.dataset.step=step;
    const progress=el('progress');progress.max=lesson.row.chars.length;progress.value=lesson.index;progress.setAttribute('aria-label','Characters introduced in this lesson');panel.append(progress);
    const steps=el('ol','ma-kana-lesson-steps');for(const [id,label]of [['meet','Meet'],['recognise','Recognise'],['listen','Listen'],['recall','Recall']]){const item=el('li','',label);if(id===step)item.setAttribute('aria-current','step');steps.append(item);}panel.append(steps);
    const task=el('div','ma-kana-lesson-task');panel.append(task);
    const status=el('p','ma-kana-lesson-feedback');status.setAttribute('role','status');
    const setStep=next=>{lesson.step=next;lesson.audioReady=false;render();};
    const finish=()=>{
      if(generation!==accountGeneration||!lesson)return;
      L.completeLessonCharacter(char,{listened:lesson.listened===true});
      if(lesson.index+1<lesson.row.chars.length){lesson.index++;lesson.step='meet';lesson.listened=false;render();}
      else{root.ModeAtlasLearningEvents?.emit('lessonCompleted','kana');lesson.complete=true;render();}
    };
    if(step==='meet'){
      const teaching=root.ModeAtlasKanaCoaching.teach(char),visual=el('div','ma-kana-lesson-visual'),shape=el('div','ma-kana-lesson-shape',char);shape.lang='ja';visual.append(shape,el('strong','ma-kana-lesson-reading',roman),root.ModeAtlasPronunciation.controls(char));
      const copy=el('div','ma-kana-lesson-copy');copy.append(el('h2','','Say the sound'),el('p','',teaching.sound),el('h2','','Notice the shape'),el('p','',teaching.shape),button('See the strokes',()=>root.ModeAtlasHandwriting.open(char,{pronunciation:char})));
      task.append(visual,copy);panel.append(button('Check this character',()=>setStep('recognise'),true));
    }else if(step==='recognise'||step==='listen'){
      const listening=step==='listen';task.classList.add('ma-kana-lesson-question');
      task.append(el('p','ma-kana-skill-explanation',listening?'Play the sound, then choose its character.':'Which character makes this sound?'));
      if(!listening)task.append(el('strong','ma-kana-lesson-reading',roman));
      const options=el('div','ma-kana-lesson-choices'),choices=[...lesson.row.chars].sort((a,b)=>((L.map[a].charCodeAt(0)+lesson.index)%7)-((L.map[b].charCodeAt(0)+lesson.index)%7));
      let answered=false;
      const choose=answer=>{
        if(answered||listening&&!lesson.audioReady)return;
        if(answer!==char){status.textContent='Not quite. '+(listening?'Listen again and try another shape.':`${char} makes the sound ${roman}. Try finding it again.`);return;}
        answered=true;if(listening)lesson.listened=true;
        for(const b of options.children)b.disabled=true;
        status.textContent='Correct.';const next=button('Continue',()=>setStep(listening?'recall':'listen'),true);panel.append(next);next.focus({preventScroll:true});
      };
      for(const item of choices){const choice=button(item,()=>choose(item));choice.lang='ja';choice.disabled=listening;options.append(choice);}
      if(listening){
        const audio=root.ModeAtlasPronunciation.controls(char,{onPlayback:played=>{if(generation!==accountGeneration||!lesson||lesson.step!=='listen'||answered)return;lesson.audioReady=played;if(played){for(const b of options.children)b.disabled=false;status.textContent='Choose the character you heard.';}else status.textContent='Audio is unavailable. You can continue with visual practice.';}});
        for(const b of audio.children)b.setAttribute('aria-label',b.textContent==='Listen'?'Play sound':'Play sound slowly');
        task.append(audio);
      }
      task.append(options);panel.append(status);
      if(listening)panel.append(button('Continue without audio',()=>{lesson.listened=false;setStep('recall');}));
    }else{
      task.classList.add('ma-kana-lesson-question');const shape=el('div','ma-kana-lesson-shape',char);shape.lang='ja';task.append(shape);
      const form=el('form','ma-kana-lesson-answer'),input=el('input','ma-input'),label=el('label','','Type the sound in romaji');input.id='kanaLessonAnswer';label.htmlFor=input.id;input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=20;input.enterKeyHint='go';form.append(label,input);
      const submit=el('button','ma-button ma-button--primary','Check answer');submit.type='submit';form.append(submit);
      form.addEventListener('submit',event=>{event.preventDefault();if(generation!==accountGeneration||!lesson||event.isComposing||input.disabled)return;const answer=input.value.trim();if(!answer)return;
        if(!root.ModeAtlasKanaCoaching.matches(char,answer)){status.textContent=`${char} is ${roman}. Say it once, then try again.`;input.select();return;}
        status.textContent='Correct. You have met this character.';input.disabled=true;submit.disabled=true;
        const next=button(lesson.index+1===lesson.row.chars.length?'Finish row lesson':'Next character',finish,true);panel.append(next);next.focus({preventScroll:true});
      });task.append(form);panel.append(status);
    }
    host.append(panel,button('Back to Kana',()=>{root.ModeAtlasPronunciation.stop();root.ModeAtlasLearningEvents?.emit('lessonExited','kana');lesson=null;render();}));
  }
  function soundWorkshop(){
    const state=L.read(),content=el('div','ma-kana-sound-workshop');
    const lessons=[{id:'longVowels',title:'Long vowels',example:'あ → ああ',copy:'A long vowel lasts two beats. Keep the sound steady for twice as long. おう often sounds like a long o, and えい like a long e; listen to each word. In katakana, ー extends the vowel before it.',question:'How many beats does ああ have?',answer:'Two beats',other:'One beat',ready:L.seen('あ'),audio:'ああ'},
      {id:'sokuon',title:'Small っ',example:'かこ → かっこ',copy:'Small っ adds a one-beat pause before the next consonant. Hold that consonant; do not say “tsu”.',question:'What does the small っ add?',answer:'A one-beat pause',other:'The sound tsu',ready:L.seen('か')&&L.seen('こ'),audio:'かっこ'}];
    function list(){content.replaceChildren();for(const item of lessons){const row=el('section');row.append(el('h3','',item.title),el('p','ma-kana-muted',state.sounds[item.id]?'Introduced · Revisit any time':item.ready?'Ready to learn':item.id==='sokuon'?'Learn か and こ first.':'Learn あ first.'));const start=button(state.sounds[item.id]?'Revisit '+item.title:'Learn '+item.title,()=>show(item),true);start.disabled=!item.ready;row.append(start);content.append(row);}}
    function show(item){content.replaceChildren(el('h3','',item.title),el('p','ma-kana-next-chars',item.example),el('p','',item.copy),root.ModeAtlasPronunciation.controls(item.audio));
      const reveal=button('Check this pattern',()=>{content.replaceChildren(el('h3','',item.question));const status=el('p');status.setAttribute('role','status');for(const answer of [item.other,item.answer])content.append(button(answer,()=>{if(answer!==item.answer){status.textContent='Try again. '+item.copy;return;}L.introduceSound(item.id);state.sounds[item.id]=Date.now();content.replaceChildren(el('h3','','Pattern introduced'),el('p','','Look out for this pattern in Words.'),button('Back to sound workshop',list,true));}));content.append(status);},true);content.append(reveal,button('Back to sound workshop',list));}
    const cancel=()=>{root.ModeAtlasPronunciation.stop();root.ModeAtlasDialog.close();};
    root.addEventListener('modeAtlasAccountWillChange',cancel);
    list();root.ModeAtlasDialog.feature({title:'Sound workshop',contentNode:content,size:'wide'}).finally(()=>root.removeEventListener('modeAtlasAccountWillChange',cancel));
  }
  function controls(includeHand=true,target=host){
    target.append(segmented('Kana script',[['hiragana','Hiragana'],['katakana','Katakana']],script,value=>{script=value;practiceSettings=null;url();render();}));
    target.append(segmented('Kana skill',(includeHand?L.skills:['reading','writing']).map(id=>[id,L.names[id]]),skill,value=>{skill=value;followJourney=false;practiceSettings=null;url();render();}));
  }
  function learningPath(){
    title('Kana','Your learning path');
    const heading=host.lastElementChild;heading.classList.add('ma-kana-path-heading');heading.append(button('Back to Kana',()=>chooseView('learn')));
    const options=el('div','ma-kana-path-options');controls(true,options);host.append(options);
    const state=L.read(),evidence=L.snapshot(),rows=L.path(script,skill,state,evidence),next=rows.find(r=>r.unlocked&&!r.complete)||rows.at(-1);
    const current=el('section','ma-kana-next');current.append(el('span','ma-kicker',next.groupName),el('h2','',`${next.name} · ${L.names[skill]}`),el('p','ma-kana-next-chars',next.chars.join(' ')),el('p','ma-kana-muted',skill==='handwriting'?'Write each character without a guide.':`${next.ready} / ${next.chars.length} familiar`));
    const actions=el('div','ma-kana-actions');
    if(skill!=='handwriting')actions.append(button('Learn this row',()=>{root.ModeAtlasLearningEvents?.emit('lessonStarted','kana');lesson={row:next,index:0};render();},true));
    actions.append(link(skill==='handwriting'?'Practise handwriting':'Practise '+L.names[skill],L.practiceUrl(skill,next.chars),skill==='handwriting'));current.append(actions);
    const layout=el('div','ma-kana-path-layout'),stage=el('div','ma-kana-path-current');stage.append(current);
    const due=skill==='handwriting'?[]:root.ModeAtlasReview.due(evidence[skill+'Review']).filter(c=>L.available(skill,state,evidence).has(c));
    if(due.length)stage.append(link(`Review ${due.length} ready kana`,L.practiceUrl(skill,due,{hints:'off'})));
    layout.append(stage,pathPreview(false));host.append(layout);
    host.append(button('Check my starting point',openPlacement));
  }
  function nextRow(direction=skill,alphabet=script,state=L.read(),evidence=L.snapshot()){
    const rows=L.path(alphabet,direction,state,evidence);
    return rows.find(row=>row.unlocked&&!row.complete)||rows.at(-1);
  }
  function activity(label,copy,mark,action){
    const item=button('',action);item.className='ma-kana-activity';
    const symbol=el('span','ma-kana-activity-mark');symbol.setAttribute('aria-hidden','true');
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(icon.namespaceURI,'use');icon.classList.add('ma-icon');use.setAttribute('href','/assets/mode-atlas-icons.svg#icon-'+('tool-'+({'✎':'handwrite','20':'daily','60':'timed','あい':'sequence'}[mark]||'practice')));icon.append(use);symbol.append(icon);
    const text=el('span','ma-kana-activity-copy');text.append(el('strong','',label),el('span','',copy));
    const arrow=el('span','ma-kana-activity-arrow','›');arrow.setAttribute('aria-hidden','true');
    item.append(symbol,text,arrow);return item;
  }
  function reviewLink(target=host){
    const evidence=L.snapshot(),state=L.read();
    for(const direction of ['reading','writing']){
      const allowed=L.available(direction,state,evidence),due=root.ModeAtlasReview.due(evidence[direction+'Review']).filter(char=>allowed.has(char));
      if(!due.length)continue;
      const a=link(`Revisit ${due.length} kana · ${L.names[direction]}`,L.practiceUrl(direction,due,{hints:'off'}));a.className='ma-kana-review-link';target.append(a);
    }
  }
  function pathPreview(includeExplore=true){
    const state=L.read(),evidence=L.snapshot(),rows=L.path(script,skill,state,evidence),next=nextRow(skill,script,state,evidence);
    const aside=el('aside','ma-kana-path-preview');aside.setAttribute('aria-label','Your complete Kana path');
    aside.append(el('span','ma-kicker',script==='hiragana'?'HIRAGANA':'KATAKANA'),el('h2','','Your path'));
    const summary=el('p','ma-kana-path-summary',`${rows.filter(row=>row.complete).length} / ${rows.length} rows familiar · ${L.names[skill]}`);aside.append(summary);
    for(const groupId of [...new Set(rows.map(row=>row.group))]){
      const groupRows=rows.filter(row=>row.group===groupId),group=el('details','ma-kana-path-group');
      group.open=groupId===next.group;
      const heading=el('summary');heading.append(el('strong','',groupRows[0].groupName),el('span','',`${groupRows.filter(row=>row.complete).length} / ${groupRows.length}`));group.append(heading);
      const list=el('div','ma-kana-path-steps');
      const trail=document.createElementNS('http://www.w3.org/2000/svg','svg'),line=document.createElementNS(trail.namespaceURI,'path');
      trail.classList.add('ma-kana-path-trail');trail.setAttribute('viewBox',`0 0 320 ${groupRows.length*128}`);trail.setAttribute('preserveAspectRatio','none');trail.setAttribute('aria-hidden','true');
      let d='M 90 27';for(let i=1;i<groupRows.length;i++){const from=i%2?90:230,to=i%2?230:90,y=(i-1)*128+27;d+=` C ${from} ${y+64}, ${to} ${y+64}, ${to} ${y+128}`;}
      line.setAttribute('d',d);trail.append(line);list.append(trail);
      for(const row of groupRows){
        const item=button('',()=>{if(skill==='handwriting')navigate(L.practiceUrl(skill,row.chars));else{root.ModeAtlasLearningEvents?.emit('lessonStarted','kana');lesson={row,index:0};render();root.scrollTo({top:0,behavior:'instant'});}});
        item.className='ma-kana-path-step';item.disabled=!row.unlocked;item.dataset.current=String(row.id===next.id);item.dataset.row=row.id;
        item.setAttribute('aria-label',`${row.name} · ${row.complete?'Revisit lesson':row.unlocked?'Learn this row':'Locked'}`);
        if(row.id===next.id)item.setAttribute('aria-current','step');
        const marker=el('span','ma-kana-path-marker',row.complete?'✓':row.chars[0]);marker.setAttribute('aria-hidden','true');
        const copy=el('span');copy.append(el('strong','',row.name),el('small','ma-kana-path-characters',row.chars.join(' ')),el('small','',row.complete?'Revisit lesson':row.unlocked?`${row.ready} / ${row.chars.length} familiar`:'Locked'));
        item.append(marker,copy);list.append(item);
      }
      group.append(list);aside.append(group);
    }
    if(includeExplore){const all=button('Explore your path →',()=>chooseView('path'));all.className='ma-kana-text-action';all.setAttribute('aria-label','Explore your path');aside.append(all);}
    return aside;
  }
  function workspace(stage,intro){const frame=el('div','ma-kana-workspace');frame.append(stage);if(intro){const layout=el('div','ma-kana-practice-layout');layout.append(intro,frame);host.append(layout);}else host.append(frame);if(!guided())host.append(link('Explore the full learning path','/kana/?view=path'));}
  function learn(){
    title('Kana · Learn','Your next step');
    const state=L.read(),evidence=L.snapshot(),following=followJourney&&state.startKind==='beginner',journey=L.journey(script,state,evidence),next=following?journey.row:nextRow(skill,script,state,evidence);
    if(following&&['reading','writing'].includes(journey.phase))skill=journey.phase;
    if(!guided())controls();
    const ready=skill==='writing'?L.path(script,'writing',state,evidence).find(row=>row.id===next.id).ready:next.ready;
    const stages=L.rows.flatMap(row=>row.chars).map(char=>L.stage(char,state,evidence));
    const familiar=stages.filter(stage=>stage>=3).length,mastered=stages.filter(stage=>stage>=5).length;
    const stage=el('div','ma-kana-learning-stage'),current=el('section','ma-kana-next');current.dataset.skill=skill;
    current.append(el('span','ma-kicker',`${script==='hiragana'?'Hiragana':'Katakana'} · ${L.names[skill]}`));
    const introduced=next.chars.every(char=>L.seen(char,state,evidence));
    current.append(el('h2','',next.name));
    const chars=el('div','ma-kana-lesson-tiles');chars.setAttribute('aria-label','Explore this row');chars.style.setProperty('--kana-tile-count',String(Math.min(5,next.chars.length)));
    next.chars.forEach((char,index)=>{
      const tile=button('',()=>{if(skill==='handwriting')navigate(L.practiceUrl(skill,[char]));else{lesson={row:next,index};render();}});tile.className='ma-kana-lesson-tile';
      tile.setAttribute('aria-label',`Learn ${char}, ${L.map[char]}`);const glyph=el('strong','',char);glyph.lang='ja';tile.append(glyph,el('span','',L.map[char]));chars.append(tile);
    });current.append(chars);
    const progress=el('progress','ma-kana-row-progress');progress.max=next.chars.length;progress.value=ready;progress.setAttribute('aria-label',next.name+' familiarity');
    current.append(progress,el('span','ma-kana-progress-caption',`${ready} / ${next.chars.length} familiar`));
    const actions=el('div','ma-kana-feature-actions');
    actions.append(button('Continue learning',()=>{
      if(skill==='handwriting'||introduced)navigate(L.practiceUrl(skill,next.chars,{hints:'off',practice:'10'}));
      else{lesson={row:next,index:Math.max(0,next.chars.findIndex(char=>!L.seen(char,state,evidence)))};render();}
    },true));
    if(following&&journey.phase==='complete'){actions.replaceChildren(link('Take a '+(script==='hiragana'?'Hiragana':'Katakana')+' test','/reading/?mode=test&script='+script,true));if(script==='hiragana')actions.append(link('Start Katakana','/kana/?script=katakana'));}
    current.insertBefore(actions,chars.nextSibling);
    const itinerary=el('ol','ma-kana-row-itinerary'),readPath=L.path(script,'reading',state,evidence).find(row=>row.id===next.id),recallPath=L.path(script,'writing',state,evidence).find(row=>row.id===next.id);
    for(const [label,done,currentStep]of [['Meet the row',introduced,!introduced],['Read it',readPath.complete,introduced&&!readPath.complete],['Recall it',recallPath.complete,readPath.complete&&!recallPath.complete]]){const item=el('li','',`${done?'✓ ':''}${label}`);if(currentStep)item.setAttribute('aria-current','step');itinerary.append(item);}current.append(itinerary);
    current.append(el('p','ma-kana-muted',!introduced?'Meet each shape and sound, then check what you remember.':skill==='writing'?'Bring the characters to mind from their sounds. Familiar Read and Recall skills open your next guided row.':'Read each character without hints until this row becomes Familiar.'));
    stage.append(current);
    const pool=L.learnedPool('reading',state,evidence);if(pool.length)stage.append(link(`Mix my ${pool.length} learned kana`,L.practiceUrl('reading',pool,{hints:'off',practice:'20'})));
    if(introduced||pool.length){const sounds=button('Sound workshop',soundWorkshop);sounds.className='ma-kana-text-action';stage.append(sounds);}
    const kanji=root.ModeAtlasLearningExperience.readiness?.()?.kanji;
    if(kanji?.recommended&&!kanji.started){const invite=el('section','ma-kana-branch-invite');invite.append(el('h2','','Ready to try Kanji'),el('p','ma-kana-muted','Your familiar kana give you a starting point for reading Kanji. Try a small first set.'),link('Meet your first Kanji','/kanji/',true));stage.append(invite);}
    if(guided()){
      reviewLink(stage);
      workspace(stage);host.append(link('See my learning path','/kana/?view=path'),toolsLink());return;
    }
    const summary=el('div','ma-kana-progress-summary');
    for(const [value,label]of [[familiar,'Familiar'],[mastered,'Mastered']]){const item=el('div');item.append(el('strong','',value),el('span','',label));summary.append(item);}
    const map=link('View mastery','/kana/?view=mastery');map.className='ma-kana-text-action';summary.append(map);stage.append(summary);
    reviewLink(stage);
    const activities=el('div','ma-kana-activities');
    activities.append(activity('Build your rhythm','Your practice tools, at your pace.','↔',()=>{skill='reading';chooseView('practice');}));
    activities.append(activity('Try handwriting','Learn each shape, stroke by stroke.','✎',()=>{skill='handwriting';chooseView('practice');}));stage.append(activities);
    const placementLink=button('Check my starting point',openPlacement);placementLink.className='ma-kana-text-action ma-kana-placement-link';stage.append(placementLink);
    workspace(stage);
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
  function customize(){
    const content=el('div','ma-kana-customize');customizing=true;
    function draw(){
      const rowOpen=content.querySelector('.ma-kana-row-picker')?.open,focus=content.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
      content.replaceChildren();
      content.append(root.ModeAtlasKanaPractice.render({skill,getSettings:settingsForPractice,onChange:next=>{practiceSettings=next;draw();},targetFields:true}));
      content.append(button('Done',()=>root.ModeAtlasDialog.close(),true));
      if(rowOpen)content.querySelector('.ma-kana-row-picker')?.setAttribute('open','');
      if(focus)[...content.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focus)?.focus({preventScroll:true});
    }
    draw();root.ModeAtlasDialog.feature({title:'Make it your session',contentNode:content}).then(()=>{customizing=false;render();});
  }
  function practise(){
    const intro=el('div','ma-kana-practice-intro');intro.append(title('Kana · Practice','Build the reflex.'));
    const choices=segmented('Kana skill',['reading','writing','both','handwriting'].map(id=>[id,L.names[id]]),skill,value=>{skill=value;practiceSettings=null;url();render();});
    choices.classList.add('ma-kana-practice-skills');intro.append(choices);
    const explanation={reading:'See あ, type “a”. Connect each shape with its sound.',writing:'See “a”, choose or type あ. Bring the shape to mind.',both:'あ → a, then a → あ. Alternate Read and Recall in one session.',handwriting:'Trace the strokes, then try writing from memory.'};
    intro.append(el('p','ma-kana-skill-explanation',explanation[skill]));
    const stage=el('div','ma-kana-practice-stage');
    const card=el('section','ma-kana-next ma-kana-session');card.dataset.skill=skill;
    if(skill==='handwriting'){
      const row=nextRow();card.append(el('span','ma-kicker',script==='hiragana'?'Hiragana':'Katakana'),el('h2','','Make the shapes your own'),el('p','ma-kana-next-chars',row.chars.join(' ')),el('p','ma-kana-muted','Take your time. Handwriting is an optional part of your journey.'));
      card.append(link('Open handwriting',L.practiceUrl(skill,row.chars),true));stage.append(card,button('Choose a different row',()=>chooseView('path')));workspace(stage,intro);return;
    }
    const settings=settingsForPractice(),family=root.ModeAtlasKanaPractice.family(settings),pool=settings.testMode?L.testPool(settings,skill):L.selection(settings,skill),chars=Object.keys(pool);
    const selected=L.rows.filter(row=>row.chars.some(char=>Object.hasOwn(pool,char)));
    const scripts=[...new Set(selected.map(row=>row.script))],scriptLabel=scripts.length===2?'Hiragana & Katakana':scripts[0]==='katakana'?'Katakana':'Hiragana';
    const name=family==='daily'?'Your daily session':family==='timed'?(settings.timeTrial?'Set yourself a target':'A one-minute challenge'):family==='sequence'?'Find the flow':family==='test'?'Put it all together':settings.practiceCount?`${settings.practiceCount} questions, at your pace`:'Stay a little longer';
    const sessionCopy=el('div','ma-kana-session-copy');
    sessionCopy.append(el('span','ma-kicker',scriptLabel),el('h2','',name));card.append(sessionCopy);
    const instrument=el('div','ma-kana-instrument');instrument.setAttribute('aria-hidden','true');const sample=el('span','ma-kana-instrument-glyph',chars[0]||'あ');sample.lang='ja';sample.dataset.combined=String((chars[0]||'あ').length>1);instrument.append(el('span','ma-kicker','SHAPE ↔ SOUND'),sample,el('span','ma-kana-instrument-answer',L.map[chars[0]]||'a'));card.append(instrument);
    sessionCopy.append(el('p','ma-kana-selection-summary',`${selected.length===1?selected[0].name+' · ':''}${chars.length} kana${settings.focusWeak?' · Focus on weaker characters':settings.confusableKana?' · Similar-looking characters':''}`));
    const copy=family==='daily'?'Twenty questions. Make a little progress today.':family==='timed'?(settings.timeTrial?`${settings.trialTarget} correct answers in ${settings.trialMinutes} minutes.`:'How many can you recognise in 60 seconds?'):family==='sequence'?'Read groups of characters together and build your fluency.':family==='test'?'One pass through your unlocked script.':settings.feedbackStyle==='quick'?'Quick feedback keeps your rhythm.':'Learn from each answer, with time to try again.';
    sessionCopy.append(el('p','ma-kana-muted',copy));
    const actions=el('div','ma-kana-feature-actions');actions.append(button('Start practice',openSession,true));
    if(family!=='daily'&&family!=='test'){
      const hints=button(settings.hint?'Hints on':'Hints off',()=>{practiceSettings={...settings,hint:!settings.hint};render();});hints.className='ma-kana-text-action';hints.setAttribute('aria-pressed',String(!!settings.hint));actions.append(hints);
    }
    card.append(actions);stage.append(card);
    const adjust=button('Adjust this session',customize);adjust.className='ma-kana-text-action ma-kana-adjust';stage.append(adjust);
    reviewLink(stage);stage.append(el('h2','ma-kana-section-title','Try a different pace'));
    const activities=el('div','ma-kana-activities');
    for(const [id,label,copy,mark]of [['practice','At your pace','Short sets or keep going.','あ'],['daily','Daily session','Twenty questions for today.','20'],['timed','Timed challenge','Build speed in one minute.','60'],['sequence','Character sequences','Practise reading kana together.','あい']]){
      if(skill==='both'&&['daily','sequence'].includes(id))continue;
      const tool=activity(label,copy,mark,()=>{practiceSettings=root.ModeAtlasKanaPractice.forFamily(settings,id,skill);render();root.scrollTo({top:0,behavior:'instant'});});tool.setAttribute('aria-pressed',String(id===family));activities.append(tool);
    }stage.append(activities);workspace(stage,intro);
  }
  function tests(){
    if(skill==='handwriting')skill='reading';title('Kana','Put your skills to the test','Complete a full script assessment, then explore its results.');
    host.append(segmented('Test skill',[['reading','Read'],['writing','Recall']],skill,value=>{skill=value;render();}));
    const eligible=L.testScripts(skill);
    for(const id of L.scripts){const name=id==='hiragana'?'Hiragana':'Katakana',row=el('section','ma-kana-test-row');row.append(el('h2','',name));
      if(eligible.includes(id))row.append(el('p','','One pass through all basic characters.'),link('Start '+name+' test','/'+(skill==='writing'?'writing':'reading')+'/?mode=test&script='+id,true));
      else row.append(el('p','ma-kana-muted','Make every basic row Familiar in '+L.names[skill]+' to open this test.'),button('Open learning path',()=>{script=id;chooseView('learn');}));host.append(row);
    }
    host.append(link('View test results','/results/'));
    const pool=L.learnedPool(skill);if(pool.length)host.append(link('Practise my learned pool first',L.practiceUrl(skill,pool,{hints:'off',practice:'20'})));
  }
  function mastery(){title('Kana','Your mastery map');host.append(root.ModeAtlasKanaMastery.render((char,detail)=>{
    const scroll=root.scrollY;host.replaceChildren(button('Back to mastery map',()=>{render();requestAnimationFrame(()=>{root.scrollTo({top:scroll,behavior:'instant'});host.querySelector(`[data-ma-mastery-kana="${char}"]`)?.focus({preventScroll:true});});}),detail);root.scrollTo({top:0,behavior:'instant'});
  }));}
  function render(){
    if(view!=='practice'&&skill==='both')skill='reading';
    placementKeyboard?.destroy();placementKeyboard=null;
    const rowOpen=host.querySelector('.ma-kana-row-picker')?.open,focus=host.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
    host.replaceChildren();const state=L.read();
    const focused=guided()||!!(lesson||placement||placementSetup);
    document.body.dataset.maKanaExperience=focused?'guided':'explore';
    document.querySelector('.ma-kana-navigation')?.toggleAttribute('hidden',focused);
    document.querySelectorAll('.ma-kana-navigation a').forEach(a=>{
      const target=new URL(a.href),next=target.searchParams.get('view')||'learn',active=next===(view==='path'?'learn':view);
      target.searchParams.set('script',script);target.searchParams.set('skill',skill);
      // Preserve choices between sections, but keep an already-open section's
      // exact URL so the native shell can scroll up without reloading it.
      a.href=active&&view!=='path'&&!lesson&&!placement&&!placementSetup?location.pathname+location.search:target.pathname+target.search;
      a.toggleAttribute('aria-current',active);if(active)a.setAttribute('aria-current','page');
    });
    if(lesson||placement||placementSetup)root.scrollTo({top:0,behavior:'instant'});
    if(placementSetup){assessSetup();return;}if(placement){renderPlacement();return;}if(lesson){renderLesson();return;}
    if(!state.startedAt){welcome();return;}
    if(view==='practice')practise();else if(view==='mastery')mastery();else if(view==='tests')tests();else if(view==='path')learningPath();else learn();
    if(rowOpen&&host.querySelector('.ma-kana-row-picker'))host.querySelector('.ma-kana-row-picker').open=true;
    if(focus)[...host.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focus)?.focus({preventScroll:true});
  }
  let refreshQueued=false;
  document.querySelector('.ma-kana-navigation')?.addEventListener('click',event=>{
    if(!(lesson||placement||placementSetup)||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const a=event.target.closest('a[href]');if(!a)return;
    const target=new URL(a.href),next=target.searchParams.get('view')||'learn';
    if(target.pathname!==location.pathname||!['learn','practice','mastery','tests'].includes(next))return;
    // A lesson/placement is an in-page state: selecting its parent section
    // must leave that state even when the address is already identical.
    event.preventDefault();chooseView(next);
  });
  function refresh(){if(lesson||placement||placementSetup||customizing||refreshQueued)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;if(lesson||placement||placementSetup||customizing)return;run(()=>{L.initialize();render();});});}
  root.addEventListener('modeAtlasCloudDataChanged',refresh);root.addEventListener('modeAtlasKanaLearningChanged',refresh);
  root.addEventListener('modeAtlasAccountWillChange',()=>{accountGeneration++;root.ModeAtlasPronunciation.stop();placementKeyboard?.destroy();placementKeyboard=null;lesson=null;placement=null;placementSetup=false;practiceSettings=null;host.replaceChildren(el('p','','Updating your learning space…'));});
  document.addEventListener('ma:ui-refresh',refresh);
  run(()=>{L.initialize();render();});
})(window);
