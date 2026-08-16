(function initModeAtlasNavigationMenu(){
  'use strict';
  var menu = document.querySelector('[data-ma-kana-menu]');
  if (!menu || menu.dataset.maMenuBound === '1') return;

  var trigger = menu.querySelector('[data-ma-kana-menu-trigger]');
  var panel = menu.querySelector('[data-ma-kana-nav]');
  if (!trigger || !panel) return;

  menu.dataset.maMenuBound = '1';
  var closeTimer = 0;
  var hoverQuery = window.matchMedia ? window.matchMedia('(hover:hover) and (pointer:fine)') : null;

  function isOpen(){
    return menu.classList.contains('is-open');
  }

  function setOpen(open){
    window.clearTimeout(closeTimer);
    menu.classList.toggle('is-open', !!open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeAfterPointerLeave(){
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(function(){
      if (!menu.contains(document.activeElement)) setOpen(false);
    }, 120);
  }

  if (!hoverQuery || hoverQuery.matches) {
    menu.addEventListener('mouseenter', function(){ setOpen(true); });
    menu.addEventListener('mouseleave', closeAfterPointerLeave);
  }

  trigger.addEventListener('click', function(event){
    event.preventDefault();
    setOpen(!isOpen());
  });

  menu.addEventListener('focusin', function(){ setOpen(true); });
  menu.addEventListener('focusout', function(){
    window.setTimeout(function(){
      if (!menu.contains(document.activeElement)) setOpen(false);
    }, 0);
  });

  document.addEventListener('pointerdown', function(event){
    if (!menu.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', function(event){
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    trigger.focus();
  });
})();
