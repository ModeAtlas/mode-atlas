(function initModeAtlasNavigationMenu(){
  'use strict';
  var nav = document.querySelector('.ma-nav');
  var navSpacer = document.querySelector('[data-ma-nav-spacer]');

  function effectiveDisplayMode(){
    return document.body?.dataset?.effectiveDisplayMode
      || document.documentElement?.dataset?.effectiveDisplayMode
      || '';
  }

  function bindPhoneScrollNavigation(){
    if (!nav || nav.dataset.maPhoneScrollBound === '1') return;
    nav.dataset.maPhoneScrollBound = '1';

    var lastY = Math.max(0, window.scrollY || 0);
    var direction = 0;
    var travel = 0;
    var ticking = false;

    function syncPhoneNavGeometry(){
      if (!navSpacer) return;
      if (effectiveDisplayMode() !== 'phone') {
        navSpacer.style.removeProperty('height');
        return;
      }
      var height = Math.ceil(nav.getBoundingClientRect().height);
      navSpacer.style.height = Math.max(0, height + 18) + 'px';
    }

    function reveal(){
      nav.classList.remove('ma-nav--scroll-hidden');
    }

    function resetMotion(currentY){
      lastY = currentY;
      direction = 0;
      travel = 0;
    }

    function update(){
      ticking = false;
      var currentY = Math.max(0, window.scrollY || 0);
      var delta = currentY - lastY;

      if (effectiveDisplayMode() !== 'phone' || document.body?.classList.contains('study-nav-hidden')) {
        reveal();
        resetMotion(currentY);
        return;
      }

      if (currentY <= 12 || nav.contains(document.activeElement)) {
        reveal();
        resetMotion(currentY);
        return;
      }

      if (Math.abs(delta) < 0.5) {
        lastY = currentY;
        return;
      }

      var nextDirection = delta > 0 ? 1 : -1;
      if (nextDirection !== direction) {
        direction = nextDirection;
        travel = 0;
      }
      travel += Math.abs(delta);

      if (direction > 0 && travel >= 12) {
        nav.classList.add('ma-nav--scroll-hidden');
      } else if (direction < 0 && travel >= 48) {
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
    window.addEventListener('resize', syncPhoneNavGeometry, { passive:true });
    window.addEventListener('orientationchange', syncPhoneNavGeometry, { passive:true });
    window.addEventListener('modeAtlasDisplayModeChanged', function(){
      resetMotion(Math.max(0, window.scrollY || 0));
      syncPhoneNavGeometry();
      reveal();
    });
    nav.addEventListener('focusin', reveal);
    nav.addEventListener('pointerdown', reveal);
    if (window.ResizeObserver) {
      new ResizeObserver(syncPhoneNavGeometry).observe(nav);
    }
    syncPhoneNavGeometry();
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