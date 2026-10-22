const {test}=require('node:test');
const assert=require('node:assert/strict');
const create=require('../assets/app/mode-atlas-learning-experience.js');
function fixture({stats={},kana={},kanji={},words=[],flags={}}={}){
  return create({ModeAtlasStorage:{readModeJSON:mode=>stats[mode]||{},json:key=>flags[key]},
    ModeAtlasKanaLearning:{read:()=>kana},ModeAtlasKanjiState:{overview:()=>kanji},
    ModeAtlasWordBank:{read:()=>words,due:()=>[]}});
}
test('consent and tour completion never turn a new learner into an established learner',()=>{
  const experience=fixture({flags:{modeAtlasOnboardingComplete:'true',modeAtlasStarterSeen:'true'}}).snapshot();
  assert.equal(experience.stage,'new');assert.equal(experience.kana.guided,true);
});
test('starting a lesson and attempting an answer are different presentation states',()=>{
  assert.equal(fixture({kana:{startedAt:1,startKind:'beginner'}}).snapshot().stage,'starting');
  const state=fixture({kana:{startedAt:1,startKind:'beginner'},stats:{reading:{あ:{wrong:1}}}}).snapshot();
  assert.equal(state.stage,'starting');assert.equal(state.kana.guided,true);
});
test('branch evidence and restored older saves work without onboarding flags',()=>{
  assert.equal(fixture({kanji:{started:true,attempts:1}}).snapshot().stage,'starting');
  assert.equal(fixture({words:[{written:'水'}]}).snapshot().stage,'starting');
  assert.equal(fixture({stats:{writing:{あ:{correct:65}}}}).snapshot().kana.guided,false);
});
test('placement and established Kana saves expose the full branch immediately',()=>{
  for(const startKind of ['existing','placement'])assert.equal(fixture({kana:{startKind}}).snapshot().kana.guided,false);
  assert.equal(fixture({kana:{earned:{reading:{あ:3,い:3,う:3,え:3,お:3}}}}).snapshot().kana.guided,false);
});
test('restored reviews and legacy correct totals preserve the returning Home without new per-character stats',()=>{
  const restored=create({ModeAtlasStorage:{readModeJSON:(_mode,key)=>key==='srs'?{あ:{lastSeen:1}}:{}}});
  assert.equal(restored.snapshot().stage,'returning');
  const legacy=create({ModeAtlasStorage:{readModeJSON:()=>({})},ModeAtlasProgress:{getSummary:()=>({lifetimeCorrect:60})}});
  assert.equal(legacy.snapshot().stage,'returning');
});

test('a first small set reveals a personal summary, not a full routine dashboard',()=>{
 const state=fixture({stats:{reading:{あ:{correct:3,wrong:2}}}}).snapshot();
 assert.equal(state.stage,'building');assert.equal(state.showPersonal,true);assert.equal(state.established,false);
});
