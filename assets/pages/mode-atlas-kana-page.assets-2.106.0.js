/* Kana branch navigation and learning path. Curriculum, assessments, practice
   configuration and mastery each have a shared owner outside this page. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanaLearning');if(!host)return;
  const L=root.ModeAtlasKanaLearning,P=root.ModeAtlasKanaPlacement,Store=root.ModeAtlasStorage;
  const params=new URLSearchParams(location.search);
  let view=['learn','practice','mastery','tests'].includes(params.get('view'))?params.get('view'):'learn';
  let script=L.scripts.includes(params.get('script'))?params.get('script'):'hiragana',skill=L.skills.includes(params.get('skill'))?params.get('skill'):'reading';
  let lesson=null,placement=null,placementSetup=false,practiceSettings=null;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function run(action){try{action();}catch(error){root.ModeAtlasToast?.show?.(error.message);const status=host.querySelector('[role=status]')||el('p','ma-status ma-status--error');status.setAttribute('role','status');status.textContent=error.message;if(!status.parentNode)host.append(status);}}
  function button(label,action,primary=false){const b=el('button','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);b.type='button';b.addEventListener('click',()=>run(action));return b;}
  function link(label,href,primary=false){const a=el('a','ma-button '+(primary?'ma-button--primary':'ma-button--ghost'),label);a.href=href;return a;}
  function navigate(href){root.ModeAtlasVersionFile?.navigate?root.ModeAtlasVersionFile.navigate(href):location.assign(href);}
  function segmented(label,items,value,onChange){const group=el('div','ma-kana-segments');group.setAttribute('role','group');group.setAttribute('aria-label',label);for(const [id,text]of items){const b=button(text,()=>onChange(id));b.setAttribute('aria-pressed',String(id===value));group.append(b);}return group;}
  function title(kicker,heading,copy){const h=el('header','ma-kana-page-heading');h.append(el('span','ma-kicker',kicker),el('h1','',heading));if(copy)h.append(el('p','ma-kana-muted',copy));host.append(h);}
  function url(){const q=new URLSearchParams({view,script,skill});history.replaceState(null,'','/kana/?'+q);}
  function chooseView(next){view=next;lesson=null;placement=null;placementSetup=false;practiceSettings=null;url();render();}
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
    const stage=el('section','ma-kana-check');stage.setAttribute('aria-label','Placement question');
    const prompt=el('div','ma-kana-check-prompt',q.skill==='reading'?q.char:q.roman);prompt.lang=q.skill==='reading'?'ja':'en';stage.append(prompt);
    if(placement.feedback){
      stage.append(el('p','ma-kana-check-feedback',placement.feedback.correct?'Correct':`${q.char} is ${q.roman}. We’ll start this skill around here.`));
      stage.append(button('Continue',()=>{placement=Store.transaction(()=>P.advance(placement));render();},true));
    }else if(q.skill==='reading'){
      const form=el('form'),input=el('input','ma-input');input.setAttribute('aria-label','Reading answer');input.autocomplete='off';input.spellcheck=false;input.autocapitalize='none';input.maxLength=20;
      const submit=el('button','ma-button ma-button--primary','Check answer');submit.type='submit';form.append(input,submit);
      form.addEventListener('submit',event=>{event.preventDefault();if(input.value.trim())run(()=>{placement=Store.transaction(()=>P.answer(placement,input.value));render();});});stage.append(form);
      // Keep the system keyboard a deliberate tap on phones.
      if(!root.AtlasPlatform?.isNative)requestAnimationFrame(()=>input.focus({preventScroll:true}));
    }else{
      const choices=el('div','ma-kana-placement-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Kana answers');
      for(const char of P.choices(placement))choices.append(button(char,()=>{placement=Store.transaction(()=>P.answer(placement,char));render();}));stage.append(choices);
    }
    if(!placement.feedback)stage.append(button('I don’t know yet',()=>{placement=Store.transaction(()=>P.answer(placement,''));render();}));
    host.append(stage,button('Finish with my progress so far',()=>{placement=Store.transaction(()=>P.finish(placement));render();}));
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
    },true));panel.append(actions);host.append(panel,button('Back to my path',()=>{lesson=null;render();}));
  }
  function controls(includeHand=true){
    host.append(segmented('Kana script',[['hiragana','Hiragana'],['katakana','Katakana']],script,value=>{script=value;practiceSettings=null;url();render();}));
    host.append(segmented('Kana skill',(includeHand?L.skills:['reading','writing']).map(id=>[id,L.names[id]]),skill,value=>{skill=value;practiceSettings=null;url();render();}));
  }
  function learn(){
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
  function settingsForPractice(){
    if(practiceSettings)return practiceSettings;
    const saved=Store.readModeJSON(skill,'settings',{}),path=L.path(script,skill),next=path.find(r=>r.unlocked&&!r.complete)||path[0];
    return practiceSettings={...saved,kanaRows:[next.id],kanaSelection:true,practiceCount:20,feedbackStyle:'learn',hint:false,srs:true,endless:false,speedRun:false,timeTrial:false,dailyChallenge:false,testMode:false,comboKana:false,focusWeak:false,confusableKana:false};
  }
  function practise(){
    title('Kana','Make time to practise','Choose a session using the rows you have unlocked.');controls();
    if(skill==='handwriting'){host.append(link('Open handwriting practice',L.practiceUrl(skill),true));return;}
    const settings=settingsForPractice();
    host.append(root.ModeAtlasKanaPractice.render({skill,getSettings:()=>settings,onChange:next=>{practiceSettings=next;render();}}));
    if(settings.timeTrial){
      const inputs=el('div','ma-kana-actions');for(const [key,label,min,max,step]of [['trialMinutes','Minutes',.1,60,.1],['trialTarget','Correct-answer target',1,1000,1]]){
        const wrap=el('label','ma-kana-field',label),input=el('input','ma-input');input.type='number';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(settings[key]|| (key==='trialMinutes'?1:20));input.addEventListener('change',()=>settings[key]=Math.max(min,Math.min(max,Number(input.value)||min)));wrap.append(input);inputs.append(wrap);
      }host.append(inputs);
    }
    const start=button('Open session',()=>{
      if(!Object.keys(L.selection(settings,skill)).length)throw new Error('Choose at least one unlocked row.');
      if(!Store.writeModeJSON(skill,'settings',settings))throw new Error('Your session settings could not be saved. Please try again.');root.KanaCloudSync?.markSectionUpdated?.(skill);
      navigate('/'+(skill==='writing'?'writing':'reading')+'/');
    },true);host.append(start);
    const due=root.ModeAtlasReview.due(L.snapshot()[skill+'Review']).filter(c=>L.available(skill).has(c));
    if(due.length)host.append(link(`Review ready kana (${due.length})`,L.practiceUrl(skill,due,{hints:'off'})));
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
  function mastery(){title('Kana','Your mastery map');host.append(root.ModeAtlasKanaMastery.render((char,detail)=>{host.replaceChildren(button('Back to mastery map',render),detail);}));}
  function render(){
    const rowOpen=host.querySelector('.ma-kana-row-picker')?.open,focus=host.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
    host.replaceChildren();const state=L.read();
    document.querySelectorAll('.ma-kana-navigation a').forEach(a=>{const active=(new URL(a.href).searchParams.get('view')||'learn')===view;a.toggleAttribute('aria-current',active);if(active)a.setAttribute('aria-current','page');});
    if(lesson||placement||placementSetup)root.scrollTo({top:0,behavior:'instant'});
    if(placementSetup){assessSetup();return;}if(placement){renderPlacement();return;}if(lesson){renderLesson();return;}
    if(!state.startedAt){welcome();return;}
    if(view==='practice')practise();else if(view==='mastery')mastery();else if(view==='tests')tests();else learn();
    if(rowOpen&&host.querySelector('.ma-kana-row-picker'))host.querySelector('.ma-kana-row-picker').open=true;
    if(focus)[...host.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focus)?.focus({preventScroll:true});
  }
  let refreshQueued=false;
  function refresh(){if(lesson||placement||placementSetup||refreshQueued)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;run(()=>{L.initialize();render();});});}
  root.addEventListener('modeAtlasCloudDataChanged',refresh);root.addEventListener('modeAtlasKanaLearningChanged',refresh);
  root.addEventListener('modeAtlasAccountWillChange',()=>{lesson=null;placement=null;placementSetup=false;practiceSettings=null;});
  document.addEventListener('ma:ui-refresh',refresh);
  run(()=>{L.initialize();render();});
})(window);
