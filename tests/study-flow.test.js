const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(){
  const context = vm.createContext({window:{},URLSearchParams});
  for(const file of ['data/mode-atlas-kana-data','app/mode-atlas-study-plan','data/mode-atlas-kana-coaching','trainer/mode-atlas-practice-modes']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',file+'.js'),'utf8'),context);
  }
  return context.window;
}
const plain = value => JSON.parse(JSON.stringify(value));
test('goal and mastery shortcuts choose a qualifying mode, script and safe target pool',()=>{
  const root=load(),plan=root.ModeAtlasStudyPlan;root.ModeAtlasProgress={weeklyRecap:()=>({todayReading:10})};
  const action=metric=>new URL(plan.goalAction({metric,target:20,value:0}).href,'https://mode-atlas.app');
  assert.equal(action('kana.writing').pathname,'/writing/');assert.equal(action('kana.balance').pathname,'/writing/');
  assert.equal(action('kana.daily').searchParams.get('mode'),'daily');assert.equal(action('kana.tests').searchParams.get('mode'),'test');
  const pool=action('kana.katakana').searchParams.get('kana').split(',');assert.ok(pool.includes('シ'));assert.ok(!pool.includes('あ'));
  assert.equal(action('kana.broad').searchParams.get('kana').split(',').length,46);
  assert.equal(action('kana.independent').searchParams.get('hints'),'off');
  assert.deepEqual(plain(plan.targetChars(['ファ','あ','bad','ファ',null])),['ファ','あ']);
  assert.equal(plan.target('reading',['unknown']),null);
  assert.equal(plan.goalAction({metric:'kana.reading',target:20,value:20}),null);
  assert.equal(plan.goalAction({metric:'study.goals',target:8,value:0},[{period:'daily',metric:'kana.writing',target:20,value:0}]).href.startsWith('/writing/'),true);
});

test('study lengths reject invalid goals and cannot compete with existing special modes',()=>{
  const {ModeAtlasStudyPlan:plan} = load();
  for(const count of [10,20,30]) assert.equal(plan.practiceCount({practiceCount:count}),count);
  for(const count of [undefined,NaN,Infinity,-10,11,300]) assert.equal(plan.practiceCount({practiceCount:count}),0);
  for(const mode of ['dailyChallenge','testMode','timeTrial','speedRun','endless','comboKana']) assert.equal(plan.practiceCount({practiceCount:10,[mode]:true}),0);
});

test('home and trainer share row selection including voiced combinations, with safe defaults',()=>{
  const {ModeAtlasKanaData:data,ModeAtlasStudyPlan:plan} = load();
  const selected={hiraganaRows:['h_ka','bogus'],katakanaRows:['k_ha'],dakuten:true,yoon:true,extendedKatakana:true};
  const chars=plan.availableChars(selected);
  for(const kana of ['か','が','きゃ','ぎゃ','ハ','パ','ファ']) assert.ok(chars.includes(kana),kana);
  assert.ok(!chars.includes('あ'));
  assert.equal(new Set(chars).size,chars.length);
  assert.deepEqual(plain(chars),Object.keys(data.selectedKanaMap(selected)));
  assert.equal(Object.keys(data.selectedKanaMap(null)).length,46);
  assert.equal(plan.availableChars({hiraganaRows:[],katakanaRows:[]}).length,0);
});

test('recommendation explains observed difficulties without treating unseen or excluded kana as weak',()=>{
  const {ModeAtlasStudyPlan:plan} = load();
  const settings={hiraganaRows:['h_a'],katakanaRows:[]};
  const next=plan.recommend({readingSettings:settings,writingSettings:settings,readingStats:{'あ':{correct:2,wrong:3},'い':{correct:0,wrong:1},'か':{correct:0,wrong:50}}});
  assert.equal(next.mode,'reading');assert.equal(next.focus,true);
  assert.match(next.reason,/1 kana has/);
  assert.match(next.href,/focusWeak=1/);
  assert.equal(plan.evidence(null,['あ']).answered,0);
  assert.equal(plan.evidence({'あ':{correct:Infinity,wrong:-4}},['あ']).answered,0);
});

test('recommendation starts gently, offers the other direction and respects meaningful last mode',()=>{
  const {ModeAtlasStudyPlan:plan} = load();
  assert.match(plan.recommend({}).href,/starter=starter/);
  const next=plan.recommend({readingStats:{'あ':{correct:40,wrong:0}}});
  assert.equal(next.mode,'writing');assert.equal(next.title,'Try writing');
  const balanced={readingStats:{'あ':{correct:10,wrong:0}},writingStats:{'あ':{correct:10,wrong:0}},lastMode:'writing'};
  assert.equal(plan.recommend(balanced).mode,'writing');
  assert.equal(plan.recommend({readingSettings:{hiraganaRows:['h_ka']}}).href,'/reading/?practice=10');
  assert.equal(plan.recommend({writingSettings:{hiraganaRows:['h_ka']}}).href,'/reading/?practice=10');
  assert.equal(plan.recommend({writingStats:{'あ':{correct:20,wrong:0}}}).href,'/reading/?practice=10');
  assert.equal(plan.recommend({writingStats:{'カ':{correct:20,wrong:0}}}).href,'/reading/?practice=10');
});

test('summary keeps unique kana distinct from questions and retains corrected mistakes for follow-up',()=>{
  const {ModeAtlasStudyPlan:plan} = load();
  assert.deepEqual(plain(plan.summarise([])),{unique:0,mistakes:[]});
  assert.deepEqual(plain(plan.summarise([{kana:'シ',correct:false},{kana:'シ',correct:true},{kana:'ツ',correct:true},{kana:'シ',correct:false}])),{unique:2,mistakes:[{kana:'シ',correct:1,wrong:2}]});
});

test('every contrast uses canonical readings and combination coaching does not split a kana unit',()=>{
  const {ModeAtlasKanaCoaching:coach} = load();
  for(const contrast of coach.contrasts) for(const kana of contrast.chars) assert.ok(coach.reading(kana),kana);
  assert.equal(coach.reading('きゃ'),'kya');
  assert.deepEqual(plain(coach.explain('きゃ').chars),['きゃ']);
  assert.match(coach.explain('きゃ').note,/one unit/);
  assert.equal(coach.reading('<script>'),'');
});


test('mode transitions and legacy conflicting flags always resolve to one session',()=>{
  const {ModeAtlasPracticeModes:modes}=load();
  for(const first of modes.list)for(const second of modes.list){
    const settings={comboKana:true,practiceCount:30};modes.select(settings,first.id);modes.select(settings,second.id);
    assert.equal(modes.selected(settings),second.id);
    assert.ok(['endless','timeTrial','speedRun','dailyChallenge','testMode'].filter(key=>settings[key]).length<=1);
  }
  const legacy={dailyChallenge:true,testMode:true,timeTrial:true,endless:true,practiceCount:10,hint:true};
  modes.normalize(legacy);assert.equal(modes.selected(legacy),'testMode');assert.equal(legacy.hint,false);
});
test('timed settings are finite and bounded; kana segmentation retains joined sounds',()=>{
  const {ModeAtlasPracticeModes:modes,ModeAtlasKanaData:data}=load();
  assert.deepEqual(plain(modes.trial(Infinity,NaN)),{minutes:.5,target:20});
  assert.deepEqual(plain(modes.trial(-2,10001)),{minutes:.1,target:1000});
  assert.deepEqual(plain(data.splitKana('きゃファあ')),['きゃ','ファ','あ']);
  for(const [kana,row] of [['が','ka'],['ぎゃ','ka'],['キャ','ka'],['ファ','ha']])assert.equal(data.kanaRow(kana),row);
});
