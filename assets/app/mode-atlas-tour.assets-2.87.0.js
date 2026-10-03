/* A guided walk through real UI. Only presentation/navigation changes; the tour
   never starts a practice session or changes learning/settings data. First use
   can finish at the existing guided-set start screen. */
(function ModeAtlasTour(root){
  'use strict';
  const key='modeAtlasActiveTour',native=!!root.ModeAtlasEnv?.isNativeApp;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!=null)node.textContent=text;return node;};
  function read(){try{const value=JSON.parse(sessionStorage.getItem(key));return value&&Number.isInteger(value.step)&&value.step>=0&&value.step<7&&Date.now()-value.at<1800000?value:null;}catch{return null;}}
  let state=read(),layer=null,target=null,observer=null,frame=0,previousFocus=null;
  const steps=[
    {path:'/',title:'Your daily starting point',text:native?'This dock connects Atlas, Kana and Words. Your avatar opens Profile, Your Atlas, Friends and Settings. Tap Kana again for Reading, Writing and Results.':'Use this navigation to reach Kana and Words. Your profile brings together Your Atlas, Friends and Settings.',selector:native?'.ma-ios-tabs':'.ma-nav'},
    {path:'/reading/',title:'Make practice yours',text:'Reading asks you to recall the sound of a kana. Practice setup is here whenever you want to choose a session or change your kana selection.',selector:'#modifiersTab'},
    {path:'/reading/',title:'Choose your session',text:'Here are the real practice modes. Guided sets give you a short finish line; reviews revisit due kana. Daily, Test and timed modes offer different challenges. We’ll leave your selection as it is.',setup:true,selector:'.ma-mode-choice'},
    {path:'/reading/',title:'See your goals grow',text:'Your Atlas rotates daily and weekly goals across recall, variety and completed practice. Completing goals adds XP alongside your answers.',section:'atlas',selector:'.ma-routine-goal'},
    {path:'/reading/',title:'Make your Atlas your own',text:'Open a reward collection to choose banners, titles and profile frames as you level up. Eligible exclusive rewards appear here too. On iOS, some milestones also unlock an app icon. Your appearance carries into your profile and Friends.',section:'atlas',rewards:true,selector:'[data-reward-category="banners"] > summary'},
    {path:'/reading/',title:'Learn alongside friends',text:'Friends is optional. Sign in and choose a display name and avatar, then share your friend code. Accepted friends can compare progress. You can report or block a profile at any time.',section:'friends',selector:'#maAccount-friends'},
    {path:'/reading/',title:'Find your preferences here',text:'Settings keeps appearance, sound, saved data and support together. You can replay this tour here any time.',section:'settings',selector:'.ma-theme-panel'}
  ];
  function save(){try{sessionStorage.setItem(key,JSON.stringify(state));}catch{}}
  function destroy(){cancelAnimationFrame(frame);observer?.disconnect();observer=null;root.removeEventListener('resize',layout);root.visualViewport?.removeEventListener('resize',layout);root.visualViewport?.removeEventListener('scroll',layout);document.removeEventListener('scroll',layout,true);document.removeEventListener('keydown',onKey,true);layer?.remove();layer=null;target=null;}
  function finish(practice=false){
    const returnPath=practice===true
      ?root.ModeAtlasVersionFile.appUrl(/^\/reading\/\?practice=10(?:&starter=starter)?$/.test(state?.practiceHref)?state.practiceHref:'/reading/?practice=10')
      :state?.returnPath;
    state=null;try{sessionStorage.removeItem(key);localStorage.setItem('modeAtlasTourSeen','1');}catch{}
    destroy();root.ModeAtlasPracticeSetup?.close();root.ModeAtlasAccountNavigation?.close();
    root.dispatchEvent(new Event('modeAtlasTourClosed'));
    if(returnPath&&returnPath!==location.pathname+location.search){location.assign(returnPath);return;}
    previousFocus?.isConnected&&previousFocus.focus({preventScroll:true});
  }
  function onKey(event){
    if(!layer)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish();return;}
    if(event.key==='Tab'){
      const items=[...layer.querySelectorAll('button:not([hidden])')],first=items[0],last=items.at(-1);
      if(event.shiftKey&&(document.activeElement===first||!items.includes(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!items.includes(document.activeElement))){event.preventDefault();first.focus();}
    }
  }
  function layout(){
    if(!layer||!target)return;cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      if(!layer||!target)return;
      const viewport=root.visualViewport,vx=viewport?.offsetLeft||0,vy=viewport?.offsetTop||0,w=viewport?.width||innerWidth,h=viewport?.height||innerHeight;
      const rect=target.getBoundingClientRect(),card=layer.querySelector('.ma-tour-card'),spot=layer.querySelector('.ma-tour-spot');
      const x=Math.max(vx+6,rect.left-5),y=Math.max(vy+6,rect.top-5),right=Math.min(vx+w-6,rect.right+5),bottom=Math.min(vy+h-6,rect.bottom+5);
      Object.assign(spot.style,{left:x+'px',top:y+'px',width:Math.max(0,right-x)+'px',height:Math.max(0,bottom-y)+'px'});
      card.style.width=Math.min(370,w-24)+'px';card.style.maxHeight=Math.max(180,h-32)+'px';
      const ch=card.getBoundingClientRect().height;
      const below=bottom+12,above=y-ch-12;
      const top=below+ch<=vy+h-12?below:above>=vy+12?above:vy+h-ch-12;
      Object.assign(card.style,{top:Math.max(vy+12,top)+'px',left:Math.max(vx+12,Math.min(x,vx+w-card.offsetWidth-12))+'px'});
    });
  }
  async function show(){
    if(!state)return;
    const step=steps[state.step],path=root.ModeAtlasVersionFile.appUrl(step.path);
    if(location.pathname!==path){save();location.assign(path);return;}
    destroy();root.ModeAtlasPracticeSetup?.close();root.ModeAtlasAccountNavigation?.close();
    // Account markup is installed synchronously at DOM ready. Wait for its owner
    // if cloud initialization or document parsing is still completing.
    if(step.section){
      for(let attempt=0;attempt<60&&!document.getElementById('maAccountSheet');attempt++)await new Promise(resolve=>requestAnimationFrame(resolve));
      if(!state)return;root.ModeAtlasAccountNavigation?.open(step.section);
      if(step.rewards)document.getElementById('atlasTab1')?.click();
    }
    if(step.setup)root.ModeAtlasPracticeSetup?.setOpen(true);
    target=document.querySelector(step.selector);
    // Selectors refer to source-owned components; unavailable features are
    // explained at their containing screen, never shown as a fabricated UI.
    if(!target||!target.getClientRects().length)target=document.querySelector(step.section?'#maAccountSheet':'#mainContent')||document.body;
    target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    layer=el('div','ma-tour-layer');layer.setAttribute('popover','manual');
    const shade=el('div','ma-tour-shade'),spot=el('div','ma-tour-spot'),card=el('section','ma-tour-card');
    card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','A quick look around');
    const firstFinish=state.firstUse&&state.step===steps.length-1;
    const count=el('p','ma-tour-count',`${state.step+1} of ${steps.length}`),title=el('h2','',step.title),copy=el('p','ma-tour-copy',step.text+(firstFinish?' Ready to try? Your first set has 10 questions, at your own pace. You can sign in to sync your progress whenever you’re ready.':'')),actions=el('div','ma-tour-actions');title.tabIndex=-1;
    const skip=el('button','ma-button ma-button--ghost','Skip tour');skip.type='button';skip.addEventListener('click',finish);
    const back=el('button','ma-button ma-button--ghost','Back');back.type='button';back.hidden=state.step===0;back.addEventListener('click',()=>advance(-1));
    const next=el('button','ma-button ma-button--primary',firstFinish?'Try a short set':state.step===steps.length-1?'Finish tour':'Next');next.type='button';next.addEventListener('click',()=>state.step===steps.length-1?finish(!!state.firstUse):advance(1));
    if(firstFinish)skip.textContent='Explore on my own';
    actions.append(back,next);card.append(count,title,copy,actions,skip);layer.append(shade,spot,card);
    (step.setup?document.getElementById('practiceSetupDialog'):document.body).append(layer);
    layer.showPopover?.();observer=new ResizeObserver(layout);observer.observe(target);observer.observe(card);
    root.addEventListener('resize',layout);root.visualViewport?.addEventListener('resize',layout);root.visualViewport?.addEventListener('scroll',layout);document.addEventListener('scroll',layout,true);document.addEventListener('keydown',onKey,true);
    layout();title.focus({preventScroll:true});
  }
  function advance(amount){if(!state)return;state.step+=amount;save();void show();}
  function start(){
    if(state)return;previousFocus=document.activeElement;
    let firstUse=false;try{firstUse=sessionStorage.getItem('modeAtlasTourPending')==='1';sessionStorage.removeItem('modeAtlasTourPending');}catch{}
    const practiceHref=root.ModeAtlasStudyPlan.recommend({readingSettings:root.ModeAtlasStorage.json('settings',undefined),writingSettings:root.ModeAtlasStorage.json('reverseSettings',undefined)}).href;
    root.ModeAtlas?.markWhatsNewSeen?.();state={step:0,at:Date.now(),firstUse,practiceHref,returnPath:location.pathname+location.search};save();void show();
  }
  root.ModeAtlasTour=Object.freeze({start,isOpen:()=>!!state,finish});
  document.addEventListener('DOMContentLoaded',()=>{if(state)requestAnimationFrame(show);},{once:true});
})(window);
