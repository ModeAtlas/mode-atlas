/* Kanji mastery view, mounted by the shared Mastery Map navigation. */
(function(root){
  'use strict';
  const state=root.ModeAtlasKanjiState,content=root.ModeAtlasKanjiContent;
  const labels=['New','Learning','Reviewing','Mastered'];
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function button(text,action){const b=el('button','ma-button ma-button--ghost',text);b.type='button';b.addEventListener('click',action);return b;}
  function detail(char,back){
    const host=el('section','ma-kanji-mastery-detail');host.append(button('‹ Back to map',back),el('h3','',char),el('p','','Loading character…'));
    void content.load().then(()=>{
      const entry=content.get(char),snapshot=state.read();host.replaceChildren(button('‹ Back to map',back),el('h3','',char),el('p','',entry.meanings.join(' · ')));
      const completed=state.completed(snapshot,char);host.append(el('p','',completed?'✓ Band progress complete':'To complete: 3 recent correct per skill at 80% accuracy.'));
      for(const skill of state.skills){
        const m=state.metrics(snapshot,char,skill),section=el('section','ma-mastery-next');section.append(el('h4','',`${skill==='pronunciation'?'Pronunciation':'Meaning'} · ${labels[state.stage(snapshot,char,skill)]}`));
        section.append(el('p','',m.recentAttempts?`${m.recentCorrect} / ${m.recentAttempts} recent correct`:'No recent practice'));
        if(state.readiness(snapshot,char,skill)<state.stage(snapshot,char,skill))section.append(el('p','','Revisit this skill.'));
        const record=el('details');record.append(el('summary','','Progress details'),el('p','',`All time: ${m.correct} / ${m.attempts} correct · ${(m.accuracy*100).toFixed(2)}%`));
        if(m.average)record.append(el('p','',`Average answer: ${(m.average/1000).toFixed(1)}s`));
        const target=state.stage(snapshot,char,skill)>=2?{correct:30,recent:10,accuracy:.9,days:4,reviews:4}:{correct:10,recent:5,accuracy:.8,days:2,reviews:2};
        const checks=el('ul','ma-mastery-checks');
        for(const [label,value,needed]of [['Unassisted correct',m.independent,target.correct],['Recent correct',m.recentCorrect,target.recent],['Recent accuracy',m.recentAccuracy*100,target.accuracy*100],['Study days',m.days.length,target.days],['Spaced successes',m.reviews,target.reviews]]){
          const met=value>=needed,item=el('li','',`${met?'✓':'○'} ${label}: ${Number.isInteger(value)?value:value.toFixed(2)} / ${needed}${label==='Recent accuracy'?'%':''}`);
          item.dataset.met=String(met);checks.append(item);
        }
        record.append(checks);section.append(record);
        const action=el('a','ma-button ma-button--ghost',`Practise ${skill}`);action.href='/kanji/?'+new URLSearchParams({char,mode:skill});section.append(action);host.append(section);
      }
      const guide=el('details');guide.append(el('summary','','How Kanji mastery works'),el('p','','Practise readings and meanings without hints across several days. Your last 12 answers show what to revisit. Earned milestones stay saved.'));
      host.append(guide);
    }).catch(error=>{host.lastChild.textContent=error.message;});return host;
  }
  function render(selection,onChange,openDetail){
    const snapshot=state.read(),bands=state.summary(snapshot),host=el('div','ma-kanji-mastery');
    if(!state.allowed(selection.level||5,snapshot))selection.level=5;
    const level=selection.level||5,band=bands.find(x=>x.level===level),tabs=el('div','ma-atlas-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Kanji mastery levels');
    for(const item of bands){const b=button(`N${item.level}`,()=>onChange('level',item.level));b.disabled=!item.unlocked;b.setAttribute('aria-pressed',String(item.level===level));b.setAttribute('aria-label',`${item.name}, N${item.level}${item.unlocked?'':', locked'}`);tabs.append(b);}host.append(tabs);
    host.append(el('h3','',`N${level} · ${band.name}`),el('p','ma-mastery-guide',`${band.complete} of ${band.total} complete · ${band.mastered} mastered`));
    const chars=[...band.chars],counts=labels.map((_,i)=>chars.filter(c=>state.stage(snapshot,c)===i).length),overview=el('div','ma-mastery-overview');
    labels.forEach((label,i)=>{const item=el('div',`ma-mastery-stage ${label.toLowerCase()}`);item.append(el('b','',counts[i]),el('strong','',label));overview.append(item);});host.append(overview);
    const page=Math.max(0,Math.min(selection.kanjiPage||0,Math.ceil(chars.length/120)-1)),grid=el('div','ma-mastery-grid');
    for(const char of chars.slice(page*120,(page+1)*120)){
      const label=labels[state.stage(snapshot,char)],b=button('',()=>openDetail(detail(char,()=>onChange('kanjiPage',page))));b.className='ma-mastery-cell '+label.toLowerCase();b.dataset.maKanjiDetail=char;b.setAttribute('aria-label',`${char} mastery details: ${label}`);b.append(el('strong','',char),el('span','',label));grid.append(b);
    }host.append(grid);
    if(chars.length>120){const nav=el('div','ma-atlas-tabs'),prev=button('Previous',()=>onChange('kanjiPage',page-1)),next=button('Next',()=>onChange('kanjiPage',page+1));prev.disabled=page===0;next.disabled=(page+1)*120>=chars.length;nav.append(prev,el('span','',`${page+1} / ${Math.ceil(chars.length/120)}`),next);host.append(nav);}
    const practice=el('a','ma-button ma-button--ghost','Open Kanji');practice.href='/kanji/?level='+level;host.append(practice);return host;
  }
  root.ModeAtlasKanjiMastery=Object.freeze({render});
})(window);
