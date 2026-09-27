/* Mode Atlas app-wide sound system
   Single source of truth for UI, answer, notification, session and dev-test sounds.
   All sounds share the same AudioContext, master gain and mode setting. */
(function(){
  'use strict';

  const VERSION = String(window.ModeAtlasVersion || window.MODE_ATLAS_VERSION || 'dev-local');
  const KEY = 'modeAtlasSound';
  const LEGACY_KEYS = ['maSoundMode','modeAtlasSoundMode','soundMode']; // read-only migration sources
  const VALID_MODES = new Set(['soft','loud','off']);
  const DEFAULT_MODE = 'soft';

  let ctx = null;
  let master = null;
  let compressor = null;
  let resumePromise = null;
  let audioPrimed = false;
  let playDelayOffset = 0;
  const lastPlay = Object.create(null);

  function normaliseMode(value){
    if(value === 'on' || value === 'true' || value === true) return 'soft';
    if(value === 'false' || value === false) return 'off';
    return VALID_MODES.has(value) ? value : DEFAULT_MODE;
  }

  function getMode(){
    const store = window.ModeAtlasStorage;
    let value = store?.get?.(KEY) ?? localStorage.getItem(KEY);
    if(!value){
      for(const legacyKey of LEGACY_KEYS){
        value = store?.get?.(legacyKey) ?? localStorage.getItem(legacyKey);
        if(value){
          const migrated = normaliseMode(value);
          try { store?.set?.(KEY, migrated) ?? localStorage.setItem(KEY, migrated); } catch(err) {}
          return migrated;
        }
      }
    }
    return normaliseMode(value);
  }

  function isEnabled(){
    return getMode() !== 'off';
  }

  function modeMultiplier(){
    // App-wide levels. `soft` is now a clear normal volume; `loud` is intentionally much stronger.
    return getMode() === 'loud' ? 3.85 : 2.25;
  }

  const SOUND_TRIM = {
    // These trims are deliberately closer together than older versions so sounds feel evenly loud.
    tap: 1.38, toggle: 1.38, open: 1.38, close: 1.38, select: 1.38, tab: 1.38, nav: 1.50, menu: 1.40, primary: 1.40,
    pause: 1.42, resume: 1.42, skip: 1.38, notify: 1.32, notification: 1.32, warning: 1.34, error: 1.34,
    correct: 1.18, wrong: 1.22, incorrect: 1.22, finish: 1.16, session: 1.16, complete: 1.16, achievement: 1.12
  };

  function soundTrim(name){
    return SOUND_TRIM[name] || 1;
  }

  function ensureAudio(force){
    if(!force && !isEnabled()) return null;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      if(!ctx) ctx = new AC();
      if(ctx.state === 'suspended'){
        resumePromise = ctx.resume().then(() => { audioPrimed = true; return ctx; }).catch(()=>null);
      }else{
        audioPrimed = true;
      }
      if(!master){
        compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -10;
        compressor.knee.value = 18;
        compressor.ratio.value = 2.5;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.11;

        master = ctx.createGain();
        master.gain.value = 1.08;
        master.connect(compressor);
        compressor.connect(ctx.destination);
      }
      return ctx;
    }catch(err){
      return null;
    }
  }

  function primeAudio(){
    const c = ensureAudio(true);
    if(!c || !master) return false;

    const warm = () => {
      if(audioPrimed) return;
      audioPrimed = true;
      try{
        const g = c.createGain();
        const o = c.createOscillator();
        g.gain.value = 0.00001;
        o.frequency.value = 440;
        o.connect(g);
        g.connect(master);
        const t = c.currentTime + 0.001;
        o.start(t);
        o.stop(t + 0.018);
      }catch(err){}
    };

    if(c.state === 'running') warm();
    else if(resumePromise && typeof resumePromise.then === 'function') resumePromise.then(warm).catch(()=>{});
    return c.state === 'running' && audioPrimed;
  }

  function envelope(gain, duration, delay){
    const c = ensureAudio(false);
    if(!c || !master) return null;
    const start = c.currentTime + playDelayOffset + (delay || 0);
    const end = start + Math.max(0.04, duration || 0.08);
    const g = c.createGain();
    g.connect(master);
    g.gain.cancelScheduledValues(start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    return { c, g, start, end };
  }

  function osc(freq, duration, type, gain, delay, slideTo){
    const p = envelope(gain, duration, delay);
    if(!p) return;
    const o = p.c.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, p.start);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, p.end);
    o.connect(p.g);
    try{
      o.start(p.start);
      o.stop(p.end + 0.025);
    }catch(err){}
  }

  function noise(duration, gain, delay){
    const c = ensureAudio(false);
    if(!c || !master) return;
    const p = envelope(gain, duration, delay);
    if(!p) return;
    const len = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i = 0; i < len; i++){
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(p.g);
    try{
      src.start(p.start);
      src.stop(p.end + 0.02);
    }catch(err){}
  }

  function hashText(value){
    const str = String(value || '');
    let h = 2166136261;
    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
  }

  function elementVariant(el, modulo){
    const key = el ? [el.id, el.className, el.getAttribute?.('aria-label'), el.title, el.textContent].join('|') : Date.now();
    return hashText(key) % Math.max(1, modulo || 4);
  }

  function sparkle(base, delay, v){
    osc(base, 0.038, 'sine', 0.012 * v, delay || 0);
    osc(base * 1.5, 0.032, 'sine', 0.007 * v, (delay || 0) + 0.026);
  }

  function play(name, options){
    const opts = options || {};
    if(!opts.force && !isEnabled()) return;

    const now = Date.now();
    const cooldown = opts.cooldown ?? (
      name === 'tap' || name === 'toggle' || name === 'open' || name === 'close' ? 48 : 115
    );
    if(lastPlay[name] && now - lastPlay[name] < cooldown) return;
    lastPlay[name] = now;

    ensureAudio(!!opts.force);
    const v = modeMultiplier() * soundTrim(name) * (opts.boost || 1);
    const previousDelayOffset = playDelayOffset;
    playDelayOffset = opts.delay || 0;

    try{
      switch(name){
      case 'correct':
        osc(660, 0.095, 'sine', 0.050 * v, 0);
        osc(880, 0.115, 'sine', 0.043 * v, 0.058);
        sparkle(1320, 0.118, v);
        break;
      case 'wrong':
      case 'incorrect':
        osc(230, 0.13, 'triangle', 0.052 * v, 0, 185);
        osc(152, 0.16, 'triangle', 0.036 * v, 0.072);
        noise(0.045, 0.006 * v, 0.02);
        break;
      case 'achievement':
        osc(523, 0.075, 'sine', 0.045 * v, 0);
        osc(659, 0.085, 'sine', 0.047 * v, 0.058);
        osc(784, 0.11, 'sine', 0.049 * v, 0.122);
        osc(1046, 0.145, 'sine', 0.034 * v, 0.225);
        sparkle(1568, 0.31, v);
        break;
      case 'notify':
      case 'notification':
        osc(560, 0.075, 'sine', 0.041 * v, 0);
        osc(740, 0.095, 'sine', 0.034 * v, 0.058);
        break;
      case 'warning':
        osc(330, 0.09, 'triangle', 0.037 * v, 0);
        osc(245, 0.12, 'triangle', 0.030 * v, 0.07);
        break;
      case 'error':
        osc(210, 0.12, 'triangle', 0.043 * v, 0);
        noise(0.07, 0.010 * v, 0.02);
        break;
      case 'finish':
      case 'session':
      case 'complete':
        osc(392, 0.095, 'sine', 0.042 * v, 0);
        osc(523, 0.11, 'sine', 0.044 * v, 0.078);
        osc(659, 0.15, 'sine', 0.047 * v, 0.178);
        sparkle(988, 0.30, v);
        break;
      case 'pause':
        osc(410, 0.07, 'sine', 0.029 * v, 0);
        osc(305, 0.105, 'sine', 0.027 * v, 0.055);
        break;
      case 'resume':
        osc(305, 0.07, 'sine', 0.029 * v, 0);
        osc(430, 0.105, 'sine', 0.028 * v, 0.055);
        break;
      case 'skip':
        osc(285, 0.09, 'triangle', 0.031 * v, 0);
        noise(0.055, 0.010 * v, 0.03);
        break;
      case 'toggle': {
        const n = opts.variant || 0;
        const base = [470, 505, 535, 565][n % 4];
        osc(base, 0.052, 'triangle', 0.037 * v, 0);
        osc(base + 145, 0.058, 'sine', 0.027 * v, 0.04);
        break;
      }
      case 'open': {
        const n = opts.variant || 0;
        const base = [520, 545, 570, 600][n % 4];
        osc(base, 0.055, 'sine', 0.039 * v, 0);
        osc(base + 125, 0.062, 'sine', 0.026 * v, 0.045);
        break;
      }
      case 'close': {
        const n = opts.variant || 0;
        const base = [440, 410, 380, 350][n % 4];
        osc(base, 0.055, 'sine', 0.038 * v, 0);
        osc(Math.max(220, base - 92), 0.062, 'sine', 0.025 * v, 0.044);
        break;
      }
      case 'select': {
        const n = opts.variant || 0;
        const base = [610, 645, 685, 720][n % 4];
        osc(base, 0.045, 'sine', 0.034 * v, 0);
        sparkle(base * 1.25, 0.038, v);
        break;
      }
      case 'tab': {
        const n = opts.variant || 0;
        const base = [500, 530, 560, 590][n % 4];
        osc(base, 0.050, 'triangle', 0.035 * v, 0);
        osc(base + 70, 0.045, 'sine', 0.020 * v, 0.035);
        break;
      }
      case 'nav': {
        const n = opts.variant || 0;
        const base = [540, 580, 620, 665][n % 4];
        osc(base, 0.070, 'sine', 0.046 * v, 0);
        osc(base * 1.25, 0.082, 'sine', 0.030 * v, 0.038);
        break;
      }
      case 'menu': {
        const n = opts.variant || 0;
        const base = [475, 510, 545, 575][n % 4];
        osc(base, 0.052, 'triangle', 0.040 * v, 0);
        osc(base + 110, 0.056, 'sine', 0.024 * v, 0.038);
        noise(0.025, 0.0028 * v, 0.006);
        break;
      }
      case 'primary': {
        const n = opts.variant || 0;
        const base = [620, 660, 705, 750][n % 4];
        osc(base, 0.052, 'sine', 0.045 * v, 0);
        osc(base + 170, 0.060, 'sine', 0.028 * v, 0.042);
        break;
      }
      case 'tap':
      default: {
        const n = opts.variant || 0;
        const base = [485, 520, 555, 590, 630, 670][n % 6];
        osc(base, 0.048, n % 2 ? 'triangle' : 'sine', 0.039 * v, 0);
        break;
      }
      }
    } finally {
      playDelayOffset = previousDelayOffset;
    }
  }

  function writeModeValue(key, mode){
    const store = window.ModeAtlasStorage;
    if(store && typeof store.set === 'function') return store.set(key, mode);
    try{
      localStorage.setItem(key, mode);
      return true;
    }catch(err){
      return false;
    }
  }

  function setMode(value){
    const mode = normaliseMode(value);
    writeModeValue(KEY, mode);
    refreshSoundControls();
    window.dispatchEvent(new CustomEvent('modeAtlasSoundChanged', { detail: { mode } }));
    if(mode !== 'off') play(mode === 'loud' ? 'achievement' : 'open', { cooldown: 0, boost: mode === 'loud' ? 0.85 : 1 });
    return mode;
  }


  const boundSoundControls = new WeakSet();

  function bindSoundControls(scope){
    const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
    root.querySelectorAll('[data-ma-sound-choice]').forEach(btn => {
      if(boundSoundControls.has(btn)) return;
      boundSoundControls.add(btn);
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        setMode(btn.dataset.maSoundChoice);
      });
    });
    refreshSoundControls();
  }

  function refreshSoundControls(){
    const current = getMode();
    document.querySelectorAll('[data-sound],[data-ma-sound-choice],[data-ma-dev-sound]').forEach(btn => {
      const raw = btn.dataset.sound || btn.dataset.maSoundChoice || btn.dataset.maDevSound;
      const value = normaliseMode(raw);
      const active = value === current;
      btn.classList.toggle('active', active);
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if(active) btn.setAttribute('data-active', 'true');
      else btn.removeAttribute('data-active');
    });
  }





  function testSound(){
    if(getMode() === 'off') setMode('soft');
    ensureAudio(true);
    play('tap', { cooldown: 0 });
    setTimeout(() => play('toggle', { cooldown: 0 }), 135);
    setTimeout(() => play('correct', { cooldown: 0 }), 310);
    setTimeout(() => play('wrong', { cooldown: 0 }), 560);
    setTimeout(() => play('finish', { cooldown: 0 }), 835);
  }

  function inferButtonSound(el){
    if(!el) return 'tap';
    const explicit = el.getAttribute && el.getAttribute('data-ma-click-sound');
    if(explicit) return explicit === 'none' ? null : explicit;
    if(el.matches('[data-ma-dev-test-sound]')) return 'notify';
    if(el.matches('[data-ma-sound-choice],[data-sound],[data-ma-dev-sound]')) return 'toggle';
    if(el.matches('.choice-btn,.answer-btn,[data-answer],[data-choice-answer]')) return 'tap';

    const text = (el.textContent || el.getAttribute('aria-label') || el.title || '').toLowerCase();
    const idClass = ((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '')).toLowerCase();
    const all = text + ' ' + idClass;

    if(/pause/.test(all)) return 'pause';
    if(/resume|continue/.test(all)) return 'resume';
    if(/don.t know|skip/.test(all)) return 'skip';
    if(/end session|finish|complete|submit test|done/.test(all)) return 'finish';
    if(el.matches && el.matches('a[href]')){
      const href = el.getAttribute('href') || '';
      if(href && href !== '#' && !href.startsWith('javascript:')) return 'nav';
    }
    if(/close|cancel|back|hide/.test(all)) return 'close';
    if(/tab|filter|sort|view|result|stats|scores|graph|selected/.test(all)) return 'tab';
    if(/start|launch|begin/.test(all)) return 'primary';
    if(/profile|about|dev menu|menu|settings|drawer|account/ .test(all)) return 'menu';
    if(/reading|writing|atlas|kana|word|bank|results|home/.test(all)) return 'nav';
    if(/edit|save|load|import|export|copy|sign in/.test(all)) return 'open';
    if(/delete|reset|remove|trash|danger|clear/.test(all)) return 'warning';
    if(/on|off|toggle|dakuten|yōon|youon|katakana|hiragana|keyboard|buttons|compact|mobile|auto|mode|daily|practice|preset|theme|loud|soft|sound/.test(all)) return 'toggle';
    return 'tap';
  }

  function safeWrapGlobal(name, soundOrFactory){
    try{
      const original = window[name];
      if(typeof original !== 'function' || original.__maStandardSoundWrapped) return;
      const wrapped = function(){
        try{
          const sound = typeof soundOrFactory === 'function' ? soundOrFactory.apply(this, arguments) : soundOrFactory;
          if(sound) play(sound, { cooldown: 130 });
        }catch(err){}
        return original.apply(this, arguments);
      };
      wrapped.__maStandardSoundWrapped = true;
      window[name] = wrapped;
    }catch(err){}
  }

  function wrapKnownFunctions(){
    safeWrapGlobal('flashResult', function(correct){ return correct ? 'correct' : 'wrong'; });
    safeWrapGlobal('endSession', 'finish');
    safeWrapGlobal('endDailyChallenge', 'finish');
    safeWrapGlobal('endTestMode', 'finish');
    safeWrapGlobal('showEnhancedEndScreen', 'finish');
    safeWrapGlobal('skipCurrentKana', 'skip');
    safeWrapGlobal('markSkipped', 'skip');

    window.ModeAtlas = window.ModeAtlas || {};
    if(typeof window.ModeAtlas.toast === 'function' && !window.ModeAtlas.toast.__maStandardSoundWrapped){
      const oldToast = window.ModeAtlas.toast;
      window.ModeAtlas.toast = function(message, type, ms){
        const text = String(message || '');
        if(/achievement unlocked/i.test(text)) play('achievement', { cooldown: 250 });
        else if(type === 'err' || type === 'error' || /failed|error/i.test(text)) play('error');
        else if(type === 'warn' || type === 'warning' || /warning/i.test(text)) play('warning');
        else play('notify');
        return oldToast.apply(this, arguments);
      };
      window.ModeAtlas.toast.__maStandardSoundWrapped = true;
    }
  }

  function bindEvents(){
    if(window.__modeAtlasStandardSoundEventsBound) return;
    window.__modeAtlasStandardSoundEventsBound = true;

    const unlock = () => primeAudio();
    const recentPointerSound = new WeakMap();
    function clickableFromEvent(event){
      return event.target.closest?.('button,a,input[type="button"],input[type="submit"],input[type="reset"],input[type="checkbox"],input[type="radio"],select,summary,label[for],.btn,.toggle-btn,.ma-preset-toggle,.ma-structured-toggle,.option-btn,.choice-btn,.ma-button,.ma-nav__link,.ma-nav__action,.launch-card,.test-tile,.mode-card,.action-card,.menu-item,.tab,.tab-button,.chip,.pill,.card,.button-like,.inline-toggle-btn,.row-view-btn,.star-btn,.debug-delete-btn,.summary-toggle,.ma-display-option,[data-action],[data-mode],[data-view],[data-tab],[data-ma-click-sound],[onclick],[role="button"],[tabindex]:not(input):not(textarea)');
    }
    function shouldSoundClickable(el){
      return !!(el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.matches?.('input[type="file"],input[type="text"],input[type="number"],textarea'));
    }

    function isPlainPrimaryActivation(event){
      return !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (event.button == null || event.button === 0);
    }

    function sameWindowNavLink(el){
      if(!el || !el.matches?.('a[href]')) return null;
      const href = el.getAttribute('href') || '';
      if(!href || href === '#' || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
      if(el.hasAttribute('download')) return null;
      const target = (el.getAttribute('target') || '').toLowerCase();
      if(target && target !== '_self') return null;
      try{
        const url = new URL(href, window.location.href);
        if(url.origin !== window.location.origin) return null;
        return url;
      }catch(err){
        return null;
      }
    }

    document.addEventListener('pointerdown', event => {
      const readyBeforePress = !!(ctx && ctx.state === 'running' && audioPrimed);
      unlock();
      if(event.button != null && event.button !== 0) return;
      const el = clickableFromEvent(event);
      if(!shouldSoundClickable(el)) return;
      if(el.matches?.('[data-ma-dev-test-sound],[data-ma-sound-choice],[data-sound],[data-ma-dev-sound]')) return;
      const sound = inferButtonSound(el);
      if(sound){
        recentPointerSound.set(el, Date.now());
        play(sound, {
          cooldown: 28,
          variant: elementVariant(el, sound === 'tap' ? 6 : 4),
          delay: readyBeforePress ? 0 : 0.05,
          boost: readyBeforePress ? 1 : 1.18
        });
      }
    }, { capture: true, passive: true });
    document.addEventListener('touchstart', unlock, { capture: true, passive: true });

    document.addEventListener('keydown', event => {
      unlock();
      if(event.isComposing || event.keyCode === 229) return;
      const textEntry = event.target.closest?.('input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"],[contenteditable="plaintext-only"]');
      if(textEntry) return;
      if(event.key === 'Enter') play('tap', { cooldown: 60 });
      else if(event.key === 'Escape') play('close', { cooldown: 90 });
      else if(/^[1-8]$/.test(event.key) || event.key === ' ') play('tap', { cooldown: 55 });
    }, true);

    document.addEventListener('change', event => {
      const control = event.target.closest?.('select,input[type="checkbox"],input[type="radio"],input[type="range"]');
      if(control && !control.disabled){
        play('select', { cooldown: 55, variant: elementVariant(control, 4) });
      }
    }, true);

    document.addEventListener('click', event => {
      const testBtn = event.target.closest?.('[data-ma-dev-test-sound]');
      if(testBtn){
        event.preventDefault();
        event.stopPropagation();
        testSound();
        return;
      }

      const soundChoice = event.target.closest?.('[data-ma-sound-choice],[data-sound],[data-ma-dev-sound]');
      if(soundChoice){
        if(soundChoice.matches?.('[data-ma-sound-choice]')) return;
        event.preventDefault();
        event.stopPropagation();
        setMode(soundChoice.dataset.sound || soundChoice.dataset.maDevSound);
        return;
      }

      const clickable = clickableFromEvent(event);
      const navUrl = sameWindowNavLink(clickable);
      if(navUrl && isPlainPrimaryActivation(event)){
        const last = recentPointerSound.get(clickable) || 0;
        if(Date.now() - last > 180){
          play('nav', { cooldown: 0, variant: elementVariant(clickable, 4), boost: 1.08 });
        }
        return;
      }

      if(shouldSoundClickable(clickable)){
        const last = recentPointerSound.get(clickable) || 0;
        if(Date.now() - last > 180){
          const sound = inferButtonSound(clickable);
          if(sound) play(sound, { cooldown: 42, variant: elementVariant(clickable, sound === 'tap' ? 6 : 4) });
        }
      }
    }, true);
  }

  function init(){
    window.ModeAtlasSounds = {
      play,
      setSound: setMode,
      setMode,
      getSoundMode: getMode,
      getMode,
      refresh: refreshSoundControls,
      testSound,
      version: VERSION
    };

    bindSoundControls();
    bindEvents();
    wrapKnownFunctions();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.addEventListener('modeAtlasSettingsMenuReady', () => bindSoundControls());
})();
