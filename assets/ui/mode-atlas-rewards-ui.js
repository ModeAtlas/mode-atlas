/* Profile, routine and collection presentation. Progress owns every unlock. */
(function ModeAtlasRewardsUI(root){
  'use strict';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  function appearance(){
    const state=root.ModeAtlasProgress.readState(),level=root.ModeAtlasProgress.getSummary(state).level;
    return root.ModeAtlasRewardRules.landmarks.find(item=>item.id===state.appearance.landmark&&item.level<=level)||root.ModeAtlasRewardRules.landmarks[0];
  }
  function refresh(){
    const item=appearance();
    const title=document.getElementById('profileAtlasTitle');if(title)title.textContent=item.title;
    const avatar=document.getElementById('profileAvatar');if(avatar)avatar.dataset.maFrame=item.frame;
    document.querySelectorAll('[data-ma-routine-streak]').forEach(node=>{node.textContent=String(root.ModeAtlasProgress.routine().streak);});
  }
  async function open(){
    root.ModeAtlasProfile?.close?.();
    const summary=root.ModeAtlasProgress.getSummary(),routine=root.ModeAtlasProgress.routine(),selected=appearance();
    const content=el('div','ma-atlas-rewards');
    content.append(el('p','ma-atlas-rewards__intro',`${routine.streak} day study streak · Atlas Level ${summary.level}`),el('p','ma-atlas-rewards__note','Keep your streak with five correct answers a day.'),el('h3','','Your routine'));
    const goals=el('div','ma-routine-goals');
    for(const goal of routine.goals){
      const card=el('div','ma-routine-goal'),complete=goal.value>=goal.target;
      card.append(el('strong','',goal.label),el('span','',complete?`✓ Complete · ${goal.xp} XP`:`${Math.min(goal.target,goal.value)} / ${goal.target} · ${goal.xp} XP`));
      const meter=el('progress','');meter.max=goal.target;meter.value=Math.min(goal.target,goal.value);meter.setAttribute('aria-label',goal.label);card.append(meter);goals.append(card);
    }
    content.append(goals);
    const reviewActions=el('div','ma-atlas-rewards__actions');
    for(const mode of ['reading','writing']){
      const map=root.ModeAtlasStorage.readModeJSON(mode,'srs',{}),due=root.ModeAtlasReview.due(map);
      if(due.length){const link=el('a','ma-button ma-button--ghost',`Review ${mode} · ${due.length} due`);link.href=`/${mode}/?practice=10&due=1`;reviewActions.append(link);}
    }
    if(!reviewActions.childElementCount)reviewActions.append(el('p','ma-atlas-rewards__note','No scheduled reviews are due. A short set can introduce or reinforce kana.'));
    content.append(reviewActions,el('h3','','Your Atlas'));
    const collection=el('div','ma-atlas-collection');
    for(const item of root.ModeAtlasRewardRules.landmarks){
      const unlocked=summary.level>=item.level,card=el('article','ma-atlas-landmark');card.dataset.unlocked=String(unlocked);card.dataset.landmark=item.id;
      const symbol=el('span','ma-atlas-landmark__symbol',item.symbol);symbol.setAttribute('aria-hidden','true');
      if(item.icon){const preview=el('img','ma-atlas-landmark__icon');preview.src=`/assets/rewards/${item.icon}.svg`;preview.alt='';card.append(preview);}else card.append(symbol);
      card.append(el('h4','',item.name),el('p','',`Level ${item.level} · ${item.title}`));
      const choose=el('button','ma-button ma-button--ghost ma-button--small',unlocked?(selected.id===item.id?'Selected':'Use title & frame'):`Unlock at Level ${item.level}`);
      choose.type='button';choose.disabled=!unlocked;choose.setAttribute('aria-pressed',String(selected.id===item.id));
      choose.addEventListener('click',()=>{if(!root.ModeAtlasProgress.selectAppearance(item.id))return;refresh();collection.querySelectorAll('[aria-pressed]').forEach(button=>{const on=button===choose;button.setAttribute('aria-pressed',String(on));if(!button.disabled)button.textContent=on?'Selected':'Use title & frame';});});card.append(choose);
      if(unlocked&&item.icon&&root.AtlasPlatform.getCapabilities().alternateIcons){
        const icon=el('button','ma-button ma-button--ghost ma-button--small','Use app icon');icon.type='button';
        icon.addEventListener('click',async()=>{icon.disabled=true;try{await root.AtlasPlatform.setAppIcon(item.icon);root.ModeAtlasFeedback.toast('App icon updated.','success');}catch{root.ModeAtlasFeedback.toast('The app icon could not be changed. Please try again.','error');}finally{icon.disabled=false;}});card.append(icon);
      }
      collection.append(card);
    }
    content.append(collection,el('p','ma-atlas-rewards__note','Earn titles and frames as your Atlas grows. Every practice mode is available from the start.'));
    if(root.AtlasPlatform.getCapabilities().alternateIcons){const reset=el('button','ma-button ma-button--ghost','Use original app icon');reset.type='button';reset.addEventListener('click',()=>root.AtlasPlatform.setAppIcon(null).catch(()=>root.ModeAtlasFeedback.toast('The app icon could not be changed.','error')));content.append(reset);}
    const mastery=el('button','ma-button ma-button--ghost','Open Mastery Map');mastery.type='button';mastery.addEventListener('click',()=>{root.ModeAtlasDialog.close();setTimeout(()=>root.ModeAtlasFeatures.openMasteryMap(),0);});content.append(mastery);
    return root.ModeAtlasDialog.feature({kicker:'Progress & rewards',title:'Your Atlas',contentNode:content});
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-ma-rewards-open]'))open();});
  for(const event of ['modeAtlasProgressChanged','modeAtlasCloudDataChanged','ma:ui-refresh'])root.addEventListener(event,refresh);
  document.addEventListener('DOMContentLoaded',refresh);
  root.ModeAtlasRewardsUI=Object.freeze({open,refresh,appearance});
})(window);
