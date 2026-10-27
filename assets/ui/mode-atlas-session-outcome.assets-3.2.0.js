/* Compact result language shared by branch owners. Due dates are always read
   from the current skill schedule, never invented from a historic test date. */
(function(root){
  'use strict';
  function when(dates,at=Date.now()){
    const valid=dates.filter(value=>Number.isFinite(value)&&value>0);
    if(!valid.length)return 'Practise to schedule your next review';
    const next=Math.min(...valid);
    if(next<=at)return 'Ready to review now';
    const minutes=Math.ceil((next-at)/60000);
    if(minutes<60)return `Next review in ${minutes} ${minutes===1?'minute':'minutes'}`;
    return 'Next review '+new Date(next).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }
  function render({skill,missed=[],due=[],scope=''}){
    const host=document.createElement('section');host.className='ma-session-outcome';host.setAttribute('aria-label','What to practise next');
    for(const [title,copy]of [['Practised',skill+(scope?' · '+scope:'')],['Revisit',missed.length?[...new Set(missed)].slice(0,8).join(' · '):'No missed items'],['When',when(due)]]){
      const row=document.createElement('p'),label=document.createElement('strong');label.textContent=title+': ';row.append(label,document.createTextNode(copy));host.append(row);
    }return host;
  }
  function kanjiDates(chars,skill){
    const state=root.ModeAtlasKanjiState.read();
    return chars.map(char=>root.ModeAtlasKanjiState.metrics(state,char,skill==='match'?'meaning':skill).due);
  }
  root.ModeAtlasSessionOutcome=Object.freeze({when,render,kanjiDates});
})(window);
