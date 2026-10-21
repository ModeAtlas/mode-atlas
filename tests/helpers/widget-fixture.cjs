// Exercise the actual progression -> native projection contract, not a second
// hand-maintained JSON schema. CI passes this exact producer output to Swift.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
  const values=new Map(),listeners={},timers=new Map();let timerId=0,now=Date.parse('2026-10-21T12:00:00Z');
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),get length(){return values.size;},key:i=>[...values.keys()][i]??null};
  const root={localStorage:storage,sessionStorage:storage,Date:Clock,console,navigator:{onLine:false},ModeAtlasEnv:{isNativeApp:true},
    document:{addEventListener(){},body:{classList:{contains:()=>false}}},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    addEventListener(name,fn){(listeners[name]||=[]).push(fn);},dispatchEvent(event){for(const fn of listeners[event.type]||[])fn(event);},
    setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},
    AtlasPlatform:{getCapabilities:()=>({widgetSnapshots:true}),publishWidgetSnapshot:async()=>({stored:true}),resetEngagement:async()=>({reset:true})}};
  root.window=root;root.self=root;
  const context=vm.createContext(root);
  for(const file of ['app/mode-atlas-date','app/mode-atlas-storage','app/mode-atlas-reward-rules','app/mode-atlas-progress','data/mode-atlas-kana-data','app/mode-atlas-review','platform/mode-atlas-native-engagement'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../assets',file+'.js'),'utf8'),context);
  const p=root.ModeAtlasProgress;
  for(let day=14;day<=21;day++){
    now=Date.parse(`2026-10-${day}T12:00:00Z`);p.startRun('widget-'+day);
    for(let index=1;index<=5;index++){
      const input={runId:'widget-'+day,index,correct:true,at:now,poolSize:10};
      day%2?p.recordKanjiAnswer({...input,skill:'meaning'}):p.recordAnswer({...input,mode:'reading',units:1,kana:['あ']});
    }
  }
  p.setPersonalGoal('daily',{id:'kana-correct',target:20,repeat:true});
  p.setPersonalGoal('weekly',{id:'kana-correct',target:100,repeat:true});
  return {root,values,listeners,timers,snapshot:()=>root.ModeAtlasNativeEngagement.snapshot()};
}
module.exports=fixture;
if(require.main===module)fs.writeFileSync(process.argv[2],JSON.stringify(fixture().snapshot()));
