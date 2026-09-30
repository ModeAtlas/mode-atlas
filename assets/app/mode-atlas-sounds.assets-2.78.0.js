/* One sound owner: a consistent activation tick and explicit outcome cues. */
(function(){
  'use strict';
  const VERSION = String(window.ModeAtlasVersion || window.MODE_ATLAS_VERSION || 'dev-local');
  const KEY='modeAtlasSound',LEGACY_KEYS=['maSoundMode','modeAtlasSoundMode','soundMode'];
  let ctx=null,master=null,resumePromise=null;
  const lastPlay=Object.create(null),boundSoundControls = new WeakSet();
  // Frequency, duration, waveform, gain, onset and optional destination frequency.
  const cues=Object.freeze({
    tap:[[620,.045,'sine',.10,0,440]],
    correct:[[660,.085,'sine',.13,0],[880,.115,'sine',.10,.045]],
    wrong:[[220,.14,'triangle',.10,0,175]],
    finish:[[523,.10,'sine',.11,0],[659,.11,'sine',.11,.08],[784,.16,'sine',.10,.17]],
    achievement:[[523,.09,'sine',.11,0],[659,.10,'sine',.11,.07],[784,.11,'sine',.10,.15],[1046,.17,'sine',.08,.24]],
    success:[[600,.08,'sine',.09,0],[750,.10,'sine',.07,.055]],
    warning:[[330,.10,'sine',.09,0],[330,.10,'sine',.07,.11]],
    error:[[260,.12,'triangle',.09,0,195]]
  });
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
    if(getMode()==='off')return null;
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
  function play(name,options={}){
    if(getMode()==='off')return;
    const cue=Object.hasOwn(cues,name)?name:(Object.hasOwn(aliases,name)?aliases[name]:'tap'),at=Date.now();
    if(lastPlay[cue]&&at-lastPlay[cue]<(options.cooldown??(cue==='tap'?35:110)))return;
    const audio=ensureAudio();if(!audio)return;
    // Do not replay stale interactions after an interrupted/background audio session.
    if(audio.state!=='running')return;
    lastPlay[cue]=at;
    const volume=getMode()==='loud'?1:.58;
    for(const [frequency,duration,type,level,delay,slide]of cues[cue]){
      const start=audio.currentTime+.002+delay,end=start+duration,gain=audio.createGain(),osc=audio.createOscillator();
      osc.type=type;osc.frequency.setValueAtTime(frequency,start);
      if(slide)osc.frequency.exponentialRampToValueAtTime(slide,end);
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(level*volume,start+.005);
      gain.gain.exponentialRampToValueAtTime(.0001,end);
      osc.connect(gain);gain.connect(master);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(end+.005);
    }
  }
  function writeModeValue(key,value){
    if(window.ModeAtlasStorage?.set)return window.ModeAtlasStorage.set(key,value);
    try{localStorage.setItem(key,value);return true;}catch{return false;}
  }
  function setMode(value){
    const mode=normaliseMode(value);writeModeValue(KEY,mode);refreshSoundControls();
    window.dispatchEvent(new CustomEvent('modeAtlasSoundChanged',{detail:{mode}}));
    if(mode!=='off')play('tap',{cooldown:0});return mode;
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
    ['tap','correct','wrong','finish','achievement'].forEach((name,index)=>setTimeout(()=>play(name,{cooldown:0}),index*450));
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
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.addEventListener('modeAtlasSettingsMenuReady',()=>bindSoundControls());
})();
