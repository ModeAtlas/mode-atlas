/* Kana branch navigation and learning path. Curriculum, assessments, practice
   configuration and mastery each have a shared owner outside this page. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanaLearning');if(!host)return;
  const L=root.ModeAtlasKanaLearning,P=root.ModeAtlasKanaPlacement,Store=root.ModeAtlasStorage;
  const params=new URLSearchParams(location.search);
  let view=['learn','path','practice','mastery','tests'].includes(params.get('view'))?params.get('view'):'learn';
  let script=L.scripts.includes(params.get('script'))?params.get('script'):'hiragana',skill=L.skills.includes(params.get('skill'))?params.get('skill'):'reading';
  let lesson=null,placement=null,placementSetup=false,practiceSettings=null,customizing=false,placementKeyboard=null;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function run(action){try{action();}catch(error){root.ModeAtlasToast?.show?.(error.message);const status=host.querySelector('[role=status]')||el('p','ma-status ma-status--error');status.setAttribute('role','status');status.textContent=error.message;if(!status.parentNode)host.append(status);}}
  function button(label,action,primary=false){const b=el('button','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);b.type='button';b.addEventListener('click',()=>run(action));return b;}
  function link(label,href,primary=false){const a=el('a','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);a.href=href;return a;}
  function navigate(href){root.ModeAtlasVersionFile?.navigate?root.ModeAtlasVersionFile.navigate(href):location.assign(href);}
  function segmented(label,items,value,onChange){const group=el('div','ma-kana-segments');group.setAttribute('role','group');group.setAttribute('aria-label',label);for(const [id,text]of items){const b=button(text,()=>onChange(id));b.setAttribute('aria-pressed',String(id===value));group.append(b);}return group;}
  function title(kicker,heading,copy){const h=el('header','ma-kana-page-heading');h.append(el('span','ma-kicker',kicker),el('h1','',heading));if(copy)h.append(el('p','ma-kana-muted',copy));host.append(h);}
  function url(){const q=new URLSearchParams({view,script,skill});history.replaceState(null,'','/kana/?'+q);}
  function chooseView(next){view=next;lesson=null;placement=null;placementSetup=false;practiceSettings=null;url();render();root.scrollTo({top:0,behavior:'instant'});}
  function openPlacement(){placement=P.read();if(placement&&!placement.finished){render();return;}placement=null;placementSetup=true;render();}
  function startBeginner(){L.start('beginner');placement=null;placementSetup=false;view='learn';script='hiragana';skill='reading';url();render();}
  function welcome(){
    title('Kana','Find your starting point','Learn the shapes, recall the sounds and write at your own pace.');
    const options=el('div','ma-kana-start-options');
    const assess=button('Take a starting-point test',openPlacement,true);assess.append(el('small','','Discover which rows are right for you.'));
    const beginner=button('Start as a beginner',startBeginner);beginner.append(el('small','','Begin with the A-row. No test needed.'));
    options.append(assess,beginner);host.append(options);
  }
  function assessSetup(){
    title('Starting point','Which scripts do you know?','The check adapts separately for Read and Recall. You can finish whenever you like.');
    let selected='hiragana';const switcher=segmented('Placement scripts',[['hiragana','Hiragana'],['katakana','Katakana'],['both','Both']],selected,value=>{selected=value;for(const b of switcher.children)b.setAttribute('aria-pressed',String(b.textContent===(value==='both'?'Both':value==='hiragana'?'Hiragana':'Katakana')));});
    host.append(switcher,button('Begin check',()=>{placement=Store.transaction(()=>P.begin(selected==='both'?L.scripts:[selected]));placementSetup=false;render();},true),button('Start as a beginner',startBeginner));
  }
  function renderPlacement(){
    if(placement.finished){
      title('Starting point','Your learning path is ready',`${placement.answered} questions explored. Continue from the rows available in each skill.`);
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
      if(placement.feedback){const feedback=el('p','ma-kana-check-feedback',placement.feedback.correct?'Correct':`${q.char} is ${q.roman}. We’ll start this skill around here.`);feedback.setAttribute('role','status');form.append(feedback);}
      if(root.ModeAtlasIOSKeyboard){const keys=el('div','ma-kana-placement-keyboard');form.append(keys);placementKeyboard=root.ModeAtlasIOSKeyboard.mount({input,container:keys,onSubmit:()=>form.requestSubmit()});}
      const actions=el('div','ma-kana-check-actions'),submit=el('button','ma-button ma-button--primary',placement.feedback?'Continue':'Check answer');submit.type='submit';actions.append(submit);
      if(!placement.feedback)actions.append(button('I don’t know yet',()=>{placement=Store.transaction(()=>P.answer(placement,''));render();}));form.append(actions);
      form.addEventListener('submit',event=>{event.preventDefault();if(event.isComposing)return;if(placement.feedback||input.value.trim())run(()=>{placement=Store.transaction(()=>placement.feedback?P.advance(placement):P.answer(placement,input.value));render();});});stage.append(form);
      focusTarget=placement.feedback?submit:input;
    }else if(placement.feedback){
      stage.append(el('p','ma-kana-check-feedback',placement.feedback.correct?'Correct':`${q.char} is ${q.roman}. We’ll start this skill around here.`));
      stage.append(button('Continue',()=>{placement=Store.transaction(()=>P.advance(placement));render();},true));
    }else{
      const choices=el('div','ma-kana-placement-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Kana answers');
      for(const char of P.choices(placement))choices.append(button(char,()=>{placement=Store.transaction(()=>P.answer(placement,char));render();}));stage.append(choices);
    }
    if(q.skill!=='reading'&&!placement.feedback)stage.append(button('I don’t know yet',()=>{placement=Store.transaction(()=>P.answer(placement,''));render();}));
    const finish=button('Finish with my progress so far',()=>{placement=Store.transaction(()=>P.finish(placement));render();});finish.className='ma-kana-text-action ma-kana-placement-finish';host.append(stage,finish);focusTarget?.focus({preventScroll:true});
  }
  function renderLesson(){
    const char=lesson.row.chars[lesson.index],roman=L.map[char];title(`${lesson.row.name} · ${lesson.index+1} of ${lesson.row.chars.length}`,'Meet the character');
    const panel=el('section','ma-kana-lesson'),shape=el('div','ma-kana-lesson-shape',char);shape.lang='ja';
    panel.append(shape,el('strong','ma-kana-lesson-reading',roman),root.ModeAtlasPronunciation.controls(char));
    panel.append(el('p','',root.ModeAtlasKanaCoaching.explain(char).note));
    const actions=el('div','ma-kana-actions');actions.append(button('See the strokes',()=>root.ModeAtlasHandwriting.open(char,{pronunciation:char})));
    actions.append(button(lesson.index+1===lesson.row.chars.length?'Practise this row':'Next character',()=>{
      L.introduce(char);if(lesson.index+1<lesson.row.chars.length){lesson.index++;render();}
      else navigate(L.practiceUrl(skill,lesson.row.chars,{hints:'off'}));
    },true));panel.append(actions);host.append(panel,button('Back to Kana',()=>{lesson=null;render();}));
  }
  function controls(includeHand=true){
    host.append(segmented('Kana script',[['hiragana','Hiragana'],['katakana','Katakana']],script,value=>{script=value;practiceSettings=null;url();render();}));
    host.append(segmented('Kana skill',(includeHand?L.skills:['reading','writing']).map(id=>[id,L.names[id]]),skill,value=>{skill=value;practiceSettings=null;url();render();}));
  }
  function learningPath(){
    host.append(button('Back to Kana',()=>chooseView('learn')));
    title('Kana','Your learning path','Read, recall and write, one row at a time.');controls();
    const state=L.read(),evidence=L.snapshot(),rows=L.path(script,skill,state,evidence),next=rows.find(r=>r.unlocked&&!r.complete)||rows.at(-1);
    const current=el('section','ma-kana-next');current.append(el('span','ma-kicker',next.groupName),el('h2','',`${next.name} · ${L.names[skill]}`),el('p','ma-kana-next-chars',next.chars.join(' ')),el('p','ma-kana-muted',skill==='handwriting'?'Complete each character without its guide to open the next row.':`${next.ready} of ${next.chars.length} familiar · independent practice opens the next row.`));
    const actions=el('div','ma-kana-actions');
    if(skill!=='handwriting')actions.append(button('Learn this row',()=>{lesson={row:next,index:0};render();},true));
    actions.append(link(skill==='handwriting'?'Practise handwriting':'Practise '+L.names[skill],L.practiceUrl(skill,next.chars),skill==='handwriting'));current.append(actions);host.append(current);
    const due=skill==='handwriting'?[]:root.ModeAtlasReview.due(evidence[skill+'Review']).filter(c=>L.available(skill,state,evidence).has(c));
    if(due.length)host.append(link(`Review ${due.length} ready kana`,L.practiceUrl(skill,due,{hints:'off'})));
    let group='';for(const row of rows){
      if(row.group!==group){group=row.group;host.append(el('h2','ma-kana-group-title',row.groupName));}
      const item=el('div','ma-kana-path-row');item.dataset.locked=String(!row.unlocked);item.dataset.complete=String(row.complete);
      const copy=el('div');copy.append(el('strong','',row.name),el('span','ma-kana-path-chars',row.chars.join(' ')));
      const action=button(row.complete?'Revisit':row.unlocked?'Learn':'Locked',()=>{if(skill==='handwriting')navigate(L.practiceUrl(skill,row.chars));else{lesson={row,index:0};render();}});action.disabled=!row.unlocked;item.append(copy,action);host.append(item);
    }
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
  function pathPreview(){
    const state=L.read(),evidence=L.snapshot(),rows=L.path(script,skill,state,evidence),next=nextRow(skill,script,state,evidence);
    const aside=el('aside','ma-kana-path-preview');aside.setAttribute('aria-label','Your complete Kana path');
    aside.append(el('span','ma-kicker',script==='hiragana'?'HIRAGANA':'KATAKANA'),el('h2','','Your path'));
    const summary=el('p','ma-kana-path-summary',`${rows.filter(row=>row.complete).length} / ${rows.length} rows familiar · ${L.names[skill]}`);aside.append(summary);
    for(const groupId of [...new Set(rows.map(row=>row.group))]){
      const groupRows=rows.filter(row=>row.group===groupId),group=el('details','ma-kana-path-group');
      group.open=groupId===next.group;
      const heading=el('summary');heading.append(el('strong','',groupRows[0].groupName),el('span','',`${groupRows.filter(row=>row.complete).length} / ${groupRows.length}`));group.append(heading);
      const list=el('div','ma-kana-path-steps');
      for(const row of groupRows){
        const item=button('',()=>{if(skill==='handwriting')navigate(L.practiceUrl(skill,row.chars));else{lesson={row,index:0};render();root.scrollTo({top:0,behavior:'instant'});}});
        item.className='ma-kana-path-step';item.disabled=!row.unlocked;item.dataset.current=String(row.id===next.id);item.dataset.row=row.id;
        item.setAttribute('aria-label',`${row.name} · ${row.complete?'Revisit lesson':row.unlocked?'Learn this row':'Locked'}`);
        if(row.id===next.id)item.setAttribute('aria-current','step');
        const marker=el('span','ma-kana-path-marker',row.complete?'✓':row.chars[0]);marker.setAttribute('aria-hidden','true');
        const copy=el('span');copy.append(el('strong','',row.name),el('small','ma-kana-path-characters',row.chars.join(' ')),el('small','',row.complete?'Revisit lesson':row.unlocked?`${row.ready} / ${row.chars.length} familiar`:'Locked'));
        item.append(marker,copy);list.append(item);
      }
      group.append(list);aside.append(group);
    }
    const all=button('Explore your path →',()=>chooseView('path'));all.className='ma-kana-text-action';all.setAttribute('aria-label','Explore your path');aside.append(all);
    return aside;
  }
  function workspace(stage){const frame=el('div','ma-kana-workspace');frame.append(stage,pathPreview());host.append(frame);}
  function learn(){
    title('Kana · Learn','Connect shapes and sounds');controls();
    const state=L.read(),evidence=L.snapshot(),next=nextRow(skill,script,state,evidence);
    const stages=L.rows.flatMap(row=>row.chars).map(char=>L.stage(char,state,evidence));
    const familiar=stages.filter(stage=>stage>=3).length,mastered=stages.filter(stage=>stage>=5).length;
    const stage=el('div','ma-kana-learning-stage'),current=el('section','ma-kana-next');current.dataset.skill=skill;
    current.append(el('span','ma-kicker',`${script==='hiragana'?'Hiragana':'Katakana'} · ${L.names[skill]}`));
    const introduced=next.chars.every(char=>state.introduced[char]),hasPractice=next.ready>0;
    current.append(el('h2','',`${introduced||hasPractice?'Keep building your':'Meet the'} ${next.name.replace(' row','-row')}`));
    const chars=el('div','ma-kana-lesson-tiles');chars.setAttribute('aria-label','Explore this row');chars.style.setProperty('--kana-tile-count',String(Math.min(5,next.chars.length)));
    next.chars.forEach((char,index)=>{
      const tile=button('',()=>{if(skill==='handwriting')navigate(L.practiceUrl(skill,[char]));else{lesson={row:next,index};render();}});tile.className='ma-kana-lesson-tile';
      tile.setAttribute('aria-label',`Learn ${char}, ${L.map[char]}`);const glyph=el('strong','',char);glyph.lang='ja';tile.append(glyph,el('span','',L.map[char]));chars.append(tile);
    });current.append(chars);
    current.append(el('p','ma-kana-muted',skill==='handwriting'?'Get to know each shape, one stroke at a time.':introduced||hasPractice?'Practise independently to make these connections familiar.':'Tap a character to meet its sound and shape. Then practise the row.'));
    const progress=el('progress','ma-kana-row-progress');progress.max=next.chars.length;progress.value=next.ready;progress.setAttribute('aria-label',next.name+' familiarity');
    current.append(progress,el('span','ma-kana-progress-caption',`${next.ready} of ${next.chars.length} familiar · the next row opens when all are ready`));
    const actions=el('div','ma-kana-feature-actions');
    actions.append(button('Continue learning',()=>{
      if(skill==='handwriting'||introduced||hasPractice)navigate(L.practiceUrl(skill,next.chars));
      else{lesson={row:next,index:Math.max(0,next.chars.findIndex(char=>!state.introduced[char]))};render();}
    },true));current.insertBefore(actions,chars.nextSibling);stage.append(current);
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
    const saved=Store.readModeJSON(skill,'settings',{}),next=nextRow();
    const previous=saved.kanaSelection&&Object.keys(L.selection(saved,skill)).length?saved:{};
    practiceSettings={practiceCount:20,feedbackStyle:'learn',hint:false,srs:true,endless:false,speedRun:false,timeTrial:false,dailyChallenge:false,testMode:false,comboKana:false,focusWeak:false,confusableKana:false,...previous,kanaRows:previous.kanaRows||[next.id],kanaSelection:true};
    if(practiceSettings.testMode&&!L.testScripts(skill).includes(practiceSettings.kanaTestScript))practiceSettings=root.ModeAtlasKanaPractice.forFamily(practiceSettings,'practice',skill);
    return practiceSettings;
  }
  function openSession(){
    const settings=settingsForPractice(),pool=settings.testMode?L.testPool(settings,skill):L.selection(settings,skill);
    if(!Object.keys(pool).length)throw new Error('Choose at least one available row.');
    if(!Store.writeModeJSON(skill,'settings',settings))throw new Error('Your session settings could not be saved. Please try again.');
    root.KanaCloudSync?.markSectionUpdated?.(skill);navigate('/'+(skill==='writing'?'writing':'reading')+'/');
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
    title('Kana · Practice','Build the reflex.');
    host.append(segmented('Kana skill',L.skills.map(id=>[id,L.names[id]]),skill,value=>{skill=value;practiceSettings=null;url();render();}));
    const explanation={reading:'See あ, type “a”. Connect each shape with its sound.',writing:'See “a”, choose or type あ. Bring the shape to mind.',handwriting:'Trace the strokes, then try writing from memory.'};
    host.append(el('p','ma-kana-skill-explanation',explanation[skill]));
    const stage=el('div','ma-kana-practice-stage');
    const card=el('section','ma-kana-next ma-kana-session');card.dataset.skill=skill;
    if(skill==='handwriting'){
      const row=nextRow();card.append(el('span','ma-kicker',script==='hiragana'?'Hiragana':'Katakana'),el('h2','','Make the shapes your own'),el('p','ma-kana-next-chars',row.chars.join(' ')),el('p','ma-kana-muted','Take your time. Handwriting is an optional part of your journey.'));
      card.append(link('Open handwriting',L.practiceUrl(skill,row.chars),true));stage.append(card,button('Choose a different row',()=>chooseView('path')));workspace(stage);return;
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
      const tool=activity(label,copy,mark,()=>{practiceSettings=root.ModeAtlasKanaPractice.forFamily(settings,id,skill);render();root.scrollTo({top:0,behavior:'instant'});});tool.setAttribute('aria-pressed',String(id===family));activities.append(tool);
    }stage.append(activities);workspace(stage);
  }
  function tests(){
    if(skill==='handwriting')skill='reading';title('Kana','Put your skills to the test','Complete a full script assessment, then explore its results.');
    host.append(segmented('Test skill',[['reading','Read'],['writing','Recall']],skill,value=>{skill=value;render();}));
    const eligible=L.testScripts(skill);
    for(const id of L.scripts){const name=id==='hiragana'?'Hiragana':'Katakana',row=el('section','ma-kana-test-row');row.append(el('h2','',name));
      if(eligible.includes(id))row.append(el('p','','One pass through all basic characters.'),link('Start '+name+' test','/'+(skill==='writing'?'writing':'reading')+'/?mode=test&script='+id,true));
      else row.append(el('p','ma-kana-muted','Unlock every basic row in '+L.names[skill]+' to open this test.'),button('Open learning path',()=>{script=id;chooseView('learn');}));host.append(row);
    }
    host.append(link('View test results','/results/'));
  }
  function mastery(){title('Kana','Your mastery map');host.append(root.ModeAtlasKanaMastery.render((char,detail)=>{
    const scroll=root.scrollY;host.replaceChildren(button('Back to mastery map',()=>{render();requestAnimationFrame(()=>{root.scrollTo({top:scroll,behavior:'instant'});host.querySelector(`[data-ma-mastery-kana="${char}"]`)?.focus({preventScroll:true});});}),detail);root.scrollTo({top:0,behavior:'instant'});
  }));}
  function render(){
    placementKeyboard?.destroy();placementKeyboard=null;
    const rowOpen=host.querySelector('.ma-kana-row-picker')?.open,focus=host.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
    host.replaceChildren();const state=L.read();
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
  function refresh(){if(lesson||placement||placementSetup||customizing||refreshQueued)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;run(()=>{L.initialize();render();});});}
  root.addEventListener('modeAtlasCloudDataChanged',refresh);root.addEventListener('modeAtlasKanaLearningChanged',refresh);
  root.addEventListener('modeAtlasAccountWillChange',()=>{placementKeyboard?.destroy();placementKeyboard=null;lesson=null;placement=null;placementSetup=false;practiceSettings=null;});
  document.addEventListener('ma:ui-refresh',refresh);
  run(()=>{L.initialize();render();});
})(window);
