/* Kanji page composition. Content, grading, persistence and session timing have
   dedicated owners; this module renders the current view and handles input. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanjiContent');if(!host)return;
  const state=root.ModeAtlasKanjiState,content=root.ModeAtlasKanjiContent,session=root.ModeAtlasKanjiSession;
  let level=state.read().settings.level,mode='learn',count=5,focus='all',test=false,composing=false;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const button=(label,action,cls='ma-button ma-button--ghost')=>{const node=el('button',cls,label);node.type='button';node.addEventListener('click',action);return node;};
  const link=(label,href)=>{const node=el('a','ma-button ma-button--ghost',label);node.href=href;return node;};
  const names={learn:'Learn',pronunciation:'Pronunciation',meaning:'Meaning',match:'Meaning Match'};
  const modes=Object.keys(names);
  const placement=root.ModeAtlasKanjiPlacement;let assessment=placement.read(),keyboard=null;
  function report(error){root.ModeAtlasDialog.alert({title:'Couldn’t continue',message:error.message||String(error)});}
  function safely(action){try{action();}catch(error){report(error);}}
  function heading(text){const h=el('h2','',text);h.tabIndex=-1;return h;}
  function select(label,options,value,change){
    const wrap=el('label','ma-kanji-select'),input=el('select');wrap.append(el('span','',label),input);
    for(const [key,text]of options){const option=el('option','',text);option.value=key;input.append(option);}input.value=value;
    input.addEventListener('change',()=>change(input.value));return wrap;
  }
  function entry(){
    host.replaceChildren(heading('Where would you like to begin?'));
    const readiness=root.ModeAtlasLearningExperience?.readiness?.().kanji;
    if(readiness&&!readiness.recommended){
      const guidance=el('aside','ma-kanji-entry-guidance');guidance.append(el('p','','Kanji feels easier once a few Hiragana rows are familiar.'),link('Build my Kana foundation','/kana/'));host.append(guidance);
    }
    const actions=el('div','ma-kanji-actions');
    actions.append(button('Start as a beginner',()=>{state.enter('beginner');showCourse();},'ma-button ma-button--primary'),
      button('Check my starting point',()=>{assessment=placement.begin();showAssessment();}),
      button('I’m confident in Kanji',async()=>{if(await root.ModeAtlasDialog.confirm({title:'Open every Kanji band?',message:'Get access to all N5–N1 lessons and practice.',confirmLabel:'Open all bands'})){state.enter('confident',[5,4,3,2,1]);showCourse();}}));host.append(actions);
  }
  function showAssessment(){
    keyboard?.destroy();keyboard=null;
    if(!assessment||assessment.done){assessment=null;root.ModeAtlasStorage.remove(placement.KEY);showCourse();return;}
    const q=placement.question(assessment),entry=content.get(q.char),reading=content.pronunciation(entry);
    host.replaceChildren(heading('Find your starting point'),el('p','ma-kicker',`N${assessment.band} · ${assessment.index+1} of 8`));
    const glyph=el('div','ma-kanji-glyph',q.skill==='pronunciation'?reading.prompt:q.char);glyph.lang='ja';host.append(glyph);
    if(assessment.feedback){host.append(el('p','',assessment.feedback.correct?'Correct':q.skill==='pronunciation'?reading.answers.join(' · '):entry.meanings.join(' · ')),button('Continue',()=>{assessment=placement.next(assessment);showAssessment();},'ma-button ma-button--primary'));}
    else{
      const form=el('form','ma-kanji-answer'),input=el('input','ma-input');input.setAttribute('aria-label',q.skill==='pronunciation'?'Kana or romaji answer':'English meaning');input.placeholder=q.skill==='pronunciation'?'Kana or romaji':'English meaning';input.autocomplete='off';input.autocapitalize='off';input.spellcheck=false;
      const submit=el('button','ma-button ma-button--primary','Check answer');submit.type='submit';form.append(input,submit);
      if(root.ModeAtlasIOSKeyboard){const keys=el('div','ma-kana-placement-keyboard');form.append(keys);keyboard=root.ModeAtlasIOSKeyboard.mount({input,container:keys,onSubmit:()=>form.requestSubmit()});}
      let composing=false;input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>composing=false);
      form.addEventListener('submit',event=>{event.preventDefault();if(composing||!input.value.trim())return;assessment=placement.answer(assessment,input.value);showAssessment();});
      host.append(form,button('I don’t know yet',()=>{assessment=placement.answer(assessment,'');showAssessment();}));input.focus({preventScroll:true});
    }
    host.append(button('Finish here',()=>{assessment=placement.finish(assessment);showAssessment();},'ma-kanji-text-button'));
  }
  function showCourse(){
    const unfinished=session.current();
    if(unfinished?.mode==='learn'&&!unfinished.finished)root.ModeAtlasLearningEvents?.emit('lessonExited','kanji');
    keyboard?.destroy();keyboard=null;
    if(assessment&&!assessment.done){showAssessment();return;}
    if(!state.entered()){entry();return;}
    if(!state.allowed(level))level=5;
    const current=state.read(),bands=state.summary(current),band=bands.find(b=>b.level===level),plan=state.learningPath(level,current);
    root.ModeAtlasPronunciation.stop();host.closest('main').removeAttribute('data-session');host.replaceChildren();
    const path=el('div','ma-kanji-path');path.setAttribute('role','group');path.setAttribute('aria-label','Kanji levels');
    for(const item of bands){
      const b=button('',()=>{level=item.level;state.settings({level});showCourse();},'ma-kanji-level');
      b.disabled=!item.unlocked;b.setAttribute('aria-pressed',String(item.level===level));b.setAttribute('aria-label',`N${item.level} ${item.name}${item.unlocked?'':', locked'}`);
      b.append(el('strong','',`N${item.level}`),el('span','ma-kanji-level__name',item.name),el('small','ma-kanji-level__status',item.unlocked?`${item.complete} / ${item.total}`:'Locked'));
      path.append(b);
    }
    const summary=el('div','ma-kanji-course-summary'),summaryCopy=el('div');summaryCopy.append(el('strong','',`N${level} · ${band.name}`),el('p','',`${band.complete} of ${band.total} complete · ${band.mastered} mastered`));
    summary.append(summaryCopy);
    host.append(path,summary);
    let firstTen=null;
    if(level===5&&!state.introReady(current)){
      const intro=el('section','ma-kanji-first-ten');intro.append(heading('Your first ten'));
      const list=el('ol');for(const char of state.introductory){const item=el('li','',char);item.lang='ja';item.dataset.learned=String(state.introduced(current,char));item.setAttribute('aria-label',char+(state.introduced(current,char)?', learned':', to learn'));list.append(item);}
      intro.append(list,el('p','ma-kanji-caption',`${state.introductory.filter(c=>state.introduced(current,c)).length} / 10 introduced`));firstTen=intro;
    }
    const old=session.saved();
    if(old){const resume=el('div','ma-kanji-resume');resume.append(el('p','',`${old.test?'Test':names[old.mode]} · ${old.index} of ${old.sequence.length}`),button('Resume',()=>safely(()=>{session.resume();showSession();}),'ma-button ma-button--primary'),button('Discard',()=>{session.discard();showCourse();}));host.append(resume);}
    const layout=el('div','ma-kanji-course-layout'),intro=el('section','ma-kanji-intro');
    const symbol=el('img','ma-kanji-intro__art');symbol.src='/assets/illustrations/kanji-scene.svg';symbol.alt='';symbol.width=480;symbol.height=300;
    const lessonCopy=el('div','ma-kanji-intro__copy');lessonCopy.append(el('p','ma-kicker','Your next step'),heading(plan.title),el('p','',plan.copy));intro.append(lessonCopy,symbol);
    intro.append(button(plan.label,()=>startPlanned(plan),'ma-button ma-button--primary'));
    const steps=el('ol','ma-kanji-learning-path');steps.setAttribute('aria-label','Kanji learning path');
    for(const [id,label]of [['learn','Meet'],['recall','Recall'],['review','Review & test']]){const item=el('li','',label);if(id===plan.step||id==='review'&&plan.step==='complete')item.setAttribute('aria-current','step');steps.append(item);}intro.append(steps);
    if(plan.mode!=='learn')intro.append(button('Start learning',()=>start('learn',false)));
    if(plan.known)intro.append(el('p','ma-kanji-pool-summary',`${plan.known} characters in your practice pool · ${plan.recalled} recalled in both skills`));
    const options=el('div','ma-kanji-options');
    options.append(select('Set length',[[5,'5 characters'],[10,'10 characters'],[20,'20 characters'],[40,'40 characters']],count,v=>count=Number(v)));
    options.append(select('Focus',[['all','All kanji'],['new','New lessons'],['due','Due reviews']],focus,v=>focus=v));
    const customize=el('details','ma-kanji-customize');customize.append(el('summary','','Choose set options'),options);intro.append(customize);
    const known=state.studyPool(level,current).filter(c=>state.access(current,c)||current.lessons[c]||state.introduced(current,c)||state.skills.some(skill=>state.metrics(current,c,skill).attempts));
    const practice=el('section','ma-kanji-practice'),tools=el('div','ma-kanji-tools');practice.append(heading('Put it into practice'));
    for(const [id,title,copy]of [['pronunciation','Recall · Pronunciation','Type the word in kana. Romaji input converts to kana.'],['meaning','Recall · Meaning','Type an English meaning for the character.'],['match','Meaning Match','Choose the English meaning that fits.']]){
      if(!known.length)continue;
      const row=button('',()=>start(id,false),'ma-kanji-mode');row.disabled=!known.length;row.append(el('span','ma-kanji-mode__mark',id==='pronunciation'?'あ':id==='meaning'?'Aa':'✓'));
      const text=el('span');text.append(el('strong','',title),el('span','',copy));row.append(text,el('span','','›'));tools.append(row);
    }
    practice.append(tools);
    const testPanel=el('div','ma-kanji-tests');testPanel.append(el('h3','','Take a test'),el('p','',plan.testReady?`${Math.min(20,known.length)} familiar characters. Check recall without hints.`:'First, recall meanings and readings for five characters.'));
    const actions=el('div','ma-kanji-actions');actions.append(button('Pronunciation',()=>start('pronunciation',true)),button('Meaning',()=>start('meaning',true)),button('Meaning Match',()=>start('match',true)));for(const b of actions.children)b.disabled=!known.length;testPanel.append(actions);if(known.length>=5&&(plan.testReady||current.entry.mode!=='beginner'))practice.append(testPanel);
    const teaching=el('div','ma-kanji-teaching');teaching.append(intro);layout.append(teaching);
    if(known.length){if(firstTen)teaching.append(firstTen);layout.append(practice);}
    else if(firstTen)layout.append(firstTen);
    host.append(layout);
    const actionsBottom=el('div','ma-kanji-actions');actionsBottom.append(button('Mastery Map',()=>root.ModeAtlasFeatures.openMasteryMap('kanji')),link('View results','/results/kanji/'));host.append(actionsBottom);
    host.append(button('Check my starting point',()=>{assessment=placement.begin();showAssessment();},'ma-kanji-text-button'));
    const credits=el('a','ma-kanji-sources','Learning sources');credits.href='/kanji/sources/';host.append(credits);
  }
  function startPlanned(plan){
    if(plan.nextLevel){level=plan.nextLevel;state.settings({level});showCourse();return;}
    safely(()=>{session.start({mode:plan.mode,level,count:plan.step==='review'?10:5,focus:plan.focus||'all',chars:plan.chars});showSession();});
  }
  function start(nextMode,formal){
    safely(()=>{mode=nextMode;test=formal;session.start({mode,level,count:formal?20:count,focus:formal?'all':focus,test:formal});showSession();});
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
  let authorizing=null;
  async function showSession(){
    const candidate=session.current();
    if(candidate&&candidate.mode!=='learn'&&!candidate.authorizationAttempted){
      if(authorizing===candidate)return;
      authorizing=candidate;host.replaceChildren(el('p','','Preparing your practice…'));
      try{await session.authorize();}catch(error){report(error);}finally{candidate.authorizationAttempted=true;authorizing=null;}
      if(session.current()!==candidate)return;
    }
    const current=session.current();if(!current){showCourse();return;}
    root.ModeAtlasPronunciation.stop();host.closest('main').dataset.session=current.mode;host.replaceChildren();
    if(current.finished){showRecap(current);return;}
    const top=el('div','ma-kanji-session-bar'),title=el('span','',`${current.test?'Test · ':''}${names[current.mode]} · N${current.level}`);
    top.append(title,el('span','',`${current.index+1} / ${current.sequence.length}`),button(current.paused?'Resume':'Pause',()=>safely(()=>{current.paused?session.play():session.pause();showSession();})));
    host.append(top);
    if(current.paused){const panel=el('section','ma-kanji-paused');panel.append(heading('Take your time'),el('p','','Your place is saved.'),button('Continue',()=>safely(()=>{session.play();showSession();}),'ma-button ma-button--primary'),button('Back to Kanji',showCourse));host.append(panel);return;}
    const entry=content.get(current.sequence[current.index]);
    host.append(current.mode==='learn'?root.ModeAtlasKanjiLesson.mount(current,showSession,report):question(entry,current));
    if(current.mode!=='learn'&&current.feedback){
      const next=button(current.index+1===current.sequence.length?'Finish set':'Continue',()=>safely(()=>{session.next();showSession();}),'ma-button ma-button--primary ma-kanji-continue');host.append(next);next.focus({preventScroll:true});
    }else if(!root.AtlasPlatform?.isNative)host.querySelector('input')?.focus({preventScroll:true});
  }
  function showRecap(current){
    if(!current.funnelComplete){current.funnelComplete=true;root.ModeAtlasLearningEvents?.emit(current.mode==='learn'?'lessonCompleted':'practiceCompleted','kanji');if(current.focus==='due')root.ModeAtlasLearningEvents?.emit('reviewCompleted','kanji');}
    const correct=current.answers.filter(x=>x.correct).length,section=el('section','ma-kanji-recap');
    section.append(heading(current.mode==='learn'?'Ready to remember':'Set complete'));
    section.append(el('p','ma-kanji-recap-score',current.mode==='learn'?`${current.sequence.length} kanji introduced`:`${correct} / ${current.answers.length} correct`));
    if(current.mode!=='learn')section.append(el('p','',`${Math.round(correct/Math.max(1,current.answers.length)*100)}% accuracy`));
    if(current.mode!=='learn')section.append(el('p','ma-kicker',names[current.mode]));
    root.ModeAtlasProgressUI.renderSessionReward(section,{...current,xpGain:current.xp});
    void root.ModeAtlasProgressUI.completeSession(current);
    const actions=el('div','ma-kanji-actions');
    if(current.mode==='learn')section.append(el('p','ma-kanji-next-step','Next: remember these meanings without choices.'));
    else if(current.mode==='meaning'&&!current.test)section.append(el('p','ma-kanji-next-step','Next: connect these characters with their spoken readings.'));
    actions.append(button('Back to Kanji',()=>{session.discard();showCourse();}));
    if(current.mode==='learn'){
      actions.append(button('Recall readings',()=>{session.start({mode:'pronunciation',level:current.level,count:current.sequence.length,chars:current.sequence});showSession();}),button('Recall meanings',()=>{session.start({mode:'meaning',level:current.level,count:current.sequence.length,chars:current.sequence});showSession();},'ma-button ma-button--primary'));
    }
    if(current.mode==='meaning'&&!current.test)actions.prepend(button('Recall these readings',()=>{session.start({mode:'pronunciation',level:current.level,count:current.sequence.length,chars:current.sequence});showSession();},'ma-button ma-button--primary'));
    if(current.test)actions.append(link('View results','/results/kanji/'));
    const missed=current.answers.filter(a=>!a.correct).map(a=>a.char);
    if(current.mode!=='learn')section.append(root.ModeAtlasSessionOutcome.render({skill:names[current.mode],missed,due:root.ModeAtlasSessionOutcome.kanjiDates(current.sequence,current.mode)}));
    if(missed.length&&current.mode!=='learn')actions.prepend(button('Retry missed characters',()=>{session.start({mode:current.mode==='match'?'meaning':current.mode,level:current.level,count:missed.length,chars:missed});showSession();},'ma-button ma-button--primary'));
    if(missed.length)actions.append(button('Revisit mistakes',()=>{session.start({mode:'learn',level:current.level,count:missed.length,chars:missed});showSession();}));
    section.append(actions);host.append(section);
  }
  root.addEventListener('modeAtlasKanjiPaused',()=>{if(session.current())showSession();});
  root.addEventListener('modeAtlasAccountWillChange',()=>{keyboard?.destroy();assessment=null;return host.replaceChildren(el('p','','Updating your learning space…'));});
  root.addEventListener('modeAtlasCloudDataChanged',()=>{if(!session.current())showCourse();});
  async function boot(){
    try{await content.load();showCourse();const params=new URLSearchParams(location.search);const requested=Number(params.get('level'));if([1,2,3,4,5].includes(requested)&&state.allowed(requested))level=requested;
      if(params.has('resume')&&session.saved()){session.resume();showSession();}
      else if(params.has('learn')){session.start({mode:'learn',level,count:5});showSession();}
      else if(params.has('test')&&['pronunciation','meaning','match'].includes(params.get('test'))){session.start({mode:params.get('test'),level,test:true,count:20});showSession();}
      else if(['pronunciation','meaning'].includes(params.get('practice'))){session.start({mode:params.get('practice'),level,focus:params.get('focus')==='due'?'due':'all',count:10});showSession();}
      else if(params.has('chars')){const chars=[...params.get('chars')].filter(c=>state.levels.get(c)===level);if(chars.length){session.start({mode:'learn',level,chars,count:40});showSession();}}
      else if(params.has('char')&&state.levels.has(params.get('char'))){const char=params.get('char');level=state.levels.get(char);session.start({mode:modes.includes(params.get('mode'))?params.get('mode'):'learn',level,chars:[char],count:5});showSession();}
      else showCourse();
    }catch(error){host.replaceChildren(el('p','',error.message),button('Back to Kanji',showCourse),button('Retry',boot));}
  }
  void boot();
})(window);
