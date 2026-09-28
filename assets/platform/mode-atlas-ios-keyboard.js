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
    root.requestAnimationFrame(measure);
    new MutationObserver(function(){
      if (document.body.classList.contains('ma-session-paused') || document.body.classList.contains('trainer-session-result')) input.blur();
      root.requestAnimationFrame(measure);
    }).observe(document.body, {attributes:true, attributeFilter:['class']});

    keyboard.addEventListener('pointerdown', function(event){
      if (event.target.closest('button')) event.preventDefault();
    });
    keyboard.addEventListener('click', function(event){
      var key = event.target.closest('button[data-key]');
      if (!key || input.disabled || !document.body.classList.contains('trainer-session-active')) return;
      var start = input.selectionStart ?? input.value.length;
      var end = input.selectionEnd ?? start;
      if (key.dataset.key === 'delete') {
        if (start === end && start > 0) start -= 1;
        input.value = input.value.slice(0, start) + input.value.slice(end);
      } else {
        input.value = input.value.slice(0, start) + key.dataset.key + input.value.slice(end);
        start += 1;
      }
      input.focus({preventScroll:true});
      input.setSelectionRange(start, start);
      input.dispatchEvent(new Event('input', {bubbles:true}));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})(window);
