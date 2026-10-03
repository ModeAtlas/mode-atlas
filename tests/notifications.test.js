const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const blank=()=>({dailyGoals:false,weeklyGoals:false,streak:false,overtaken:false});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function client(){
  let account='one',permission=null,status=null,prefs=blank();const calls=[],events={};
  const root={ModeAtlasEnv:{isNativeApp:true},navigator:{onLine:true},KanaCloudSync:{getUser:()=>account?{uid:account}:null},
    AtlasPlatform:{getCapabilities:()=>({remoteNotifications:true}),
      requestNotifications:async()=>{calls.push('permission');return permission?await permission:{granted:true};},
      getNotificationStatus:async()=>status?await status:{granted:true},
      getPushToken:async()=>{calls.push('token');return {token:'valid-notification-token'};},
      deletePushToken:async()=>{calls.push('delete');}},
    ModeAtlasSocial:{call:async(action,data,owner)=>{calls.push({action,data,owner});if(action==='configureNotifications')prefs={...data.preferences};return {preferences:{...prefs}};}},
    addEventListener:(name,fn)=>events[name]=fn,dispatchEvent(){}};
  vm.runInNewContext(fs.readFileSync('assets/platform/mode-atlas-notifications.js','utf8'),{window:root,Intl,CustomEvent:class{}});
  return {api:root.ModeAtlasNotifications,calls,events,root,setAccount:value=>account=value,setPrefs:value=>prefs=value,
    delayPermission:()=>permission=new Promise(resolve=>{root.permission=resolve;}),delayStatus:()=>status=new Promise(resolve=>{root.status=resolve;})};
}
test('reading preferences never prompts; enabling registers and disabling does not ask permission',async()=>{
  const c=client();await c.api.read();assert.ok(!c.calls.includes('permission'));
  await c.api.configure({...blank(),dailyGoals:true,streak:true});
  await c.api.configure({...blank(),streak:true});
  await c.api.configure(blank());
  assert.equal(c.calls.filter(x=>x==='permission').length,1);assert.equal(c.calls.filter(x=>x==='delete').length,1);
  assert.deepEqual(c.calls.filter(x=>x.action==='configureNotifications').map(x=>x.owner),['one','one','one']);
});
test('signing out while permission is pending cannot register or delete a new account’s token',async()=>{
  const c=client();c.delayPermission();const pending=c.api.configure({...blank(),streak:true});
  const rejected=assert.rejects(pending,/account changed/);
  await c.api.signOut();c.setAccount('two');c.root.permission({granted:true});await rejected;
  assert.equal(c.calls.filter(x=>x==='token').length,0);assert.equal(c.calls.filter(x=>x==='delete').length,1);
  assert.equal(c.calls.filter(x=>x.action==='configureNotifications').length,0);
});
test('background reconnection cannot copy a previous account’s preferences after an account switch',async()=>{
  const c=client();c.setPrefs({...blank(),dailyGoals:true});c.delayStatus();const pending=c.api.reconnect();await turn();
  c.setAccount('two');c.setPrefs(blank());c.root.status({granted:true});await pending;await turn();
  assert.equal(c.calls.filter(x=>x.action==='configureNotifications').length,0);assert.equal(c.calls.filter(x=>x==='token').length,0);
});
test('denied notification access saves no preference or token',async()=>{
  const c=client();c.delayPermission();const pending=c.api.configure({...blank(),overtaken:true});
  c.root.permission({granted:false});await assert.rejects(pending,/iPhone Settings/);
  assert.equal(c.calls.filter(x=>x.action==='configureNotifications').length,0);assert.ok(!c.calls.includes('token'));
});
