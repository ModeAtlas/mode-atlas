/* Self-marked personal word recall. Notes are never treated as an answer key. */
(function(root){
  'use strict';
  const model=root.ModeAtlasWordBank;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
  function open(){
    const queue=model.due().slice(0,10),content=el('div','ma-word-review','');let index=0;
    function button(label,action){const node=el('button','ma-button ma-button--primary',label);node.type='button';node.addEventListener('click',action);return node;}
    function render(){
      content.replaceChildren();
      const word=queue[index];
      if(!word){content.append(el('p','',queue.length?'Set complete. Your words will return when they’re ready to review.':'No words are due. Add a meaning to a saved word to include it in review.'));return;}
      content.append(el('p','ma-kicker',`${index+1} of ${queue.length}`));
      const prompt=el('h2','',word.written);prompt.lang='ja';content.append(prompt,el('p','','Recall the meaning, then reveal it.'));
      content.append(button('Reveal',()=>{
        content.replaceChildren(prompt,el('p','',word.reading),el('p','',word.english));
        if(word.example)content.append(el('p','',word.example));
        const actions=el('div','ma-action-row','');
        for(const [label,remembered]of [['Again',false],['Remembered',true]])actions.append(button(label,()=>{model.review(word.id,remembered);index++;render();}));
        content.append(actions);
      }));
    }
    const close=()=>root.ModeAtlasDialog.close(false);root.addEventListener('modeAtlasAccountWillChange',close);
    render();root.ModeAtlasDialog.feature({kicker:'Word Bank',title:'Review your words',contentNode:content}).finally(()=>root.removeEventListener('modeAtlasAccountWillChange',close));
  }
  root.ModeAtlasWordReview=Object.freeze({open});
})(window);
