/* iOS-only chrome and layout coordination for the shared static pages. */
(function ModeAtlasIOSChrome(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp || root.ModeAtlasEnv.nativePlatform !== 'ios') return;

  // The platform facade owns destination paths for deep links and the dock.
  var tabs = [
    ['atlas', 'Atlas', 'あア'],
    ['kana', 'Kana', 'かな'],
    ['wordBank', 'Words', '語']
  ];
  var kanaPages = [
    ['reading', 'Reading', '読'],
    ['writing', 'Writing', '書'],
    ['results', 'Results', '記']
  ];
  var route = location.pathname.replace(/\/index\.html$/i, '/');
  var currentPage = (tabs.concat(kanaPages).find(function(tab){ return root.AtlasPlatform.destinationPath(tab[0]) === route; }) || [])[0] || '';
  var current = kanaPages.some(function(tab){ return tab[0] === currentPage; }) ? 'kana' : currentPage;

  // Cross-document transitions keep the previous local page visible until the
  // next page is ready. Unsupported WebViews retain ordinary navigation.
  var transitionStyle = document.createElement('style');
  transitionStyle.textContent = '@view-transition{navigation:auto}' +
    '@keyframes ma-ios-leave{to{opacity:0}}' +
    '@keyframes ma-ios-enter{from{opacity:.92;transform:translateY(3px)}to{opacity:1;transform:none}}' +
    '::view-transition-old(root){animation:90ms ease-out both ma-ios-leave}' +
    '::view-transition-new(root){animation:140ms ease-out both ma-ios-enter}' +
    '@media(prefers-reduced-motion:reduce){::view-transition-old(root),::view-transition-new(root){animation-duration:.01ms}}';
  document.head.appendChild(transitionStyle);

  function render(){
    if (document.querySelector('.ma-ios-tabs')) return;
    var dock = document.createElement('nav');
    dock.className = 'ma-ios-tabs';
    dock.setAttribute('aria-label', 'Mode Atlas iOS navigation');

    var utilities = document.createElement('div');
    utilities.className = 'ma-ios-tabs__utilities';
    var title = document.createElement('span');
    title.className = 'ma-ios-tabs__title';
    title.textContent = current === 'atlas' ? 'Mode Atlas' : (document.querySelector('.ma-nav__title')?.textContent || 'Mode Atlas');
    utilities.appendChild(title);
    var setup = document.getElementById('modifiersTab');
    if (setup) utilities.appendChild(setup);
    var profile = document.getElementById('profileOpenBtn');
    var settings = document.querySelector('.ma-nav__settings');
    if (profile) {
      profile.setAttribute('aria-label', 'Open profile');
      utilities.appendChild(profile);
    }
    if (settings) utilities.appendChild(settings);
    var focus = document.getElementById('studyNavHideBtn');
    if (focus) utilities.appendChild(focus);
    var exit = document.getElementById('studyNavShowBtn');
    if (exit) utilities.appendChild(exit);
    dock.appendChild(utilities);

    var rail = document.createElement('div');
    rail.className = 'ma-ios-tabs__rail';
    var links = document.createElement('div');
    links.className = 'ma-ios-tabs__links';
    var kanaMenu = document.createElement('div');
    kanaMenu.id = 'maIosKanaMenu';
    kanaMenu.className = 'ma-ios-kana-menu';
    kanaMenu.setAttribute('aria-label', 'Kana practice');
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'ma-ios-tab ma-ios-kana-back';
    back.setAttribute('aria-label', 'Close Kana practice menu');
    back.innerHTML = '<span class="ma-ios-tab__icon" aria-hidden="true">‹</span><span class="ma-ios-tab__label">Kana</span>';
    kanaMenu.appendChild(back);
    kanaPages.forEach(function(tab){
      var item = document.createElement('a');
      item.href = root.AtlasPlatform.destinationPath(tab[0]);
      item.className = 'ma-ios-tab' + (tab[0] === currentPage ? ' is-active' : '');
      item.innerHTML = '<span class="ma-ios-tab__icon" aria-hidden="true">' + tab[2] + '</span><span class="ma-ios-tab__label">' + tab[1] + '</span>';
      if (tab[0] === currentPage) item.setAttribute('aria-current', 'page');
      item.addEventListener('click', function(){
        try { sessionStorage.setItem('modeAtlasOpenKanaMenu', '1'); } catch (_) {}
      });
      kanaMenu.appendChild(item);
    });
    tabs.forEach(function(tab){
      var link = document.createElement('a');
      link.className = 'ma-ios-tab' + (tab[0] === current ? ' is-active' : '');
      link.href = root.AtlasPlatform.destinationPath(tab[0]);
      if (tab[0] === currentPage) link.setAttribute('aria-current', 'page');
      if (tab[0] === 'kana') {
        link.setAttribute('aria-controls', kanaMenu.id);
        link.setAttribute('aria-expanded', 'false');
        link.setAttribute('aria-label', 'Kana page and practice menu');
      }
      var icon = document.createElement('span');
      icon.className = 'ma-ios-tab__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = tab[2];
      var label = document.createElement('span');
      label.className = 'ma-ios-tab__label';
      label.textContent = tab[1];
      link.append(icon, label);
      links.appendChild(link);
    });
    rail.append(links, kanaMenu);
    dock.appendChild(rail);
    document.body.appendChild(dock);

    var kanaTab = links.querySelector('[aria-controls="maIosKanaMenu"]');
    function setKanaMenu(open){
      rail.classList.toggle('is-kana-open', open);
      kanaTab.setAttribute('aria-expanded', String(open));
      links.inert = open;
      kanaMenu.inert = !open;
    }
    setKanaMenu(false);
    back.addEventListener('click', function(){ setKanaMenu(false); kanaTab.focus(); });
    kanaTab.addEventListener('click', function(event){
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (current !== 'kana') {
        try { sessionStorage.setItem('modeAtlasOpenKanaMenu', '1'); } catch (_) {}
        return;
      }
      event.preventDefault();
      setKanaMenu(!rail.classList.contains('is-kana-open'));
    });
    try {
      if (sessionStorage.getItem('modeAtlasOpenKanaMenu') === '1') setKanaMenu(true);
      sessionStorage.removeItem('modeAtlasOpenKanaMenu');
    } catch (_) {}
    document.addEventListener('click', function(event){
      if (!dock.contains(event.target)) setKanaMenu(false);
    });
    document.addEventListener('keydown', function(event){
      if (event.key === 'Escape' && rail.classList.contains('is-kana-open')) { setKanaMenu(false); kanaTab.focus(); }
    });

    var dockHeight = -1, visibleHeight = -1;
    function measure(){
      var nextDockHeight = dock.getBoundingClientRect().height;
      var nextVisibleHeight = root.visualViewport?.height || root.innerHeight;
      if (nextDockHeight !== dockHeight) {
        dockHeight = nextDockHeight;
        document.documentElement.style.setProperty('--ma-ios-dock-height', dockHeight + 'px');
      }
      if (nextVisibleHeight !== visibleHeight) {
        visibleHeight = nextVisibleHeight;
        document.documentElement.style.setProperty('--ma-ios-visible-height', visibleHeight + 'px');
      }
    }
    // Safe-area and font/layout changes need not mutate the body or resize the
    // viewport. Observe the actual dock, including when editing/focus hides it.
    new ResizeObserver(measure).observe(dock, {box:'border-box'});
    root.visualViewport?.addEventListener('resize', measure);
    root.addEventListener('resize', measure);
    root.addEventListener('pageshow', measure);
    measure();
    try { sessionStorage.setItem('modeAtlasNativeBooted', '1'); } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, {once:true});
  else render();

  // Bundled documents remain separate pages. Do not add a synthetic wait or
  // fullscreen cover: local navigation can start on the same tap.
  document.addEventListener('click', function(event){
    var link = event.target.closest?.('.ma-ios-tab[href]:not([aria-controls])');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (new URL(link.href, location.href).pathname === location.pathname) {
      event.preventDefault();
      root.scrollTo({top:0, behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    }
  });
  document.addEventListener('focusin', function(event){
    if (event.target.matches?.('input, textarea, [contenteditable="true"]')) {
      document.body.classList.add('ma-ios-editing');
      if (event.target.id === 'input') {
        event.target.setAttribute('autocapitalize', 'off');
        event.target.setAttribute('autocorrect', 'off');
        event.target.setAttribute('enterkeyhint', 'done');
      }
    }
  });
  document.addEventListener('focusout', function(){
    root.setTimeout(function(){
      if (!document.activeElement?.matches?.('input, textarea, [contenteditable="true"]')) document.body.classList.remove('ma-ios-editing');
    }, 0);
  });
})(window);
