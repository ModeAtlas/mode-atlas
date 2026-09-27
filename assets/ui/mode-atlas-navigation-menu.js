(function initModeAtlasNavigationMenu(){
  'use strict';
  var nav = document.querySelector('.ma-nav');

  function effectiveDisplayMode(){
    return document.body?.dataset?.effectiveDisplayMode
      || document.documentElement?.dataset?.effectiveDisplayMode
      || '';
  }

  function bindPhoneScrollNavigation(){
    if (!nav || nav.dataset.maPhoneScrollBound === '1') return;
    nav.dataset.maPhoneScrollBound = '1';

    var lastY = Math.max(0, window.scrollY || 0);
    var ticking = false;

    function reveal(){
      nav.classList.remove('ma-nav--scroll-hidden');
    }

    function update(){
      ticking = false;
      var currentY = Math.max(0, window.scrollY || 0);
      var delta = currentY - lastY;

      if (effectiveDisplayMode() !== 'phone' || document.body?.classList.contains('study-nav-hidden')) {
        reveal();
        lastY = currentY;
        return;
      }

      if (currentY <= 12 || nav.contains(document.activeElement)) {
        reveal();
      } else if (delta > 3) {
        nav.classList.add('ma-nav--scroll-hidden');
      } else if (delta < -3) {
        reveal();
      }

      lastY = currentY;
    }

    function schedule(){
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', schedule, { passive:true });
    window.addEventListener('modeAtlasDisplayModeChanged', function(){
      lastY = Math.max(0, window.scrollY || 0);
      reveal();
    });
    nav.addEventListener('focusin', reveal);
    nav.addEventListener('pointerdown', reveal);
    update();
  }

  bindPhoneScrollNavigation();

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

  trigger.addEventListener('click', function(){
    setOpen(true);
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