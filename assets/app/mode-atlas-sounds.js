/* One sound owner: a consistent activation tick and explicit outcome cues. */
(function(){
  'use strict';
  const VERSION = String(window.ModeAtlasVersion || window.MODE_ATLAS_VERSION || 'dev-local');
  const KEY='modeAtlasSound',LEGACY_KEYS=['maSoundMode','modeAtlasSoundMode','soundMode'];
  let ctx=null,master=null,resumePromise=null;
  const lastPlay=Object.create(null),boundSoundControls = new WeakSet();
  const {cues,envelope}=window.ModeAtlasSoundCues;
  const voices=new Set(),testTimers=new Set();
  let quietUntil=0;
  const nativeSounds=()=>window.AtlasPlatform?.getCapabilities?.().sounds===true;
  const aliases={incorrect:'wrong',complete:'finish',session:'finish',notify:'success',notification:'success'};
  function normaliseMode(value){
    if(value===false||value==='false')return 'off';
    return ['soft','loud','off'].includes(value)?value:'soft';
  }
  function getMode(){
    const store=window.ModeAtlasStorage;
    let value=store?.get?.(KEY)??localStorage.getItem(KEY);
    if(!value)for(const key of LEGACY_KEYS){
      value=store?.get?.(key)??localStorage.getItem(key);
      if(value){writeModeValue(KEY,normaliseMode(value));break;}
    }
    return normaliseMode(value);
  }
  function ensureAudio(){
    if(getMode()==='off'||nativeSounds())return null;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;
      if(!ctx){
        ctx=new Audio();master=ctx.createGain();master.gain.value=1;master.connect(ctx.destination);
      }
      if(ctx.state==='suspended'&&!resumePromise){
        resumePromise=ctx.resume().catch(()=>{}).finally(()=>{resumePromise=null;});
      }
      return ctx;
    }catch{return null;}
  }
  function stopSounds(){
    testTimers.forEach(clearTimeout);testTimers.clear();
    if(nativeSounds()){window.AtlasPlatform.stopSounds().catch(()=>{});return;}
    if(!ctx)return;
    const at=ctx.currentTime;
    for(const voice of voices){
      voice.gain.gain.cancelAndHoldAtTime(at);
      voice.gain.gain.linearRampToValueAtTime(0,at+.018);
      voice.osc.stop(at+.02);
    }
  }
  function play(name,options={}){
    if(getMode()==='off'||document.hidden)return;
    const cue=Object.hasOwn(cues,name)?name:(Object.hasOwn(aliases,name)?aliases[name]:'tap'),at=Date.now();
    if(cue==='tap'&&at<quietUntil)return;
    if(lastPlay[cue]&&at-lastPlay[cue]<(options.cooldown??(cue==='tap'?80:140)))return;
    const volume=getMode()==='loud'?1:.58;
    if(nativeSounds()){
      lastPlay[cue]=at;
      window.AtlasPlatform.playSound(cue,volume).catch(()=>{});
      return;
    }
    const audio=ensureAudio();if(!audio||audio.state!=='running'||voices.size>=8)return;
    // Background/resume never queues interaction sounds for later playback.
    lastPlay[cue]=at;
    if(cue!=='tap')quietUntil=at+Math.max(...cues[cue].map(note=>note[1]+note[4]))*1000;
    for(const [frequency,duration,type,level,delay,slide]of cues[cue]){
      const start=audio.currentTime+.002+delay,end=start+duration,gain=audio.createGain(),osc=audio.createOscillator();
      osc.type=type;osc.frequency.setValueAtTime(frequency,start);
      if(slide)osc.frequency.exponentialRampToValueAtTime(slide,end);
      const curve=Float32Array.from({length:128},(_,i)=>envelope(i*duration/127,duration)*level*volume);
      gain.gain.setValueCurveAtTime(curve,start,duration);
      osc.connect(gain);gain.connect(master);
      const voice={osc,gain};voices.add(voice);
      osc.onended=()=>{voices.delete(voice);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(end+.005);
    }
  }
  function writeModeValue(key,value){
    if(window.ModeAtlasStorage?.set)return window.ModeAtlasStorage.set(key,value);
    try{localStorage.setItem(key,value);return true;}catch{return false;}
  }
  function setMode(value){
    const mode=normaliseMode(value);writeModeValue(KEY,mode);refreshSoundControls();
    window.dispatchEvent(new CustomEvent('modeAtlasSoundChanged',{detail:{mode}}));
    if(mode==='off')stopSounds();else play('tap',{cooldown:0});return mode;
  }
  function refreshSoundControls(){
    const mode=getMode();
    document.querySelectorAll('[data-sound],[data-ma-sound-choice],[data-ma-dev-sound]').forEach(btn=>{
      const selected=normaliseMode(btn.dataset.maSoundChoice||btn.dataset.sound||btn.dataset.maDevSound)===mode;
      btn.classList.toggle('active',selected);btn.setAttribute('aria-pressed',String(selected));
    });
  }
  function bindSoundControls(scope){
    const parent=scope?.querySelectorAll?scope:document;
    parent.querySelectorAll('[data-ma-sound-choice]').forEach(btn=>{
      if(boundSoundControls.has(btn))return;boundSoundControls.add(btn);
      btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();setMode(btn.dataset.maSoundChoice);});
    });refreshSoundControls();
  }
  function testSound(){
    stopSounds();
    ['tap','correct','wrong','finish','achievement'].forEach((name,index)=>{
      const timer=setTimeout(()=>{testTimers.delete(timer);play(name,{cooldown:0});},index*500);testTimers.add(timer);
    });
  }
  function notify(message,type,explicit){
    if(explicit==='none')return;
    if(explicit&&Object.hasOwn(cues,explicit))return play(explicit);
    if(['err','error','danger'].includes(type))play('error');
    else if(['warn','warning'].includes(type))play('warning');
    else if(['ok','success'].includes(type))play('success');
  }
  function bindEvents(){
    // Pointer/key events unlock audio only. Activation and changed values sound once.
    document.addEventListener('pointerdown',ensureAudio,{capture:true,passive:true});
    document.addEventListener('keydown',event=>{if(event.isComposing || event.keyCode === 229)return;if(!event.repeat)ensureAudio();},true);
    document.addEventListener('change',event=>{
      const control=event.target.closest?.('select,input[type="checkbox"],input[type="radio"],input[type="range"]');
      if(control&&!control.disabled&&control.closest('[data-ma-click-sound]')?.dataset.maClickSound!=='none')play('tap');
    },true);
    document.addEventListener('click',event=>{
      if(event.button>0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
      const control=event.target.closest?.('button,a[href],summary,input[type="button"],input[type="submit"],input[type="reset"],[role="button"]');
      if(!control||control.matches(':disabled,[aria-disabled="true"]')||control.closest('[inert]'))return;
      if(control.matches('[data-ma-sound-choice]'))return;
      if(control.matches('[data-sound],[data-ma-dev-sound]')){setMode(control.dataset.sound||control.dataset.maDevSound);return;}
      if(control.matches('[data-ma-dev-test-sound]'))return; // Developer console owns its test action.
      const explicit=control.closest('[data-ma-click-sound]')?.dataset.maClickSound;
      if(explicit!=='none')play(explicit||'tap');
    },true);
  }
  function init(){
    window.ModeAtlasSounds=Object.freeze({play,notify,setSound:setMode,setMode,getSoundMode:getMode,getMode,refresh:refreshSoundControls,testSound,version:VERSION});
    bindSoundControls();bindEvents();
    window.addEventListener('pagehide',()=>{testTimers.forEach(clearTimeout);testTimers.clear();if(!nativeSounds())stopSounds();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){testTimers.forEach(clearTimeout);testTimers.clear();if(!nativeSounds())stopSounds();}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.addEventListener('modeAtlasSettingsMenuReady',()=>bindSoundControls());
})();
