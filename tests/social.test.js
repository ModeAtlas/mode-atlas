const test=require('node:test');
const assert=require('node:assert/strict');
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
test('account deletion waits for social cleanup and propagates failure instead of silently dropping it',async()=>{
  const client=createSocial({enabled:()=>true,user:()=>({uid:'first'}),online:()=>true,transport:async(action)=>{assert.equal(action,'leave');throw new Error('backend unavailable');}});
  await assert.rejects(client.prepareAccountDeletion(),/backend unavailable/);
  const disabled=createSocial({enabled:()=>false,user:()=>({uid:'first'}),online:()=>false,transport:()=>{throw new Error('must not run');}});
  await disabled.prepareAccountDeletion();
});
