/* One character, companion and identity editor, shared by Profile and Rewards. */
(function(root){
  'use strict';
  const rules=root.ModeAtlasAvatarRules,rewards=root.ModeAtlasRewardRules,identity=root.ModeAtlasSocialIdentity;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const button=(label,action,cls='ma-button ma-button--ghost')=>{const node=el('button',cls,label);node.type='button';if(action)node.addEventListener('click',action);return node;};
  function picker(initial={}){
    let selected=initial.avatar==='account'?'account':'character',character=rules.normalize(initial.character),tab='look',greeting=initial.greeting||'',displayName=initial.displayName||'',editingBio=false;
    const petNames={...initial.petNames};if(character.pet!=='none')petNames[character.pet]=character.petName;
    const level=()=>Number.isInteger(initial.level)?initial.level:root.ModeAtlasProgress.getSummary().level,access=()=>root.ModeAtlasRewardAccess?.current();
    const host=el('div','ma-avatar-editor'),modes=el('div','ma-avatar-modes'),body=el('div','ma-avatar-editor__body');
    modes.setAttribute('role','group');modes.setAttribute('aria-label','Profile picture');
    const photo=identity.photoURL(initial.accountPhoto)||identity.presentation(null,root.KanaCloudSync?.getUser?.()).url;
    const controls=[];
    function paint(){
      body.replaceChildren();controls.forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.avatarMode===selected)));
      const preview=el('div','ma-avatar-studio'),figure=el('div','ma-avatar-studio__figure');figure.setAttribute('role','img');figure.setAttribute('aria-label','Your character and pet preview');root.ModeAtlasAvatarArt.render(figure,character);preview.append(figure);
      const caption=el('div','ma-avatar-studio__caption');
      const bio=button(greeting||'A little progress every day!',()=>{editingBio=!editingBio;paint();body.querySelector('[name="greeting"]')?.focus();},'ma-avatar-bio');bio.setAttribute('aria-label','Edit avatar message');bio.setAttribute('aria-expanded',String(editingBio));caption.append(bio,el('span','ma-avatar-caption-hint','Tap your message to edit'));
      if(editingBio){
        const label=el('label','ma-avatar-identity-field','Your avatar’s message'),input=el('textarea');input.name='greeting';input.rows=3;input.maxLength=240;input.value=greeting;input.placeholder='Say hello to your friends';
        input.addEventListener('input',()=>{greeting=input.value;input.setCustomValidity(identity.validGreeting(identity.cleanGreeting(greeting))?'':'Use a friendly message of up to 120 characters.');bio.textContent=greeting||'A little progress every day!';});label.append(input);caption.append(label,el('span','ma-avatar-caption-hint','Up to 120 characters. Shared only with accepted friends.'));
      }
      const name=el('label','ma-avatar-identity-field','Display name'),input=el('input');input.name='displayName';input.value=displayName;input.maxLength=48;input.placeholder='Your name';input.autocomplete='nickname';input.required=!!initial.displayName;
      input.addEventListener('input',()=>{displayName=input.value;input.setCustomValidity(!displayName&&!initial.displayName||identity.validName(displayName)&&!identity.objectionableName(displayName)?'':'Use 2–24 letters or numbers for your name.');});name.append(input);caption.append(name);
      if(selected==='account'){const portrait=el('span','ma-avatar-account-preview ma-atlas-avatar');root.ModeAtlasPortrait.render(portrait,{avatar:'account',avatarURL:photo});portrait.setAttribute('role','img');portrait.setAttribute('aria-label','Selected account profile photo');caption.append(portrait);}
      preview.append(caption);body.append(preview);
      const tabs=el('div','ma-avatar-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Character options');
      for(const [id,label]of [['look','Appearance'],['wardrobe','Wardrobe'],['pets','Pet']]){const control=button(label,()=>{tab=id;paint();body.querySelector('.ma-avatar-tabs [aria-pressed="true"]')?.focus();});control.setAttribute('aria-pressed',String(tab===id));tabs.append(control);}body.append(tabs);
      const options=el('div','ma-avatar-options');
      function choices(key,title,items,type){
        const swatches=items.every(item=>item.value),field=el('fieldset','ma-avatar-field');field.append(el('legend','',title));const grid=el('div',swatches?'ma-avatar-swatches':'ma-avatar-items');
        for(const item of items){
          if(type&&!rewards.visible(item,level(),access()))continue;
          const available=!type||rewards.unlocked(item,level(),access());
          const choice=button('',()=>{
            if(key==='pet'){if(character.pet!=='none')petNames[character.pet]=character.petName;character.petName=petNames[item.id]||'';}
            character=rules.normalize({...character,[key]:item.id});paint();body.querySelector(`[data-avatar-slot="${key}"][data-avatar-choice="${item.id}"]`)?.focus();
          },swatches?'ma-avatar-swatch':'ma-avatar-item');
          choice.dataset.avatarSlot=key;choice.dataset.avatarChoice=item.id;choice.disabled=!available;choice.setAttribute('aria-pressed',String(character[key]===item.id));choice.setAttribute('aria-label',item.name+(available?'':` · Level ${item.level}`));
          if(item.value){choice.style.setProperty('--avatar-swatch',item.tones?'linear-gradient(160deg,'+item.tones.join(',')+')':item.value);choice.title=item.name;choice.append(el('span','ma-avatar-swatch__fill'));}
          else{const mini=el('span','ma-avatar-item__art');if(key==='pet'&&item.id==='none')mini.classList.add('ma-avatar-item__art--none');else root.ModeAtlasAvatarArt.render(mini,{...character,pet:key==='pet'?item.id:'none',[key]:item.id},{portrait:!['outfit','pants','pet'].includes(key),petOnly:key==='pet'});choice.append(mini,el('span','',item.name));if(!available)choice.append(el('small','',`Level ${item.level}`));}
          grid.append(choice);
        }field.append(grid);options.append(field);
      }
      if(tab==='look'){
        choices('skin','Skin tone',rules.choices.skin);choices('hair','Hairstyle',rewards.hairstyles,'hairstyles');
        choices('hairColor','Hair colour',rules.choices.hairColor,'hairColours');choices('eyes','Eye colour',rules.choices.eyes);
      }else if(tab==='wardrobe'){
        choices('outfit','Tops & dresses',rewards.outfits,'outfits');
        if(rules.colourableOutfits.includes(character.outfit))choices('outfitColor','Clothing colour',rules.choices.outfitColor.filter(item=>character.outfit!=='seigaiha-kimono'||rules.kimonoColours.includes(item.id)));
        if(!['day-dress','pinafore','meadow-dress','seigaiha-kimono'].includes(character.outfit)){choices('pants','Pants & skirts',rewards.pants,'pants');choices('pantsColor','Bottoms colour',rules.choices.pantsColor);}
        choices('headwear','Headwear',rewards.headwear,'headwear');choices('accessory','Accessories',rewards.accessories,'accessories');
      }else{
        choices('pet','Your companion',rewards.pets,'pets');
        if(character.pet!=='none'){
          const label=el('label','ma-avatar-identity-field','Pet name'),name=el('input');name.name='petName';name.maxLength=48;name.value=character.petName;name.placeholder=rewards.item('pets',character.pet).name;
          name.addEventListener('input',()=>{character.petName=identity.cleanName(name.value);petNames[character.pet]=character.petName;name.setCustomValidity(rules.validPetName(character.petName)&&!identity.objectionableName(character.petName)?'':'Use a friendly name of up to 24 letters or numbers.');});label.append(name);options.append(label);
        }
      }
      if(tab!=='look')options.append(button('Explore the shop →',()=>{root.ModeAtlasDialog.close();root.ModeAtlasAccountNavigation.open('shop');}));
      body.append(options);
    }
    for(const [id,label]of [['character','Character portrait'],['account','Account photo']]){const control=button(label,()=>{selected=id;paint();});control.dataset.avatarMode=id;control.disabled=id==='account'&&!photo;controls.push(control);modes.append(control);}
    host.append(modes,body);paint();
    return {node:host,value(){return {avatar:selected,character:{...character},...(displayName?{displayName}:{}),greeting,petNames:{...petNames}};}};
  }
  let opening=false;
  async function open(){
    if(opening)return;opening=true;
    const uid=root.KanaCloudSync?.getUser?.()?.uid;
    root.ModeAtlasAccountNavigation?.close();
    const form=el('form','ma-avatar-form'),status=el('p','ma-avatar-status',uid?'Loading your avatar…':'Sign in to save your look.');status.setAttribute('role','status');form.append(status);
    let connected=true;
    const done=root.ModeAtlasDialog.feature({title:'Your avatar & pet',kicker:'Profile',size:'wide',contentNode:form}).then(()=>{connected=false;opening=false;});
    try{
      const initial=uid?await root.ModeAtlasAvatar.refresh(true):null;
      if(!connected||uid!==root.KanaCloudSync?.getUser?.()?.uid)return;
      if(uid&&!initial)throw new Error('Unavailable');
      const edit=picker(initial||{}),save=button(uid?'Save changes':'Sign in to save',null,'ma-button ma-button--primary');save.type='submit';
      status.textContent=uid?'':'Sign in to save your look.';form.replaceChildren(edit.node,status,save);
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(!form.reportValidity())return;if(!uid){root.ModeAtlasDialog.close();root.ModeAtlasAccountNavigation.open('profile');return;}
        const selection=edit.value();if(!selection||form.getAttribute('aria-busy')==='true')return;
        form.setAttribute('aria-busy','true');save.disabled=true;status.textContent='Saving…';
        try{await root.ModeAtlasAvatar.save(selection,initial.revision);if(connected){root.ModeAtlasSocial.clearProfile();root.ModeAtlasDialog.close();root.ModeAtlasFeedback.toast('Profile updated.','success');}}
        catch(error){if(connected)status.textContent=root.ModeAtlasAvatar.message(error);}
        finally{if(connected){form.removeAttribute('aria-busy');save.disabled=false;}}
      });
    }catch{if(connected){status.textContent='Your avatar couldn’t load. Check your connection and try again.';form.append(button('Try again',()=>{root.ModeAtlasDialog.close();void done.then(open);}));}}
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-ma-avatar-open]'))void open();});
  for(const event of ['modeAtlasAccountWillChange','modeAtlasAccountSignedOut'])root.addEventListener(event,()=>{if(opening)root.ModeAtlasDialog.close();});
  root.ModeAtlasAvatarUI=Object.freeze({picker,open});
})(window);
