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
      if (coldLaunch) document.getElementById('maLoadingScreen')?.classList.add('is-ready');
      schedule(coldLaunch ? 430 : 0);
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
