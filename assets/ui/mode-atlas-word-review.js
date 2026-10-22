/* Separate meaning, reading and listening retrieval for personal vocabulary.
   Only the saved reading is an objective key; meanings remain self-assessed. */
(function(root){
  'use strict';
  const model=root.ModeAtlasWordBank;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
  function open(){
    const content=el('div','ma-word-review','');let index=0,skill='meaning',queue=[],active=true;
    function button(label,action){const node=el('button','ma-button ma-button--primary',label);node.type='button';node.addEventListener('click',()=>{if(active)action();});return node;}
    function choose(){
      root.ModeAtlasPronunciation.stop();content.replaceChildren();
      for(const [kind,label,description]of [['meaning','Meaning','Reveal and check your recall.'],['reading','Reading','Type the reading.'],['listening','Listening','Listen and type.']]){
        const due=model.due(Date.now(),kind),action=button(`${label} · ${due.length} due`,()=>{skill=kind;index=0;queue=due.slice(0,10);render();});
        action.disabled=!due.length;content.append(action,el('p','ma-muted',description));
      }
      if(!model.due().length)content.append(el('p','','No reviews due yet.'));
    }
    function grade(word,remembered){
      if(queue[index]?.id!==word.id)return;
      try{model.review(word.id,remembered,Date.now(),skill);index++;render();}
      catch(error){root.ModeAtlasToast?.show?.(error.message||'Your answer could not be saved. Try again.');}
    }
    function explanation(word){
      const block=el('div','ma-word-explanation',''),written=el('h2','',word.written),reading=el('p','',word.reading);written.lang=reading.lang='ja';
      block.append(written,reading,el('p','',word.english));
      if(word.example){const example=el('p','',word.example);example.lang='ja';block.append(example);}
      if(word.exampleTranslation)block.append(el('p','ma-muted',word.exampleTranslation));
      if(word.reading)block.append(root.ModeAtlasPronunciation.controls(word.reading));return block;
    }
    function reveal(word,correct){
      content.replaceChildren(el('p','ma-kicker',`${index+1} of ${queue.length} · ${skill}`),explanation(word));
      if(skill==='meaning'){
        for(const [label,remembered]of [['Again',false],['Remembered',true]])content.append(button(label,()=>grade(word,remembered)));
      }else{
        const status=el('p','',correct?'Correct':'Review the reading above.');status.setAttribute('role','status');content.append(status,button('Continue',()=>grade(word,correct)));
      }
    }
    function render(){
      root.ModeAtlasPronunciation.stop();content.replaceChildren();const word=queue[index];
      if(!word){
        root.ModeAtlasLearningEvents?.emit('reviewCompleted','words');
        content.append(el('h2','','Set complete'),root.ModeAtlasSessionOutcome.render({skill:'Word Bank · '+skill,missed:queue.filter(word=>model.read().find(item=>item.id===word.id)?.[model.reviewKey(skill)].level===0).map(word=>word.written),due:model.read().filter(word=>queue.some(item=>item.id===word.id)).map(word=>word[model.reviewKey(skill)].due)}),button('Choose another skill',choose));return;
      }
      content.append(el('p','ma-kicker',`${index+1} of ${queue.length} · ${skill}`));
      if(skill!=='listening'){const prompt=el('h2','',word.written);prompt.lang='ja';content.append(prompt);}
      if(skill==='meaning'){content.append(el('p','','Recall the meaning, then reveal it.'),button('Reveal',()=>reveal(word)));return;}
      const form=el('form','ma-word-reading-form',''),label=el('label','','Your answer (kana or romaji)'),input=document.createElement('input');input.className='ma-input';input.id='maWordRecallInput';label.htmlFor=input.id;input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.maxLength=200;
      const submit=button('Check reading',()=>form.requestSubmit());let played=skill!=='listening';submit.disabled=!played;
      if(skill==='listening')content.append(el('p','','Listen, then type the word.'));
      if(skill==='listening')content.append(root.ModeAtlasPronunciation.controls(word.reading,{onPlayback:ok=>{played=ok;submit.disabled=!ok;}}));
      form.append(label,input,submit);form.addEventListener('submit',event=>{event.preventDefault();if(!event.isComposing&&active&&played&&input.value.trim())reveal(word,root.ModeAtlasJapanese.matchesReading(input.value,word.reading));});content.append(form);
      content.append(button('I don’t know yet',()=>reveal(word,false)),button('Choose another skill',choose));input.focus({preventScroll:true});
    }
    const close=()=>{active=false;root.ModeAtlasPronunciation.stop();root.ModeAtlasDialog.close(false);};root.addEventListener('modeAtlasAccountWillChange',close);
    choose();root.ModeAtlasDialog.feature({kicker:'Word Bank',title:'Review your words',contentNode:content}).finally(()=>{active=false;root.ModeAtlasPronunciation.stop();root.removeEventListener('modeAtlasAccountWillChange',close);});
  }
  root.ModeAtlasWordReview=Object.freeze({open});
})(window);
