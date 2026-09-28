/* The iOS shell owns its navigation chrome. Shared study pages remain unchanged. */
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
    var nav = document.createElement('nav');
    nav.className = 'ma-ios-tabs';
    nav.setAttribute('aria-label', 'Study areas');
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
      nav.appendChild(link);
    });
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, {once:true});
  else render();

  document.addEventListener('click', function(event){
    var link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    var target = new URL(link.href, location.href);
    if (target.origin !== location.origin || !/^\/(?:kana|reading|writing|results|wordbank|privacy|terms)?\/?(?:index\.html)?$/i.test(target.pathname)) return;
    if (target.pathname + target.search + target.hash === location.pathname + location.search + location.hash) {
      if (link.classList.contains('ma-ios-tab')) { event.preventDefault(); root.scrollTo({top:0, behavior:'smooth'}); }
      return;
    }
    if (target.hash && target.pathname === location.pathname && target.search === location.search) return;
    event.preventDefault();
    document.documentElement.classList.add('ma-ios-leaving');
    root.setTimeout(function(){ location.assign(target.href); }, root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 110);
    root.setTimeout(function(){ document.documentElement.classList.remove('ma-ios-leaving'); }, 1500);
  });
  root.addEventListener('pageshow', function(){ document.documentElement.classList.remove('ma-ios-leaving'); });
  document.addEventListener('focusin', function(event){
    if (event.target.matches?.('input, textarea, [contenteditable="true"]')) document.body.classList.add('ma-ios-editing');
  });
  document.addEventListener('focusout', function(){
    root.setTimeout(function(){
      if (!document.activeElement?.matches?.('input, textarea, [contenteditable="true"]')) document.body.classList.remove('ma-ios-editing');
    }, 0);
  });
})(window);
