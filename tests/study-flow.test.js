const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function load(){
  const context = vm.createContext({window:{},URLSearchParams});
  for(const file of ['data/mode-atlas-kana-data','app/mode-atlas-study-plan','data/mode-atlas-kana-coaching']){
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',file+'.js'),'utf8'),context);
  }
  return context.window;
}
const plain = value => JSON.parse(JSON.stringify(value));

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
