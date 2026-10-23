/* iOS-only chrome and layout coordination for the shared static pages. */
(function ModeAtlasIOSChrome(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp || root.ModeAtlasEnv.nativePlatform !== 'ios') return;

  // Primary destinations stay stable inside every learning branch.
    const tabs=[['atlas','Atlas','あア'],['learn','Learn','nav-learn'],['progress','Progress','nav-progress'],['friends','Friends','nav-friends']];
  const route=location.pathname.replace(/\/index\.html$/i,'/');
  const current=tabs.find(tab=>root.AtlasPlatform.destinationPath(tab[0])===route)?.[0]
    || (/^\/(kana|kanji|reading|writing|results|wordbank)\//.test(route)?'learn':'');

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
      if(key==='atlas'){const image=document.createElement('img');image.src='/assets/brand/mode-atlas-symbol.svg';image.width=24;image.height=24;image.alt='';icon.append(image);}
      else icon.innerHTML=`<svg class="ma-icon"><use href="/assets/mode-atlas-icons.svg#icon-${symbol}"></use></svg>`;
      const text=document.createElement('span');text.className='ma-ios-tab__label';text.textContent=label;
      link.append(icon,text);links.append(link);
    });
    dock.append(links);
    if(profile){
      profile.className='ma-ios-profile';profile.setAttribute('aria-label','Profile and settings');
      const home=document.querySelector('.atlas-home-heading'),hub=document.querySelector('.ma-hub-header'),resultsNav=document.querySelector('.ma-results-branches');
      if(home){home.append(profile);}
      else if(hub&&!resultsNav)hub.append(profile);
      else if(header?.querySelector('.ma-ios-practice-actions'))header.querySelector('.ma-ios-practice-actions').append(profile);
      else {
        const bar=document.createElement('div');bar.className='ma-ios-page-tools';
        const back=document.createElement('a');back.href=root.AtlasPlatform.destinationPath('learn');back.textContent='‹ Learn';
        bar.append(back,profile);if(resultsNav)resultsNav.before(bar);else document.querySelector('.shell,.wrap,main')?.prepend(bar);
      }
    }
    if(exit){
      exit.setAttribute('aria-label','Exit focus mode');
      exit.querySelector('span').textContent='Exit focus';
      dock.append(exit);
    }
    document.body.append(dock);

    var dockHeight = -1, visibleHeight = -1, nativeLayout = null;
    const html=document.documentElement;
    function setPixels(name,value,element=html){
      const next=Math.round(value*100)/100+'px';
      if(element.style.getPropertyValue(name)!==next)element.style.setProperty(name,next);
    }
    let frame=0;
    function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;measure();});}
    const watched=new Set(),regions=new ResizeObserver(schedule);
    function watch(element){if(element&&!watched.has(element)){watched.add(element);regions.observe(element);}}
    // A surface can borrow the side strip only after UIKit has described its
    // occlusions. Old shells and transient/stale geometry keep the safe area.
    function clearSpace(geometry,safe,width,height){
      const clear={...safe},blocks=geometry?.occlusions||[];
      if(!geometry?.reservedRegionsAvailable)return clear;
      for(const edge of ['left','right']){
        if(!safe[edge])continue;
        const inStrip=blocks.filter(r=>r.width>0&&r.height>0&&(edge==='right'?r.x>=width-safe.right:r.x+r.width<=safe.left));
        if(!inStrip.length)continue;
        const top=Math.max(safe.top,...inStrip.map(r=>r.y+r.height+12));
        if(height-top-safe.bottom<200)continue;
        clear[edge]=0;clear.top=Math.max(clear.top,top);
      }
      return clear;
    }
    function protectSection(element,blocks,enabled){
      watch(element);
      let left=0,right=0;
      if(enabled&&element.getClientRects().length){
        const r=element.getBoundingClientRect();
        for(const b of blocks){
          if(r.bottom<=b.y-8||r.top>=b.y+b.height+8||r.right<=b.x-8||r.left>=b.x+b.width+8)continue;
          if(b.x+b.width/2>innerWidth/2)right=Math.max(right,r.right-b.x+8);
          else left=Math.max(left,b.x+b.width+8-r.left);
        }
      }
      setPixels('--ma-ios-section-left',left,element);setPixels('--ma-ios-section-right',right,element);
    }
    function measure(){
      const style=getComputedStyle(html),width=root.innerWidth,height=root.innerHeight;
      // Native points and CSS pixels agree at viewport scale 1. Ignore a stale
      // native snapshot during a fold until both sides describe the same view.
      const geometry=nativeLayout&&Math.abs(nativeLayout.width-width)<2&&Math.abs(nativeLayout.height-height)<2?nativeLayout:null;
      const safe=Object.fromEntries(['top','right','bottom','left'].map(side=>[side,
        Math.max(0,geometry?.safeArea?.[side]??(parseFloat(style.getPropertyValue('--ma-safe-'+side))||0))]));
      const font=parseFloat(style.fontSize)||16,railSize=Math.max(76,font*4.75);
      const neededHeight=4*Math.max(64,font*4)+3*12+24;
      const safeWidth=width-safe.left-safe.right,safeHeight=height-safe.top-safe.bottom;
      let side='right',shared=false,top=safe.top,bottom=safe.bottom,offset=safe.right;
      // Reuse the system side gutter only with native occlusion evidence. Do
      // not infer a camera or a Duo model from a viewport size or a user agent.
      for(const edge of ['right','left']){
        if(safe[edge]<railSize+8)continue;
        const x=edge==='right'?width-safe.right:0;
        const blocked=(geometry?.occlusions||[]).filter(r=>r.x+r.width>x&&r.x<x+safe[edge]&&r.width>0&&r.height>0);
        if(!blocked.length)continue;
        const start=Math.max(safe.top,...blocked.map(r=>r.y+r.height))+8;
        if(height-start-safe.bottom<neededHeight)continue;
        side=edge;shared=true;top=start;offset=(safe[edge]-railSize)/2;break;
      }
      // A wide, short window benefits from a rail even on older native shells.
      // Tall inner-display layouts keep a bottom dock unless the OS supplies a
      // usable side region. The threshold is content capacity, not device size.
      const rail=shared||(safeWidth-railSize>=600&&safeWidth>safeHeight&&safeHeight>=neededHeight);
      html.dataset.maNavigation=rail?'rail':'bottom';
      html.dataset.maRailSide=side;
      html.toggleAttribute('data-ma-shared-bar',rail&&shared);
      setPixels('--ma-ios-rail-size',railSize);
      setPixels('--ma-ios-rail-offset',offset);
      setPixels('--ma-ios-rail-top',top);
      setPixels('--ma-ios-rail-bottom',bottom);
      const dockVisible=getComputedStyle(dock).display!=='none';
      setPixels('--ma-ios-rail-left',dockVisible&&rail&&!shared&&side==='left'?railSize:0);
      setPixels('--ma-ios-rail-right',dockVisible&&rail&&!shared&&side==='right'?railSize:0);
      const clear=clearSpace(geometry,safe,width,height);
      setPixels('--ma-ios-clear-left',clear.left);setPixels('--ma-ios-clear-right',clear.right);
      const view=root.visualViewport,viewTop=view?.offsetTop||0,viewHeight=view?.height||height;
      const overlayClear=viewHeight-Math.max(0,clear.top-viewTop)-safe.bottom>=240;
      setPixels('--ma-ios-overlay-top',Math.max(0,(overlayClear?clear.top:safe.top)-viewTop));
      setPixels('--ma-ios-overlay-left',overlayClear?clear.left:safe.left);
      setPixels('--ma-ios-overlay-right',overlayClear?clear.right:safe.right);
      const expanded=document.body.classList.contains('trainer-session-active')&&(!dockVisible||document.body.classList.contains('study-nav-hidden'));
      html.toggleAttribute('data-ma-expanded-practice',expanded);
      const blocks=geometry?.occlusions?[...geometry.occlusions]:[];
      // Keep the entire upper gutter protected: hardware corners/camera need
      // not be separate reserved-region entries above the reported status UI.
      for(const edge of ['left','right'])if(clear[edge]<safe[edge])blocks.push({x:edge==='right'?width-safe.right:0,y:0,width:safe[edge],height:clear.top-8});
      if(dockVisible&&exit?.getClientRects().length){const r=exit.getBoundingClientRect();blocks.push({x:r.x,y:r.y,width:r.width,height:r.height});}
      for(const element of document.querySelectorAll('.ma-trainer-header,.ma-session-hud,.ma-trainer-prompt-wrap,.ma-trainer-answer-wrap,.ma-trainer-session-controls'))protectSection(element,blocks,expanded);
      const keyboard=document.querySelector('.ma-ios-reading-keyboard:not(.ma-ios-reading-keyboard--inline)');
      if(keyboard){
        watch(keyboard);const below=keyboard.getBoundingClientRect().top>=clear.top;
        setPixels('--ma-ios-keyboard-left',below?clear.left:safe.left);
        setPixels('--ma-ios-keyboard-right',below?clear.right:safe.right);
      }
      const sheet=document.querySelector('.ma-account-sheet');
      if(sheet?.getClientRects().length){
        watch(sheet);const r=sheet.getBoundingClientRect();
        setPixels('--ma-ios-account-left',Math.max(0,safe.left-r.left),sheet);
        setPixels('--ma-ios-account-right',Math.max(0,r.right-(width-safe.right)),sheet);
        const content=sheet.querySelector('.ma-account-view:not([hidden])');
        if(content){
          const margin=parseFloat(getComputedStyle(content).marginTop)||0;
          setPixels('--ma-ios-account-gap',Math.max(0,clear.top-content.getBoundingClientRect().top+margin),sheet);
        }
      }
      for(const element of watched)if(!element.isConnected){regions.unobserve(element);watched.delete(element);}
      var nextDockHeight = rail?0:dock.getBoundingClientRect().height;
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
    new ResizeObserver(schedule).observe(dock, {box:'border-box'});
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open']});
    root.visualViewport?.addEventListener('resize', schedule);
    root.visualViewport?.addEventListener('scroll', schedule);
    root.addEventListener('resize', schedule);
    root.addEventListener('scroll',schedule,{passive:true});
    root.addEventListener('pageshow', measure);
    root.addEventListener('modeAtlasTextSizeChanged',measure);
    const native=root.Capacitor?.Plugins?.ModeAtlasNative;
    if(native?.getViewportLayout){
      const accept=layout=>{nativeLayout=layout;measure();};
      // Subscribe first so an opening/closing transition cannot be missed while
      // the initial request is in flight. A newer event wins over that request.
      let received=false;
      native.addListener?.('viewportLayoutChanged',layout=>{received=true;accept(layout);});
      native.getViewportLayout().then(layout=>{if(!received)accept(layout);}).catch(()=>{});
    }
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
