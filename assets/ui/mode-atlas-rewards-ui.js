/* Shared goals and reward presentation. Progress owns unlocks and selection. */
(function ModeAtlasRewardsUI(root){
  'use strict';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const ranks={plain:'Original',grove:'Bronze',bridge:'Silver',summit:'Gold',lantern:'Amethyst',horizon:'Diamond'};
  const compactLabels={recall:'Recall 20 kana',balance:'Read 5 · Write 5',review:'Recall 5 due kana'};
  const button=(label,cls='ma-button ma-button--ghost')=>{const node=el('button',cls,label);node.type='button';return node;};
  function appearance(){
    const state=root.ModeAtlasProgress.readState(),level=root.ModeAtlasProgress.getSummary(state).level;
    return root.ModeAtlasRewardRules.appearance(state.appearance.landmark,level);
  }
  function banner(){
    const state=root.ModeAtlasProgress.readState();
    return root.ModeAtlasRewardRules.banner(state.appearance.banner,root.ModeAtlasProgress.getSummary(state).level);
  }
  function refresh(){
    const item=appearance(),selectedBanner=banner(),summary=root.ModeAtlasProgress.getSummary(),routine=root.ModeAtlasProgress.routine();
    const title=document.getElementById('profileAtlasTitle');if(title)title.textContent=item.title;
    document.querySelectorAll('#profileAvatar,#topProfileDot,[data-ma-selected-avatar]').forEach(node=>{node.dataset.maFrame=item.frame;});
    document.querySelectorAll('[data-ma-selected-title]').forEach(node=>{node.textContent=item.title;});
    document.querySelectorAll('[data-ma-selected-banner]').forEach(node=>{node.dataset.maBanner=selectedBanner.id;});
    document.querySelectorAll('.ma-atlas-banner-choice').forEach(node=>{
      const reward=root.ModeAtlasRewardRules.banners.find(reward=>reward.id===node.dataset.maBanner),unlocked=summary.level>=reward.level;
      node.disabled=!unlocked;node.setAttribute('aria-pressed',String(reward.id===selectedBanner.id));
      node.querySelector('small').textContent=reward.id===selectedBanner.id?'Selected':unlocked?'Available':`Level ${reward.level}`;
      node.setAttribute('aria-label',`${reward.name} banner, ${reward.id===selectedBanner.id?'selected':unlocked?'available':'unlocks at level '+reward.level}`);
    });
    document.querySelectorAll('.ma-atlas-landmark').forEach(node=>{
      const reward=root.ModeAtlasRewardRules.landmarks.find(reward=>reward.id===node.dataset.landmark),unlocked=summary.level>=reward.level;
      node.disabled=!unlocked;node.dataset.unlocked=String(unlocked);node.setAttribute('aria-pressed',String(reward.id===item.id));
      node.setAttribute('aria-label',`${reward.title}, ${ranks[reward.frame]} frame, ${unlocked?'level':'unlocks at level'} ${reward.level}`);
      node.querySelector('.ma-atlas-landmark__state').textContent=unlocked?'✓':'Locked';
    });
    document.querySelectorAll('.ma-atlas-icon-choice').forEach(node=>{
      const unlocked=summary.level>=Number(node.dataset.rewardLevel);node.disabled=!unlocked;
      node.setAttribute('aria-label',unlocked?`Use ${node.dataset.appIcon} app icon`:`${node.dataset.appIcon} app icon, unlocks at level ${node.dataset.rewardLevel}`);
      node.querySelector('small').hidden=unlocked;
    });
    document.querySelectorAll('[data-ma-routine-streak]').forEach(node=>{node.textContent=String(routine.streak);});
    document.querySelectorAll('[data-ma-atlas-summary]').forEach(node=>{node.textContent=`Level ${summary.level} · ${routine.streak}-day study streak`;});
    renderGoals(document.querySelector('.ma-atlas-rewards .ma-routine-goals'));
  }
  function avatar(item){
    const node=el('span','ma-atlas-avatar');node.dataset.maFrame=item.frame;node.setAttribute('aria-hidden','true');
    const source=root.KanaCloudSync?.getUser?.()?.photoURL||document.querySelector('#topProfileDot img')?.getAttribute('src');
    if(source){const image=el('img');image.src=source;image.alt='';node.append(image);}else node.textContent='あ';
    return node;
  }
  function renderGoals(host,{compact=false}={}){
    if(!host)return;
    const routine=root.ModeAtlasProgress.routine();host.replaceChildren();
    for(const goal of routine.goals.filter(goal=>!compact||goal.id!=='week')){
      const complete=goal.value>=goal.target,card=el('div','ma-routine-goal');card.dataset.goal=goal.id;card.dataset.complete=String(complete);
      card.append(el('strong','',compact?compactLabels[goal.id]:goal.label));
      const value=el('span','',compact?`${Math.min(goal.target,goal.value)}/${goal.target}${complete?' ✓':''}`:complete?`✓ Complete · +${goal.xp} XP`:`${Math.min(goal.target,goal.value)} / ${goal.target} · +${goal.xp} XP`);
      card.append(value);
      const meter=el('progress');meter.max=goal.target;meter.value=Math.min(goal.target,goal.value);meter.setAttribute('aria-label',goal.label);card.append(meter);host.append(card);
    }
  }
  function goalPanel(){
    const panel=el('div','ma-atlas-panel');
    panel.append(el('h3','','Daily & weekly goals'));
    const goals=el('div','ma-routine-goals');renderGoals(goals);panel.append(goals);
    const reviewActions=el('div','ma-atlas-rewards__actions');
    for(const mode of ['reading','writing']){
      const due=root.ModeAtlasReview.due(root.ModeAtlasStorage.readModeJSON(mode,'srs',{}));
      if(due.length){const link=el('a','ma-button ma-button--ghost',`Review ${mode} · ${due.length} due`);link.href=`/${mode}/?practice=10&due=1`;reviewActions.append(link);}
    }
    if(!reviewActions.childElementCount)reviewActions.append(el('p','ma-atlas-rewards__note','You’re up to date with your reviews.'));
    panel.append(reviewActions);
    const mastery=button('Open Mastery Map');mastery.addEventListener('click',()=>root.ModeAtlasFeatures.openMasteryMap());panel.append(mastery);
    return panel;
  }
  function rewardPanel(summary){
    const panel=el('div','ma-atlas-panel');
    panel.append(el('h3','','Profile banners'),el('p','ma-atlas-rewards__note','A background for your profile and Friends cards. Mix it with any unlocked title and frame.'));
    const banners=el('div','ma-atlas-banners');
    for(const item of root.ModeAtlasRewardRules.banners){
      const choose=button('','ma-atlas-banner-choice ma-profile-banner');choose.dataset.maBanner=item.id;
      choose.append(el('strong','',item.name),el('small','',summary.level>=item.level?'Available':`Level ${item.level}`));
      choose.addEventListener('click',()=>{if(root.ModeAtlasProgress.selectBanner(item.id))refresh();});banners.append(choose);
    }
    panel.append(banners);
    panel.append(el('h3','','Titles & frames'),el('p','ma-atlas-rewards__note','Choose a look for your profile. Unlock more as you level up.'));
    const collection=el('div','ma-atlas-collection');
    for(const item of root.ModeAtlasRewardRules.landmarks){
      const unlocked=summary.level>=item.level,choose=button('','ma-atlas-landmark');
      choose.dataset.unlocked=String(unlocked);choose.dataset.landmark=item.id;choose.disabled=!unlocked;
      choose.setAttribute('aria-label',`${item.title}, ${ranks[item.frame]} frame, ${unlocked?'level':'unlocks at level'} ${item.level}`);
      const copy=el('span','ma-atlas-landmark__copy');
      copy.append(el('strong','',item.title),el('small','',`${ranks[item.frame]} frame · Level ${item.level}`));
      const state=el('span','ma-atlas-landmark__state',unlocked?'✓':'Locked');state.setAttribute('aria-hidden','true');
      choose.append(avatar(item),copy,state);
      choose.addEventListener('click',()=>{if(root.ModeAtlasProgress.selectAppearance(item.id))refresh();});
      collection.append(choose);
    }
    panel.append(collection);
    if(root.AtlasPlatform.getCapabilities().alternateIcons){
      panel.append(el('h3','','App icons'),el('p','ma-atlas-rewards__note','Choose an icon for this device’s Home Screen.'));
      const icons=el('div','ma-atlas-icons');
      const choices=[{id:'original',name:'Original',icon:null,level:1},...root.ModeAtlasRewardRules.landmarks.filter(item=>item.icon)];
      let changing=false;
      for(const item of choices){
        const unlocked=summary.level>=item.level,name=item.icon||'Original',choose=button('','ma-atlas-icon-choice');choose.dataset.appIcon=name;choose.dataset.rewardLevel=String(item.level);
        choose.disabled=!unlocked;choose.setAttribute('aria-label',unlocked?`Use ${name} app icon`:`${name} app icon, unlocks at level ${item.level}`);
        if(item.icon){const preview=el('img');preview.src=`/assets/rewards/${item.icon}.svg`;preview.alt='';choose.append(preview);}else{const mark=el('span','ma-atlas-icon-choice__original','あア');mark.setAttribute('aria-hidden','true');choose.append(mark);}
        choose.append(el('strong','',name));const level=el('small','',`Level ${item.level}`);level.hidden=unlocked;choose.append(level);
        choose.addEventListener('click',async()=>{
          if(changing)return;changing=true;choose.setAttribute('aria-busy','true');
          try{await root.AtlasPlatform.setAppIcon(item.icon);root.ModeAtlasFeedback.toast('App icon updated.','success');}
          catch{root.ModeAtlasFeedback.toast('The app icon could not be changed. Please try again.','error');}
          finally{changing=false;choose.removeAttribute('aria-busy');}
        });icons.append(choose);
      }
      panel.append(icons);
    }
    return panel;
  }
  function mount(host){
    const summary=root.ModeAtlasProgress.getSummary(),selected=appearance();
    const content=el('div','ma-atlas-rewards'),identity=el('div','ma-atlas-identity ma-profile-banner');identity.dataset.maSelectedBanner='';
    const preview=avatar(selected);preview.dataset.maSelectedAvatar='';
    const copy=el('div','ma-atlas-identity__copy'),title=el('strong','',selected.title);title.dataset.maSelectedTitle='';
    const status=el('span');status.dataset.maAtlasSummary='';
    copy.append(title,status);identity.append(preview,copy);content.append(identity);
    const tabs=el('div','ma-atlas-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Your Atlas');
    const panels=[goalPanel(),rewardPanel(summary)];
    const controls=['Goals','Rewards'].map((label,index)=>{
      const tab=button(label);tab.id=`atlasTab${index}`;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',`atlasPanel${index}`);
      panels[index].id=`atlasPanel${index}`;panels[index].setAttribute('role','tabpanel');panels[index].setAttribute('aria-labelledby',tab.id);panels[index].tabIndex=0;
      tab.addEventListener('click',()=>selectTab(index));tabs.append(tab);return tab;
    });
    function selectTab(index){controls.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});}
    tabs.addEventListener('keydown',event=>{
      const index=controls.indexOf(document.activeElement);if(index<0)return;
      const target=event.key==='ArrowRight'?(index+1)%2:event.key==='ArrowLeft'?(index+1)%2:event.key==='Home'?0:event.key==='End'?1:-1;
      if(target>=0){event.preventDefault();selectTab(target);controls[target].focus();}
    });
    selectTab(0);content.append(tabs,...panels);
    host.replaceChildren(content);refresh();
    return ()=>content.remove();
  }
  function open(){root.ModeAtlasAccountNavigation?.open('atlas');}
  document.addEventListener('click',event=>{if(event.target.closest('[data-ma-rewards-open]'))open();});
  for(const event of ['modeAtlasProgressChanged','modeAtlasCloudDataChanged','modeAtlasProfileMenuReady'])root.addEventListener(event,refresh);
  document.addEventListener('ma:ui-refresh',refresh);
  document.addEventListener('DOMContentLoaded',refresh);
  root.ModeAtlasRewardsUI=Object.freeze({open,mount,refresh,appearance,banner,renderGoals});
})(window);
