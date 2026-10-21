/* Shared session setup for the Kana branch and both trainer adapters. Families
   simplify navigation while feedback, timed goals and sequence practice retain
   their distinct behaviour and existing result formats. */
(function(root){
  'use strict';
  const L=root.ModeAtlasKanaLearning;
  function family(s){return s.testMode?'test':s.dailyChallenge?'daily':s.timeTrial||s.speedRun?'timed':s.comboKana?'sequence':'practice';}
  function forFamily(s,value,skill){
    const next={...s};for(const key of ['testMode','dailyChallenge','timeTrial','speedRun','comboKana','endless'])next[key]=false;
    next.focusWeak=false;next.confusableKana=false;
    if(value==='daily'){next.dailyChallenge=true;next.hint=false;next.practiceCount=0;}
    else if(value==='test'){next.testMode=true;next.hint=false;next.practiceCount=0;next.kanaTestScript=L.testScripts(skill)[0];}
    else if(value==='timed'){next.speedRun=true;next.practiceCount=0;}
    else if(value==='sequence'){next.comboKana=true;next.practiceCount=0;}
    else next.practiceCount=[10,20,30].includes(s.practiceCount)?s.practiceCount:20;
    return next;
  }
  function render({skill,getSettings,onChange,locked=false,targetFields=false}){
    const s=getSettings(),state=L.read(),evidence=L.snapshot(),host=document.createElement('div');host.className='ma-kana-practice-form';
    if(s.kanaDirection==='both')skill='both';
    const selectedFamily=family(s),eligible=L.testScripts(skill,state,evidence);
    const change=values=>{if(!locked)onChange({...getSettings(),...values});};
    function field(label,value,options,action){
      const wrap=document.createElement('label');wrap.className='ma-kana-field';const name=document.createElement('span');name.textContent=label;
      const select=document.createElement('select');select.className='ma-input';select.setAttribute('aria-label',label);select.disabled=locked;
      for(const [id,text,disabled]of options){if(label==='Session'&&s.kanaDirection==='both'&&['daily','test','sequence'].includes(id))continue;const o=document.createElement('option');o.value=id;o.textContent=text;o.disabled=!!disabled;select.append(o);}select.value=String(value);select.addEventListener('change',()=>action(select.value));wrap.append(name,select);host.append(wrap);return select;
    }
    function chooseFamily(value){
      change(forFamily(s,value,skill));
    }
    field('Session',selectedFamily,[['practice','Practice'],['daily','Daily session'],['timed','Timed challenge'],['sequence','Character sequences'],['test','Test',!eligible.length]],chooseFamily);
    if(selectedFamily==='practice'){
      field('Session length',s.practiceCount||0,[[10,'10 questions'],[20,'20 questions'],[30,'30 questions'],[0,'Keep going']],value=>{
        const count=Number(value);change({practiceCount:count,endless:!count&&s.feedbackStyle==='quick'});
      });
      field('Feedback',s.endless?'quick':s.feedbackStyle||'learn',[['learn','Explain errors'],['quick','Quick feedback']],value=>change({feedbackStyle:value,endless:!s.practiceCount&&value==='quick'}));
    }
    if(selectedFamily==='timed')field('Timed goal',s.timeTrial?'target':'score',[['score','60-second score attack'],['target','Reach a correct-answer target']],value=>change({timeTrial:value==='target',speedRun:value==='score'}));
    if(targetFields&&selectedFamily==='timed'&&s.timeTrial){
      for(const [key,label,min,max,step,fallback]of [['trialMinutes','Minutes',.1,60,.1,1],['trialTarget','Correct-answer target',1,1000,1,20]]){
        const wrap=document.createElement('label');wrap.className='ma-kana-field';wrap.textContent=label;
        const input=document.createElement('input');input.className='ma-input';input.type='number';input.setAttribute('aria-label',label);input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(s[key]||fallback);input.disabled=locked;
        input.addEventListener('change',()=>change({[key]:Math.max(min,Math.min(max,Number(input.value)||min))}));wrap.append(input);host.append(wrap);
      }
    }
    if(selectedFamily==='sequence')field('Sequence pattern',s.comboMode||'random',[['random','Mixed characters'],['same_row','Characters from one row']],value=>change({comboMode:value}));
    if(selectedFamily==='test'){
      field('Test script',eligible.includes(s.kanaTestScript)||s.kanaTestScript==='both'?s.kanaTestScript:eligible[0],[...eligible.map(id=>[id,id==='hiragana'?'Hiragana':'Katakana']),...(eligible.length===2?[['both','Both scripts']]:[])],value=>change({kanaTestScript:value}));
      field('Test coverage',s.kanaTestExtended?'extended':'base',[['base','Basic characters'],['extended','Include unlocked sound combinations']],value=>change({kanaTestExtended:value==='extended'}));
      return host;
    }
    const hints=field('Hints',s.hint?'on':'off',[['off','Off'],['on','On']],value=>change({hint:value==='on'}));hints.disabled=locked||selectedFamily==='daily';
    const confusableRows=L.rows.filter(row=>row.chars.some(char=>L.confusable.has(char)&&L.available(skill,state,evidence).has(char)));
    if(selectedFamily==='practice')field('Focus',s.confusableKana?'confusable':s.focusWeak?'weak':'balanced',[['balanced','Balanced'],['weak','Needs practice'],['confusable','Similar shapes',!confusableRows.length]],value=>change({focusWeak:value==='weak',confusableKana:value==='confusable',srs:true,...(value==='confusable'?{kanaRows:confusableRows.map(row=>row.id)}:{})}));
    const chooser=document.createElement('details');chooser.className='ma-kana-row-picker';const summary=document.createElement('summary');
    const paths=L.scripts.map(script=>L.path(script,skill,state,evidence)),available=new Set(paths.flat().filter(row=>row.unlocked).map(row=>row.id));
    const selected=new Set((Array.isArray(s.kanaRows)?s.kanaRows:L.rows.filter(row=>row.chars.some(c=>Object.hasOwn(root.ModeAtlasKanaData.selectedKanaMap(s),c))).map(row=>row.id)).filter(id=>available.has(id)));
    const count=Object.keys(L.selection(s,skill,state,evidence)).length;summary.textContent=`Study selection · ${count} kana`;chooser.append(summary);
    for(const rows of paths){
      const script=rows[0].script,name=script==='hiragana'?'Hiragana':'Katakana',unlocked=rows.filter(row=>row.unlocked),chosen=unlocked.filter(row=>selected.has(row.id));
      const header=document.createElement('div');header.className='ma-kana-row-picker-header';
      const heading=document.createElement('h4');heading.textContent=name;
      const all=document.createElement('label'),toggle=document.createElement('input'),caption=document.createElement('span');
      toggle.type='checkbox';toggle.setAttribute('aria-label','All unlocked '+name);toggle.checked=!!unlocked.length&&chosen.length===unlocked.length;toggle.indeterminate=!!chosen.length&&chosen.length<unlocked.length;toggle.disabled=locked||!unlocked.length;
      toggle.addEventListener('change',()=>{const ids=new Set(selected);for(const row of unlocked){if(toggle.checked)ids.add(row.id);else ids.delete(row.id);}change({kanaRows:[...ids],kanaSelection:true});});
      caption.textContent='All unlocked';all.append(toggle,caption);header.append(heading,all);chooser.append(header);
      const grid=document.createElement('div');grid.className='ma-kana-row-picker-grid';
      for(const row of unlocked){
        const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',script+' '+row.groupName+' '+row.name);input.checked=row.unlocked&&selected.has(row.id);input.disabled=locked||!row.unlocked;
        input.addEventListener('change',()=>{const ids=new Set(selected);if(input.checked)ids.add(row.id);else ids.delete(row.id);change({kanaRows:[...ids],kanaSelection:true});});
        const text=document.createElement('span');text.textContent=row.name+(row.group==='base'?'':' · '+row.groupName);label.append(input,text);grid.append(label);
      }chooser.append(grid);
    }
    const path=document.createElement('a');path.className='ma-kana-picker-path';path.href='/kana/?view=path&skill='+skill;path.textContent='See all rows in your learning path';chooser.append(path);
    host.append(chooser);return host;
  }
  root.ModeAtlasKanaPractice=Object.freeze({family,forFamily,render});
})(window);
