'use strict';
// Private account entitlements. Client saves and token email never award access.
const {createHash}=require('node:crypto');
const {isAdmin}=require('./identity.cjs');
const rules=require('./shared/mode-atlas-reward-rules.js');
const grants=new Set(Object.values(rules.catalogue).flat().map(item=>item.grant).filter(Boolean));
const testerEmailHash='bbb008ea1efa3915c64bb4ab722966728c871dcdc66e1abd2a901287b5565777';
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
  return {allCustom,grants:[...allowed].sort(),validUntil};
}
function createRewards({db,now=Date.now}){
  async function read(user,tx){
    if(!user)return entitlement(null,{},now());
    const ref=db.doc('rewardEntitlements/'+user.uid),record=tx?await tx.get(ref):await ref.get();
    return entitlement(user,record.data(),now());
  }
  function key(access){return JSON.stringify([access.allCustom,access.grants]);}
  function hasCustom(profile){
    return !!(rules.item('banners',profile.banner)?.grant||rules.landmarks.find(item=>item.frame===profile.frame&&item.title===profile.title)?.grant||rules.item('avatars',profile.avatar)?.grant);
  }
  function sanitize(profile,access){
    const frame=rules.landmarks.find(item=>item.frame===profile.frame&&item.title===profile.title);
    const appearance=rules.appearance(frame?.id,profile.level,access);
    profile.frame=appearance.frame;profile.title=appearance.title;
    profile.banner=rules.banner(profile.banner,profile.level,access).id;
    if(rules.item('avatars',profile.avatar)&&!rules.allowed('avatars',profile.avatar,profile.level,access))profile.avatar='kana';
  }
  return {read,key,hasCustom,sanitize,erase:uid=>db.doc('rewardEntitlements/'+uid).delete()};
}
module.exports={createRewards,entitlement};
