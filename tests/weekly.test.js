const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=require('../assets/app/mode-atlas-weekly-rules.js');
function client(){
  let account='one',offline=false,fail=false;const calls=[],timers=new Map(),events={},pending=[];let tokenResponse=null;
  const root={navigator:{onLine:true},KanaCloudSync:{getUser:()=>account?{uid:account}:null},ModeAtlasWeeklyRules:policy,
    ModeAtlasSocial:{call:async(action,data,owner)=>{
      calls.push({action,data,owner});if(offline)throw new Error('offline');
      if(action==='weeklyStart'){if(tokenResponse)await new Promise(resolve=>pending.push(resolve));return {enabled:true,token:'server-token',week:'2026-09-28',expiresAt:Date.now()+3600000,index:0};}
      if(fail){fail=false;throw new Error('lost response');}
      return {runEarned:data.answers.at(-1).index*2,earned:data.answers.length*2,score:data.answers.length*2,index:data.answers.at(-1).index};
    }},addEventListener:(name,fn)=>{events[name]=fn;},dispatchEvent(){}};
  const context=vm.createContext({window:root,document:{addEventListener(){}},Date,CustomEvent:class{},setTimeout:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync('assets/app/mode-atlas-weekly.js','utf8'),context);
  return {root,api:root.ModeAtlasWeekly,calls,timers,events,setAccount:value=>account=value,setOffline:value=>offline=value,loseResponse:()=>fail=true,delayStart:()=>tokenResponse=true,release:()=>pending.splice(0).forEach(fn=>fn())};
}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const config={direction:'reading',mode:'guided',hints:false,pool:['あ']};
test('weekly weeks reset at the same UTC instant across daylight-saving changes',()=>{
  assert.equal(policy.period(Date.parse('2026-10-04T23:59:59Z')).id,'2026-09-28');
  assert.equal(policy.period(Date.parse('2026-10-05T00:00:00Z')).id,'2026-10-05');
  assert.equal(policy.period(Date.parse('2026-10-04T09:00:00Z')).endAt,Date.parse('2026-10-05T00:00:00Z'));
});
test('practice continues while weekly registration connects and sends buffered answers once',async()=>{
  const c=client(),current={runId:'run-live'};c.delayStart();c.api.start(current,config);
  c.api.answer(current,{kana:'あ',answer:'a'});c.api.finish(current);assert.equal(c.calls.length,1);
  c.release();await turn();assert.equal(c.calls.length,2);assert.equal(current.weekly.earned,2);assert.equal(current.weekly.pending.length,0);
});
test('failed weekly uploads retain the same sequence for a safe retry',async()=>{
  const c=client(),current={runId:'run-retry'};c.api.start(current,config);await turn();
  c.api.answer(current,{kana:'あ',answer:'a'});c.loseResponse();c.api.finish(current);await turn();
  assert.equal(current.weekly.status,'pending');assert.equal(current.weekly.pending[0].index,1);
  c.api.finish(current);await turn();assert.equal(current.weekly.pending.length,0);
  assert.deepEqual(c.calls.filter(row=>row.action==='weeklySubmit').map(row=>row.data.answers[0].index),[1,1]);
});
test('a delayed weekly registration cannot upload one account’s answers for another',async()=>{
  const c=client(),current={runId:'run-account'};c.delayStart();c.api.start(current,config);c.api.answer(current,{kana:'あ',answer:'a'});
  c.setAccount('two');c.api.finish(current);c.release();await turn();
  assert.equal(c.calls.filter(row=>row.action==='weeklySubmit').length,0);
});
test('offline starts do not fabricate a competitive receipt',()=>{
  const c=client(),current={runId:'offline'};c.root.navigator.onLine=false;c.api.start(current,config);c.api.answer(current,{kana:'あ',answer:'a'});c.api.finish(current);
  assert.equal(c.calls.length,0);assert.equal(current.weekly,undefined);
});
