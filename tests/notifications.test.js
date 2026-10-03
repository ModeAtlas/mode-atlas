const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const blank=()=>({dailyGoals:false,weeklyGoals:false,streak:false,overtaken:false});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const timing=require('../assets/app/mode-atlas-notification-rules.js');
test('notification windows honor DST, midnight, daytime quiet hours and reminder overlap',()=>{
  const at=Date.parse('2026-10-04T09:15:00Z');
  assert.equal(timing.allowed(at,'Australia/Melbourne',undefined,true),true);
  assert.equal(timing.expiresAt(at,'Australia/Melbourne',undefined,true),Date.parse('2026-10-04T11:00:00Z'));
  const spring={reminderMinute:120,quietStart:240,quietEnd:60};
  assert.equal(timing.valid(spring),true);
  const beforeJump=Date.parse('2026-10-03T16:00:00Z'); // 03:00 after the skipped hour.
  assert.equal(timing.allowed(beforeJump,'Australia/Melbourne',spring,true),true);
  assert.equal(timing.expiresAt(beforeJump,'Australia/Melbourne',spring,true),Date.parse('2026-10-03T17:00:00Z'));
  const late={reminderMinute:1380,quietStart:60,quietEnd:540};
  assert.equal(timing.expiresAt(Date.parse('2026-10-03T23:30:00Z'),'UTC',late,true),Date.parse('2026-10-04T00:00:00Z'));
  assert.equal(timing.valid({reminderMinute:1200,quietStart:540,quietEnd:1020}),true);
  assert.equal(timing.valid({reminderMinute:1200,quietStart:1200,quietEnd:540}),false);
  assert.equal(timing.overlaps({enabled:true,hour:19,minute:0}),true);assert.equal(timing.overlaps({enabled:true,hour:18,minute:59}),false);
});
test('timing-only changes preserve flags, register the local reminder, and never ask permission',async()=>{
  const c=client();c.setPrefs({...blank(),dailyGoals:true});c.root.AtlasPlatform.getEngagementState=async()=>({reminder:{enabled:true,hour:19,minute:0}});
  await c.api.read();const schedule={reminderMinute:1110,quietStart:1290,quietEnd:480};await c.api.configure({...blank(),dailyGoals:true},schedule);
  const request=c.calls.find(call=>call.action==='configureNotifications').data;
  assert.deepEqual(request.schedule,schedule);assert.deepEqual(JSON.parse(JSON.stringify(request.localReminder)),{enabled:true,hour:19,minute:0});
  assert.equal(c.calls.includes('permission'),false);
  await assert.rejects(c.api.configure(blank(),{...schedule,quietStart:1110}),/quiet hours/);
});
function client(){
  let account='one',permission=null,status=null,prefs=blank();const calls=[],events={};
  const root={ModeAtlasNotificationRules:require('../assets/app/mode-atlas-notification-rules.js'),ModeAtlasEnv:{isNativeApp:true},navigator:{onLine:true},KanaCloudSync:{getUser:()=>account?{uid:account}:null},
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
