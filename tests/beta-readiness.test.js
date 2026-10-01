const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/app/mode-atlas-diagnostics.js'),'utf8');
function load(saved=new Map()){
  const listeners={},notifications=[];
  const window={addEventListener:(name,fn)=>(listeners[name]||=[]).push(fn),ModeAtlasFeedback:{toast:text=>notifications.push(text)}};
  const context={window,URL,console,Date,document:{readyState:'complete'},location:{href:'https://mode-atlas.app/reading/?email=private@example.test',origin:'https://mode-atlas.app',pathname:'/reading/'},sessionStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)}};
  vm.runInNewContext(source,context);
  return {api:window.ModeAtlasDiagnostics,saved,notifications,emit:(name,event={})=>listeners[name]?.forEach(fn=>fn(event)),window};
}
test('technical reports omit sensitive error text, stack, URL parameters and unknown fields',()=>{
  const {api,saved}=load();
  api.record('cloud-sync',{name:'TypeError',code:'permission-denied',message:'private@example.test secretToken123',stack:'users/privateUID',uid:'privateUID'},{file:'https://mode-atlas.app/assets/app/mode-atlas-tour.assets-2.81.0.js?token=secretToken123',line:42});
  const text=api.report();assert.match(text,/permission-denied/);assert.match(text,/mode-atlas-tour.assets-2.81.0.js:42/);
  assert.doesNotMatch(text+JSON.stringify([...saved]),/private|secretToken|\?token/);
  api.record('friends',{name:'private@example.test',code:'privateUID',message:'hidden'},{file:'https://other.test/private.js'});
  assert.equal(api.snapshot().at(-1).name,'Error');assert.equal(api.snapshot().at(-1).file,'');
});
test('diagnostics deduplicate bursts, bound storage, expire and clear on account changes',()=>{
  const {api,saved,emit}=load();
  for(let i=0;i<200;i++)api.record('script',{name:'TypeError'});
  assert.equal(api.snapshot().length,1);assert.equal(api.snapshot()[0].count,99);
  for(let i=0;i<60;i++)api.record(i%2?'script':'promise');
  assert.equal(api.snapshot().length,20);assert.ok(api.report().length<=1500);
  assert.equal(load(saved).api.snapshot().length,20);
  emit('modeAtlasAccountWillChange');assert.equal(api.snapshot().length,0);assert.equal(saved.has('modeAtlasDiagnostics'),false);
  saved.set('modeAtlasDiagnostics',JSON.stringify([{kind:'script',at:Date.now()-86400001}]));
  assert.equal(load(saved).api.snapshot().length,0);
});
test('unexpected failures get one recovery notice without cancelling normal browser error handling',()=>{
  const {emit,api,window,notifications}=load();
  emit('error',{target:window,error:{name:'ReferenceError'},filename:'https://mode-atlas.app/cloud-sync.assets-2.81.0.js',lineno:12});
  emit('unhandledrejection',{reason:{name:'TypeError',message:'secret'}});
  emit('unhandledrejection',{reason:{name:'AbortError'}});
  assert.equal(notifications.length,1);assert.equal(api.snapshot().length,2);
});
