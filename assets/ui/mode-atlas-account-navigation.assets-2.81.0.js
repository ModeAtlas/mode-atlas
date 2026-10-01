/* One account surface; feature modules own the content of its peer sections. */
(function ModeAtlasAccountNavigation(root){
  'use strict';
  if(root.ModeAtlasAccountNavigation)return;
  let layer, sheet, current='', returnFocus=null, disposeView=null;
  const sections=[['profile','Profile','user'],['atlas','Your Atlas','achievement'],['friends','Friends','people'],['settings','Settings','settings']];
  const panels=new Map(), tabs=new Map();

  function available(name){return name!=='friends'||root.ModeAtlasSocial?.isEnabled();}
  function syncVisibility(){
    if(!layer)return;
    const dialogOpen=root.ModeAtlasDialog?.isOpen()===true;
    sheet.inert=dialogOpen||!current;
    sheet.setAttribute('aria-hidden',String(dialogOpen||!current));
    for(const [name,panel]of panels)panel.setAttribute('aria-hidden',String(name!==current||dialogOpen));
    document.querySelectorAll('[data-profile-open]').forEach(button=>button.setAttribute('aria-expanded',String(!!current&&(root.ModeAtlasEnv?.isNativeApp||current!=='settings'))));
    document.querySelectorAll('[data-settings-open]').forEach(button=>button.setAttribute('aria-expanded',String(current==='settings')));
  }
  function releaseView(){if(disposeView){disposeView();disposeView=null;}}
  function select(name,{focus=false}={}){
    if(!panels.has(name)||!available(name))return;
    if(current!==name){
      releaseView();current=name;
      for(const [key,panel]of panels){panel.hidden=key!==name;panel.classList.toggle('is-active',key===name);}
      for(const [key,tab]of tabs){tab.setAttribute('aria-selected',String(key===name));tab.tabIndex=key===name?0:-1;}
      document.getElementById('maAccountTitle').textContent=sections.find(section=>section[0]===name)[1];
      if(name==='atlas')disposeView=root.ModeAtlasRewardsUI.mount(panels.get(name));
      if(name==='friends')disposeView=root.ModeAtlasSocialUI.mount(panels.get(name));
      if(name==='settings')root.ModeAtlasNativeSettings?.refresh?.();
    }
    syncVisibility();
    if(focus)tabs.get(name).focus({preventScroll:true});
  }
  function open(name='profile',trigger){
    if(!layer||!panels.has(name)||!available(name))return;
    if(!current){
      returnFocus=trigger instanceof Element?trigger:document.activeElement;
      layer.hidden=false;root.ModeAtlasOverlay.lock(layer);document.body.classList.add('ma-account-open');
    }
    select(name);
    root.ModeAtlasProfile?.refresh?.();
    document.getElementById('maAccountClose').focus({preventScroll:true});
  }
  function close(){
    if(!current)return;
    if(layer.contains(document.activeElement))document.activeElement.blur();
    releaseView();current='';layer.hidden=true;root.ModeAtlasOverlay.unlock(layer);document.body.classList.remove('ma-account-open');
    for(const panel of panels.values()){panel.hidden=true;panel.classList.remove('is-active');}
    syncVisibility();
    const target=returnFocus;returnFocus=null;
    if(target?.isConnected)target.focus({preventScroll:true});
  }
  function trapFocus(event){
    if(event.key!=='Tab')return;
    const items=[...sheet.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
      .filter(node=>!node.closest('[hidden],[inert]')&&node.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(!first){event.preventDefault();sheet.focus();return;}
    const outside=!sheet.contains(document.activeElement)||!!document.activeElement.closest('[hidden],[inert]');
    if(event.shiftKey&&(outside||document.activeElement===first)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(outside||document.activeElement===last)){event.preventDefault();first.focus();}
  }
  function install({href,profileMarkup,settingsMarkup}){
    if(layer)return;
    const icon=name=>`<svg class="ma-icon" aria-hidden="true"><use href="${href('assets/mode-atlas-icons.svg')}#icon-${name}"></use></svg>`;
    const visible=sections.filter(([name])=>available(name));
    layer=document.createElement('div');layer.className='ma-account-layer';layer.hidden=true;
    layer.innerHTML=`<div class="ma-account-backdrop" data-ma-account-close></div>
      <section class="ma-account-sheet" id="maAccountSheet" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="maAccountTitle" tabindex="-1">
        <header class="ma-account-header"><div><div class="ma-menu-kicker">Your space</div><h2 id="maAccountTitle">Profile</h2></div>
          <button class="ma-button ma-button--ghost ma-icon-button" id="maAccountClose" data-ma-account-close type="button" aria-label="Close account menu">${icon('close')}</button></header>
        <div class="ma-account-tabs" role="tablist" aria-label="Account sections" style="--ma-account-tab-count:${visible.length}">
          ${visible.map(([name,label,symbol])=>`<button type="button" class="ma-account-tab" role="tab" id="maAccountTab-${name}" aria-controls="maAccount-${name}" aria-selected="false" tabindex="-1" data-ma-account-section="${name}">${icon(symbol)}<span>${label}</span></button>`).join('')}
        </div>
        ${visible.map(([name])=>`<section class="ma-account-view ma-account-${name}" id="maAccount-${name}" role="tabpanel" aria-labelledby="maAccountTab-${name}" aria-hidden="true" tabindex="0" hidden>${name==='profile'?profileMarkup:name==='settings'?settingsMarkup:''}</section>`).join('')}
      </section>`;
    document.body.append(layer);sheet=layer.querySelector('.ma-account-sheet');sheet.inert=true;
    for(const [name]of visible){
      panels.set(name,document.getElementById('maAccount-'+name));
      const tab=document.getElementById('maAccountTab-'+name);tabs.set(name,tab);
      tab.addEventListener('click',()=>select(name,{focus:true}));
    }
    layer.querySelector('.ma-account-tabs').addEventListener('keydown',event=>{
      const names=[...tabs.keys()],index=names.findIndex(name=>tabs.get(name)===document.activeElement);
      if(index<0)return;
      const target=event.key==='ArrowRight'?(index+1)%names.length:event.key==='ArrowLeft'?(index+names.length-1)%names.length:event.key==='Home'?0:event.key==='End'?names.length-1:-1;
      if(target>=0){event.preventDefault();select(names[target],{focus:true});}
    });
    layer.querySelectorAll('[data-ma-account-close]').forEach(node=>node.addEventListener('click',close));
    document.querySelectorAll('[data-profile-open]').forEach(button=>button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      if(current&&(root.ModeAtlasEnv?.isNativeApp||current!=='settings'))close();else open('profile',button);
    }));
    document.querySelectorAll('[data-settings-open]').forEach(button=>button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      if(current==='settings')close();else open('settings',button);
    }));
    document.addEventListener('keydown',event=>{
      if(!current||event.defaultPrevented||root.ModeAtlasDialog?.isOpen()||root.ModeAtlasTour?.isOpen())return;
      if(event.key==='Escape'){event.preventDefault();close();return;}
      trapFocus(event);
    });
    root.addEventListener('modeAtlasDialogStateChanged',syncVisibility);
    root.addEventListener('pagehide',close);
    if(new URLSearchParams(location.search).get('section')==='atlas')queueMicrotask(()=>open('atlas'));
  }
  root.ModeAtlasAccountNavigation=Object.freeze({install,open,close,isOpen:()=>!!current,current:()=>current});
})(window);
