/* Kana owns the course and receipts; the shared drawing tool owns strokes. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanaHandwriting'),L=root.ModeAtlasKanaLearning;if(!host)return;
  const query=new URLSearchParams(location.search),requested=query.get('kana');
  let script=L.rows.find(r=>r.chars.includes(requested))?.script||'hiragana',rowId='';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function open(char){
    const owner=root.KanaCloudSync?.getUser?.()?.uid||'guest';
    root.ModeAtlasHandwriting.open(char,{pronunciation:char,onComplete:event=>{
      if(owner!==(root.KanaCloudSync?.getUser?.()?.uid||'guest'))throw new Error('This practice belongs to a different account.');
      root.ModeAtlasStorage.transaction(()=>L.recordHandwriting(char,event));render();
    }});
  }
  function render(){
    const state=L.initialize();host.replaceChildren();
    if(!state.startedAt){const link=el('a','ma-button ma-button--primary','Choose my Kana starting point');link.href='/kana/';host.append(link);return;}
    const switcher=el('div','ma-kana-handwriting-tabs');switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Kana script');
    for(const [id,label]of [['hiragana','Hiragana'],['katakana','Katakana']]){const b=el('button','ma-button ma-button--ghost',label);b.type='button';b.setAttribute('aria-pressed',String(id===script));b.addEventListener('click',()=>{script=id;rowId='';render();});switcher.append(b);}host.append(switcher);
    const rows=L.path(script,'handwriting',state),select=el('select'),label=el('label','ma-kana-handwriting-select','Choose a row');select.id='maKanaStrokeRow';label.htmlFor=select.id;
    for(const row of rows){const option=el('option','',row.name+' · '+row.groupName+(row.unlocked?'':' · Locked'));option.value=row.id;option.disabled=!row.unlocked;select.append(option);}
    if(!rows.some(r=>r.id===rowId&&r.unlocked))rowId=(rows.find(r=>r.unlocked&&r.chars.includes(requested))||rows.find(r=>r.unlocked&&!r.complete)||rows[0]).id;
    select.value=rowId;select.addEventListener('change',()=>{rowId=select.value;render();});label.append(select);host.append(label);
    const grid=el('div','ma-kana-handwriting-grid');
    for(const char of rows.find(r=>r.id===rowId).chars){const b=el('button','ma-kana-handwriting-character');b.type='button';b.setAttribute('aria-label',`Write ${char} (${L.map[char]})`);const glyph=el('strong','',char);glyph.lang='ja';b.append(glyph,el('span','',L.map[char]),el('span','',L.labels[L.earned(char,'handwriting',state,{})]));b.addEventListener('click',()=>open(char));grid.append(b);}host.append(grid);
    host.append(el('p','ma-hub-note','Watch, trace, then try Write without the guide. One clean completion of every character opens the next row. Handwriting adds Mastered+ when your Read and Recall are mastered.'));
  }
  render();
  if(requested&&L.read().startedAt&&L.available('handwriting').has(requested))open(requested);
  root.addEventListener('modeAtlasCloudDataChanged',render);document.addEventListener('ma:ui-refresh',render);
})(window);
