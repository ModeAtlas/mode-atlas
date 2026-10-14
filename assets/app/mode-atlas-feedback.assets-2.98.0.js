(function ModeAtlasFeedbackOwner(root){
  'use strict';
  if (root.ModeAtlasFeedback) return;

  const TONES = Object.freeze({
    ok:'success', success:'success',
    neutral:'info', info:'info',
    warn:'warning', warning:'warning',
    bad:'error', err:'error', error:'error', danger:'error'
  });

  function tone(value){ return TONES[String(value || 'info').toLowerCase()] || 'info'; }

  function toast(message, value = 'info', duration = 2800, options = {}){
    const normalized = tone(value);
    if (typeof root.ModeAtlas?.toast === 'function') return root.ModeAtlas.toast(message, normalized, duration, options);
    if (typeof root.ModeAtlasToast === 'function') return root.ModeAtlasToast(message, normalized, duration, options);
    console.info('[Mode Atlas]', message);
    return null;
  }

  function resolveTarget(target){
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    return target;
  }

  function status(target, message, value = 'info'){
    const el = resolveTarget(target);
    if (!el) return false;
    const normalized = tone(value);
    el.textContent = String(message || '');
    el.classList.add('ma-status');
    ['info','success','warning','error'].forEach((name) => el.classList.remove(`ma-status--${name}`));
    if (message) el.classList.add(`ma-status--${normalized}`);
    el.setAttribute('role', normalized === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', normalized === 'error' ? 'assertive' : 'polite');
    return true;
  }

  function clearStatus(target){
    const el = resolveTarget(target);
    if (!el) return false;
    el.textContent = '';
    ['info','success','warning','error'].forEach((name) => el.classList.remove(`ma-status--${name}`));
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    return true;
  }

  function alert(input){
    if (root.ModeAtlasDialog?.alert) return root.ModeAtlasDialog.alert(input);
    toast(typeof input === 'string' ? input : input?.message || 'Something went wrong.', input?.tone || 'error', 4200);
    return Promise.resolve(true);
  }

  function confirm(input){
    if (root.ModeAtlasDialog?.confirm) return root.ModeAtlasDialog.confirm(input);
    console.warn('[Mode Atlas] Dialog owner unavailable; confirmation cancelled safely.');
    return Promise.resolve(false);
  }

  let keyHaptic=null,lastHaptic=0;
  function haptic(kind){
    if(!root.ModeAtlasEnv?.isNativeApp||root.ModeAtlasStorage?.get('modeAtlasHaptics','on')==='off')return;
    const engine=root.Capacitor?.Plugins?.Haptics;if(!engine)return;
    clearTimeout(keyHaptic);
    const play=()=>{
      if(Date.now()-lastHaptic<(kind==='key'?35:90))return;
      lastHaptic=Date.now();
      const action=['complete','milestone','incorrect'].includes(kind)&&engine.notification
        ?engine.notification({type:kind==='incorrect'?'WARNING':'SUCCESS'}):engine.impact?.({style:'LIGHT'});
      Promise.resolve(action).catch(()=>{});
    };
    if(kind==='key')keyHaptic=setTimeout(play,35);else play();
  }
  function question(element){
    if(!root.ModeAtlasEnv?.isNativeApp||!element?.animate||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    element.animate([{opacity:.65},{opacity:1}],{duration:140,easing:'ease-out'});
  }
  function syncHaptics(){
    document.querySelectorAll('[data-ma-haptic-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.maHapticChoice===(root.ModeAtlasStorage?.get('modeAtlasHaptics','on')||'on'))));
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-ma-haptic-choice]');if(!button)return;
    root.ModeAtlasStorage.set('modeAtlasHaptics',button.dataset.maHapticChoice);syncHaptics();haptic('key');
  });
  document.addEventListener('DOMContentLoaded',syncHaptics);
  document.addEventListener('ma:ui-refresh',syncHaptics);
  root.ModeAtlasFeedback = Object.freeze({ tone, toast, status, clearStatus, alert, confirm, haptic, question });
})(window);
