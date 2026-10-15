/* Kanji page composition. Content, grading, persistence and session timing have
   dedicated owners; this module renders the current view and handles input. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanjiContent');if(!host)return;
  const state=root.ModeAtlasKanjiState,content=root.ModeAtlasKanjiContent,session=root.ModeAtlasKanjiSession;
  let level=state.read().settings.level,mode='learn',count=10,focus='all',test=false,composing=false;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const button=(label,action,cls='ma-button ma-button--ghost')=>{const node=el('button',cls,label);node.type='button';node.addEventListener('click',action);return node;};
  const link=(label,href)=>{const node=el('a','ma-button ma-button--ghost',label);node.href=href;return node;};
  const names={learn:'Learn',pronunciation:'Pronunciation',meaning:'Meaning',match:'Meaning Match'};
  const modes=Object.keys(names);
  function report(error){root.ModeAtlasDialog.alert({title:'Couldn’t continue',message:error.message||String(error)});}
  function safely(action){try{action();}catch(error){report(error);}}
  function heading(text){const h=el('h2','',text);h.tabIndex=-1;return h;}
  function help(){root.ModeAtlasDialog.alert({title:'Your Kanji path',message:'Complete each character with 3 correct answers without hints in both Pronunciation and typed Meaning, at 80% accuracy or better. Completing every character opens the next level permanently. Meaning Match helps you practise; typed recall demonstrates completion. Mastery grows through spaced recall across days. N5–N1 are approximate study bands.',confirmLabel:'Got it'});}
  function select(label,options,value,change){
    const wrap=el('label','ma-kanji-select'),input=el('select');wrap.append(el('span','',label),input);
    for(const [key,text]of options){const option=el('option','',text);option.value=key;input.append(option);}input.value=value;
    input.addEventListener('change',()=>change(input.value));return wrap;
  }
  function showCourse(){
    if(!state.allowed(level))level=5;
    const current=state.read(),bands=state.summary(current),band=bands.find(b=>b.level===level);
    host.replaceChildren();
    const path=el('div','ma-kanji-path');path.setAttribute('role','group');path.setAttribute('aria-label','Kanji levels');
    for(const item of bands){
      const b=button('',()=>{level=item.level;state.settings({level});showCourse();},'ma-kanji-level');
      b.disabled=!item.unlocked;b.setAttribute('aria-pressed',String(item.level===level));b.setAttribute('aria-label',`N${item.level} ${item.name}${item.unlocked?'':', locked'}`);
      b.append(el('strong','',`N${item.level}`),el('span','',item.name),el('small','',item.unlocked?`${item.complete} / ${item.total}`:'Locked'));
      path.append(b);
    }
    const summary=el('div','ma-kanji-course-summary');summary.append(el('p','',`${band.complete} of ${band.total} complete · ${band.mastered} mastered`),button('How levels unlock',help,'ma-kanji-text-button'));
    host.append(path,summary);
    const old=session.saved();
    if(old){const resume=el('div','ma-kanji-resume');resume.append(el('p','',`${old.test?'Test':names[old.mode]} · ${old.index} of ${old.sequence.length}`),button('Resume',()=>safely(()=>{session.resume();showSession();}),'ma-button ma-button--primary'),button('Discard',()=>{session.discard();showCourse();}));host.append(resume);}
    const layout=el('div','ma-kanji-course-layout'),intro=el('section','ma-kanji-intro');
    const symbol=el('div','ma-kanji-intro__glyph','漢');symbol.lang='ja';symbol.setAttribute('aria-hidden','true');
    intro.append(symbol,heading('Meet your next kanji'),el('p','','Explore its meaning, learn its readings and recognise it in a real word.'));
    intro.append(button('Start learning',()=>start('learn',false),'ma-button ma-button--primary'));
    const options=el('div','ma-kanji-options');
    options.append(select('Set length',[[5,'5 characters'],[10,'10 characters'],[20,'20 characters'],[40,'40 characters']],count,v=>count=Number(v)));
    options.append(select('Focus',[['all','All kanji'],['new','Not taught yet'],['due','Due reviews']],focus,v=>focus=v));intro.append(options);
    const practice=el('section','ma-kanji-practice');practice.append(heading('Put it into practice'));
    for(const [id,title,copy]of [['pronunciation','Recall · Pronunciation','Type the word in kana. Romaji input converts to kana.'],['meaning','Recall · Meaning','Type an English meaning for the character.'],['match','Meaning Match','Choose the English meaning that fits.']]){
      const row=button('',()=>start(id,false),'ma-kanji-mode');row.append(el('span','ma-kanji-mode__mark',id==='pronunciation'?'あ':id==='meaning'?'Aa':'✓'));
      const text=el('span');text.append(el('strong','',title),el('span','',copy));row.append(text,el('span','','›'));practice.append(row);
    }
    const assessment=el('div','ma-kanji-tests');assessment.append(el('h3','','Take a test'),el('p','','20 questions, no hints. Your results are saved.'));
    const actions=el('div','ma-kanji-actions');actions.append(button('Pronunciation',()=>start('pronunciation',true)),button('Meaning',()=>start('meaning',true)),button('Meaning Match',()=>start('match',true)));assessment.append(actions);practice.append(assessment);
    layout.append(intro,practice);host.append(layout);
    const actionsBottom=el('div','ma-kanji-actions');actionsBottom.append(button('Mastery Map',()=>root.ModeAtlasFeatures.openMasteryMap('kanji')),link('View results','/results/kanji/'));host.append(actionsBottom);
    const credits=el('a','ma-kanji-sources','Learning sources');credits.href='/kanji/sources/';host.append(credits);
  }
  function start(nextMode,formal){
    safely(()=>{mode=nextMode;test=formal;session.start({mode,level,count:formal?20:count,focus:formal?'all':focus,test:formal});showSession();});
  }
  function readings(entry,roman){
    const list=el('dl','ma-kanji-readings');
    for(const [label,values]of [['On’yomi',entry.on],['Kun’yomi',entry.kun]]){
      if(!values.length)continue;const readings=values.map(v=>v.replace(/[.-]/g,''));list.append(el('dt','',label),el('dd','',readings.map(v=>roman?content.romaji(v):v).join(' · ')));
    }return list;
  }
  function learn(entry){
    const roman=state.read().settings.romaji,layout=el('div','ma-kanji-lesson');
    const glyph=el('div','ma-kanji-glyph',entry.char);glyph.lang='ja';
    const details=el('div','ma-kanji-lesson-copy');details.append(heading(entry.meanings[0]));
    if(entry.meanings.length>1){const more=el('details','ma-kanji-other-meanings');more.append(el('summary','','More meanings'),el('p','',entry.meanings.slice(1).join(' · ')));details.append(more);}
    const toggle=button(roman?'Show kana':'Show romaji',()=>{state.settings({romaji:!roman});showSession();},'ma-kanji-text-button');toggle.setAttribute('aria-pressed',String(roman));details.append(toggle,readings(entry,roman));
    details.append(button('About these readings',()=>root.ModeAtlasDialog.alert({title:'One character, several readings',message:'On’yomi are readings used in many compound words. Kun’yomi are readings used in Japanese words, often followed by kana. The word decides which reading fits. Pronunciation practice shows a real word, or asks explicitly for one on’yomi reading.',confirmLabel:'Got it'}),'ma-kanji-text-button'));
    const description=content.description(entry),jp=el('p','ma-kanji-description',roman?content.romaji(description.ja):description.ja);jp.lang=roman?'ja-Latn':'ja';details.append(jp,el('p','ma-kanji-description',description.en));
    if(entry.example){
      const example=el('div','ma-kanji-example');example.append(el('p','ma-kanji-eyebrow','In a word'),el('strong','',entry.example.word),el('span','',roman?content.romaji(entry.example.kana):entry.example.kana),el('p','',entry.example.meanings.join(' · ')));details.append(example);
    }
    details.append(el('p','ma-kanji-caption',`${entry.strokes} strokes · N${entry.level}`));layout.append(glyph,details);return layout;
  }
  function question(entry,current){
    const view=el('div','ma-kanji-question'),pronounced=content.pronunciation(entry);
    const prompt=current.mode==='pronunciation'?pronounced.prompt:entry.char;
    const caption=current.mode==='pronunciation'?(pronounced.kind==='on'?'Give one on’yomi reading in kana':'Write this word in kana'):current.mode==='meaning'?'Give one English meaning':'Which meaning fits?';
    view.append(heading(caption));const glyph=el('div','ma-kanji-glyph',prompt);glyph.lang='ja';view.append(glyph);
    if(current.mode==='pronunciation'&&pronounced.kind==='word'&&prompt!==entry.char)view.append(el('p','ma-kanji-caption',`Focus character: ${entry.char}`));
    const revealed=current.feedback||current.hinted;
    if(revealed){
      const accepted=current.mode==='pronunciation'?pronounced.answers:entry.meanings;
      const feedback=el('div','ma-kanji-feedback');feedback.dataset.result=current.feedback?(current.feedback.correct?'correct':'incorrect'):'hint';feedback.setAttribute('role','status');
      feedback.append(el('strong','',current.feedback?(current.feedback.correct?'Correct':'Keep this one in mind'):'A little help'),el('p','',accepted.join(' · ')));
      if(current.feedback&&!current.feedback.correct&&current.feedback.answer)feedback.append(el('small','',`Your answer: ${current.feedback.answer}`));
      if(current.mode==='pronunciation')feedback.append(el('small','',pronounced.gloss));view.append(feedback);
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
  function showSession(){
    const current=session.current();if(!current){showCourse();return;}
    host.replaceChildren();
    if(current.finished){showRecap(current);return;}
    const top=el('div','ma-kanji-session-bar'),title=el('span','',`${current.test?'Test · ':''}${names[current.mode]} · N${current.level}`);
    top.append(title,el('span','',`${current.index+1} / ${current.sequence.length}`),button(current.paused?'Resume':'Pause',()=>safely(()=>{current.paused?session.play():session.pause();showSession();})));
    host.append(top);
    if(current.paused){const panel=el('section','ma-kanji-paused');panel.append(heading('Take your time'),el('p','','Your place is saved.'),button('Continue',()=>safely(()=>{session.play();showSession();}),'ma-button ma-button--primary'),button('Back to Kanji',showCourse));host.append(panel);return;}
    const entry=content.get(current.sequence[current.index]);
    host.append(current.mode==='learn'?learn(entry):question(entry,current));
    if(current.mode==='learn'||current.feedback){
      const next=button(current.index+1===current.sequence.length?'Finish set':'Continue',()=>safely(()=>{session.next();showSession();}),'ma-button ma-button--primary ma-kanji-continue');host.append(next);next.focus({preventScroll:true});
    }else if(!root.AtlasPlatform?.isNative)host.querySelector('input')?.focus({preventScroll:true});
  }
  function showRecap(current){
    const correct=current.answers.filter(x=>x.correct).length,section=el('section','ma-kanji-recap');
    section.append(heading(current.mode==='learn'?'A few more familiar faces':'Set complete'));
    section.append(el('p','ma-kanji-recap-score',current.mode==='learn'?`${current.sequence.length} kanji explored`:`${correct} / ${current.answers.length} correct`));
    if(current.mode!=='learn')section.append(el('p','',`${Math.round(correct/current.answers.length*100)}% accuracy · +${current.xp} XP`));
    const actions=el('div','ma-kanji-actions');actions.append(button('Back to Kanji',()=>{session.discard();showCourse();},'ma-button ma-button--primary'));
    if(current.mode==='learn')actions.append(button('Try pronunciation',()=>{session.start({mode:'pronunciation',level:current.level,count:current.sequence.length,chars:current.sequence});showSession();}));
    if(current.test)actions.append(link('View results','/results/kanji/'));
    const missed=current.answers.filter(a=>!a.correct).map(a=>a.char);
    if(missed.length)actions.append(button('Revisit mistakes',()=>{session.start({mode:'learn',level:current.level,count:missed.length,chars:missed});showSession();}));
    section.append(actions);host.append(section);
  }
  root.addEventListener('modeAtlasKanjiPaused',()=>{if(session.current())showSession();});
  root.addEventListener('modeAtlasAccountWillChange',()=>host.replaceChildren(el('p','','Updating your learning space…')));
  root.addEventListener('modeAtlasCloudDataChanged',()=>{if(!session.current())showCourse();});
  async function boot(){
    try{await content.load();showCourse();const params=new URLSearchParams(location.search);const requested=Number(params.get('level'));if([1,2,3,4,5].includes(requested)&&state.allowed(requested))level=requested;
      if(params.has('test')&&['pronunciation','meaning','match'].includes(params.get('test'))){session.start({mode:params.get('test'),level,test:true,count:20});showSession();}
      else if(['pronunciation','meaning'].includes(params.get('practice'))){session.start({mode:params.get('practice'),level,focus:params.get('focus')==='due'?'due':'all',count:10});showSession();}
      else if(params.has('chars')){const chars=[...params.get('chars')].filter(c=>state.levels.get(c)===level);if(chars.length){session.start({mode:'learn',level,chars,count:40});showSession();}}
      else if(params.has('char')&&state.levels.has(params.get('char'))){const char=params.get('char');level=state.levels.get(char);session.start({mode:modes.includes(params.get('mode'))?params.get('mode'):'learn',level,chars:[char],count:5});showSession();}
      else showCourse();
    }catch(error){host.replaceChildren(el('p','',error.message),button('Retry',boot));}
  }
  void boot();
})(window);
