/* A guided walk through real UI. Only presentation/navigation changes; the tour
   never starts a practice session or changes learning/settings data. First use
   can finish at the existing guided-set start screen. */
(function ModeAtlasTour(root){
  'use strict';
  const key='modeAtlasActiveTour',native=!!root.ModeAtlasEnv?.isNativeApp;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!=null)node.textContent=text;return node;};
  const tours={
    hub:[
      {path:'/',title:'Your daily starting point',text:'Atlas brings together your next learning step, due reviews and goals. Your avatar opens Profile, Shop and Settings.',selector:'.atlas-home-continue'},
      {path:'/learn/',title:'Choose a branch',text:'Kana connects shapes and sounds. Kanji builds readings and meanings. Word Bank collects words you meet. Each branch has its own learning tools and tour.',selector:'.ma-branch-library'},
      {path:'/progress/',title:'See your goals grow',text:'Daily and weekly goals rotate. Add one personal goal for each period, choose a target, and turn on Repeat if you want it to return next period.',selector:'.ma-routine-goal'},
      {path:'/progress/',title:'Make your Atlas your own',text:'Rewards is where you equip your banners, themes, frames, avatar and pet. Your unlocked appearance follows you across the app.',rewards:true,selector:'[data-reward-category="banners"] > summary'},
      {path:'/friends/',title:'Learn alongside friends',text:'Share a friend code or meet people in the weekly ladder. Friends can see each other’s learning progress. You can report or block a profile at any time.',selector:'.ma-social'},
      {path:'/shop/',title:'Find your next look',text:'Explore wardrobe items, pets, themes and streak items. Open an item for a closer look and its price before choosing to buy.',selector:'.ma-shop'},
      {path:'/',title:'Your preferences, together',text:'Settings keeps sound, appearance and help together. Open Learning tours here whenever you want another look around.',section:'settings',selector:'.ma-theme-panel'}
    ],
    kana:[
      {path:'/kana/',title:'Find your starting point',text:'Start with the A-rows, take a check to find the rows you know, or choose confident entry. Placement opens access; it does not award mastery.',selector:'#maKanaLearning'},
      {path:'/kana/',title:'Learn, then practise',text:'Follow Your path to meet a row and revisit its lesson. Read connects a kana to its sound; Recall goes back from sound to kana. Read & Recall practises both. More tools appear as your rows open.',selector:'#maKanaLearning'},
      {path:'/kana/?view=mastery',title:'Evidence you can understand',text:'Tap a kana to see which targets you meet and what needs practice. Spaced, independent recall builds mastery. Handwriting is optional and adds Mastered+ without holding back Read or Recall.',selector:'#maKanaLearning'}
    ],
    kanji:[
      {path:'/kanji/',title:'Choose your Kanji starting point',text:'Begin with ten common N5 characters, check what you know, or open every level if you are confident. N5–N1 are study groupings, not an official complete JLPT list.',selector:'#maKanjiContent'},
      {path:'/kanji/',title:'Hear it, connect it, recall it',text:'Lessons introduce a character, a useful word and its pronunciation. On’yomi are readings derived from Chinese; kun’yomi are Japanese readings. Words tell you which reading to use. Listen, make a connection, then recall.',selector:'#maKanjiContent'},
      {path:'/kanji/',title:'Build lasting recognition',text:'Practise pronunciation, meaning or meaning matches. Due reviews revisit older learning without postponing it when you practise early. Handwriting is optional. Save lesson words to your Word Bank.',selector:'#maKanjiContent'}
    ],
    words:[
      {path:'/wordbank/',title:'Keep words you meet',text:'Save a word’s written form, its kana reading and an English meaning. Add an example or note from the place you found it.',selector:'#entries'},
      {path:'/wordbank/',title:'Recall your own collection',text:'Review words shows the written form first. Recall the meaning, reveal it, then choose Again or Remembered. Your honest self-check sets the next review; it does not award test marks.',selector:'#wordBankReviewBtn'}
    ]
  };
  function read(){try{const value=JSON.parse(sessionStorage.getItem(key));const scope=value?.scope||'hub';return value&&tours[scope]&&Number.isInteger(value.step)&&value.step>=0&&value.step<tours[scope].length&&Date.now()-value.at<1800000?{...value,scope}:null;}catch{return null;}}
  let state=read(),layer=null,target=null,observer=null,frame=0,previousFocus=null;
  function save(){try{sessionStorage.setItem(key,JSON.stringify(state));}catch{}}
  function destroy(){cancelAnimationFrame(frame);observer?.disconnect();observer=null;root.removeEventListener('resize',layout);root.visualViewport?.removeEventListener('resize',layout);root.visualViewport?.removeEventListener('scroll',layout);document.removeEventListener('scroll',layout,true);document.removeEventListener('keydown',onKey,true);layer?.remove();layer=null;target=null;}
  function finish(practice=false){
    const returnPath=practice===true
      ?(!root.ModeAtlasKanaLearning.read().startedAt?'/kana/':root.ModeAtlasVersionFile.appUrl(/^\/reading\/\?practice=10(?:&starter=starter)?$/.test(state?.practiceHref)?state.practiceHref:'/reading/?practice=10'))
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
    const steps=tours[state.scope],step=steps[state.step],path=root.ModeAtlasVersionFile.appUrl(step.path);
    if(location.pathname+location.search!==path){save();location.assign(path);return;}
    destroy();root.ModeAtlasPracticeSetup?.close();root.ModeAtlasAccountNavigation?.close();
    // Account markup is installed synchronously at DOM ready. Wait for its owner
    // if cloud initialization or document parsing is still completing.
    if(step.section){
      for(let attempt=0;attempt<60&&!document.getElementById('maAccountSheet');attempt++)await new Promise(resolve=>requestAnimationFrame(resolve));
      if(!state)return;root.ModeAtlasAccountNavigation?.open(step.section);
    }
    if(step.rewards)document.getElementById('atlasTab1')?.click();
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
    const next=el('button','ma-button ma-button--primary',firstFinish?(!root.ModeAtlasKanaLearning.read().startedAt?'Choose my starting point':'Try a short set'):state.step===steps.length-1?'Finish tour':'Next');next.type='button';next.addEventListener('click',()=>state.step===steps.length-1?finish(!!state.firstUse):advance(1));
    if(firstFinish)skip.textContent='Explore on my own';
    actions.append(back,next);card.append(count,title,copy,actions,skip);layer.append(shade,spot,card);
    (step.setup?document.getElementById('practiceSetupDialog'):document.body).append(layer);
    layer.showPopover?.();observer=new ResizeObserver(layout);observer.observe(target);observer.observe(card);
    root.addEventListener('resize',layout);root.visualViewport?.addEventListener('resize',layout);root.visualViewport?.addEventListener('scroll',layout);document.addEventListener('scroll',layout,true);document.addEventListener('keydown',onKey,true);
    layout();title.focus({preventScroll:true});
  }
  function advance(amount){if(!state)return;state.step+=amount;save();void show();}
  function start(scope='hub'){
    if(state)return;previousFocus=document.activeElement;
    let firstUse=false;try{firstUse=sessionStorage.getItem('modeAtlasTourPending')==='1';sessionStorage.removeItem('modeAtlasTourPending');}catch{}
    const practiceHref=root.ModeAtlasStudyPlan.recommend({readingSettings:root.ModeAtlasStorage.json('settings',undefined),writingSettings:root.ModeAtlasStorage.json('reverseSettings',undefined)}).href;
    root.ModeAtlas?.markWhatsNewSeen?.();state={scope:tours[scope]?scope:'hub',step:0,at:Date.now(),firstUse,practiceHref,returnPath:location.pathname+location.search};save();void show();
  }
  function choose(){
    const content=el('div','ma-action-row');
    for(const [scope,title]of [['hub','Around Mode Atlas'],['kana','Kana'],['kanji','Kanji'],['words','Word Bank']]){
      const button=el('button','ma-button',title);button.type='button';button.addEventListener('click',()=>{root.ModeAtlasDialog.close();start(scope);});content.append(button);
    }
    root.ModeAtlasDialog.feature({title:'Learning tours',contentNode:content});
  }
  async function offer(scope){
    if(scope==='hub'||!tours[scope]||state||root.ModeAtlasDialog.isOpen())return;
    const seen=root.ModeAtlasStorage.json('modeAtlasBranchToursSeen',{});if(seen[scope])return;
    const owner=root.KanaCloudSync?.getUser?.()?.uid||'guest';
    seen[scope]=true;root.ModeAtlasStorage.setJSON('modeAtlasBranchToursSeen',seen);
    if(await root.ModeAtlasDialog.confirm({title:'A quick look around '+(root.ModeAtlasBranches.items.find(b=>b.id===scope)?.name||'this branch')+'?',message:'See the learning path and practice tools. You can replay this tour from Settings.',confirmLabel:'Show me',cancelLabel:'Explore myself'})&&(root.KanaCloudSync?.getUser?.()?.uid||'guest')===owner)start(scope);
  }
  root.ModeAtlasTour=Object.freeze({start,choose,offer,isOpen:()=>!!state,finish});
  document.addEventListener('DOMContentLoaded',()=>{if(state)requestAnimationFrame(show);},{once:true});
})(window);
