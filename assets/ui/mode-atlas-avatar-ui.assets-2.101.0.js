/* Shared avatar editor; private account preferences do not require joining Friends. */
(function(root){
  'use strict';
  const rules=root.ModeAtlasAvatarRules,rewards=root.ModeAtlasRewardRules,identity=root.ModeAtlasSocialIdentity;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const button=(label,action,cls='ma-button ma-button--ghost')=>{const node=el('button',cls,label);node.type='button';if(action)node.addEventListener('click',action);return node;};
  function picker(initial={}){
    let selected=initial.avatar==='account'?'account':'character',character=rules.normalize(initial.character),tab='look',mode=selected;
    const level=()=>Number.isInteger(initial.level)?initial.level:root.ModeAtlasProgress.getSummary().level,access=()=>root.ModeAtlasRewardAccess?.current();
    const host=el('div','ma-avatar-editor'),modes=el('div','ma-avatar-modes'),body=el('div','ma-avatar-editor__body');
    modes.setAttribute('role','group');modes.setAttribute('aria-label','Avatar type');
    const photo=identity.photoURL(initial.accountPhoto)||identity.presentation(null,root.KanaCloudSync?.getUser?.()).url;
    const controls=[];
    function paint(){
      body.replaceChildren();controls.forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.avatarMode===mode)));
      if(mode==='character'){
        selected='character';const preview=el('div','ma-avatar-studio'),figure=el('div','ma-avatar-studio__figure');figure.setAttribute('role','img');figure.setAttribute('aria-label','Your character preview');root.ModeAtlasAvatarArt.render(figure,character);preview.append(figure);
        const caption=el('div','ma-avatar-studio__caption');caption.append(el('strong','','A little more you.'),el('span','','Build your look. Collect your favourites.'));preview.append(caption);body.append(preview);
        const tabs=el('div','ma-avatar-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Character options');
        for(const [id,label]of [['look','Appearance'],['wardrobe','Wardrobe']]){const control=button(label,()=>{tab=id;paint();body.querySelector('[aria-pressed="true"]')?.focus();});control.setAttribute('aria-pressed',String(tab===id));tabs.append(control);}body.append(tabs);
        const options=el('div','ma-avatar-options');
        function choices(key,title,items,type){
          const swatches=items.every(item=>item.value),field=el('fieldset','ma-avatar-field');field.append(el('legend','',title));const grid=el('div',swatches?'ma-avatar-swatches':'ma-avatar-items');
          for(const item of items){
            if(type&&!rewards.visible(item,level(),access()))continue;
            const available=!type||rewards.unlocked(item,level(),access());
            const choice=button('',()=>{character={...character,[key]:item.id};paint();body.querySelector(`[data-avatar-slot="${key}"][data-avatar-choice="${item.id}"]`)?.focus();},swatches?'ma-avatar-swatch':'ma-avatar-item');
            choice.dataset.avatarSlot=key;choice.dataset.avatarChoice=item.id;choice.disabled=!available;choice.setAttribute('aria-pressed',String(character[key]===item.id));choice.setAttribute('aria-label',item.name+(available?'':` · Level ${item.level}`));
            if(item.value){choice.style.setProperty('--avatar-swatch',item.tones?'linear-gradient(160deg,'+item.tones.join(',')+')':item.value);choice.title=item.name;choice.append(el('span','ma-avatar-swatch__fill'));}
            else{const mini=el('span','ma-avatar-item__art');root.ModeAtlasAvatarArt.render(mini,{...character,[key]:item.id},{portrait:!['outfit','pants'].includes(key)});choice.append(mini,el('span','',item.name));if(!available)choice.append(el('small','',`Level ${item.level}`));}
            grid.append(choice);
          }field.append(grid);options.append(field);
        }
        if(tab==='look'){
          choices('skin','Skin tone',rules.choices.skin);choices('hair','Hairstyle',rewards.hairstyles,'hairstyles');
          choices('hairColor','Hair colour',rules.choices.hairColor,'hairColours');choices('eyes','Eye colour',rules.choices.eyes);
        }else{
          choices('outfit','Outfit',rewards.outfits,'outfits');
          if(['everyday','sport','linen','crewneck','striped'].includes(character.outfit))choices('outfitColor','Clothing colour',rules.choices.outfitColor);
          choices('pants','Pants',rewards.pants,'pants');
          choices('headwear','Headwear',rewards.headwear,'headwear');choices('accessory','Accessories',rewards.accessories,'accessories');
          const shop=button('Explore the shop →',()=>{root.ModeAtlasDialog.close();root.ModeAtlasAccountNavigation.open('shop');});options.append(shop);
        }
        body.append(options);return;
      }
      if(mode==='account'){
        selected='account';const preview=el('div','ma-social-photo-choice'),portrait=el('span','ma-atlas-avatar');root.ModeAtlasPortrait.render(portrait,{avatar:'account',avatarURL:photo});preview.append(portrait,el('p','ma-social-note','Use your linked Google account photo.'));body.append(preview);return;
      }
    }
    for(const [id,label]of [['character','Character'],['account','Account photo']]){const control=button(label,()=>{mode=id;paint();});control.dataset.avatarMode=id;control.disabled=id==='account'&&!photo;controls.push(control);modes.append(control);}
    host.append(modes,body);paint();
    return {node:host,value(){return {avatar:selected,character:{...character}};}};
  }
  let opening=false;
  async function open(){
    if(opening)return;opening=true;
    const uid=root.KanaCloudSync?.getUser?.()?.uid;
    root.ModeAtlasAccountNavigation?.close();
    const form=el('form','ma-avatar-form'),status=el('p','ma-avatar-status',uid?'Loading your avatar…':'Sign in to save your look.');status.setAttribute('role','status');form.append(status);
    let connected=true;
    const done=root.ModeAtlasDialog.feature({title:'Your avatar',kicker:'Profile',size:'wide',contentNode:form}).then(()=>{connected=false;opening=false;});
    try{
      const initial=uid?await root.ModeAtlasAvatar.refresh(true):null;
      if(!connected||uid!==root.KanaCloudSync?.getUser?.()?.uid)return;
      if(uid&&!initial)throw new Error('Unavailable');
      const edit=picker(initial||{}),save=button(uid?'Save avatar':'Sign in to save',null,'ma-button ma-button--primary');save.type='submit';
      status.textContent=uid?'':'Sign in to save your look.';form.replaceChildren(edit.node,status,save);
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(!uid){root.ModeAtlasDialog.close();root.ModeAtlasAccountNavigation.open('profile');return;}
        const selection=edit.value();if(!selection||form.getAttribute('aria-busy')==='true')return;
        form.setAttribute('aria-busy','true');save.disabled=true;status.textContent='Saving…';
        try{await root.ModeAtlasAvatar.save(selection,initial.revision);if(connected){root.ModeAtlasSocial.clearProfile();root.ModeAtlasDialog.close();root.ModeAtlasFeedback.toast('Avatar updated.','success');}}
        catch(error){if(connected)status.textContent=root.ModeAtlasAvatar.message(error);}
        finally{if(connected){form.removeAttribute('aria-busy');save.disabled=false;}}
      });
    }catch{if(connected){status.textContent='Your avatar couldn’t load. Check your connection and try again.';form.append(button('Try again',()=>{root.ModeAtlasDialog.close();void done.then(open);}));}}
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-ma-avatar-open]'))void open();});
  for(const event of ['modeAtlasAccountWillChange','modeAtlasAccountSignedOut'])root.addEventListener(event,()=>{if(opening)root.ModeAtlasDialog.close();});
  root.ModeAtlasAvatarUI=Object.freeze({picker,open});
})(window);
