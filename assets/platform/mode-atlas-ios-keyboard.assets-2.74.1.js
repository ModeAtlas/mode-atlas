/* Native Reading input surface. Answer evaluation remains owned by the shared trainer. */
(function ModeAtlasIOSReadingKeyboard(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp || root.ModeAtlasEnv.nativePlatform !== 'ios') return;

  function init(){
    if (!document.body.classList.contains('ma-reading-page')) return;
    var input = document.getElementById('input');
    var card = document.querySelector('.ma-trainer-card');
    if (!input || !card) return;

    // Readonly keeps the actual answer control focusable and accessible while
    // preventing the system keyboard from obscuring the practice surface.
    input.readOnly = true;
    input.setAttribute('inputmode', 'none');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    const status = document.createElement('span');
    status.className = 'ma-ios-accessibility-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    card.appendChild(status);
    document.body.classList.add('ma-ios-custom-input');

    var keyboard = document.createElement('div');
    keyboard.className = 'ma-ios-reading-keyboard';
    keyboard.setAttribute('role', 'group');
    keyboard.setAttribute('aria-label', 'Reading romaji keyboard');
    ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].forEach(function(row, rowIndex){
      var line = document.createElement('div');
      line.className = 'ma-ios-reading-keyboard__row';
      for (var i = 0; i < row.length; i++) {
        var key = document.createElement('button');
        key.type = 'button';
        key.className = 'ma-ios-reading-keyboard__key';
        key.textContent = row[i];
        key.dataset.key = row[i];
        line.appendChild(key);
      }
      if (rowIndex === 2) {
        var deleteKey = document.createElement('button');
        deleteKey.type = 'button';
        deleteKey.className = 'ma-ios-reading-keyboard__key ma-ios-reading-keyboard__key--delete';
        deleteKey.textContent = '⌫';
        deleteKey.dataset.key = 'delete';
        deleteKey.setAttribute('aria-label', 'Delete last letter');
        line.appendChild(deleteKey);
      }
      keyboard.appendChild(line);
    });
    document.body.appendChild(keyboard);
    function measure(){
      document.documentElement.style.setProperty('--ma-ios-custom-kb-height', keyboard.getBoundingClientRect().height + 'px');
    }
    root.addEventListener('resize', measure);
    new ResizeObserver(measure).observe(keyboard, {box:'border-box'});
    root.requestAnimationFrame(measure);
    new MutationObserver(function(){
      if (document.body.classList.contains('ma-session-paused') || document.body.classList.contains('trainer-session-result') || document.body.classList.contains('ma-study-feedback-open')) input.blur();
      root.requestAnimationFrame(measure);
    }).observe(document.body, {attributes:true, attributeFilter:['class']});

    function feedback(){
      root.ModeAtlasFeedback?.haptic('key');
    }
    var pressedKey = null;
    function release(){
      if (!pressedKey) return;
      var key = pressedKey;
      pressedKey = null;
      root.setTimeout(function(){ key.classList.remove('is-pressed'); }, 85);
    }
    keyboard.addEventListener('pointerdown', function(event){
      var key = event.target.closest('button[data-key]');
      if (!key || input.disabled || !document.body.classList.contains('trainer-session-active')) return;
      event.preventDefault();
      release();
      pressedKey = key;
      key.classList.add('is-pressed');
      feedback();
    });
    keyboard.addEventListener('pointerup', release);
    keyboard.addEventListener('pointercancel', release);
    keyboard.addEventListener('pointerleave', release);
    keyboard.addEventListener('click', function(event){
      var key = event.target.closest('button[data-key]');
      if (!key || input.disabled || !document.body.classList.contains('trainer-session-active')) return;
      if (event.detail === 0) feedback(); // Hardware keyboard/accessibility activation.
      var start = input.selectionStart ?? input.value.length;
      var end = input.selectionEnd ?? start;
      if (key.dataset.key === 'delete') {
        if (start === end && start > 0) start -= 1;
        input.value = input.value.slice(0, start) + input.value.slice(end);
      } else {
        input.value = input.value.slice(0, start) + key.dataset.key + input.value.slice(end);
        start += 1;
      }
      // VoiceOver and hardware-key activation retain focus on the key.
      if (event.detail !== 0) input.focus({preventScroll:true});
      input.setSelectionRange(start, start);
      input.dispatchEvent(new Event('input', {bubbles:true}));
      if (event.detail === 0) status.textContent = input.value ? 'Answer: ' + input.value : 'Answer cleared';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})(window);
