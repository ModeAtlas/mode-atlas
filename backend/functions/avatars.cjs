'use strict';
// Private avatar selection is canonical; Friends and the ladder publish a
// sanitized projection only after the learner has joined those features.
const {createHash}=require('node:crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const identity=require('./shared/mode-atlas-social-identity.js');
const characters=require('./shared/mode-atlas-avatar-rules.js');
const rewards=require('./shared/mode-atlas-reward-rules.js');
const {accountPhoto,mayUseName}=require('./identity.cjs');
const {entitlement,isTester}=require('./rewards.cjs');
const {levelFromSave,projectSave}=require('./projection.cjs');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const hash=value=>createHash('sha256').update(value).digest('hex');
function createAvatars({db,identities,now=Date.now}){
  const reference=uid=>db.doc('avatarProfiles/'+uid);
  function record(value,legacy,user){
    const character=characters.normalize(value?.character||legacy?.character);
    // A one-time default on the private record. A later explicit "none" stays none.
    const testerCompanionSeeded=value?.testerCompanionSeeded===true||isTester(user);
    if(isTester(user)&&value?.testerCompanionSeeded!==true&&character.pet==='none'){character.pet='japanese-spitz';character.petName='Shiro';}
    const petNames={};for(const pet of rewards.pets)if(pet.id!=='none'&&characters.validPetName(value?.petNames?.[pet.id]))petNames[pet.id]=value.petNames[pet.id];
    if(character.pet!=='none')petNames[character.pet]=character.petName;
    return {version:1,revision:Number.isSafeInteger(value?.revision)&&value.revision>=0?value.revision:0,
      avatar:identity.avatar(value?.avatar)||identity.avatar(legacy?.avatar)||(accountPhoto(user)?'account':'character'),
      displayName:legacy?.displayName??value?.displayName??'',greeting:legacy?.greeting??value?.greeting??'',testerCompanionSeeded,petNames,character};
  }
  function projection(value,user,level,access){
    const avatar=value.avatar==='account'&&!accountPhoto(user)?'character':value.avatar;
    const petNames=Object.fromEntries(Object.entries(value.petNames||{}).filter(([pet])=>rewards.allowed('pets',pet,level,access)));
    return {...value,avatar,petNames,character:characters.visible(value.character,level,access),level,
      accountPhoto:accountPhoto(user),...(avatar==='account'?{avatarURL:accountPhoto(user)}:{})};
  }
  async function prepare(tx,user,data,{legacy,level,access}){
    const ref=reference(user.uid),snapshot=await tx.get(ref),previous=record(snapshot.data(),legacy,user);
    if(data.revision!==undefined&&data.revision!==previous.revision)fail('aborted','Your avatar changed on another device. Reopen the editor to use the latest look.');
    const avatar=identity.avatar(data.avatar===undefined?projection(previous,user,level,access).avatar:data.avatar),selection=data.character===undefined?characters.visible(previous.character,level,access):data.character;
    if(!avatar||!characters.valid(selection))fail('invalid-argument','Choose a valid avatar and wardrobe items.');
    const character=characters.normalize(selection),previousVisible=characters.visible(previous.character,level,access);
    // Older clients cannot edit pants or new dyes. Preserve those choices when
    // they send back the compatible view supplied to them.
    if(selection.version<3){
      const compatible=characters.compatible(previousVisible,selection.version);
      for(const key of ['pantsColor','pet','petName'])character[key]=previousVisible[key];
      for(const key of ['outfit','pants'])if(selection[key]===compatible[key])character[key]=previousVisible[key];
      if(character.outfit==='seigaiha-kimono'&&!characters.kimonoColours.includes(character.outfitColor))character.outfitColor=previousVisible.outfitColor;
    }
    if(selection.version===1){character.pants=previousVisible.pants;if(selection.hairColor===characters.legacy(previousVisible).hairColor)character.hairColor=previousVisible.hairColor;}
    character.petName=identity.cleanName(character.petName);
    if(identity.objectionableName(character.petName))fail('invalid-argument','Choose a friendly name for your pet.');
    if(avatar==='account'&&!accountPhoto(user))fail('failed-precondition','Your linked Google account has no available photo.');
    if(rewards.item('avatars',avatar)&&!rewards.allowed('avatars',avatar,level,access)||!characters.allowed(character,level,access))fail('permission-denied','One of these avatar items is not available for your account.');
    const displayName=data.displayName===undefined?previous.displayName:identity.cleanName(data.displayName),greeting=data.greeting===undefined?previous.greeting:identity.cleanGreeting(data.greeting);
    if(data.displayName!==undefined&&(typeof data.displayName!=='string'||!mayUseName(displayName,user)))fail('invalid-argument','Choose an available display name with 2–24 letters or numbers.');
    if(data.greeting!==undefined&&(typeof data.greeting!=='string'||!identity.validGreeting(greeting)))fail('invalid-argument','Keep your avatar message friendly and under 120 characters, with no markup.');
    const petNames={...previous.petNames};
    if(data.petNames!==undefined){
      if(!data.petNames||typeof data.petNames!=='object'||Array.isArray(data.petNames)||Object.keys(data.petNames).length>rewards.pets.length-1)fail('invalid-argument','Choose valid pet names.');
      for(const [pet,name]of Object.entries(data.petNames)){
        if(pet==='none'||!rewards.item('pets',pet)||!characters.validPetName(name)||identity.objectionableName(name))fail('invalid-argument','Choose a friendly pet name of up to 24 characters.');
        if(!rewards.allowed('pets',pet,level,access))fail('permission-denied','That companion is not available for your account.');
        petNames[pet]=identity.cleanName(name);
      }
    }
    if(character.pet!=='none')petNames[character.pet]=character.petName;
    const value={version:1,revision:previous.revision+1,avatar,character:{...character},displayName,greeting,petNames,testerCompanionSeeded:previous.testerCompanionSeeded},out=projection(value,user,level,access);
    const profile={avatar,character:out.character,displayName,nameKey:identity.nameKey(displayName),greeting,...(avatar==='account'?{avatarURL:out.avatarURL}:{})};
    return {value:out,profile,commit:()=>tx.set(ref,{...value,updatedAt:now()})};
  }
  async function run(user,action,data){
    const keys=action==='avatarState'?['characterVersion']:['avatar','character','revision','displayName','greeting','petNames'];
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!keys.includes(key)))fail('invalid-argument','The avatar request contains unsupported fields.');
    if(action==='avatarUpdate'&&(!Number.isSafeInteger(data.revision)||data.revision<0))fail('invalid-argument','Reopen the avatar editor and try again.');
    if(action==='avatarState'&&data.characterVersion!==undefined&&![1,2,3].includes(data.characterVersion))fail('invalid-argument','Unsupported character version.');
    const requested=action==='avatarState'?data.characterVersion:data.character?.version;
    const response=value=>({...value,character:characters.compatible(value.character,requested||1)});
    return db.runTransaction(async tx=>{
      const socialRef=db.doc('socialAccounts/'+user.uid),[social,save,awards,deleting,deleted,restriction]=await tx.getAll(socialRef,db.doc('users/'+user.uid+'/appData/kanaTrainer'),db.doc('rewardEntitlements/'+user.uid),db.doc('accountDeletions/'+user.uid),db.doc('socialDeleted/'+hash(user.uid)),db.doc('socialRestrictions/'+user.uid));
      if(deleting.exists||deleted.exists&&(Date.parse(user.metadata?.creationTime)||0)<=deleted.data().at)fail('unauthenticated','This account is being deleted.');
      const account=social.data(),level=levelFromSave(save.data()),access=entitlement(user,awards.data(),now());
      if(action==='avatarState'){
        const ref=reference(user.uid),stored=(await tx.get(ref)).data(),value=record(stored,account?.profile,user);
        if(isTester(user)&&stored?.testerCompanionSeeded!==true){value.revision++;tx.set(ref,{...value,updatedAt:now()});}
        return response(projection(value,user,level,access));
      }
      if(restriction.exists||account?.restricted)fail('permission-denied','Profile editing is restricted. Contact support@mode-atlas.com to appeal.');
      if(account?.deleting)fail('failed-precondition','Your friends profile is being removed. Try again shortly.');
      const update=await prepare(tx,user,data,{legacy:account?.profile,level,access});
      const claim=account?.active&&data.displayName!==undefined?await identities.claim(tx,user.uid,update.profile,account.profile):()=>{};
      claim();
      update.commit();
      if(account?.active&&!account.deleting){
        const profile={...account.profile};delete profile.character;delete profile.avatarURL;
        Object.assign(profile,update.profile);
        if(data.displayName!==undefined)delete profile.requiresNameChange;
        tx.update(socialRef,{profile,rewardAccess:access,summary:projectSave(save.data(),profile.timeZone,save.updateTime?.toMillis()||0,access),updatedAt:now()});
      }
      return response(update.value);
    });
  }
  async function publicCharacter(tx,uid,legacy,level,access){return characters.visible((await tx.get(reference(uid))).data()?.character||legacy?.character,level,access);}
  return {prepare,run,publicCharacter,erase:uid=>reference(uid).delete()};
}
module.exports={createAvatars};
