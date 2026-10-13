'use strict';
// Private avatar selection is canonical; Friends and the ladder publish a
// sanitized projection only after the learner has joined those features.
const {createHash}=require('node:crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const identity=require('./shared/mode-atlas-social-identity.js');
const characters=require('./shared/mode-atlas-avatar-rules.js');
const rewards=require('./shared/mode-atlas-reward-rules.js');
const {accountPhoto}=require('./identity.cjs');
const {entitlement}=require('./rewards.cjs');
const {levelFromSave,projectSave}=require('./projection.cjs');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const hash=value=>createHash('sha256').update(value).digest('hex');
function createAvatars({db,now=Date.now}){
  const reference=uid=>db.doc('avatarProfiles/'+uid);
  function record(value,legacy,user){
    return {version:1,revision:Number.isSafeInteger(value?.revision)&&value.revision>=0?value.revision:0,
      avatar:identity.avatar(value?.avatar)||identity.avatar(legacy?.avatar)||(accountPhoto(user)?'account':'kana'),
      character:characters.normalize(value?.character||legacy?.character)};
  }
  function projection(value,user,level,access){
    const avatar=value.avatar==='account'&&!accountPhoto(user)?'kana':value.avatar;
    return {...value,avatar,character:characters.visible(value.character,level,access),level,
      accountPhoto:accountPhoto(user),...(avatar==='account'?{avatarURL:accountPhoto(user)}:{})};
  }
  async function prepare(tx,user,data,{legacy,level,access}){
    const ref=reference(user.uid),snapshot=await tx.get(ref),previous=record(snapshot.data(),legacy,user);
    if(data.revision!==undefined&&data.revision!==previous.revision)fail('aborted','Your avatar changed on another device. Reopen the editor to use the latest look.');
    const avatar=identity.avatar(data.avatar),character=data.character===undefined?characters.visible(previous.character,level,access):data.character;
    if(!avatar||!characters.valid(character))fail('invalid-argument','Choose a valid avatar and wardrobe items.');
    if(avatar==='account'&&!accountPhoto(user))fail('failed-precondition','Your linked Google account has no available photo.');
    if(rewards.item('avatars',avatar)&&!rewards.allowed('avatars',avatar,level,access)||!characters.allowed(character,level,access))fail('permission-denied','One of these avatar items is not available for your account.');
    const value={version:1,revision:previous.revision+1,avatar,character:{...character}},out=projection(value,user,level,access);
    const profile={avatar,...(avatar==='character'?{character:out.character}:{}),...(avatar==='account'?{avatarURL:out.avatarURL}:{})};
    return {value:out,profile,commit:()=>tx.set(ref,{...value,updatedAt:now()})};
  }
  async function run(user,action,data){
    const keys=action==='avatarState'?[]:['avatar','character','revision'];
    if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!keys.includes(key)))fail('invalid-argument','The avatar request contains unsupported fields.');
    if(action==='avatarUpdate'&&(!Number.isSafeInteger(data.revision)||data.revision<0))fail('invalid-argument','Reopen the avatar editor and try again.');
    return db.runTransaction(async tx=>{
      const socialRef=db.doc('socialAccounts/'+user.uid),[social,save,awards,deleting,deleted]=await tx.getAll(socialRef,db.doc('users/'+user.uid+'/appData/kanaTrainer'),db.doc('rewardEntitlements/'+user.uid),db.doc('accountDeletions/'+user.uid),db.doc('socialDeleted/'+hash(user.uid)));
      if(deleting.exists||deleted.exists&&(Date.parse(user.metadata?.creationTime)||0)<=deleted.data().at)fail('unauthenticated','This account is being deleted.');
      const account=social.data(),level=levelFromSave(save.data()),access=entitlement(user,awards.data(),now());
      if(action==='avatarState')return projection(record((await tx.get(reference(user.uid))).data(),account?.profile,user),user,level,access);
      const update=await prepare(tx,user,data,{legacy:account?.profile,level,access});
      update.commit();
      if(account?.active&&!account.deleting){
        const profile={...account.profile};delete profile.character;delete profile.avatarURL;
        Object.assign(profile,update.profile);
        tx.update(socialRef,{profile,rewardAccess:access,summary:projectSave(save.data(),profile.timeZone,save.updateTime?.toMillis()||0,access),updatedAt:now()});
      }
      return update.value;
    });
  }
  return {prepare,run,erase:uid=>reference(uid).delete()};
}
module.exports={createAvatars};
