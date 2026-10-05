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

    var navSpacer = document.querySelector('[data-ma-nav-spacer]');
    var lastY = Math.max(0, window.scrollY || 0);
    var direction = 0;
    var travel = 0;
    var ticking = false;

    function syncPhoneNavGeometry(){
      if (!navSpacer) return;
      if (effectiveDisplayMode() !== 'phone' || document.body?.classList.contains('study-nav-hidden')) {
        navSpacer.style.removeProperty('height');
        return;
      }
      var rect = nav.getBoundingClientRect();
      navSpacer.style.height = Math.max(0, Math.ceil(rect.bottom + 12)) + 'px';
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

})();
