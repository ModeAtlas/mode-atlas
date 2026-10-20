const test=require('node:test'),assert=require('node:assert/strict');
const {gzipSync}=require('node:zlib');
const createProgress=require('../assets/app/mode-atlas-progress.js');
const createAchievements=require('../assets/achievements/mode-atlas-achievements.js');
const project=require('../backend/functions/projection.cjs');
const dates=require('../assets/app/mode-atlas-date.js'),rules=require('../assets/app/mode-atlas-reward-rules.js'),kana=require('../assets/data/mode-atlas-kana-data.js');
function model(){return createAchievements({ModeAtlasKanaData:kana});}
test('rank identities are unique and every achievement family has real vector artwork',()=>{
  const m=model(),tracks=Object.values(m.tracks).flat(),ids=tracks.flatMap(t=>t.ranks.map(r=>r.unlockId));
  assert.equal(new Set(ids).size,ids.length);
  const art=require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/achievements/mode-atlas-badges.svg'),'utf8');
  for(const track of tracks)assert.ok(art.includes(`id="${track.id}"`),track.id);
  const completion=m.completion({});assert.equal(completion.earned,0);
  assert.equal(completion.total,tracks.filter(t=>!t.legacy&&!m.special(t.id)).reduce((n,t)=>n+t.ranks.length,0));
  const special={earned:{'general-5':1,'progress-special-delivery-1':1,'kana-4':1}};
  assert.equal(m.completion(special).earned,0);assert.equal(m.unlocked(special).length,3);
});
test('earned ranks survive lower current metrics and offline merges without XP or coin awards',()=>{
  let saved={legacySeeded:true,sources:{device:{'kana.reading.correct':100}}};
  const root={ModeAtlasDates:dates,ModeAtlasRewardRules:rules,ModeAtlasAchievements:model(),ModeAtlasStorage:{json:()=>saved,setJSON:(_key,state)=>{saved=state;return true;},set(){}}};
  const p=createProgress(root),xp=p.getXP();assert.equal(p.recordAchievements(['wordbank-0','kana-14','not-an-achievement']),true);
  assert.equal(p.recordAchievements(['wordbank-0']),false);assert.equal(p.getXP(),xp);
  const merged=p.mergeStates(saved,{legacySeeded:true,achievements:{'wordbank-0':1,'general-0':2}});
  assert.equal(merged.achievements['wordbank-0'],1);assert.equal(Object.keys(merged.achievements).length,3);
  assert.deepEqual(p.mergeStates(merged,saved).achievements,merged.achievements);
  assert.equal(root.ModeAtlasAchievements.unlocked({wordCount:0,mastered:0,earned:merged.achievements}).length,3);
  assert.equal(p.normalizeState({achievements:{bad:{toString:3}}}).achievements.bad,undefined);
});
test('profile mastery uses exact earned stages and the full branch denominator',()=>{
  const row=[30,0,30,4,30000,100000,200000,4,'2026-10-01,2026-10-02,2026-10-03,2026-10-04'];
  const kanjiState={sources:{device:{'一':{pronunciation:row,meaning:row},'二':{meaning:[10,0,10,4,10000,100000,200000,2,'2026-10-01,2026-10-02']}}}};
  const save={sections:{progress:{data:{state:{legacySeeded:true,sources:{device:{'kana.reading.correct':5,'kanji.correct':70}},achievements:{'wordbank-0':1}}}},kanaLearning:{data:{state:{earned:{reading:{'あ':5,'い':4},writing:{'あ':5,'い':4}}}}},kanji:{data:{state:kanjiState}}}};
  const plain=project.projectSave(save);assert.equal(plain.totalCorrect,75);assert.equal(plain.insights.kana.mastered,1);assert.equal(plain.insights.kana.confident,1);assert.equal(plain.insights.kana.percent,0.4);assert.equal(plain.insights.kana.total,kana.collections.all.length);
  assert.equal(plain.insights.kanji.mastered,1);assert.equal(plain.insights.kanji.learning,1);assert.ok(plain.insights.kanji.total>1000);assert.ok(plain.insights.achievements.earned>=1);
  save.sections.kanji.data.state={evidence:{encoding:'gzip-base64-v1',data:gzipSync(JSON.stringify(kanjiState.sources)).toString('base64')}};
  assert.deepEqual(project.projectSave(save).insights,plain.insights);
  save.sections.kanji.data.state.evidence.data='broken';const bad=project.projectSave(save).insights;assert.equal(bad.kanji,null);assert.equal(bad.achievements,null);assert.equal(bad.kana.mastered,1);
});
test('account-wide insights stay private outside accepted friendships',()=>{
  const account={active:true,profile:{displayName:'Learner',avatar:'kana',timeZone:'UTC'},summary:project.projectSave()};
  assert.equal(project.publicProfile('learner',account,Date.now(),false).stats,undefined);
  assert.ok(project.publicProfile('learner',account,Date.now(),true).stats.insights);
});
