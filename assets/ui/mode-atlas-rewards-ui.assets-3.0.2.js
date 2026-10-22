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
    const host=el('div','ma-action-grid ma-progress-actions');host.setAttribute('aria-label','Explore your progress');
    for(const item of [...items,{label:'View achievements',short:'Achievements',icon:'achievement',achievements:true}]){
      const control=item.href?el('a','ma-button ma-button--ghost'):button('');
      if(item.href)control.href=item.href;if(item.action)control.addEventListener('click',item.action);if(item.achievements)control.dataset.maAchievementsOpen='';
      control.setAttribute('aria-label',item.label);
      const art=el('img');art.alt='';art.src='/assets/illustrations/'+(item.icon==='book'?'mastery':item.icon==='achievement'?'achievement':'progress')+'-scene.svg';
      control.append(art,el('span','',item.short||item.label));host.append(control);
    }return host;
  }
  function appearance(){
    const state=root.ModeAtlasProgress.readSnapshot(),level=root.ModeAtlasProgress.getSummary(state).level;
    return root.ModeAtlasRewardRules.appearance(state.appearance.landmark,level,access());
  }
  function banner(){
    const state=root.ModeAtlasProgress.readSnapshot();
    return root.ModeAtlasRewardRules.banner(state.appearance.banner,root.ModeAtlasProgress.getSummary(state).level,access());
  }
  let refreshPending=false;
  function refresh(){
    if(refreshPending)return;refreshPending=true;
    requestAnimationFrame(()=>{refreshPending=false;render();});
  }
  function render(){
    const state=root.ModeAtlasProgress.readSnapshot(),summary=root.ModeAtlasProgress.getSummary(state);
    const item=rules.appearance(state.appearance.landmark,summary.level,access()),selectedBanner=rules.banner(state.appearance.banner,summary.level,access());
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
    const routine=document.querySelector('[data-ma-routine-streak],[data-ma-atlas-summary]')?root.ModeAtlasProgress.routine(state):null;
    document.querySelectorAll('[data-ma-routine-streak]').forEach(node=>{node.textContent=String(routine.streak);});
    document.querySelectorAll('[data-ma-atlas-summary]').forEach(node=>{node.textContent=`Level ${summary.level} · ${routine.streak}-day study streak`;});
    const visible=selector=>{const node=document.querySelector(selector);return node&&!node.closest('[hidden]')?node:null;};
    renderGoals(visible('.ma-atlas-rewards .ma-routine-goals'));
    renderReviews(visible('[data-ma-due-reviews]'));
    renderRecap(visible('.ma-atlas-recap'));
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

  function editPersonalGoal(period){
    const current=root.ModeAtlasProgress.routine().goals.find(goal=>goal.personal&&goal.period===period);
    const choices=root.ModeAtlasProgress.personalGoalChoices(period);
    const content=el('form','ma-personal-goal-editor'),type=el('select','ma-input'),target=el('select','ma-input'),repeat=el('input'),explanation=el('p','ma-personal-goal-help'),status=el('p','ma-status');
    type.id='maPersonalGoalType';target.id='maPersonalGoalTarget';repeat.id='maPersonalGoalRepeat';repeat.type='checkbox';repeat.checked=!!current?.repeat;status.setAttribute('role','status');
    for(const item of choices){const option=el('option','',item.name);option.value=item.id;type.append(option);}
    type.value=choices.some(item=>item.id===current?.template)?current.template:choices[0].id;
    const field=(label,input)=>{const row=el('label','ma-personal-goal-field');row.htmlFor=input.id;input.setAttribute('aria-label',label);row.append(el('span','',label),input);return row;};
    const intro=el('p','ma-personal-goal-intro',`Make one ${period==='daily'?'daily':'weekly'} goal your own. Choose what to work on and a target that suits you.`);
    function update(){
      const item=choices.find(goal=>goal.id===type.value);target.replaceChildren();
      for(const value of item[period]){const option=el('option','',String(value)+(item.percent?'%':''));option.value=String(value);target.append(option);}
      if(current?.template===item.id&&item[period].includes(current.target))target.value=String(current.target);
      explanation.textContent=item.help;
    }
    update();type.addEventListener('change',update);
    const repeating=el('label','ma-personal-goal-repeat');repeating.htmlFor=repeat.id;repeating.append(repeat,el('span','',period==='daily'?'Repeat each day':'Repeat each week'));
    const note=el('p','ma-personal-goal-help',`${period==='daily'?'Days reset at midnight':'Weeks run Monday to Sunday'}, using your local time. Activity already recorded this ${period==='daily'?'day':'week'} counts. Earn ${period==='daily'?40:200} XP once per period, even if you edit the goal.`);
    const actions=el('div','ma-personal-goal-actions'),save=button(current?'Save goal':'Create goal','ma-button ma-button--primary');save.type='submit';actions.append(save);
    if(current){const remove=button('Remove goal');remove.addEventListener('click',()=>{try{root.ModeAtlasProgress.removePersonalGoal(period);root.ModeAtlasDialog.close();refresh();}catch(error){status.textContent=error.message;}});actions.append(remove);}
    content.append(intro,field('Goal',type),field('Target',target),explanation,repeating,note,status,actions);
    const action=current&&root.ModeAtlasStudyPlan.goalAction(current);if(action){const link=el('a','ma-personal-goal-study',action.label+' →');link.href=action.href;content.append(link);}
    content.addEventListener('submit',event=>{event.preventDefault();try{root.ModeAtlasProgress.setPersonalGoal(period,{id:type.value,target:Number(target.value),repeat:repeat.checked});root.ModeAtlasDialog.close();refresh();}catch(error){status.textContent=error.message;}});
    root.ModeAtlasDialog.feature({title:period==='daily'?'Your daily goal':'Your weekly goal',kicker:'Personal goal',contentNode:content});
  }
  function changeGoal(goal){
    const content=el('div','ma-goal-choices'),status=el('p','ma-status');status.setAttribute('role','status');
    for(const next of root.ModeAtlasProgress.goalChoices(goal.period,goal.slot)){
      const choice=button('','ma-goal-choice');choice.append(el('span','',next.label),el('small','',`+${next.xp} XP`));
      choice.addEventListener('click',()=>{try{root.ModeAtlasProgress.replaceGoal(goal.period,goal.slot,next.id);root.ModeAtlasDialog.close();refresh();}catch(error){status.textContent=error.message;}});content.append(choice);
    }
    content.append(status);root.ModeAtlasDialog.feature({title:'Choose a goal',kicker:goal.period==='daily'?'Today':'This week',contentNode:content});
  }

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
      const complete=goal.value>=goal.target,action=root.ModeAtlasStudyPlan.goalAction(goal,routine.goals),card=el(goal.personal?'button':action?'a':'div','ma-routine-goal');card.classList.toggle('ma-routine-goal--full',!compact);card.dataset.goal=goal.id;card.dataset.complete=String(complete);card.dataset.period=goal.period;
      if(goal.personal){card.type='button';card.dataset.personal='true';card.setAttribute('aria-label',`${goal.label} · ${Math.min(goal.value,goal.target)} of ${goal.target} · Edit ${goal.period} goal`);card.addEventListener('click',()=>editPersonalGoal(goal.period));}
      else if(action){card.href=action.href;card.setAttribute('aria-label',`${goal.label} · ${Math.min(goal.value,goal.target)} of ${goal.target} · ${action.label}`);}
      const meter=el('progress');meter.max=goal.target;meter.value=Math.min(goal.target,goal.value);meter.setAttribute('aria-label',goal.label);
      if(compact){
        card.append(el('strong','',goal.short),el('span','',`${Math.min(goal.target,goal.value)}/${goal.target}${complete?' ✓':''}`),meter);host.append(card);
      }else{
        const mark=el('span','ma-goal-ring',complete?'✓':'');mark.setAttribute('aria-hidden','true');mark.style.setProperty('--goal-progress',Math.min(100,goal.value/goal.target*100)+'%');
        const copy=el('div','ma-goal-copy');copy.append(el('strong','',goal.label),el('span','',complete?'Complete':`${Math.min(goal.value,goal.target)} / ${goal.target}`),meter);
        const reward=el('span','ma-goal-reward',goal.personal&&goal.claimed?'XP earned':`+${goal.xp} XP`);
        if(goal.personal)copy.append(el('small','ma-routine-goal__action',`Your goal${goal.repeat?' · Repeats':''} · Edit →`));
        else if(action)copy.append(el('small','ma-routine-goal__action',action.label+' →'));
        card.append(mark,copy,reward);
        if(!goal.personal&&!complete){
          const row=el('div','ma-goal-editable'),change=button('↻','ma-goal-change');change.setAttribute('aria-label','Change goal: '+goal.label);change.title='Change goal';change.addEventListener('click',()=>changeGoal(goal));row.append(card,change);groups.get(goal.period).append(row);
        }else groups.get(goal.period).append(card);
      }
    }
    if(!compact)for(const [period,group]of groups){
      if(routine.goals.some(goal=>goal.period===period&&goal.personal))continue;
      const add=button('+ Set '+period+' goal','ma-personal-goal-add');add.dataset.personalGoalAdd=period;add.addEventListener('click',()=>editPersonalGoal(period));group.append(add);
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
    host.append(grid,el('p','ma-atlas-rewards__note',data.reading+data.writing+(data.kanji||0)?'Five attempts make a study day, including mistakes.':'No practice recorded this week.'));
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
    for(const link of reviewActions.querySelectorAll('a')){const label=link.textContent;link.replaceChildren();const mark=el('span','ma-review-branch',link.href.includes('/kanji/')?'字':link.href.includes('/writing/')?'ア':'あ');mark.setAttribute('aria-hidden','true');link.append(mark,el('span','',label));}
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
    if(!root.ModeAtlasLearningExperience?.snapshot().hasLearning&&!new URLSearchParams(location.search).has('tab')){
      const panel=el('section','ma-atlas-rewards');panel.append(el('h2','','No practice yet'),el('p','','Complete a practice session to see your progress.'));
      const start=el('a','ma-button ma-button--primary','Choose a lesson');start.href='/learn/';const explore=button('Explore goals & rewards');explore.addEventListener('click',()=>{history.replaceState(null,'','?tab=goals');mount(host);});panel.append(start,explore);host.replaceChildren(panel);return ()=>panel.remove();
    }

    const summary=root.ModeAtlasProgress.getSummary(),selected=appearance();
    const content=el('div','ma-atlas-rewards'),identity=el('div','ma-atlas-identity ma-profile-banner');identity.dataset.maSelectedBanner='';
    const preview=avatar(selected);preview.dataset.maSelectedAvatar='';
    const copy=el('div','ma-atlas-identity__copy'),title=el('strong','',selected.title);title.dataset.maSelectedTitle='';
    const status=el('span');status.dataset.maAtlasSummary='';
    copy.append(title,status);identity.append(preview,copy);content.append(identity);
    const tabs=el('div','ma-atlas-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Progress');
    const recap=el('div','ma-atlas-panel ma-atlas-recap');
    const panels=[el('div','ma-atlas-panel'),el('div','ma-atlas-panel'),recap],mounted=new Set();
    const controls=['Goals','Rewards','Recap'].map((label,index)=>{
      const tab=button(label);tab.id=`atlasTab${index}`;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',`atlasPanel${index}`);
      panels[index].id=`atlasPanel${index}`;panels[index].setAttribute('role','tabpanel');panels[index].setAttribute('aria-labelledby',tab.id);panels[index].tabIndex=0;
      tab.addEventListener('click',()=>selectTab(index));tabs.append(tab);return tab;
    });
    function selectTab(index){
      if(!mounted.has(index)){
        if(index<2){
          const content=index===0?goalPanel():rewardPanel(root.ModeAtlasProgress.getSummary());
          panels[index].className=content.className;panels[index].append(...content.childNodes);
        }
        mounted.add(index);
      }
      controls.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});
      if(index===0){renderGoals(panels[0].querySelector('.ma-routine-goals'));renderReviews(panels[0].querySelector('[data-ma-due-reviews]'));}
      if(index===1&&panels[index].isConnected)refresh();
      if(index===2)renderRecap(recap);
    }
    tabs.addEventListener('keydown',event=>{
      const index=controls.indexOf(document.activeElement);if(index<0)return;
      const target=event.key==='ArrowRight'?(index+1)%controls.length:event.key==='ArrowLeft'?(index+controls.length-1)%controls.length:event.key==='Home'?0:event.key==='End'?controls.length-1:-1;
      if(target>=0){event.preventDefault();selectTab(target);controls[target].focus();}
    });
    const requested=new URLSearchParams(location.search).get('tab');selectTab(requested==='rewards'?1:requested==='recap'?2:0);content.append(tabs,...panels);
    host.replaceChildren(content);refresh();void root.ModeAtlasRewardAccess?.refresh();void root.ModeAtlasShop?.refresh();
    return ()=>content.remove();
  }
  function open(section='goals'){
    if(location.pathname==='/progress/'){root.ModeAtlasAccountNavigation?.close();const tab=document.getElementById(section==='rewards'?'atlasTab1':'atlasTab0');if(tab){tab.click();tab.focus();return;}}
    root.ModeAtlasVersionFile.navigate('/progress/?tab='+(section==='rewards'?'rewards':'goals'));
  }
  document.addEventListener('click',event=>{const control=event.target.closest('[data-ma-rewards-open]');if(control)open(control.dataset.maRewardsOpen||'goals');});
  for(const event of ['modeAtlasDayChanged','modeAtlasAvatarChanged','modeAtlasShopChanged','modeAtlasRewardAccessChanged','modeAtlasProgressChanged','modeAtlasCloudDataChanged','modeAtlasProfileMenuReady','modeAtlasSelfProfileChanged','modeAtlasAccountSignedOut'])root.addEventListener(event,refresh);
  root.addEventListener('kanaCloudSyncStatusChanged',refresh);
  document.addEventListener('ma:ui-refresh',refresh);
  document.addEventListener('DOMContentLoaded',refresh);
  root.ModeAtlasRewardsUI=Object.freeze({open,mount,refresh,appearance,banner,renderGoals});
})(window);
