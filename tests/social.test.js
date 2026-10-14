const test=require('node:test');
const assert=require('node:assert/strict');

test('private avatar cache and pending requests never cross accounts; stale revisions reach the server unchanged',async()=>{
  const createAvatar=require('../assets/app/mode-atlas-avatar.js'),rules=require('../assets/app/mode-atlas-avatar-rules.js');
  const value={version:1,revision:3,avatar:'character',character:{...rules.defaults},level:1};
  let uid='alice',cache=null,resolve,calls=[];
  const owner=createAvatar({user:()=>uid,online:()=>true,valid:v=>rules.valid(v.character),read:()=>cache,write:v=>{cache=v;},
    call:(action,data,expected)=>{calls.push({action,data,expected});return new Promise(done=>{resolve=done;});}});
  const pending=owner.refresh();const shared=owner.refresh();assert.equal(calls.length,1);resolve(value);await Promise.all([pending,shared]);assert.equal(owner.current().avatar,'character');
  const saving=owner.save({avatar:'emoji:🦊',character:value.character},3);await new Promise(r=>setImmediate(r));assert.equal(calls[1].data.revision,3);
  uid='bob';owner.clear();resolve({...value,revision:4,avatar:'emoji:🦊'});await assert.rejects(saving,/account changed/);assert.equal(owner.current(),null);assert.equal(cache,null);
  const delayed=owner.refresh();uid='carol';owner.clear();resolve(value);assert.equal(await delayed,null);assert.equal(owner.current(),null);
});
test('avatar save bypasses stalled learning sync and reads; late reads cannot replace the new look',async()=>{
  const createAvatar=require('../assets/app/mode-atlas-avatar.js'),rules=require('../assets/app/mode-atlas-avatar-rules.js');
  const old={version:1,revision:0,avatar:'character',character:{...rules.defaults},level:1},next={...old,revision:1,character:{...rules.defaults,hair:'quiff'}};
  let readDone,saveDone,syncCalls=0;
  const owner=createAvatar({user:()=> 'alice',online:()=>true,valid:()=>true,sync:()=>{syncCalls++;return new Promise(()=>{});},
    call:action=>new Promise(done=>{if(action==='avatarState')readDone=done;else saveDone=done;})});
  const reading=owner.refresh(),saving=owner.save({avatar:'character',character:next.character},0);
  await assert.rejects(owner.save({avatar:'character',character:old.character},0),{code:'failed-precondition'});
  saveDone(next);assert.equal((await saving).revision,1);readDone(old);assert.equal(await reading,null);
  assert.equal(owner.current().character.hair,'quiff');assert.equal(syncCalls,0);
});
test('failed avatar saves release the save lock and keep the previous portrait for retry',async()=>{
  const createAvatar=require('../assets/app/mode-atlas-avatar.js'),rules=require('../assets/app/mode-atlas-avatar-rules.js');
  const value={version:1,revision:0,avatar:'character',character:rules.defaults};let fail=true;
  const owner=createAvatar({user:()=> 'alice',online:()=>true,valid:()=>true,call:async action=>{if(action==='avatarUpdate'&&fail)throw Object.assign(Error('Timed out'),{code:'deadline-exceeded'});return value;}});
  await owner.refresh();await assert.rejects(owner.save(value,0),{code:'deadline-exceeded'});assert.equal(owner.current().revision,0);
  fail=false;assert.deepEqual(await owner.save(value,0),value);
});
const createSocial=require('../assets/app/mode-atlas-social.js');
test('social requests reject disabled, signed-out and offline use without contacting the backend',async()=>{
  let enabled=false,uid='first',online=true,calls=0;
  const client=createSocial({enabled:()=>enabled,user:()=>uid?{uid}:null,online:()=>online,transport:async()=>{calls++;return {};}});
  await assert.rejects(client.call('state'),{code:'unavailable'});
  enabled=true;uid=null;await assert.rejects(client.call('state'),{code:'unauthenticated'});
  uid='first';online=false;await assert.rejects(client.call('state'),{code:'offline'});
  assert.equal(calls,0);
});
test('social responses cannot cross accounts; server receives the original account precondition',async()=>{
  let uid='first',resolve,seen;
  const client=createSocial({enabled:()=>true,user:()=>({uid}),online:()=>true,transport:(action,data,owner)=>{seen={action,data,owner};return new Promise(done=>{resolve=done;});}});
  const request=client.call('accept',{uid:'friend'});uid='second';resolve({ok:true});
  await assert.rejects(request,{code:'account-changed'});assert.deepEqual(seen,{action:'accept',data:{uid:'friend'},owner:'first'});
});
test('account deletion remains available with Friends disabled and preserves failure details',async()=>{
  const client=createSocial({enabled:()=>false,user:()=>({uid:'first'}),online:()=>true,transport:async(action)=>{assert.equal(action,'deleteAccount');throw new Error('backend unavailable');}});
  await assert.rejects(client.deleteAccount(),/backend unavailable/);
  const offline=createSocial({enabled:()=>false,user:()=>({uid:'first'}),online:()=>false,transport:()=>{throw new Error('must not run');}});
  await assert.rejects(offline.deleteAccount(),{code:'offline'});
});
test('deletion and receipt lookup remain bound to the originally confirmed account',async()=>{
  let uid='first',calls=0;
  const client=createSocial({enabled:()=>true,user:()=>({uid}),online:()=>true,transport:async(action,data,owner)=>{calls++;assert.equal(owner,'first');return {deleted:true};}});
  const confirmed=uid;uid='second';
  await assert.rejects(client.deleteAccount(confirmed),{code:'account-changed'});
  await assert.rejects(client.accountDeletionStatus(confirmed),{code:'account-changed'});
  assert.equal(calls,0);
  uid='first';assert.equal((await client.deleteAccount(confirmed)).deleted,true);
});

const identity=require('../assets/app/mode-atlas-social-identity.js');
test('profile presentation uses the chosen avatar and linked Google photo after Apple sign-in',()=>{
  const photo='https://lh3.googleusercontent.com/a/linked',user={providerData:[{providerId:'apple.com'},{providerId:'google.com',photoURL:photo}]};
  assert.deepEqual(identity.presentation(null,user),{symbol:'あ',url:photo});
  assert.deepEqual(identity.presentation({avatar:'emoji:🦊'},user),{symbol:'🦊',url:null});
  assert.deepEqual(identity.presentation({avatar:'moon'},user),{symbol:'月',url:null});
  assert.deepEqual(identity.presentation({avatar:'account',avatarURL:photo},user),{symbol:'あ',url:photo});
  assert.equal(identity.presentation({avatar:'account',avatarURL:'javascript:bad'}).url,null);
});
test('self-profile cache follows the authenticated owner, coalesces reads and rejects stale account responses',async()=>{
  let uid='first',cached=null,resolve,calls=0,clock=1000;
  const client=createSocial({enabled:()=>true,user:()=>uid?{uid}:null,online:()=>true,readProfile:()=>cached,writeProfile:value=>{cached=value;},now:()=>clock,transport:async()=>{calls++;return new Promise(done=>{resolve=done;});}});
  const first=client.refreshProfile(),same=client.refreshProfile();resolve({active:true,profile:{uid:'first',avatar:'emoji:🦊'}});await Promise.all([first,same]);assert.equal(calls,1);assert.equal(client.selfProfile().avatar,'emoji:🦊');
  await client.refreshProfile();assert.equal(calls,1);uid='other';assert.equal(client.selfProfile(),null);
  clock+=60001;uid='first';const delayed=client.refreshProfile();client.clearProfile();uid='other';resolve({active:true,profile:{uid:'first',avatar:'moon'}});await delayed;assert.equal(cached,null);assert.equal(client.selfProfile(),null);
});
test('server and client agree on migrated levels, new XP and rotating study days',()=>{
  const createProgress=require('../assets/app/mode-atlas-progress.js'),rules=require('../assets/app/mode-atlas-reward-rules.js'),dates=require('../assets/app/mode-atlas-date.js');
  const owner=createProgress({ModeAtlasRewardRules:rules,ModeAtlasDates:dates});
  const state=owner.normalizeState({version:3,legacySeeded:true,sources:{old:{'kana.reading.correct':6405}}});
  state.credits.newDevice={answer:700};
  const projected=require('../backend/functions/projection.cjs').projectSave({sections:{progress:{data:{state}}}});
  assert.equal(projected.level,owner.getSummary(state).level);assert.equal(projected.xp,7105);
  assert.equal(projected.level,12);
});
test('the server projects only unlocked banners from the shared save, with a safe legacy default',()=>{
  const {projectSave,publicProfile}=require('../backend/functions/projection.cjs');
  const save=(xp,banner)=>({sections:{progress:{data:{state:{version:3,legacySeeded:true,sources:{old:{'kana.reading.correct':xp}},appearance:{landmark:'grove',at:1,banner,bannerAt:2}}}}}});
  for(const [xp,banner,expected] of [[700,'grove','grove'],[0,'horizon','plain'],[700,'unknown','plain'],[700,undefined,'plain']]){
    const summary=projectSave(save(xp,banner));assert.equal(summary.banner,expected);
    const profile=publicProfile('friend',{active:true,profile:{displayName:'Friend',avatar:'kana',timeZone:'UTC'},summary});
    assert.equal(profile.banner,expected);assert.equal(profile.stats.xp,xp);
  }
});
test('identity policy normalises equivalent names and reserves official-looking names',()=>{
  assert.equal(identity.nameKey('  Ｊáck.Wright '),identity.nameKey('JACK wright'));
  for(const name of ['Owner',' STAFF ','Ａｄｍｉｎ','Admіn','a.d.m.i.n','Admin 1','Mode Atlas Support','Staff-42','0wner123','Administrator'])assert.equal(identity.reservedName(name),true,name);
  for(const name of ['Jack','桜の道','Stafford','Hana'])assert.equal(identity.reservedName(name),false,name);
  for(const name of ['', '..', 'a', '<script>', 'x'.repeat(25),{toString:5},null,123])assert.equal(identity.validName(name),false);
});
test('avatar policy accepts one emoji grapheme and restricts provider photo URLs',()=>{
  for(const symbol of ['🐶','👩🏽‍🚀','🇦🇺','1️⃣'])assert.equal(identity.avatar('emoji:'+symbol),'emoji:'+symbol);
  for(const symbol of ['hi','🌸🌙','<img src=x>','\u200D'])assert.equal(identity.avatar('emoji:'+symbol),null);
  assert.equal(identity.avatar('account'),'account');assert.equal(identity.avatar('moon'),'moon');assert.equal(identity.avatar({toString:5}),null);
  assert.equal(identity.photoURL('https://lh3.googleusercontent.com/a/photo'),'https://lh3.googleusercontent.com/a/photo');
  for(const url of ['http://lh3.googleusercontent.com/a','https://lh3.googleusercontent.com.evil.test/a','https://user@lh3.googleusercontent.com/a','javascript:alert(1)'])assert.equal(identity.photoURL(url),null);
});

test('obvious abusive names are filtered without rejecting harmless substrings',()=>{
  for(const name of ['fuck','f.u.c.k','Shit','f4ggot'])assert.equal(identity.objectionableName(name),true,name);
  for(const name of ['Scunthorpe','Classroom','Stafford','桜の道'])assert.equal(identity.objectionableName(name),false,name);
});

test('cached friend profiles recalculate legacy levels immediately, before their next sync',()=>{
  const {publicProfile}=require('../backend/functions/projection.cjs');
  const profile=publicProfile('cached',{active:true,profile:{displayName:'Cached',avatar:'kana',timeZone:'UTC'},summary:{xp:7003,level:21,landmark:'bridge',studyDays:[]}});
  assert.equal(profile.level,12);assert.equal(profile.stats.xp,7003);
});

test('identical social reads share one request but never survive an account epoch change',async()=>{
  let uid='alice',calls=0,finish;
  const client=createSocial({enabled:()=>true,user:()=>({uid}),online:()=>true,transport:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}});
  const first=client.call('state',{listKind:'friends'}),second=client.call('state',{listKind:'friends'});
  assert.equal(calls,1);finish({active:true,profile:{uid:'alice'},list:{rows:[]}});await Promise.all([first,second]);
  const stale=client.call('list',{kind:'friends'});client.clearProfile();uid='bob';uid='alice';finish({rows:[{uid:'private-friend'}]});
  await assert.rejects(stale,{code:'account-changed'});
});
