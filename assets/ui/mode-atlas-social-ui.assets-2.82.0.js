/* Shared friends screens. Identity, relationships and ranks come from the server. */
(function ModeAtlasSocialUI(root){
  'use strict';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
  const identityPolicy=root.ModeAtlasSocialIdentity,avatars=identityPolicy.avatars;
  const number=value=>Number(value||0).toLocaleString();
  let host=null,body=null,notice=null,state=null,owner=null,generation=0,tab='friends',kind='friends',metric='xp';
  const alive=ticket=>!!host?.isConnected && ticket===generation && owner===root.KanaCloudSync?.getUser?.()?.uid;
  function button(label,action,cls='ma-button ma-button--ghost'){
    const node=el('button',cls,label);node.type='button';if(action)node.addEventListener('click',action);return node;
  }
  function iconButton(label,name,action){
    const node=button('',action,'ma-button ma-button--ghost ma-social-icon-button');node.setAttribute('aria-label',label);node.title=label;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(svg.namespaceURI,'use');
    svg.classList.add('ma-icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href',root.ModeAtlasVersionFile.appUrl('/assets/mode-atlas-icons.svg')+'#icon-'+name);svg.append(use);node.append(svg);return node;
  }
  function profileCard(profile,cls){
    const node=el('div',cls+' ma-profile-banner');
    if(profile.uid===owner){node.dataset.maSelectedBanner='';node.dataset.maBanner=root.ModeAtlasRewardsUI.banner().id;}
    else node.dataset.maBanner=root.ModeAtlasRewardRules.banner(profile.banner,profile.level||1).id;
    return node;
  }
  function status(message,tone='info'){if(notice){notice.textContent=message;notice.dataset.tone=tone;notice.hidden=!message;}}
  function avatar(profile){
    const value=identityPolicy.avatar(profile.avatar),symbol=value?.startsWith('emoji:')?value.slice(6):avatars[value]?.[0]||'あ';
    const node=el('span','ma-atlas-avatar ma-social-avatar',symbol);node.dataset.maFrame=profile.frame||'plain';node.setAttribute('aria-hidden','true');
    const url=value==='account'?identityPolicy.photoURL(profile.avatarURL):null;
    if(url){const image=el('img');image.src=url;image.alt='';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>{node.textContent='あ';},{once:true});node.replaceChildren(image);}
    return node;
  }
  function identity(profile){const copy=el('span','ma-social-identity'),name=el('span','ma-social-name');name.append(el('strong','',profile.displayName+(profile.uid===owner?' · You':'')));if(['admin','moderator'].includes(profile.role))name.append(el('span','ma-official-badge',profile.role==='admin'?'✓ Admin':'✓ Moderator'));copy.append(name,el('small','',`Level ${number(profile.level)} · ${profile.title}`));return copy;}
  async function run(action,onSuccess){
    if(!host || host.getAttribute('aria-busy')==='true')return;
    const ticket=generation;status('');host.setAttribute('aria-busy','true');
    const controls=[...host.querySelectorAll('button,input,select,textarea')];controls.forEach(node=>{node.dataset.wasDisabled=String(node.disabled);node.disabled=true;});
    try{const result=await action();if(alive(ticket))await onSuccess?.(result);}
    catch(error){root.ModeAtlasDiagnostics?.record('friends',error);if(alive(ticket))status(root.ModeAtlasSocial.message(error),'error');}
    finally{if(alive(ticket))host.removeAttribute('aria-busy');controls.forEach(node=>{node.disabled=node.dataset.wasDisabled==='true';delete node.dataset.wasDisabled;});}
  }
  function screen(){generation++;status('');if(body.contains(document.activeElement))document.activeElement.blur();body.replaceChildren();body.classList.remove('ma-social-home');const panel=host.closest('.ma-account-view');if(panel)panel.scrollTop=0;host.removeAttribute('aria-busy');return generation;}
  function empty(title,description){const card=el('div','ma-social-empty');card.append(el('h3','',title),el('p','',description));body.append(card);return card;}
  function focusTitle(){const title=body.querySelector('h3');if(title){title.tabIndex=-1;title.focus({preventScroll:true});}}
  function back(label,action){body.append(button('← '+label,action,'ma-button ma-button--ghost ma-social-back'));}
  async function load(){
    if(!host?.isConnected)return;
    const ticket=screen();state=null;
    if(!root.KanaCloudSync?.getUser?.()){
      const card=empty('Learn alongside friends','Sign in to share your progress and connect with other learners.');
      card.append(button('Sign in',()=>root.ModeAtlasAccountNavigation.open('profile'),'ma-button ma-button--primary'));return;
    }
    empty('Loading your circle…','');
    try{
      const result=await root.ModeAtlasSocial.call('state');if(!alive(ticket))return;state=result;
      if(result.restricted){screen();empty('Friends access is restricted','Contact support@mode-atlas.com if you think this is a mistake. Your learning progress is still available.');return;}
      if(result.deleting){screen();empty('Removing your friends profile','Please try again shortly.');return;}
      if(!result.active)editProfile();else home();
    }catch(error){if(alive(ticket)){screen();empty('Friends is unavailable',root.ModeAtlasSocial.message(error)).append(button('Try again',load));}}
  }
  function home(){
    if(!state?.active)return void load();
    screen();
    body.classList.add('ma-social-home');
    const self=profileCard(state.profile,'ma-social-self');self.append(avatar(state.profile),identity(state.profile),button('Edit',()=>editProfile()));body.append(self);
    if(state.preferences?.requiresNameChange){const note=el('div','ma-social-name-notice');note.append(el('p','','Your previous name is unavailable. Choose a new display name.'),button('Choose name',()=>editProfile()));body.append(note);}
    const tabs=el('div','ma-atlas-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Friends and rankings');
    for(const value of ['friends','rankings']){
      const node=button(value==='friends'?'Friends':'Rankings',()=>{tab=value;home();});
      if(value==='friends'&&state.counts.incoming&&tab!=='friends'){const badge=el('span','ma-social-badge',String(state.counts.incoming));badge.setAttribute('aria-label',`${state.counts.incoming} pending requests`);node.append(badge);}
      node.setAttribute('role','tab');node.setAttribute('aria-selected',String(tab===value));node.tabIndex=tab===value?0:-1;
      node.id='maSocialTab-'+value;node.setAttribute('aria-controls','maSocialList');tabs.append(node);
    }
    tabs.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();tab=event.key==='Home'?'friends':event.key==='End'?'rankings':tab==='friends'?'rankings':'friends';home();document.getElementById('maSocialTab-'+tab)?.focus();
    });body.append(tabs);
    const tools=el('div','ma-social-tools');
    if(tab==='friends'){
      tools.classList.add('ma-social-home-tools');tools.dataset.staff=String(!!state.canModerate);
      const label=el('div','ma-social-filter'),select=el('select');select.setAttribute('aria-label','Friends list');
      for(const [value,title] of [['friends','Friends'],['incoming','Requests'],['outgoing','Sent'],['blocked','Blocked']]){
        const option=el('option','',`${title} · ${state.counts[value]||0}${value==='incoming'&&state.counts.incoming?' pending':''}`);option.value=value;select.append(option);
      }
      select.value=kind;select.addEventListener('change',()=>{kind=select.value;home();});label.append(select);
      if(state.counts.incoming&&kind!=='incoming'){
        label.dataset.pending='true';
        const pending=button(`${state.counts.incoming} ${state.counts.incoming===1?'request':'requests'}`,()=>{kind='incoming';home();},'ma-social-request-badge');
        pending.setAttribute('aria-label',`Review ${state.counts.incoming} pending friend ${state.counts.incoming===1?'request':'requests'}`);label.append(pending);
      }
      tools.append(label,button('Add friend',()=>addFriend(),'ma-button ma-button--primary'),button('My code',myCode),iconButton('Refresh','refresh',load));
    }else{
      const label=el('div','ma-social-filter','Compare'),select=el('select');select.setAttribute('aria-label','Ranking');
      for(const [value,title]of [['xp','Level & XP'],['streak','Study streak'],['mastery','Mastery · Both'],['reading','Mastery · Reading'],['writing','Mastery · Writing'],['correct','Total correct']]){const option=el('option','',title);option.value=value;select.append(option);}
      select.value=metric;select.addEventListener('change',()=>{metric=select.value;home();});label.append(select);tools.append(label,iconButton('Refresh','refresh',load));
    }
    if(state.canModerate)tools.append(iconButton('Moderator menu','shield',()=>moderationHub()));
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
    const card=profileCard(profile,'ma-social-row');if(profile.uid===owner)card.dataset.self='true';
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
      actions.append(button('Report',()=>reportProfile(profile)));
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
    const hint=el('p','ma-social-note','2–24 characters. Display names are unique.');hint.id='maSocialNameHelp';input.setAttribute('aria-describedby',hint.id);form.append(hint);
    const choices=el('fieldset','ma-social-avatar-picker');choices.append(el('legend','','Avatar'));
    const modes=el('div','ma-social-avatar-modes'),options=el('div','ma-social-avatar-options');
    let selected=state?.preferences?.avatar||'kana',avatarMode=selected==='account'?'account':selected.startsWith('emoji:')?'emoji':'atlas';
    let selectedAtlas=Object.hasOwn(avatars,selected)?selected:'kana',selectedEmoji=selected.startsWith('emoji:')?selected.slice(6):'🌸';
    let emojiInput=null;
    const photo=identityPolicy.photoURL(state?.accountPhoto);
    const controls=[];
    function renderAvatars(){
      for(const control of controls)control.setAttribute('aria-pressed',String(control.dataset.avatarMode===avatarMode));
      options.replaceChildren();emojiInput=null;
      if(avatarMode==='account'){
        selected='account';const preview=el('div','ma-social-photo-choice');preview.append(avatar({avatar:'account',avatarURL:photo,frame:state?.profile?.frame}),el('p','ma-social-note','Use your linked Google account photo in Friends.'));options.append(preview);return;
      }
      const grid=el('div','ma-social-avatar-choices');
      if(avatarMode==='atlas'){
        selected=selectedAtlas;
        for(const [id,[symbol,name]]of Object.entries(avatars)){
          const choice=button(symbol,()=>{selectedAtlas=id;renderAvatars();options.querySelector(`[data-avatar="${id}"]`).focus();},'ma-button ma-social-avatar-choice');choice.dataset.avatar=id;choice.setAttribute('aria-label',name);choice.setAttribute('aria-pressed',String(id===selected));grid.append(choice);
        }
      }else{
        selected='emoji:'+selectedEmoji;
        const label=el('label','ma-social-field','Your emoji');emojiInput=el('input');emojiInput.name='emoji';emojiInput.autocomplete='off';emojiInput.maxLength=40;emojiInput.value=selectedEmoji;emojiInput.setAttribute('aria-describedby','maSocialEmojiHelp');
        emojiInput.addEventListener('input',()=>{emojiInput.setCustomValidity('');selectedEmoji=emojiInput.value;selected='emoji:'+selectedEmoji;grid.querySelectorAll('button').forEach(node=>node.setAttribute('aria-pressed',String(node.textContent===selectedEmoji)));});label.append(emojiInput);options.append(label);
        for(const symbol of identityPolicy.emojis){const choice=button(symbol,()=>{selectedEmoji=symbol;selected='emoji:'+symbol;emojiInput.value=symbol;emojiInput.setCustomValidity('');grid.querySelectorAll('button').forEach(node=>node.setAttribute('aria-pressed',String(node.textContent===symbol)));},'ma-button ma-social-avatar-choice');choice.setAttribute('aria-label','Use '+symbol);choice.setAttribute('aria-pressed',String(symbol===selectedEmoji));grid.append(choice);}
        const help=el('p','ma-social-note','Choose one below or enter one using your emoji keyboard.');help.id='maSocialEmojiHelp';options.append(help);
      }
      options.append(grid);
    }
    for(const [mode,title]of [['atlas','Atlas'],['emoji','Emoji'],['account','Account photo']]){
      const control=button(title,()=>{avatarMode=mode;renderAvatars();},'ma-button ma-button--ghost');control.dataset.avatarMode=mode;control.disabled=mode==='account'&&!photo;controls.push(control);modes.append(control);
    }
    choices.append(modes,options);form.append(choices);renderAvatars();
    if(!editing){const consent=el('label','ma-social-consent'),check=el('input');check.type='checkbox';check.required=true;check.name='consent';consent.append(check,el('span','','Share my profile through Friends'));form.append(consent);}
    const submit=button(editing?'Save profile':'Create profile',null,'ma-button ma-button--primary');submit.type='submit';form.append(submit);
    form.addEventListener('submit',event=>{event.preventDefault();if(emojiInput){const symbol=identityPolicy.emoji(emojiInput.value);emojiInput.setCustomValidity(symbol?'':'Choose a single emoji.');if(symbol)selected='emoji:'+symbol;}if(!form.reportValidity())return;const uid=owner;run(async()=>{
      await root.KanaCloudSync?.syncNow?.();
      if(root.KanaCloudSync?.getUser?.()?.uid!==uid)throw Object.assign(new Error('The account changed.'),{code:'account-changed'});
      return root.ModeAtlasSocial.call('updateProfile',{displayName:input.value,avatar:selected,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});
    },load);});body.append(form);
    if(editing)body.append(button('Leave Friends',()=>confirmAction('Leave Friends?','Your friends profile, code, connections, requests and blocked list will be removed. Your learning progress stays saved.','Leave Friends','leave',{},()=>editProfile()),'ma-button ma-button--danger'));
  }
  function myCode(){
    screen();back('Friends',home);body.append(el('h3','','Your friend code'),el('p','ma-social-note','Share this code with someone you want to add. You choose which requests to accept.'));
    const input=el('input','ma-social-code');input.readOnly=true;input.setAttribute('aria-label','Your friend code');input.value=state.code.match(/.{1,4}/g).join('-');input.addEventListener('click',()=>input.select());body.append(input);
    const actions=el('div','ma-social-tools');
    if(root.AtlasPlatform.getCapabilities().friendSharing){
      const share=button('Share code',async()=>{
        if(share.disabled)return;const ticket=generation;share.disabled=true;status('');
        try{const result=await root.AtlasPlatform.shareFriendCode(input.value);if(alive(ticket)){
          if(result.status==='shared')status('Friend code shared.','success');
          else if(result.status!=='cancelled')status('Sharing is unavailable. You can copy your code instead.');
        }}catch(error){root.ModeAtlasDiagnostics?.record('sharing',error);if(alive(ticket))status('Could not share your code. Try again or copy it instead.','error');}
        finally{share.disabled=false;}
      },'ma-button ma-button--primary');actions.append(share);
    }
    actions.append(button('Copy code',async()=>{try{await navigator.clipboard.writeText(input.value);status('Friend code copied.','success');}catch{input.focus();input.select();status('Select and copy your code.');}}));body.append(actions);
    body.append(button('Create a new code',()=>confirmAction('Replace your friend code?','Your old code will stop working. Existing friends and requests are kept.','Replace code','rotateCode',{},myCode)));
    focusTitle();
  }
  function addFriend(){
    screen();back('Friends',home);body.append(el('h3','','Find a friend'));
    const form=el('form','ma-social-form'),label=el('label','ma-social-field','Friend code'),input=el('input');input.placeholder='Paste their code';input.name='friendCode';input.autocomplete='off';input.spellcheck=false;input.maxLength=40;input.required=true;label.append(input);form.append(label);
    const submit=button('Find profile',null,'ma-button ma-button--primary');submit.type='submit';form.append(submit);const preview=el('div','ma-social-preview');
    form.addEventListener('submit',event=>{event.preventDefault();preview.replaceChildren();const code=input.value;run(()=>root.ModeAtlasSocial.call('lookup',{code}),result=>{
      const card=profileCard(result.profile,'ma-social-self');card.append(avatar(result.profile),identity(result.profile));preview.append(card);
      if(result.relationship==='none')preview.append(button('Send request',()=>run(()=>root.ModeAtlasSocial.call('sendRequest',{code}),()=>{kind='outgoing';load();}),'ma-button ma-button--primary'));
      else if(result.relationship==='incoming')preview.append(button('Review request',()=>{kind='incoming';load();}));
      else preview.append(el('p','ma-social-note',result.relationship==='friend'?'You’re already friends.':'Your request is waiting for a reply.'));
      preview.append(button('Report',()=>reportProfile(result.profile,code)));if(state.canModerate)preview.append(button('Moderation',()=>staffProfile(result.profile.uid)));
    });});body.append(form,preview);
  }
  async function showProfile(uid){
    const ticket=screen();back(tab==='rankings'?'Rankings':'Friends',home);
    try{
      const result=await root.ModeAtlasSocial.call('profile',{uid});if(!alive(ticket))return;
      const profile=result.profile,card=profileCard(profile,'ma-social-self');card.append(avatar(profile),identity(profile));body.append(card);
      if(state.canModerate)body.append(button('Moderation & warnings',()=>staffProfile(uid)));
      const stats=profile.stats,grid=el('div','ma-social-stats');
      for(const [label,value]of [['Atlas level',number(profile.level)],['Total XP',number(stats.xp)],['Study streak',`${number(stats.streak)} days`],['Total correct',number(stats.totalCorrect)],['Reading mastery',`${stats.readingMastered} / ${stats.kanaCount}`],['Writing mastery',`${stats.writingMastered} / ${stats.kanaCount}`]]){const tile=el('div');tile.append(el('span','',label),el('strong','',value));grid.append(tile);}body.append(grid);
      body.append(el('p','ma-social-note',stats.syncedAt?`Progress synced ${new Date(stats.syncedAt).toLocaleString()}.`:'Progress will appear after the next sync.'));
      if(uid!==owner){const actions=el('div','ma-social-tools');actions.append(
        button('Report',()=>reportProfile(profile)),
        button('Remove friend',()=>confirmAction('Remove '+profile.displayName+'?','You will stop appearing in each other’s friends list and rankings.','Remove friend','remove',{uid},()=>showProfile(uid))),
        button('Block',()=>confirmAction('Block '+profile.displayName+'?','You will not see each other’s profiles or receive requests from each other.','Block','block',{uid},()=>showProfile(uid)),'ma-button ma-button--danger'));body.append(actions);}
    }catch(error){if(alive(ticket))status(root.ModeAtlasSocial.message(error),'error');}
  }
  function reportProfile(profile,code){
    screen();back('Friends',home);body.append(el('h3','','Report '+profile.displayName),el('p','ma-social-note','Reports are reviewed by the Mode Atlas team. Your identity is not shared with the person you report.'));
    const form=el('form','ma-social-form'),label=el('label','ma-social-field','Reason'),reason=el('select');reason.name='reason';reason.setAttribute('aria-label','Reason');
    for(const [value,text]of [['name','Inappropriate name'],['avatar','Inappropriate avatar'],['harassment','Harassment or spam'],['other','Something else']]){const option=el('option','',text);option.value=value;reason.append(option);}label.append(reason);
    const details=el('label','ma-social-field','Details (optional)'),note=el('textarea');note.name='note';note.rows=3;note.maxLength=500;details.append(note);
    const submit=button('Send report',null,'ma-button ma-button--primary');submit.type='submit';form.append(label,details,submit);
    form.addEventListener('submit',event=>{event.preventDefault();run(()=>root.ModeAtlasSocial.call('reportProfile',{uid:profile.uid,reason:reason.value,note:note.value,...(code?{code}:{})}),()=>{
      screen();body.append(el('h3','','Report sent'),el('p','ma-social-note','Thank you for helping keep Friends welcoming. You can also block this profile to stop requests and hide each other’s profiles.'));
      const actions=el('div','ma-social-tools');actions.append(button('Done',load,'ma-button ma-button--primary'),button('Block profile',()=>confirmAction('Block '+profile.displayName+'?','You will not see each other’s profiles or receive requests from each other.','Block','block',{uid:profile.uid},load),'ma-button ma-button--danger'));body.append(actions);focusTitle();
    });});body.append(form);focusTitle();
  }
  async function moderationHub(section='reports',cursor=null){
    if(!state?.canModerate)return;
    const ticket=screen(),sections=[['reports','Reports'],['warnings','Warnings'],['moderators','Moderators'],['restricted','Restricted']];
    back('Friends',home);body.append(el('h3','','Moderator menu'));
    const tabs=el('div','ma-atlas-tabs ma-social-moderation-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Moderation sections');
    for(const [id,label]of sections){
      const control=button(label,()=>{void moderationHub(id);document.getElementById('maModerationTab-'+id)?.focus();});
      control.id='maModerationTab-'+id;control.setAttribute('role','tab');control.setAttribute('aria-selected',String(section===id));control.setAttribute('aria-controls','maModerationPanel');control.tabIndex=section===id?0:-1;tabs.append(control);
    }
    tabs.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const current=sections.findIndex(([id])=>id===section);
      const index=event.key==='Home'?0:event.key==='End'?sections.length-1:(current+(event.key==='ArrowRight'?1:sections.length-1))%sections.length;
      void moderationHub(sections[index][0]);document.getElementById('maModerationTab-'+sections[index][0])?.focus();
    });body.append(tabs);
    const panel=el('div','ma-social-list');panel.id='maModerationPanel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','maModerationTab-'+section);body.append(panel);
    const loading=el('p','ma-social-note','Loading…');loading.setAttribute('role','status');panel.append(loading);focusTitle();
    const returnTo=()=>moderationHub(section,cursor),openStaff=uid=>staffProfile(uid,returnTo,'Moderator menu');
    try{
      const action={reports:'listReports',warnings:'listWarnings',moderators:'listModerators',restricted:'listRestrictions'}[section];
      const result=await root.ModeAtlasSocial.call(action,cursor?{cursor}:{});if(!alive(ticket))return;loading.remove();
      if(!result.rows.length)panel.append(el('p','ma-social-empty',cursor||result.nextCursor?'No accounts on this page.':{reports:'No reports waiting for review.',warnings:'No accounts with warnings.',moderators:state.role==='admin'?'No moderators yet. Open a member’s profile to assign the role.':'No moderators to display.',restricted:'No restricted profiles.'}[section]));
      for(const item of result.rows){
        if(section==='reports'||section==='restricted'){panel.append(reportCard(item,section==='restricted',returnTo,openStaff));continue;}
        const row=el('div','ma-social-staff-row'),copy=el('span','ma-social-identity');copy.append(el('strong','',item.displayName));
        if(section==='warnings'){
          copy.append(el('small','',`${number(item.count)} ${item.count===1?'warning':'warnings'}${item.lastWarnedAt?' · '+new Date(item.lastWarnedAt).toLocaleDateString():''}`));
          if(['admin','moderator'].includes(item.role))copy.append(el('span','ma-official-badge',item.role==='admin'?'✓ Admin':'✓ Moderator'));
          const open=button('',()=>openStaff(item.uid),'ma-social-person');open.append(copy);row.append(open);
        }else{
          row.append(copy);
          if(result.canManage)row.append(button('Remove role',()=>confirmAction('Remove '+item.displayName+' as moderator?','They will no longer review reports or warn members.','Remove role','assignModerator',{uid:item.uid,moderator:false},returnTo,returnTo)));
        }
        panel.append(row);
      }
      if(result.nextCursor)panel.append(button('Next page',()=>moderationHub(section,result.nextCursor)));
      if(cursor)panel.append(button('Back to first page',()=>moderationHub(section)));
    }catch(error){if(alive(ticket)){loading.remove();status(root.ModeAtlasSocial.message(error),'error');panel.append(button('Try again',returnTo));}}
  }
  function reportCard(report,restricted,returnTo,openStaff){
    const card=el('article','ma-social-report'),actions=el('div','ma-social-tools');
    if(restricted){
      card.append(el('h4','',report.displayName));
      actions.append(button('Moderation & warnings',()=>openStaff(report.uid)));
      if(report.canAct!==false)actions.append(button('Restore Friends access',()=>confirmAction('Restore Friends access?','This account can use Friends again.','Restore access','restoreProfile',{uid:report.uid},returnTo,returnTo)));
    }else{
      const preview=el('div','ma-social-self');preview.append(avatar(report.snapshot),el('strong','',report.snapshot.displayName));card.append(preview,el('p','ma-social-note',report.reason+' · '+new Date(report.createdAt).toLocaleDateString()),el('p','',report.note||'No additional details.'));
      if(report.current?.displayName!==report.snapshot.displayName)card.append(el('p','ma-social-note','Current name: '+(report.current?.displayName||'Profile removed')));
      if(report.canAct===false)card.append(el('p','ma-social-note','Only Admin can review reports about official accounts.'));
      actions.append(button('Moderation & warnings',()=>openStaff(report.target)));
      for(const [decision,label,message]of [['dismiss','Dismiss','Close this report without changing the profile.'],['reset','Reset name and avatar','Replace the current name and avatar with a neutral profile. Learning progress is kept.'],['restrict','Restrict Friends access','Hide this profile and prevent it using Friends. Learning progress is kept.']]){
        if(report.canAct===false||(report.target===owner&&decision!=='dismiss'))continue;
        actions.append(button(label,()=>confirmAction(label+'?',message,label,'reviewReport',{id:report.id,decision},returnTo,returnTo)));
      }
    }
    card.append(actions);return card;
  }
  async function staffProfile(uid,returnTo=home,returnLabel='Friends'){
    const reload=()=>staffProfile(uid,returnTo,returnLabel);
    const ticket=screen();back(returnLabel,returnTo);body.append(el('h3','','Moderation & warnings'));
    try{
      const profile=await root.ModeAtlasSocial.call('staffProfile',{uid});if(!alive(ticket))return;
      body.append(el('h4','',profile.displayName),el('p','ma-social-note',`${profile.count} ${profile.count===1?'warning':'warnings'} · Visible only to Admin and Moderators`));
      if(profile.role!=='member')body.append(el('span','ma-official-badge',profile.role==='admin'?'✓ Admin':'✓ Moderator'));
      const assigned=profile.moderatorAssigned??profile.role==='moderator';
      if(profile.canManage&&profile.role!=='admin'&&(assigned||profile.canAssign!==false))body.append(button(assigned?'Remove moderator role':'Make moderator',()=>confirmAction(assigned?'Remove moderator role?':'Make '+profile.displayName+' a moderator?',assigned?'This account will no longer review reports or warn members.':'Moderators can review member reports and send warnings. They cannot action official accounts or access developer tools.',assigned?'Remove role':'Make moderator','assignModerator',{uid,moderator:!assigned},reload,reload)));
      if(profile.canManage&&profile.count)body.append(button('Clear warnings',()=>confirmAction('Clear all warnings?','The warning count, warning history and unread notices for this account will be removed.','Clear warnings','clearWarnings',{uid},reload,reload),'ma-button ma-button--danger'));
      if(profile.canAct){
        const form=el('form','ma-social-form'),label=el('label','ma-social-field','Send a warning'),message=el('textarea');message.rows=3;message.maxLength=500;message.minLength=3;message.required=true;message.name='warning';label.append(message);
        const hint=el('p','ma-social-note','Explain the concern and what needs to change. This message appears on their next visit.');
        const submit=button('Review warning',null,'ma-button ma-button--primary');submit.type='submit';form.append(label,hint,submit);
        form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const text=message.value.trim();if(text.length<3)return;
          const requestId=crypto.randomUUID();confirmAction('Send warning to '+profile.displayName+'?',text,'Send warning','warnProfile',{uid,message:text,requestId},reload,reload);});body.append(form);
      }else body.append(el('p','ma-social-note','Only Admin can warn official accounts.'));
      if(profile.history.length){const list=el('div','ma-social-list');for(const warning of profile.history){const card=el('article','ma-social-report');card.append(el('small','ma-social-note',new Date(warning.at).toLocaleString()),el('p','',warning.message));list.append(card);}body.append(list);if(profile.count>profile.history.length)body.append(el('p','ma-social-note','Showing the most recent 50 warnings. The total includes all warnings.'));}
      focusTitle();
    }catch(error){if(alive(ticket))status(root.ModeAtlasSocial.message(error),'error');}
  }
  function confirmAction(title,message,label,action,data,cancel,done=load){
    screen();body.append(el('h3','',title),el('p','ma-social-note',message));const actions=el('div','ma-social-tools');
    actions.append(button('Cancel',cancel),button(label,()=>run(()=>root.ModeAtlasSocial.call(action,data),done),'ma-button ma-button--danger'));body.append(actions);focusTitle();
  }
  function mount(parent){
    if(!root.ModeAtlasSocial.isEnabled())return;
    owner=root.KanaCloudSync?.getUser?.()?.uid;state=null;tab='friends';kind='friends';
    const container=el('div','ma-social');host=container;
    notice=el('p','ma-social-status');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;
    body=el('div','ma-social-body');host.append(notice,body);
    parent.replaceChildren(container);
    queueMicrotask(()=>{if(host===container)void load();});
    return ()=>{
      if(host===container){generation++;host=body=notice=state=null;}
      container.remove();
    };
  }
  function open(){root.ModeAtlasAccountNavigation?.open('friends');}
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{
    if(host && owner!==root.KanaCloudSync?.getUser?.()?.uid){owner=root.KanaCloudSync?.getUser?.()?.uid;generation++;state=null;void load();}
  });
  root.ModeAtlasSocialUI=Object.freeze({open,mount});
})(window);
