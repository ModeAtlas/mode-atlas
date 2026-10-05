/* iOS-only chrome and layout coordination for the shared static pages. */
(function ModeAtlasIOSChrome(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp || root.ModeAtlasEnv.nativePlatform !== 'ios') return;

  // Primary destinations stay stable inside every learning branch.
  const tabs=[['atlas','Atlas','あア'],['learn','Learn','book'],['progress','Progress','chart'],['friends','Friends','people']];
  const route=location.pathname.replace(/\/index\.html$/i,'/');
  const current=tabs.find(tab=>root.AtlasPlatform.destinationPath(tab[0])===route)?.[0]
    || (/^\/(kana|reading|writing|results|wordbank)\//.test(route)?'learn':'');

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

    var setup = document.getElementById('modifiersTab');
    var profile = document.getElementById('profileOpenBtn');
    var focus = document.getElementById('studyNavHideBtn');
    var exit = document.getElementById('studyNavShowBtn');
    var header = document.querySelector('.ma-trainer-header');
    if (header && setup && focus) {
      var practiceActions = document.createElement('div');
      practiceActions.className = 'ma-ios-practice-actions';
      practiceActions.append(setup, focus);
      header.prepend(practiceActions);
    }

    const links=document.createElement('div');links.className='ma-ios-tabs__links';
    tabs.forEach(([key,label,symbol])=>{
      const link=document.createElement('a');link.className='ma-ios-tab'+(key===current?' is-active':'');
      link.href=root.AtlasPlatform.destinationPath(key);
      if(key===current)link.setAttribute('aria-current','page');
      const icon=document.createElement('span');icon.className='ma-ios-tab__icon';icon.setAttribute('aria-hidden','true');
      if(key==='atlas')icon.textContent=symbol;
      else icon.innerHTML=`<svg class="ma-icon"><use href="/assets/mode-atlas-icons.svg#icon-${symbol}"></use></svg>`;
      const text=document.createElement('span');text.className='ma-ios-tab__label';text.textContent=label;
      link.append(icon,text);links.append(link);
    });
    dock.append(links);
    if(profile){
      profile.className='ma-ios-profile';profile.setAttribute('aria-label','Profile and settings');
      const home=document.querySelector('.atlas-ios-home__header'),hub=document.querySelector('.ma-hub-header');
      if(home){home.querySelector('.atlas-ios-home__brand')?.remove();home.append(profile);}
      else if(hub)hub.append(profile);
      else if(header?.querySelector('.ma-ios-practice-actions'))header.querySelector('.ma-ios-practice-actions').append(profile);
      else {
        const bar=document.createElement('div');bar.className='ma-ios-page-tools';
        const back=document.createElement('a');back.href=root.AtlasPlatform.destinationPath('learn');back.textContent='‹ Learn';
        bar.append(back,profile);document.querySelector('.shell,.wrap,main')?.prepend(bar);
      }
    }
    if(exit)dock.append(exit);
    document.body.append(dock);

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
    var link = event.target.closest?.('.ma-ios-tab[href],.ma-kana-navigation a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var target = new URL(link.href, location.href);
    if (target.pathname === location.pathname && target.search === location.search) {
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
