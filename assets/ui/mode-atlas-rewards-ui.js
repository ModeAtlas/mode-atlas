/* Shared reward presentation. Catalogue/access own unlocks; progress persists selection. */
(function ModeAtlasRewardsUI(root){
  'use strict';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const ranks={plain:'Original',grove:'Bronze',bridge:'Silver',summit:'Gold',lantern:'Amethyst',horizon:'Diamond'};
  const rules=root.ModeAtlasRewardRules;
  const wardrobeItems=Object.entries(root.ModeAtlasAvatarRules.slots).flatMap(([slot,type])=>rules.catalogue[type].filter(item=>item.grant||item.level>1).map(item=>({...item,slot,type})));
  const access=()=>root.ModeAtlasRewardAccess?.current()||{};
  const button=(label,cls='ma-button ma-button--ghost')=>{const node=el('button',cls,label);node.type='button';return node;};
  function pageActions(items=[]){
    const host=el('div','ma-action-grid');host.setAttribute('aria-label','Explore your progress');
    for(const item of [...items,{label:'View achievements',short:'Achievements',icon:'achievement',achievements:true}]){
      const control=item.href?el('a','ma-button ma-button--ghost'):button('');
      if(item.href)control.href=item.href;if(item.action)control.addEventListener('click',item.action);if(item.achievements)control.dataset.maAchievementsOpen='';
      control.setAttribute('aria-label',item.label);
      const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(icon.namespaceURI,'use');icon.classList.add('ma-icon');icon.setAttribute('aria-hidden','true');use.setAttribute('href','/assets/mode-atlas-icons.svg#icon-'+item.icon);icon.append(use);
      control.append(icon,el('span','',item.short||item.label));host.append(control);
    }return host;
  }
  function appearance(){
    const state=root.ModeAtlasProgress.readState(),level=root.ModeAtlasProgress.getSummary(state).level;
    return root.ModeAtlasRewardRules.appearance(state.appearance.landmark,level,access());
  }
  function banner(){
    const state=root.ModeAtlasProgress.readState();
    return root.ModeAtlasRewardRules.banner(state.appearance.banner,root.ModeAtlasProgress.getSummary(state).level,access());
  }
  function refresh(){
    const item=appearance(),selectedBanner=banner(),summary=root.ModeAtlasProgress.getSummary(),routine=root.ModeAtlasProgress.routine();
    const title=document.getElementById('profileAtlasTitle');if(title)title.textContent=item.title;
    document.querySelectorAll('#profileAvatar,#topProfileDot,[data-ma-selected-avatar]').forEach(node=>{node.dataset.maFrame=item.frame;});
    document.querySelectorAll('[data-ma-selected-avatar]').forEach(renderAvatar);
    document.querySelectorAll('.ma-reward-studio__art').forEach(renderStudio);
    document.querySelectorAll('[data-ma-selected-title]').forEach(node=>{node.textContent=item.title;});
    document.querySelectorAll('[data-ma-selected-banner]').forEach(node=>{node.dataset.maBanner=selectedBanner.id;});
    document.querySelectorAll('.ma-atlas-banner-choice').forEach(node=>{
      const reward=root.ModeAtlasRewardRules.banners.find(reward=>reward.id===node.dataset.maBanner),unlocked=rules.unlocked(reward,summary.level,access());
      node.hidden=!rules.visible(reward,summary.level,access());
      node.disabled=!unlocked;node.setAttribute('aria-pressed',String(reward.id===selectedBanner.id));
      node.querySelector('small').textContent=reward.id===selectedBanner.id?'Selected':unlocked?'Available':`Level ${reward.level}`;
      node.setAttribute('aria-label',`${reward.name} banner, ${reward.id===selectedBanner.id?'selected':unlocked?'available':'unlocks at level '+reward.level}`);
    });
    document.querySelectorAll('.ma-atlas-landmark').forEach(node=>{
      const reward=root.ModeAtlasRewardRules.landmarks.find(reward=>reward.id===node.dataset.landmark),unlocked=rules.unlocked(reward,summary.level,access());
      node.hidden=!rules.visible(reward,summary.level,access());
      node.disabled=!unlocked;node.dataset.unlocked=String(unlocked);node.setAttribute('aria-pressed',String(reward.id===item.id));
      node.setAttribute('aria-label',`${reward.title}, ${ranks[reward.frame]||reward.name} frame, ${reward.kind==='shop'?'shop collection':reward.grant?'exclusive reward':`${unlocked?'level':'unlocks at level'} ${reward.level}`}`);
      node.querySelector('.ma-atlas-landmark__state').textContent=unlocked?'✓':'Locked';
    });
    document.querySelectorAll('.ma-atlas-icon-choice').forEach(node=>{
      const reward=rules.item('icons',node.dataset.rewardId),unlocked=rules.unlocked(reward,summary.level,access());node.hidden=!rules.visible(reward,summary.level,access());node.disabled=!unlocked;
      node.setAttribute('aria-label',unlocked?`Use ${node.dataset.appIcon} app icon`:`${node.dataset.appIcon} app icon, unlocks at level ${node.dataset.rewardLevel}`);
      node.querySelector('small').hidden=unlocked;
    });
    for(const node of document.querySelectorAll('[data-ma-wardrobe-item]')){
      const item=rules.item(node.dataset.wardrobeType,node.dataset.maWardrobeItem),available=rules.unlocked(item,summary.level,access());
      node.hidden=!rules.visible(item,summary.level,access());
      node.querySelector('small').textContent=available?'In your wardrobe':`Level ${item.level}`;
    }
    for(const section of document.querySelectorAll('[data-reward-category]')){
      const type=section.dataset.rewardCategory,items=(type==='wardrobe'?wardrobeItems:rules.catalogue[type]).filter(item=>rules.visible(item,summary.level,access()));
      if(type==='wardrobe')section.hidden=!items.length;
      const selected=type==='banners'?selectedBanner.name:type==='frames'?item.title:'';
      section.querySelector('.ma-reward-category__meta').textContent=[selected,`${items.filter(item=>rules.unlocked(item,summary.level,access())).length+(type==='themes'?3:0)} available`].filter(Boolean).join(' · ');
    }
    root.ModeAtlasTheme?.updateButtons();
    const notice=document.querySelector('.ma-reward-access');
    if(notice){
      const state=root.ModeAtlasRewardAccess?.status(),owned=access();
      const hasExtra=Object.values(rules.catalogue).some(items=>items.some(reward=>reward.grant&&rules.unlocked(reward,summary.level,owned)));
      notice.hidden=!hasExtra||!['loading','offline','error'].includes(state);
      notice.querySelector('span').textContent=state==='loading'?'Refreshing your extra rewards…':state==='offline'?'Showing your saved extra rewards while offline.':'Showing your saved extra rewards.';
      notice.querySelector('button').hidden=state!=='error';
    }
    document.querySelectorAll('[data-ma-routine-streak]').forEach(node=>{node.textContent=String(routine.streak);});
    document.querySelectorAll('[data-ma-atlas-summary]').forEach(node=>{node.textContent=`Level ${summary.level} · ${routine.streak}-day study streak`;});
    renderGoals(document.querySelector('.ma-atlas-rewards .ma-routine-goals'));
    renderReviews(document.querySelector('[data-ma-due-reviews]'));
    renderRecap(document.querySelector('.ma-atlas-recap'));
  }
  function avatar(item){
    const node=el('span','ma-atlas-avatar');node.dataset.maFrame=item.frame;node.setAttribute('aria-hidden','true');
    renderAvatar(node);
    return node;
  }
  function renderAvatar(node){
    root.ModeAtlasPortrait?.render(node);
  }

  function renderStudio(node){root.ModeAtlasAvatarArt.render(node,root.ModeAtlasAvatar?.presentation?.()?.character);}

  function renderGoals(host,{compact=false}={}){
    if(!host)return;
    const routine=root.ModeAtlasProgress.routine();host.replaceChildren();
    const groups=new Map();
    if(!compact){
      for(const [period,label]of [['daily','Today'],['weekly','This week']]){
        const goals=routine.goals.filter(goal=>goal.period===period),group=el('section','ma-goal-group'),heading=el('div','ma-goal-group__heading');
        heading.append(el('h3','',label),el('span','',`${goals.filter(goal=>goal.value>=goal.target).length} / ${goals.length} complete`));
        group.append(heading);host.append(group);groups.set(period,group);
      }
    }
    for(const goal of routine.goals.filter(goal=>!compact||goal.period==='daily')){
      const complete=goal.value>=goal.target,action=root.ModeAtlasStudyPlan.goalAction(goal,routine.goals),card=el(action?'a':'div','ma-routine-goal');card.classList.toggle('ma-routine-goal--full',!compact);card.dataset.goal=goal.id;card.dataset.complete=String(complete);card.dataset.period=goal.period;
      if(action){card.href=action.href;card.setAttribute('aria-label',`${goal.label} · ${Math.min(goal.value,goal.target)} of ${goal.target} · ${action.label}`);}
      const meter=el('progress');meter.max=goal.target;meter.value=Math.min(goal.target,goal.value);meter.setAttribute('aria-label',goal.label);
      if(compact){
        card.append(el('strong','',goal.short),el('span','',`${Math.min(goal.target,goal.value)}/${goal.target}${complete?' ✓':''}`),meter);host.append(card);
      }else{
        const mark=el('span','ma-goal-ring',complete?'✓':'');mark.setAttribute('aria-hidden','true');mark.style.setProperty('--goal-progress',Math.min(100,goal.value/goal.target*100)+'%');
        const copy=el('div','ma-goal-copy');copy.append(el('strong','',goal.label),el('span','',complete?'Complete':`${Math.min(goal.value,goal.target)} / ${goal.target}`),meter);
        const reward=el('span','ma-goal-reward',`+${goal.xp} XP`);
        if(action)copy.append(el('small','ma-routine-goal__action',action.label+' →'));
        card.append(mark,copy,reward);groups.get(goal.period).append(card);
      }
    }
  }
  function renderRecap(host){
    if(!host)return;
    const previous=host.dataset.previous==='true',data=root.ModeAtlasProgress.weeklyRecap(undefined,Date.now(),previous);
    host.replaceChildren();
    const controls=el('div','ma-atlas-tabs');controls.setAttribute('role','group');controls.setAttribute('aria-label','Recap week');
    for(const [value,label]of [[false,'This week'],[true,'Last week']]){const control=button(label);control.setAttribute('aria-pressed',String(value===previous));control.addEventListener('click',()=>{host.dataset.previous=String(value);renderRecap(host);host.querySelector('[aria-pressed="true"]')?.focus();});controls.append(control);}
    host.append(el('h3','','Your weekly recap'),controls,el('p','ma-atlas-rewards__note',`${data.start} – ${data.end} · Your local study week`));
    const grid=el('div','ma-recap-grid');
    for(const [label,value]of [['Study days',`${data.studyDays} / 7`],['Read correct',data.reading],['Recall correct',data.writing],['Kanji correct',data.kanji||0],['Sessions',data.sessions],['Different kana',data.variety],['Daily goals completed',data.dailyGoals],['Weekly goals completed',data.weeklyGoals]]){const card=el('div');card.append(el('strong','',Number.isFinite(value)?value.toLocaleString():value),el('span','',label));grid.append(card);}
    host.append(grid,el('p','ma-atlas-rewards__note',data.reading+data.writing+(data.kanji||0)?'Each study day needs five correct answers across your practice. These totals use saved, dated activity; older undated practice is not estimated.':'No dated practice is recorded for this week yet. A short session is a good place to start.'));
    host.append(pageActions([{label:'Start a short session',short:'Practise',icon:'play',href:'/reading/?practice=10'},{label:'View weekly ranking',short:'Rankings',icon:'chart',href:root.AtlasPlatform.destinationPath('weekly')} ]));
  }
  function renderReviews(reviewActions){
    if(!reviewActions)return;
    reviewActions.replaceChildren();
    for(const mode of ['reading','writing']){
      const due=root.ModeAtlasReview.due(root.ModeAtlasStorage.readModeJSON(mode,'srs',{}));
      if(due.length){const link=el('a','ma-button ma-button--ghost',`Review ${mode==='reading'?'Read':'Recall'} · ${due.length} due`);link.href=`/${mode}/?practice=10&due=1`;reviewActions.append(link);}
    }
    for(const {label,href,due}of root.ModeAtlasStudyPlan.kanjiReviews()){const link=el('a','ma-button ma-button--ghost',`${label} · ${due} due`);link.href=href;reviewActions.append(link);}
    if(!reviewActions.childElementCount)reviewActions.append(el('p','ma-atlas-rewards__note','You’re up to date with your reviews.'));
  }
  function goalPanel(){
    const panel=el('div','ma-atlas-panel');
    panel.classList.add('ma-goals-panel');
    const goals=el('div','ma-routine-goals');renderGoals(goals);panel.append(goals);
    const reviews=el('section','ma-due-reviews'),heading=el('div','ma-due-reviews__heading');
    const title=el('h3','','Spaced reviews');title.id='maDueReviewsTitle';reviews.setAttribute('aria-labelledby',title.id);
    const help=button('i','ma-info-button');help.setAttribute('aria-label','About due reviews');help.setAttribute('aria-haspopup','dialog');
    help.addEventListener('click',()=>root.ModeAtlasDialog.alert({title:'What does “due” mean?',message:root.ModeAtlasReview.dueHelp(),confirmLabel:'Got it'}));
    heading.append(title,help);
    const reviewActions=el('div','ma-atlas-rewards__actions');reviewActions.dataset.maDueReviews='';renderReviews(reviewActions);
    reviews.append(heading,reviewActions);panel.append(reviews);
    panel.append(pageActions([{label:'Open Mastery Map',short:'Mastery Map',icon:'book',action:()=>root.ModeAtlasFeatures.openMasteryMap()}]));
    return panel;
  }
  function category(type,title,note,open=false){
    const section=el('details','ma-reward-category');section.dataset.rewardCategory=type;section.open=open;
    const heading=el('summary'),copy=el('span','ma-reward-category__heading');
    copy.append(el('strong','',title),el('small','ma-reward-category__meta'));
    const arrow=el('span','ma-reward-category__arrow','⌄');arrow.setAttribute('aria-hidden','true');
    const mark=el('span','ma-reward-category__mark');mark.setAttribute('aria-hidden','true');
    if(type==='icons'){const image=el('img');image.src='/assets/brand/mode-atlas-symbol.svg';image.alt='';mark.append(image);}
    else mark.textContent=({themes:'◐',banners:'▧',wardrobe:'✧',frames:'◎'})[type];
    heading.append(mark,copy,arrow);
    const content=el('div','ma-reward-category__content');content.append(el('p','ma-atlas-rewards__note',note));section.append(heading,content);
    return {section,content};
  }
  function rewardPanel(summary){
    const panel=el('div','ma-atlas-panel ma-collection-panel');
    const notice=el('div','ma-reward-access');notice.hidden=true;notice.setAttribute('role','status');
    const retry=button('Refresh');retry.addEventListener('click',()=>{void root.ModeAtlasRewardAccess?.refresh(true);});notice.append(el('span'),retry);panel.append(notice);
    const inventory=el('section');root.ModeAtlasShopUI?.renderInventory(inventory);panel.append(inventory);
    const edit=button('','ma-reward-studio');edit.dataset.maAvatarOpen='';const figure=el('span','ma-reward-studio__art');figure.setAttribute('aria-hidden','true');renderStudio(figure);const editCopy=el('span');editCopy.append(el('strong','','Edit avatar & pet'),el('small','','Make your character your own'));edit.append(figure,editCopy,el('span','','→'));panel.append(edit);
    const themesSection=category('themes','App themes','A new look throughout Mode Atlas.'),themes=el('div','ma-owned-themes');
    for(const [id,name]of [['dark','Dark'],['light','Light'],['system','System']]){const choose=button(name);choose.dataset.maThemeChoice=id;themes.append(choose);}
    for(const theme of rules.themes){const choose=button(theme.name,'ma-button ma-theme-collection-choice');choose.dataset.maThemeChoice=theme.id;choose.dataset.maThemeSample=theme.id;themes.append(choose);}
    themesSection.content.append(themes);panel.append(themesSection.section);
    const bannersSection=category('banners','Profile banners','A background for your profile and Friends cards.',true),banners=el('div','ma-atlas-banners');
    for(const item of rules.banners){
      const choose=button('','ma-atlas-banner-choice ma-profile-banner');choose.dataset.maBanner=item.id;
      choose.append(el('strong','',item.name),el('small'));
      if(item.grant){const badge=el('span','ma-reward-exclusive',item.kind==='shop'?'Shop':item.kind==='event'?'Event':'Exclusive');choose.append(badge);}
      choose.addEventListener('click',()=>{if(root.ModeAtlasProgress.selectBanner(item.id))refresh();});banners.append(choose);
    }
    bannersSection.content.append(banners);panel.append(bannersSection.section);
    const wardrobeSection=category('wardrobe','Wardrobe & companions','Choose your favourites in Edit avatar & pet.'),wardrobe=el('div','ma-avatar-collection');
    for(const item of wardrobeItems){
      const tile=el('article','ma-avatar-collectible'),art=el('span','ma-avatar-item__art');tile.dataset.maWardrobeItem=item.id;tile.dataset.wardrobeType=item.type;
      root.ModeAtlasAvatarArt.render(art,{...root.ModeAtlasAvatarRules.defaults,[item.slot]:item.id},{portrait:!['outfit','pants','pet'].includes(item.slot),petOnly:item.slot==='pet'});
      tile.append(art,el('strong','',item.name),el('small'));wardrobe.append(tile);
    }
    wardrobeSection.content.append(wardrobe);panel.append(wardrobeSection.section);
    const framesSection=category('frames','Titles & frames','Choose a look for your profile. Unlock more as you level up.'),collection=el('div','ma-atlas-collection');
    for(const item of rules.landmarks){
      const choose=button('','ma-atlas-landmark');choose.dataset.landmark=item.id;
      const copy=el('span','ma-atlas-landmark__copy');
      copy.append(el('strong','',item.title),el('small','',item.kind==='shop'?'Shop collection':item.grant?'Exclusive':`${ranks[item.frame]} frame · Level ${item.level}`));
      const state=el('span','ma-atlas-landmark__state');state.setAttribute('aria-hidden','true');choose.append(avatar(item),copy,state);
      choose.addEventListener('click',()=>{if(root.ModeAtlasProgress.selectAppearance(item.id))refresh();});collection.append(choose);
    }
    framesSection.content.append(collection);panel.append(framesSection.section);
    if(root.AtlasPlatform.getCapabilities().alternateIcons){
      const iconsSection=category('icons','App icons','Choose an icon for this device’s Home Screen.'),icons=el('div','ma-atlas-icons');
      let changing=false;
      for(const item of rules.icons){
        const name=item.name,choose=button('','ma-atlas-icon-choice');choose.dataset.appIcon=name;choose.dataset.rewardId=item.id;choose.dataset.rewardLevel=String(item.level||0);
        const preview=el('img');preview.src=item.icon?`/assets/rewards/${item.icon}.svg`:'/assets/mode-atlas-icon.svg';preview.alt='';choose.append(preview);
        choose.append(el('strong','',name),el('small','',item.kind==='shop'?'Shop':item.grant?'Exclusive':`Level ${item.level}`));
        choose.addEventListener('click',async()=>{
          if(changing||!rules.unlocked(item,root.ModeAtlasProgress.getSummary().level,access()))return;
          changing=true;choose.setAttribute('aria-busy','true');
          try{await root.AtlasPlatform.setAppIcon(item.icon);root.ModeAtlasFeedback.toast('App icon updated.','success');}
          catch{root.ModeAtlasFeedback.toast('The app icon could not be changed. Please try again.','error');}
          finally{changing=false;choose.removeAttribute('aria-busy');}
        });icons.append(choose);
      }
      iconsSection.content.append(icons);panel.append(iconsSection.section);
    }
    panel.append(pageActions());
    return panel;
  }
  function mount(host){
    const summary=root.ModeAtlasProgress.getSummary(),selected=appearance();
    const content=el('div','ma-atlas-rewards'),identity=el('div','ma-atlas-identity ma-profile-banner');identity.dataset.maSelectedBanner='';
    const preview=avatar(selected);preview.dataset.maSelectedAvatar='';
    const copy=el('div','ma-atlas-identity__copy'),title=el('strong','',selected.title);title.dataset.maSelectedTitle='';
    const status=el('span');status.dataset.maAtlasSummary='';
    copy.append(title,status);identity.append(preview,copy);content.append(identity);
    const tabs=el('div','ma-atlas-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Progress');
    const recap=el('div','ma-atlas-panel ma-atlas-recap');renderRecap(recap);
    const panels=[goalPanel(),rewardPanel(summary),recap];
    const controls=['Goals','Rewards','Recap'].map((label,index)=>{
      const tab=button(label);tab.id=`atlasTab${index}`;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',`atlasPanel${index}`);
      panels[index].id=`atlasPanel${index}`;panels[index].setAttribute('role','tabpanel');panels[index].setAttribute('aria-labelledby',tab.id);panels[index].tabIndex=0;
      tab.addEventListener('click',()=>selectTab(index));tabs.append(tab);return tab;
    });
    function selectTab(index){controls.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});if(index===2)renderRecap(recap);}
    tabs.addEventListener('keydown',event=>{
      const index=controls.indexOf(document.activeElement);if(index<0)return;
      const target=event.key==='ArrowRight'?(index+1)%controls.length:event.key==='ArrowLeft'?(index+controls.length-1)%controls.length:event.key==='Home'?0:event.key==='End'?controls.length-1:-1;
      if(target>=0){event.preventDefault();selectTab(target);controls[target].focus();}
    });
    const requested=new URLSearchParams(location.search).get('tab');selectTab(requested==='rewards'?1:requested==='recap'?2:0);content.append(tabs,...panels);
    host.replaceChildren(content);refresh();void root.ModeAtlasRewardAccess?.refresh();void root.ModeAtlasShop?.refresh();void root.ModeAtlasSocial?.refreshProfile?.();
    return ()=>content.remove();
  }
  function open(section='goals'){
    if(location.pathname==='/progress/'){root.ModeAtlasAccountNavigation?.close();const tab=document.getElementById(section==='rewards'?'atlasTab1':'atlasTab0');tab?.click();tab?.focus();return;}
    root.ModeAtlasVersionFile.navigate('/progress/'+(section==='rewards'?'?tab=rewards':''));
  }
  document.addEventListener('click',event=>{const control=event.target.closest('[data-ma-rewards-open]');if(control)open(control.dataset.maRewardsOpen||'goals');});
  for(const event of ['modeAtlasAvatarChanged','modeAtlasShopChanged','modeAtlasRewardAccessChanged','modeAtlasProgressChanged','modeAtlasCloudDataChanged','modeAtlasProfileMenuReady','modeAtlasSelfProfileChanged','modeAtlasAccountSignedOut'])root.addEventListener(event,refresh);
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{refresh();if(document.querySelector('[data-ma-selected-avatar]'))void root.ModeAtlasSocial?.refreshProfile?.();});
  document.addEventListener('ma:ui-refresh',refresh);
  document.addEventListener('DOMContentLoaded',refresh);
  root.ModeAtlasRewardsUI=Object.freeze({open,mount,refresh,appearance,banner,renderGoals});
})(window);
