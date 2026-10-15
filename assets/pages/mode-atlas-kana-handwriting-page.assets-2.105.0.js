/* Kana selects characters; the shared handwriting tool owns paths and input. */
(function(root){
  'use strict';
  const host=document.getElementById('maKanaHandwriting'),data=root.ModeAtlasKanaData;if(!host)return;
  let script='hiragana',row='base:a';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function render(){
    host.replaceChildren();const switcher=el('div','ma-kana-handwriting-tabs');switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Kana script');
    for(const [id,label]of [['hiragana','Hiragana'],['katakana','Katakana']]){const b=el('button','ma-button ma-button--ghost',label);b.type='button';b.setAttribute('aria-pressed',String(id===script));b.addEventListener('click',()=>{script=id;render();});switcher.append(b);}host.append(switcher);
    const groups=[['base',data[script+'Rows']],['dakuten',data.dakutenRows],['combined',data.yoonRows],...(script==='katakana'?[['extended',data.extendedKatakanaRows]]:[])];
    const rows=groups.flatMap(([kind,items])=>Object.entries(items).filter(([key])=>key.startsWith(script==='hiragana'?'h_':'k_')).map(([key,items])=>[kind+':'+key.slice(2),items]));
    const select=el('select'),label=el('label','ma-kana-handwriting-select','Choose a row');select.id='maKanaStrokeRow';label.htmlFor=select.id;
    for(const [key]of rows){const [kind,suffix]=key.split(':'),name=suffix.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()),option=el('option','',name+' row'+(kind==='base'?'':' · '+kind));option.value=key;select.append(option);}
    if(!rows.some(([key])=>key===row))row=rows[0][0];select.value=row;select.addEventListener('change',()=>{row=select.value;render();});label.append(select);host.append(label);
    const grid=el('div','ma-kana-handwriting-grid');
    for(const [char,roman]of Object.entries(rows.find(([key])=>key===row)[1])){const b=el('button','ma-kana-handwriting-character');b.type='button';b.setAttribute('aria-label',`Write ${char} (${roman})`);const glyph=el('strong','',char);glyph.lang='ja';b.append(glyph,el('span','',roman));b.addEventListener('click',()=>root.ModeAtlasHandwriting.open(char,{pronunciation:char}));grid.append(b);}host.append(grid);
    const tip=el('p','ma-hub-note','Start with the first stroke. Lift your finger or pen between strokes; on a computer, click and drag. You can watch without drawing.');host.append(tip);
  }
  render();
})(window);
