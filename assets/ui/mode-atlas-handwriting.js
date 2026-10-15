/* One stroke-order viewer and drawing surface for Kana and Kanji. Only the
   requested immutable data shard is loaded; drawings stay in this dialog. */
(function(root){
  'use strict';
  const pending=new Map(),NS='http://www.w3.org/2000/svg';let current=null;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const svg=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  function shard(char){return root.ModeAtlasKanjiState?.levels.has(char)?'n'+root.ModeAtlasKanjiState.levels.get(char):/^[ぁ-ゖァ-ヺー]$/.test(char)?'kana':null;}
  async function load(char){
    if(root.ModeAtlasStrokeData?.[char])return root.ModeAtlasStrokeData[char];
    const group=shard(char);if(!group)throw new Error('Choose a kana or kanji character.');
    if(!pending.has(group))pending.set(group,new Promise((resolve,reject)=>{
      const script=el('script');script.src='/assets/data/mode-atlas-strokes-'+group+'.'+root.ModeAtlasCacheRevision+'.js';
      script.onload=()=>resolve();script.onerror=()=>{pending.delete(group);script.remove();reject(new Error('Stroke order could not load. Please try again when connected.'));};document.head.append(script);
    }));
    await pending.get(group);const paths=root.ModeAtlasStrokeData?.[char];if(!paths)throw new Error('Stroke order is unavailable for this character.');return paths;
  }
  function open(text,{pronunciation}={}){
    current?.close();const chars=[...String(text)].filter(c=>shard(c));if(!chars.length)return;
    const previous=document.activeElement,dialog=el('dialog','ma-handwriting');dialog.setAttribute('aria-labelledby','maHandwritingTitle');
    const header=el('header'),title=el('h2','', 'Writing practice');title.id='maHandwritingTitle';header.append(title);
    const makeButton=(label,action)=>{const b=el('button','ma-button ma-button--ghost',label);b.type='button';b.addEventListener('click',action);return b;};
    const closeButton=makeButton('Close',()=>dialog.close());header.append(closeButton);
    const body=el('div','ma-handwriting-body'),selector=el('div','ma-handwriting-characters');selector.setAttribute('role','group');selector.setAttribute('aria-label','Characters to write');
    const stage=el('div','ma-handwriting-stage'),status=el('p','ma-handwriting-status');status.setAttribute('role','status');
    const tools=el('div','ma-handwriting-tools'),actions=el('div','ma-handwriting-tools');
    const watch=makeButton('Watch strokes',()=>animate()),step=makeButton('Next stroke',()=>showStep()),trace=makeButton('Trace',()=>setMode('trace')),write=makeButton('Write',()=>setMode('write'));
    const undo=makeButton('Undo',()=>{stopAnimation();accepted.pop();drawn.pop();render();}),clear=makeButton('Clear',()=>{stopAnimation();accepted=[];drawn=[];render();});
    tools.append(watch,step,trace,write);actions.append(undo,clear);
    const tip=el('p','ma-handwriting-tip','Follow the starting dot and stroke direction. Use a finger, pen or mouse.');
    const source=el('a','ma-handwriting-source','Stroke artwork: KanjiVG');source.href='/kanji/sources/';
    body.append(selector);if(pronunciation)body.append(root.ModeAtlasPronunciation.controls(pronunciation));body.append(tools,stage,status,actions,tip,source);dialog.append(header,body);document.body.append(dialog);
    let paths=[],reference=[],accepted=[],drawn=[],mode='trace',which=0,animation=0,loadToken=0,pointer=null,points=[],ink=null,board=null,watchIndex=0;
    function stopAnimation(){animation++;stage.getAnimations({subtree:true}).forEach(a=>a.cancel());watch.disabled=false;}
    function setMode(next){stopAnimation();mode=next;accepted=[];drawn=[];watchIndex=0;render();}
    function pathPoints(path){const size=path.getTotalLength();return Array.from({length:40},(_,i)=>path.getPointAtLength(size*i/39));}
    function render(){
      pointer=null;points=[];stage.replaceChildren();reference=[];
      board=svg('svg',{viewBox:'0 0 109 109',role:'img','aria-label':`Writing area for ${chars[which]}`});board.classList.add('ma-handwriting-board');stage.append(board);
      board.append(svg('path',{d:'M54.5 0V109 M0 54.5H109',class:'ma-handwriting-grid'}));
      paths.forEach((d,i)=>{
        const p=svg('path',{d,class:'ma-handwriting-guide'});board.append(p);reference.push(pathPoints(p));
        if(mode==='write'&&i>=accepted.length)p.classList.add('is-hidden');
        if(i<accepted.length)p.classList.add('is-done');else if(i===accepted.length&&mode==='trace')p.classList.add('is-next');
      });
      for(const d of drawn)board.append(svg('path',{d,class:'ma-handwriting-ink'}));
      if(accepted.length<paths.length&&mode==='trace'){
        const p=reference[accepted.length][0];board.append(svg('circle',{cx:p.x,cy:p.y,r:3,class:'ma-handwriting-start'}));
      }
      trace.setAttribute('aria-pressed',String(mode==='trace'));write.setAttribute('aria-pressed',String(mode==='write'));
      undo.disabled=!accepted.length;clear.disabled=!accepted.length;watch.disabled=!paths.length;step.disabled=!paths.length;
      status.textContent=accepted.length===paths.length?`${paths.length===1?'The stroke is':`All ${paths.length} strokes are`} practised. Try writing it again without the guide.`:`${chars[which]} · Stroke ${accepted.length+1} of ${paths.length}`;
      board.addEventListener('pointerdown',begin);board.addEventListener('pointermove',move);board.addEventListener('pointerup',end);board.addEventListener('pointercancel',cancel);board.addEventListener('lostpointercapture',cancel);
    }
    function position(event){const r=board.getBoundingClientRect();return {x:(event.clientX-r.left)*109/r.width,y:(event.clientY-r.top)*109/r.height};}
    function pathString(list){return list.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');}
    function begin(event){
      if(pointer!==null||event.button!==0||!paths.length||accepted.length>=paths.length)return;
      event.preventDefault();stopAnimation();pointer=event.pointerId;board.setPointerCapture(pointer);points=[position(event)];ink=svg('path',{class:'ma-handwriting-ink',d:pathString(points)});board.append(ink);
    }
    function move(event){if(event.pointerId!==pointer)return;event.preventDefault();if(points.length<2000)points.push(position(event));ink.setAttribute('d',pathString(points));}
    function end(event){
      if(event.pointerId!==pointer)return;move(event);const captured=pointer;pointer=null;board.releasePointerCapture(captured);
      if(root.ModeAtlasStrokeMatcher.matches(points,reference[accepted.length])){accepted.push(true);drawn.push(pathString(points));render();}
      else{ink.remove();status.textContent='Try that stroke again. Follow its starting point, direction and shape.';}
    }
    function cancel(event){if(event.pointerId!==pointer)return;pointer=null;points=[];ink?.remove();}
    function showStep(){
      stopAnimation();accepted=[];drawn=[];render();const guides=[...board.querySelectorAll('.ma-handwriting-guide')];
      guides.forEach((p,i)=>p.classList.toggle('is-hidden',i>watchIndex));guides[watchIndex].classList.add('is-demonstrated');
      status.textContent=`${chars[which]} · Showing stroke ${watchIndex+1} of ${paths.length}`;watchIndex=(watchIndex+1)%paths.length;
    }
    async function animate(){
      stopAnimation();accepted=[];drawn=[];render();const token=animation;watch.disabled=true;
      const guides=[...board.querySelectorAll('.ma-handwriting-guide')];guides.forEach(p=>p.classList.add('is-hidden'));board.querySelector('.ma-handwriting-start')?.remove();
      try{for(let i=0;i<guides.length;i++){
        if(token!==animation||!dialog.open)return;
        const p=guides[i],length=p.getTotalLength();p.classList.remove('is-hidden');p.classList.add('is-demonstrated');
        status.textContent=`${chars[which]} · Showing stroke ${i+1} of ${paths.length}`;
        if(!root.matchMedia('(prefers-reduced-motion: reduce)').matches)await p.animate([{strokeDasharray:`${length}`,strokeDashoffset:length},{strokeDasharray:`${length}`,strokeDashoffset:0}],{duration:650,easing:'linear'}).finished;
      }if(token===animation)status.textContent='Your turn. Choose Trace or Write to begin.';}catch(_){}finally{if(token===animation)watch.disabled=false;}
    }
    async function choose(index){
      stopAnimation();const token=++loadToken;which=index;paths=[];accepted=[];drawn=[];watchIndex=0;
      for(const [i,b]of [...selector.children].entries())b.setAttribute('aria-pressed',String(i===index));
      stage.replaceChildren(el('p','','Loading stroke order…'));status.textContent='';for(const b of [...tools.children,...actions.children])b.disabled=true;
      try{const loaded=await load(chars[index]);if(token!==loadToken||!dialog.open)return;paths=loaded;trace.disabled=false;write.disabled=false;render();}
      catch(error){if(token!==loadToken||!dialog.open)return;stage.replaceChildren(el('p','',error.message),makeButton('Retry',()=>choose(index)));}
    }
    for(const [i,char]of chars.entries())selector.append(makeButton(char,()=>choose(i)));
    dialog.addEventListener('close',()=>{loadToken++;stopAnimation();root.ModeAtlasOverlay.unlock(dialog);dialog.remove();if(current===dialog)current=null;previous?.focus?.({preventScroll:true});},{once:true});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
    current=dialog;root.ModeAtlasOverlay.lock(dialog);dialog.showModal();closeButton.focus({preventScroll:true});choose(0);
  }
  for(const event of ['pagehide','modeAtlasAccountWillChange'])root.addEventListener(event,()=>current?.close());
  root.ModeAtlasHandwriting=Object.freeze({open,load});
})(window);
