/* Shared native romaji input. The trainer or assessment owns answer evaluation. */
(function ModeAtlasIOSKeyboard(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp || root.ModeAtlasEnv.nativePlatform !== 'ios') return;

  function mount({input,container=document.body,enabled=()=>true,label='Reading romaji keyboard',onSubmit}){
    const original={readOnly:input.readOnly,inputmode:input.getAttribute('inputmode')};
    input.readOnly=true;input.setAttribute('inputmode','none');
    input.setAttribute('autocapitalize','off');input.setAttribute('autocorrect','off');
    const status=document.createElement('span');status.className='ma-ios-accessibility-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');container.append(status);
    const keyboard=document.createElement('div');keyboard.className='ma-ios-reading-keyboard'+(container===document.body?'':' ma-ios-reading-keyboard--inline');
    keyboard.dataset.maClickSound='none';keyboard.setAttribute('role','group');keyboard.setAttribute('aria-label',label);
    const active=()=>!input.disabled&&input.isConnected&&enabled();
    for(const [index,row]of ['qwertyuiop','asdfghjkl','zxcvbnm'].entries()){
      const line=document.createElement('div');line.className='ma-ios-reading-keyboard__row';
      for(const value of [...row,...(index===2?['delete']:[])]){
        const key=document.createElement('button');key.type='button';key.className='ma-ios-reading-keyboard__key'+(value==='delete'?' ma-ios-reading-keyboard__key--delete':'');key.textContent=value==='delete'?'⌫':value;key.dataset.key=value;
        if(value==='delete')key.setAttribute('aria-label','Delete last letter');line.append(key);
      }keyboard.append(line);
    }container.append(keyboard);
    const feedback=()=>root.ModeAtlasFeedback?.haptic('key');
    let pressedKey=null;
    function release(){if(!pressedKey)return;const key=pressedKey;pressedKey=null;root.setTimeout(()=>key.classList.remove('is-pressed'),85);}
    keyboard.addEventListener('pointerdown',event=>{
      const key=event.target.closest('button[data-key]');if(!key||!active())return;
      event.preventDefault();release();pressedKey=key;key.classList.add('is-pressed');feedback();
    });
    for(const event of ['pointerup','pointercancel','pointerleave'])keyboard.addEventListener(event,release);
    function typeKey(value,keepFocus){
      if(!active())return;
      let start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
      if(value==='delete'||value==='forward-delete'){
        if(start===end){if(value==='delete'&&start>0)start--;else if(value==='forward-delete')end++;}
        input.value=input.value.slice(0,start)+input.value.slice(end);
      }else{
        if(input.maxLength>=0&&input.value.length-(end-start)+value.length>input.maxLength)return;
        input.value=input.value.slice(0,start)+value+input.value.slice(end);start+=value.length;
      }
      // VoiceOver and hardware-key activation retain focus on the selected key.
      if(!keepFocus)input.focus({preventScroll:true});
      input.setSelectionRange(start,start);input.dispatchEvent(new Event('input',{bubbles:true}));
      if(keepFocus)status.textContent=input.value?'Answer: '+input.value:'Answer cleared';
    }
    keyboard.addEventListener('click',event=>{
      const key=event.target.closest('button[data-key]');if(!key||!active())return;
      if(event.detail===0)feedback();typeKey(key.dataset.key,event.detail===0);
    });
    function hardwareKey(event){
      if(event.isComposing||event.metaKey||event.ctrlKey||event.altKey||!active())return;
      if(event.key==='Enter'&&event.target===input&&onSubmit){event.preventDefault();onSubmit();return;}
      const value=/^[a-z]$/i.test(event.key)?event.key.toLowerCase():event.key==='Backspace'?'delete':event.key==='Delete'?'forward-delete':'';
      if(!value)return;event.preventDefault();typeKey(value,true);
    }
    input.addEventListener('keydown',hardwareKey);keyboard.addEventListener('keydown',hardwareKey);
    function refresh(){for(const key of keyboard.querySelectorAll('button'))key.disabled=!active();}
    const observer=new MutationObserver(refresh);observer.observe(input,{attributes:true,attributeFilter:['disabled']});
    root.requestAnimationFrame(refresh);
    return {element:keyboard,refresh,destroy(){
      observer.disconnect();input.removeEventListener('keydown',hardwareKey);keyboard.remove();status.remove();input.readOnly=original.readOnly;
      if(original.inputmode===null)input.removeAttribute('inputmode');else input.setAttribute('inputmode',original.inputmode);
    }};
  }
  root.ModeAtlasIOSKeyboard=Object.freeze({mount});

  function init(){
    if(!document.body.classList.contains('ma-reading-page'))return;
    const input=document.getElementById('input'),card=document.querySelector('.ma-trainer-card');if(!input||!card)return;
    const keyboard=mount({input,enabled:()=>document.body.classList.contains('trainer-session-active')});
    document.body.classList.add('ma-ios-custom-input');
    function measure(){document.documentElement.style.setProperty('--ma-ios-custom-kb-height',keyboard.element.getBoundingClientRect().height+'px');}
    root.addEventListener('resize',measure);new ResizeObserver(measure).observe(keyboard.element,{box:'border-box'});root.requestAnimationFrame(measure);
    new MutationObserver(()=>{
      if(document.body.classList.contains('ma-session-paused')||document.body.classList.contains('trainer-session-result')||document.body.classList.contains('ma-study-feedback-open'))input.blur();
      keyboard.refresh();root.requestAnimationFrame(measure);
    }).observe(document.body,{attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
