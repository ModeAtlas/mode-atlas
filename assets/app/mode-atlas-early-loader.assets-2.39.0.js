/* Mode Atlas early loader. Owns loading-screen hide timing. */
(function(){
  var hidden = false;

  function hide(){
    if (hidden) return;
    var el = document.getElementById('maLoadingScreen');
    if (!el) return;
    hidden = true;
    el.classList.add('done');
    setTimeout(function(){ try { el.remove(); } catch(e) {} }, 220);
  }

  function schedule(delay){
    setTimeout(hide, delay);
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
