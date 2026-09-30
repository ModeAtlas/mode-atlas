/* Shared friends screens. Identity, relationships and ranks come from the server. */
(function ModeAtlasSocialUI(root){
  'use strict';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
  const avatars={kana:['あ','Hiragana'],katakana:['ア','Katakana'],book:['本','Book'],sakura:['桜','Cherry blossom'],mountain:['山','Mountain'],moon:['月','Moon']};
  const number=value=>Number(value||0).toLocaleString();
  let host=null,body=null,notice=null,state=null,owner=null,generation=0,tab='friends',kind='friends',metric='xp';
  const alive=ticket=>!!host?.isConnected && ticket===generation && owner===root.KanaCloudSync?.getUser?.()?.uid;
  function button(label,action,cls='ma-button ma-button--ghost'){
    const node=el('button',cls,label);node.type='button';if(action)node.addEventListener('click',action);return node;
  }
  function status(message,tone='info'){if(notice){notice.textContent=message;notice.dataset.tone=tone;notice.hidden=!message;}}
  function avatar(profile){const node=el('span','ma-atlas-avatar ma-social-avatar',avatars[profile.avatar]?.[0]||'あ');node.dataset.maFrame=profile.frame||'plain';node.setAttribute('aria-hidden','true');return node;}
  function identity(profile){const copy=el('span','ma-social-identity');copy.append(el('strong','',profile.displayName+(profile.uid===owner?' · You':'')),el('small','',`Level ${number(profile.level)} · ${profile.title}`));return copy;}
  async function run(action,onSuccess){
    if(!host || host.getAttribute('aria-busy')==='true')return;
    const ticket=generation;status('');host.setAttribute('aria-busy','true');
    const controls=[...host.querySelectorAll('button,input,select')];controls.forEach(node=>{node.dataset.wasDisabled=String(node.disabled);node.disabled=true;});
    try{const result=await action();if(alive(ticket))await onSuccess?.(result);}
    catch(error){if(alive(ticket))status(root.ModeAtlasSocial.message(error),'error');}
    finally{if(alive(ticket))host.removeAttribute('aria-busy');controls.forEach(node=>{node.disabled=node.dataset.wasDisabled==='true';delete node.dataset.wasDisabled;});}
  }
  function screen(){generation++;status('');body.replaceChildren();host.removeAttribute('aria-busy');return generation;}
  function empty(title,description){const card=el('div','ma-social-empty');card.append(el('h3','',title),el('p','',description));body.append(card);return card;}
  function back(label,action){body.append(button('← '+label,action,'ma-button ma-button--ghost ma-social-back'));}
  async function load(){
    if(!host?.isConnected)return;
    const ticket=screen();state=null;
    if(!root.KanaCloudSync?.getUser?.()){
      const card=empty('Learn alongside friends','Sign in to share your progress and connect with other learners.');
      card.append(button('Sign in',()=>{root.ModeAtlasDialog.close();root.ModeAtlasProfile.open();},'ma-button ma-button--primary'));return;
    }
    empty('Loading your circle…','');
    try{
      const result=await root.ModeAtlasSocial.call('state');if(!alive(ticket))return;state=result;
      if(result.deleting){screen();empty('Removing your friends profile','Please try again shortly.');return;}
      if(!result.active)editProfile();else home();
    }catch(error){if(alive(ticket)){screen();empty('Friends is unavailable',root.ModeAtlasSocial.message(error));}}
  }
  function home(){
    if(!state?.active)return void load();
    screen();
    const self=el('div','ma-social-self');self.append(avatar(state.profile),identity(state.profile),button('Edit',()=>editProfile()));body.append(self);
    const tabs=el('div','ma-atlas-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Friends and rankings');
    for(const value of ['friends','rankings']){
      const node=button(value==='friends'?`Friends · ${state.counts.friends}`:'Rankings',()=>{tab=value;home();});
      node.setAttribute('role','tab');node.setAttribute('aria-selected',String(tab===value));node.tabIndex=tab===value?0:-1;
      node.id='maSocialTab-'+value;node.setAttribute('aria-controls','maSocialList');tabs.append(node);
    }
    tabs.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();tab=event.key==='Home'?'friends':event.key==='End'?'rankings':tab==='friends'?'rankings':'friends';home();document.getElementById('maSocialTab-'+tab)?.focus();
    });body.append(tabs);
    const tools=el('div','ma-social-tools');
    if(tab==='friends'){
      const label=el('label','ma-social-filter','Show'),select=el('select');select.setAttribute('aria-label','Friends list');
      for(const [value,title] of [['friends','Friends'],['incoming','Requests'],['outgoing','Sent'],['blocked','Blocked']]){
        const option=el('option','',`${title} · ${state.counts[value]||0}`);option.value=value;select.append(option);
      }
      select.value=kind;select.addEventListener('change',()=>{kind=select.value;home();});label.append(select);tools.append(label,
        button('Add friend',()=>addFriend(),'ma-button ma-button--primary'),button('My code',myCode));
    }else{
      const label=el('label','ma-social-filter','Compare'),select=el('select');select.setAttribute('aria-label','Ranking');
      for(const [value,title]of [['xp','Level & XP'],['streak','Study streak'],['mastery','Mastery · Both'],['reading','Mastery · Reading'],['writing','Mastery · Writing'],['correct','Total correct']]){const option=el('option','',title);option.value=value;select.append(option);}
      select.value=metric;select.addEventListener('change',()=>{metric=select.value;home();});label.append(select);tools.append(label);
    }
    body.append(tools);
    if(tab==='rankings')body.append(el('p','ma-social-note','Rankings use each friend’s latest synced learning progress.'));
    const list=el('div','ma-social-list');list.id='maSocialList';list.setAttribute('role','tabpanel');list.setAttribute('aria-labelledby','maSocialTab-'+tab);body.append(list);
    void loadPage(list,null);
  }
  function score(row){
    if(metric==='xp')return `${number(row.score)} XP`;
    if(metric==='streak')return `${number(row.score)} ${row.score===1?'day':'days'}`;
    if(metric==='correct')return `${number(row.score)} correct`;
    return `${number(row.score)} / ${number(row.stats.kanaCount)}`;
  }
  function row(profile,ranking=false){
    const card=el('div','ma-social-row');if(profile.uid===owner)card.dataset.self='true';
    if(ranking)card.append(el('strong','ma-social-rank',String(profile.rank)));
    const open=button('',()=>showProfile(profile.uid),'ma-social-person');open.append(avatar(profile),identity(profile));card.append(open);
    if(ranking)card.append(el('strong','ma-social-score',score(profile)));
    else if(kind==='friends')card.append(el('span','ma-social-score',`${number(profile.stats.streak)}d streak`));
    else{
      const label=el('div','ma-social-person');open.replaceWith(label);label.append(avatar(profile));
      if(kind==='blocked'){const copy=el('span','ma-social-identity');copy.append(el('strong','',profile.displayName),el('small','','Blocked profile'));label.append(copy);}
      else label.append(identity(profile));
      const actions=el('div','ma-social-row-actions');
      if(kind==='incoming'){
        actions.append(button('Accept',()=>run(()=>root.ModeAtlasSocial.call('accept',{uid:profile.uid}),load),'ma-button ma-button--primary'),button('Decline',()=>run(()=>root.ModeAtlasSocial.call('decline',{uid:profile.uid}),load)),
          button('Block',()=>confirmAction('Block '+profile.displayName+'?','You will not see each other’s profiles or receive requests from each other.','Block','block',{uid:profile.uid},home)));
      }else if(kind==='outgoing')actions.append(button('Cancel request',()=>run(()=>root.ModeAtlasSocial.call('cancel',{uid:profile.uid}),load)));
      else actions.append(button('Unblock',()=>confirmAction('Unblock '+profile.displayName+'?','You can exchange requests again. This does not restore your previous friendship.','Unblock','unblock',{uid:profile.uid},home)));
      card.append(actions);
    }
    return card;
  }
  async function loadPage(list,cursor){
    const ticket=generation,loading=el('p','ma-social-note','Loading…');list.append(loading);
    try{
      const result=await root.ModeAtlasSocial.call('list',{kind:tab==='rankings'?'rankings':kind,metric,...(cursor?{cursor}:{})});
      if(!alive(ticket))return;loading.remove();
      if(!result.rows.length && !cursor)list.append(el('p','ma-social-empty',kind==='incoming'?'You’re all caught up. New requests will appear here.':kind==='outgoing'?'No requests waiting for a reply.':kind==='blocked'?'No blocked profiles.':'Your circle starts here. Add a friend using their code.'));
      for(const profile of result.rows)list.append(row(profile,tab==='rankings'));
      if(tab==='rankings' && result.total===1)list.append(el('p','ma-social-note','Add a friend to compare your progress.'));
      if(result.nextCursor){const more=button('Load more',()=>{more.remove();void loadPage(list,result.nextCursor);});list.append(more);}
    }catch(error){if(alive(ticket)){loading.remove();status(root.ModeAtlasSocial.message(error),'error');}}
  }
  function editProfile(){
    screen();const editing=state?.active;if(editing)back('Friends',home);
    body.append(el('h3','',editing?'Your friends profile':'Create your friends profile'),el('p','ma-social-note','People with your code can see your name, avatar, level and title. Accepted friends can also see your study streak, mastery and learning totals.'));
    const form=el('form','ma-social-form'),label=el('label','ma-social-field','Display name'),input=el('input');input.name='displayName';input.autocomplete='nickname';input.maxLength=48;input.required=true;input.value=state?.preferences?.displayName||'';input.placeholder='Choose a name';label.append(input);form.append(label);
    const choices=el('fieldset','ma-social-avatar-choices');choices.append(el('legend','','Avatar'));let selected=state?.preferences?.avatar||'kana';
    for(const [id,[symbol,name]]of Object.entries(avatars)){
      const choice=button(symbol,()=>{selected=id;choices.querySelectorAll('button').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.avatar===id)));},'ma-button ma-social-avatar-choice');choice.dataset.avatar=id;choice.setAttribute('aria-label',name);choice.setAttribute('aria-pressed',String(id===selected));choices.append(choice);
    }form.append(choices);
    if(!editing){const consent=el('label','ma-social-consent'),check=el('input');check.type='checkbox';check.required=true;check.name='consent';consent.append(check,el('span','','Share my profile through Friends'));form.append(consent);}
    const submit=button(editing?'Save profile':'Create profile',null,'ma-button ma-button--primary');submit.type='submit';form.append(submit);
    form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const uid=owner;run(async()=>{
      await root.KanaCloudSync?.syncNow?.();
      if(root.KanaCloudSync?.getUser?.()?.uid!==uid)throw Object.assign(new Error('The account changed.'),{code:'account-changed'});
      return root.ModeAtlasSocial.call('updateProfile',{displayName:input.value,avatar:selected,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});
    },load);});body.append(form);
    if(editing)body.append(button('Leave Friends',()=>confirmAction('Leave Friends?','Your friends profile, code, connections, requests and blocked list will be removed. Your learning progress stays saved.','Leave Friends','leave',{},()=>editProfile()),'ma-button ma-button--danger'));
  }
  function myCode(){
    screen();back('Friends',home);body.append(el('h3','','Your friend code'),el('p','ma-social-note','Share this code with someone you want to add. You choose which requests to accept.'));
    const input=el('input','ma-social-code');input.readOnly=true;input.setAttribute('aria-label','Your friend code');input.value=state.code.match(/.{1,4}/g).join('-');input.addEventListener('click',()=>input.select());body.append(input);
    body.append(button('Copy code',async()=>{try{await navigator.clipboard.writeText(input.value);status('Friend code copied.','success');}catch{input.focus();input.select();status('Select and copy your code.');}},'ma-button ma-button--primary'));
    body.append(button('Create a new code',()=>confirmAction('Replace your friend code?','Your old code will stop working. Existing friends and requests are kept.','Replace code','rotateCode',{},myCode)));
  }
  function addFriend(){
    screen();back('Friends',home);body.append(el('h3','','Find a friend'));
    const form=el('form','ma-social-form'),label=el('label','ma-social-field','Friend code'),input=el('input');input.placeholder='Paste their code';input.name='friendCode';input.autocomplete='off';input.spellcheck=false;input.maxLength=40;input.required=true;label.append(input);form.append(label);
    const submit=button('Find profile',null,'ma-button ma-button--primary');submit.type='submit';form.append(submit);const preview=el('div','ma-social-preview');
    form.addEventListener('submit',event=>{event.preventDefault();preview.replaceChildren();const code=input.value;run(()=>root.ModeAtlasSocial.call('lookup',{code}),result=>{
      const card=el('div','ma-social-self');card.append(avatar(result.profile),identity(result.profile));preview.append(card);
      if(result.relationship==='none')preview.append(button('Send request',()=>run(()=>root.ModeAtlasSocial.call('sendRequest',{code}),()=>{kind='outgoing';load();}),'ma-button ma-button--primary'));
      else if(result.relationship==='incoming')preview.append(button('Review request',()=>{kind='incoming';load();}));
      else preview.append(el('p','ma-social-note',result.relationship==='friend'?'You’re already friends.':'Your request is waiting for a reply.'));
    });});body.append(form,preview);
  }
  async function showProfile(uid){
    const ticket=screen();back(tab==='rankings'?'Rankings':'Friends',home);
    try{
      const result=await root.ModeAtlasSocial.call('profile',{uid});if(!alive(ticket))return;
      const profile=result.profile,card=el('div','ma-social-self');card.append(avatar(profile),identity(profile));body.append(card);
      const stats=profile.stats,grid=el('div','ma-social-stats');
      for(const [label,value]of [['Atlas level',number(profile.level)],['Total XP',number(stats.xp)],['Study streak',`${number(stats.streak)} days`],['Total correct',number(stats.totalCorrect)],['Reading mastery',`${stats.readingMastered} / ${stats.kanaCount}`],['Writing mastery',`${stats.writingMastered} / ${stats.kanaCount}`]]){const tile=el('div');tile.append(el('span','',label),el('strong','',value));grid.append(tile);}body.append(grid);
      body.append(el('p','ma-social-note',stats.syncedAt?`Progress synced ${new Date(stats.syncedAt).toLocaleString()}.`:'Progress will appear after the next sync.'));
      if(uid!==owner){const actions=el('div','ma-social-tools');actions.append(
        button('Remove friend',()=>confirmAction('Remove '+profile.displayName+'?','You will stop appearing in each other’s friends list and rankings.','Remove friend','remove',{uid},()=>showProfile(uid))),
        button('Block',()=>confirmAction('Block '+profile.displayName+'?','You will not see each other’s profiles or receive requests from each other.','Block','block',{uid},()=>showProfile(uid)),'ma-button ma-button--danger'));body.append(actions);}
    }catch(error){if(alive(ticket))status(root.ModeAtlasSocial.message(error),'error');}
  }
  function confirmAction(title,message,label,action,data,cancel){
    screen();body.append(el('h3','',title),el('p','ma-social-note',message));const actions=el('div','ma-social-tools');
    actions.append(button('Cancel',cancel),button(label,()=>run(()=>root.ModeAtlasSocial.call(action,data),load),'ma-button ma-button--danger'));body.append(actions);
  }
  async function open(){
    if(!root.ModeAtlasSocial.isEnabled())return;
    root.ModeAtlasProfile?.close?.();root.ModeAtlasDialog.close();
    owner=root.KanaCloudSync?.getUser?.()?.uid;state=null;tab='friends';kind='friends';
    const container=el('div','ma-social');host=container;
    const top=el('div','ma-social-tools');top.append(button('← Your Atlas',()=>{root.ModeAtlasDialog.close();root.ModeAtlasRewardsUI.open();}),button('Refresh',load));
    notice=el('p','ma-social-status');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;
    body=el('div','ma-social-body');host.append(top,notice,body);
    const closed=root.ModeAtlasDialog.feature({kicker:'Learn together',title:'Friends',contentNode:host,closeIcon:true,closeLabel:'×'});
    queueMicrotask(load);
    await closed;
    if(host===container){generation++;host=body=notice=state=null;}
  }
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{
    if(host && owner!==root.KanaCloudSync?.getUser?.()?.uid){owner=root.KanaCloudSync?.getUser?.()?.uid;generation++;state=null;void load();}
  });
  root.ModeAtlasSocialUI=Object.freeze({open});
})(window);
