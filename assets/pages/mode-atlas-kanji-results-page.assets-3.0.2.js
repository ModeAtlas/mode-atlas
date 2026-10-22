/* Kanji test history. Kana results remain owned by their existing result engine. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanjiResults');if(!host)return;
  const results=root.ModeAtlasKanjiResults,content=root.ModeAtlasKanjiContent;
  let selected='',filter='all';
  const labels={pronunciation:'Pronunciation',meaning:'Meaning',match:'Meaning Match'};
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const link=(label,href)=>{const a=el('a','ma-button ma-button--ghost',label);a.href=href;return a;};
  function render(){
    const all=results.read(),rows=all.filter(r=>filter==='all'||r.mode===filter);host.replaceChildren();
    const controls=el('div','ma-kanji-actions');
    for(const [value,label]of [['all','All tests'],['pronunciation','Pronunciation'],['meaning','Meaning'],['match','Meaning Match']]){
      const b=el('button','ma-button ma-button--ghost',label);b.type='button';b.setAttribute('aria-pressed',String(value===filter));b.addEventListener('click',()=>{filter=value;render();});controls.append(b);
    }if(all.length)host.append(controls);
    if(!rows.length){
      const empty=el('div','results-empty-assessment'),art=el('img','results-empty-assessment__art');art.src='/assets/illustrations/kanji-scene.svg';art.alt='';art.width=480;art.height=300;
      empty.append(art,el('strong','results-empty-assessment__title',all.length?'No tests in this mode yet':'No Kanji test results yet'),el('p','results-empty-assessment__copy','Finish a Kanji test to see your score, answers and what to revisit.'),link('Open Kanji','/kanji/'));host.append(empty);return;
    }
    const current=rows.find(r=>r.id===selected)||rows[0];selected=current.id;
    const layout=el('div','ma-kanji-result-layout'),history=el('div','ma-kanji-result-list');history.setAttribute('role','group');history.setAttribute('aria-label','Saved Kanji tests');
    for(const row of rows){
      const correct=row.answers.filter(a=>a.correct).length,b=el('button','ma-button ma-button--ghost');b.type='button';b.setAttribute('aria-pressed',String(row.id===selected));b.append(el('strong','',`N${row.level} · ${labels[row.mode]}`),el('span','',`${correct} / ${row.answers.length}`),el('small','',new Date(row.at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})));b.addEventListener('click',()=>{selected=row.id;render();});history.append(b);
    }
    const detail=el('section','ma-kanji-result-detail'),correct=current.answers.filter(a=>a.correct).length,stats=el('div','ma-kanji-result-stats');
    for(const [value,label]of [[`${correct}/${current.answers.length}`,'Correct'],[`${(correct/current.answers.length*100).toFixed(1)}%`,'Accuracy'],[`${(current.answers.reduce((n,a)=>n+a.elapsed,0)/current.answers.length/1000).toFixed(1)}s`,'Average answer']]){const item=el('div');item.append(el('strong','',value),el('span','',label));stats.append(item);}
    detail.append(el('h2','',`${labels[current.mode]} · N${current.level} content band`),stats);
    const actions=el('div','ma-kanji-actions');actions.append(link('Take another test','/kanji/?'+new URLSearchParams({level:String(current.level),test:current.mode})));
    const missed=current.answers.filter(a=>!a.correct).map(a=>a.char);
    detail.append(root.ModeAtlasSessionOutcome.render({skill:labels[current.mode],scope:'Character/word test',missed,due:root.ModeAtlasSessionOutcome.kanjiDates(current.answers.map(a=>a.char),current.mode)}));
    actions.prepend(link('Review '+(current.mode==='pronunciation'?'readings':'meanings'),'/kanji/?'+new URLSearchParams({level:String(current.level),practice:current.mode==='match'?'meaning':current.mode,focus:'due'})));
    if(missed.length)actions.append(link('Revisit mistakes','/kanji/?'+new URLSearchParams({level:String(current.level),chars:missed.join(''),mode:'learn'})));detail.append(actions);
    const answers=el('ol','ma-kanji-result-answers');
    for(const answer of current.answers){
      const row=el('li'),copy=el('div'),result=el('p','',answer.correct?'Correct':answer.answer?'Review':'Skipped');result.dataset.correct=String(answer.correct);const entry=content.get(answer.char),expected=current.mode==='pronunciation'?content.pronunciation(entry).answers:entry.meanings;
      copy.append(result,el('p','',expected.join(' · ')));if(!answer.correct&&answer.answer)copy.append(el('small','',`Your answer: ${answer.answer}`));row.append(el('strong','',answer.char),copy);answers.append(row);
    }detail.append(answers);layout.append(history,detail);host.append(layout);
  }
  async function boot(){try{await content.load();render();}catch(error){host.replaceChildren(el('p','',error.message),link('Back to Kanji','/kanji/'));}}
  for(const event of ['modeAtlasCloudDataChanged','modeAtlasDataCleared'])root.addEventListener(event,()=>{if(content.entries().length)render();});
  void boot();
})(window);
