/* Mode Atlas early loader. Owns loading-screen hide timing. */
(function(){
  var hidden = false;

  function hide(){
    if (hidden) return;
    var el = document.getElementById('maLoadingScreen');
    if (!el) return;
    hidden = true;
    el.classList.add('done');
    setTimeout(function(){ try { el.remove(); } catch(e) {} }, window.ModeAtlasEnv?.isNativeApp ? 360 : 220);
  }

  function schedule(delay){
    setTimeout(hide, delay);
  }

  // The native launch screen hands off to this branded surface. Keep it up
  // until the document and its CSS have painted, including on slower devices.
  if (window.ModeAtlasEnv?.isNativeApp) {
    var coldLaunch = document.documentElement.dataset.maNativeWarm !== 'true';
    function nativeReady(){
      if (!coldLaunch) { schedule(0); return; }
      var screen = document.getElementById('maLoadingScreen');
      var mark = screen?.querySelector('.ma-loading-mark');
      if (!mark || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        schedule(100);
        return;
      }
      mark.addEventListener('animationend', function(event){
        if (event.target === mark && event.animationName === 'ma-ios-mark-spin') schedule(80);
      }, {once:true});
      // A missing animation event must not hold the first page hostage.
      schedule(1100);
      requestAnimationFrame(function(){ screen.classList.add('is-ready'); });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', nativeReady, { once:true });
    } else nativeReady();
    window.addEventListener('pageshow', function(event){ if (event.persisted) schedule(0); });
    schedule(3200); // A failed asset must never leave the app covered.
    return;
  }


  // Do not wait for every blocking script at the end of the page. The loader
  // should disappear as soon as the loading shell exists and the page markup is
  // visible.
  schedule(80);
  schedule(180);
  schedule(360);
  schedule(700);
  schedule(1200);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ schedule(0); }, { once: true });
  } else {
    schedule(0);
  }

  window.addEventListener('load', function(){ schedule(0); }, { once: true });
  window.addEventListener('pageshow', function(){ schedule(0); });
})();
