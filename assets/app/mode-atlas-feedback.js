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

  function toast(message, value = 'info', duration = 2800){
    const normalized = tone(value);
    if (typeof root.ModeAtlas?.toast === 'function') return root.ModeAtlas.toast(message, normalized, duration);
    if (typeof root.ModeAtlasToast === 'function') return root.ModeAtlasToast(message, normalized, duration);
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

  root.ModeAtlasFeedback = Object.freeze({ tone, toast, status, clearStatus, alert, confirm });
})(window);
