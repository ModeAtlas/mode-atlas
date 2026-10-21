'use strict';
const {readSave}=require('./account-data.cjs');
// Private account entitlements. Client saves and token email never award access.
const {createHash}=require('node:crypto');
const {isAdmin}=require('./identity.cjs');
const {levelFromSave}=require('./projection.cjs');
const rules=require('./shared/mode-atlas-reward-rules.js');
const characters=require('./shared/mode-atlas-avatar-rules.js');
const grants=new Set(Object.values(rules.catalogue).flat().map(item=>item.grant).filter(Boolean));
const testerEmailHash='bbb008ea1efa3915c64bb4ab722966728c871dcdc66e1abd2a901287b5565777';
const isTester=user=>user?.emailVerified===true&&!user.disabled&&createHash('sha256').update((user.email||'').trim().toLowerCase()).digest('hex')===testerEmailHash;
const validTime=value=>value==null||typeof value==='number'&&Number.isFinite(value)&&value>=0;
function entitlement(user,record={},now=Date.now(),audienceHash=testerEmailHash){
  const empty={allCustom:false,grants:[],validUntil:now+86400000};
  if(!user||user.disabled||!user.emailVerified)return empty;
  const allCustom=isAdmin(user),awards=record.grants||{},allowed=new Set();let validUntil=empty.validUntil;
  for(const key of grants){
    const grant=Object.hasOwn(awards,key)?awards[key]:null;
    if(!grant||typeof grant!=='object'||Array.isArray(grant)||grant.revoked===true||!validTime(grant.startsAt)||!validTime(grant.expiresAt))continue;
    if((grant.startsAt||0)>now||grant.expiresAt&&grant.expiresAt<=now)continue;
    allowed.add(key);if(grant.expiresAt)validUntil=Math.min(validUntil,grant.expiresAt);
  }
  const email=typeof user.email==='string'?user.email.trim().toLowerCase():'';
  if(createHash('sha256').update(email).digest('hex')===audienceHash&&awards['hunny-tester']?.revoked!==true)allowed.add('hunny-tester');
  if(isTester(user)&&awards['shop-japanese-spitz']?.revoked!==true)allowed.add('shop-japanese-spitz');
  return {allCustom,grants:[...allowed].sort(),validUntil};
}
function createRewards({db,now=Date.now}){
  async function retainEquipped(user,existing){
    if(!user||user.disabled||!user.emailVerified)return;
    const ref=db.doc('rewardEntitlements/'+user.uid);existing||=await ref.get();
    if(existing.data()?.wardrobeMigration===1)return;
    await db.runTransaction(async tx=>{
      const [awards,avatar,social,save,deleting,deleted]=await tx.getAll(ref,db.doc('avatarProfiles/'+user.uid),db.doc('socialAccounts/'+user.uid),db.doc('users/'+user.uid+'/appData/kanaTrainer'),db.doc('accountDeletions/'+user.uid),db.doc('socialDeleted/'+createHash('sha256').update(user.uid).digest('hex')));
      if(awards.data()?.wardrobeMigration===1||deleting.exists||deleted.exists&&(Date.parse(user.metadata?.creationTime)||0)<=deleted.data().at)return;
      const record=awards.data()||{},granted={...(record.grants||{})},look=avatar.data()?.character||social.data()?.profile?.character,level=levelFromSave((await readSave(tx,save)));
      if(characters.valid(look))for(const [slot,type]of Object.entries(characters.slots)){
        const item=rules.item(type,look[slot]);
        if(item?.legacyLevel&&level>=item.legacyLevel&&!Object.hasOwn(granted,item.grant))granted[item.grant]={awardedAt:now(),source:'equipped-migration'};
      }
      tx.set(ref,{...record,grants:granted,wardrobeMigration:1});
    });
  }
  async function read(user,tx){
    if(!user)return entitlement(null,{},now());
    const ref=db.doc('rewardEntitlements/'+user.uid);let record=tx?await tx.get(ref):await ref.get();
    if(!tx&&record.data()?.wardrobeMigration!==1){await retainEquipped(user,record);record=await ref.get();}
    return entitlement(user,record.data(),now());
  }
  function key(access){return JSON.stringify([access.allCustom,access.grants]);}
  function hasCustom(profile){
    return !!(rules.item('themes',profile.theme)?.grant||rules.item('banners',profile.banner)?.grant||rules.landmarks.find(item=>item.frame===profile.frame&&item.title===profile.title)?.grant||rules.item('avatars',profile.avatar)?.grant||!!profile.character&&Object.entries(characters.slots).some(([slot,type])=>rules.item(type,profile.character?.[slot])?.grant));
  }
  function sanitize(profile,access){
    if(!rules.allowed('themes',profile.theme,profile.level,access))profile.theme='';
    const frame=rules.landmarks.find(item=>item.frame===profile.frame&&item.title===profile.title);
    const appearance=rules.appearance(frame?.id,profile.level,access);
    profile.frame=appearance.frame;profile.title=appearance.title;
    profile.banner=rules.banner(profile.banner,profile.level,access).id;
    if(rules.item('avatars',profile.avatar)&&!rules.allowed('avatars',profile.avatar,profile.level,access))profile.avatar='kana';
    if(profile.character)profile.character=characters.visible(profile.character,profile.level,access);
  }
  return {read,retainEquipped,key,hasCustom,sanitize,erase:uid=>db.doc('rewardEntitlements/'+uid).delete()};
}
module.exports={createRewards,entitlement,isTester};
