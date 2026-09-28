/* iOS-only chrome and layout coordination for the shared static pages. */
(function ModeAtlasIOSChrome(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp || root.ModeAtlasEnv.nativePlatform !== 'ios') return;

  var tabs = [
    ['atlas', 'Atlas', '/', 'あア'],
    ['kana', 'Kana', '/kana/', 'かな'],
    ['reading', 'Reading', '/reading/', '読'],
    ['writing', 'Writing', '/writing/', '書'],
    ['wordbank', 'Words', '/wordbank/', '語']
  ];
  var route = location.pathname.replace(/\/index\.html$/i, '/');
  var current = ({'/':'atlas', '/kana/':'kana', '/reading/':'reading', '/writing/':'writing', '/wordbank/':'wordbank', '/results/':'kana'})[route] || '';

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
    if (profile) utilities.appendChild(profile);
    if (settings) utilities.appendChild(settings);
    var focus = document.getElementById('studyNavHideBtn');
    if (focus) utilities.appendChild(focus);
    var exit = document.getElementById('studyNavShowBtn');
    if (exit) utilities.appendChild(exit);
    dock.appendChild(utilities);

    var links = document.createElement('div');
    links.className = 'ma-ios-tabs__links';
    tabs.forEach(function(tab){
      var link = document.createElement('a');
      link.className = 'ma-ios-tab' + (tab[0] === current ? ' is-active' : '');
      link.href = tab[2];
      if (tab[0] === current) link.setAttribute('aria-current', 'page');
      var icon = document.createElement('span');
      icon.className = 'ma-ios-tab__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = tab[3];
      var label = document.createElement('span');
      label.className = 'ma-ios-tab__label';
      label.textContent = tab[1];
      link.append(icon, label);
      links.appendChild(link);
    });
    dock.appendChild(links);
    document.body.appendChild(dock);

    function measure(){
      document.documentElement.style.setProperty('--ma-ios-dock-height', dock.getBoundingClientRect().height + 'px');
    }
    new MutationObserver(measure).observe(document.body, {attributes:true, attributeFilter:['class']});
    root.visualViewport?.addEventListener('resize', measure);
    root.addEventListener('resize', measure);
    root.requestAnimationFrame(measure);
    try { sessionStorage.setItem('modeAtlasNativeBooted', '1'); } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, {once:true});
  else render();

  // Bundled documents remain separate pages. Do not add a synthetic wait or
  // fullscreen cover: local navigation can start on the same tap.
  document.addEventListener('click', function(event){
    var link = event.target.closest?.('.ma-ios-tab[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (new URL(link.href, location.href).pathname === location.pathname) {
      event.preventDefault();
      root.scrollTo({top:0, behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    }
  });
  document.addEventListener('focusin', function(event){
    if (event.target.matches?.('input, textarea, [contenteditable="true"]')) document.body.classList.add('ma-ios-editing');
  });
  document.addEventListener('focusout', function(){
    root.setTimeout(function(){
      if (!document.activeElement?.matches?.('input, textarea, [contenteditable="true"]')) document.body.classList.remove('ma-ios-editing');
    }, 0);
  });
})(window);
