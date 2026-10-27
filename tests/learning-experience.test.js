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
test('a beginner retains their chosen guided course after substantial practice',()=>{
 const state=fixture({kana:{startKind:'beginner',earned:{reading:{あ:3,い:3,う:3,え:3,お:3}}},stats:{reading:{あ:{correct:80}}}}).snapshot();
 assert.equal(state.established,true);assert.equal(state.kana.guided,true);
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

test('Kanji invitation needs three complete Familiar reading rows and never grants access or mastery',()=>{
 const chars=['あいうえお','かきくけこ','さしすせそ'];
 const state={introduced:{},earned:{reading:{},writing:{}},placed:{reading:{}}};
 const api=create({ModeAtlasKanaLearning:{read:()=>state,snapshot:()=>({}),rows:chars.map((row,i)=>({id:String(i),script:'hiragana',group:'base',chars:[...row]}))}});
 for(const char of chars.join('')){state.introduced[char]=1;state.earned.writing[char]=5;}
 state.placed.reading={0:1,1:1,2:1};
 assert.equal(api.readiness().kanji.recommended,false);
 for(const char of chars.join('').slice(0,-1))state.earned.reading[char]=3;
 assert.equal(api.readiness().kanji.familiarRows,2);
 assert.equal(api.readiness().kanji.recommended,false);
 state.earned.reading.そ=3;
 const before=JSON.stringify(state),ready=api.readiness();
 assert.equal(ready.kanji.recommended,true);assert.equal(ready.kanji.href,'/kanji/');
 assert.equal(ready.words.recommended,true);assert.equal(JSON.stringify(state),before);
});

test('Words course activity counts independently from saved personal words and phrase completions',()=>{
 const root={ModeAtlasStorage:{readModeJSON:()=>({})},ModeAtlasWordLessonState:{read:()=>({}),vocabularyOverview:()=>({introduced:4,attempts:8,due:2})}};
 const state=create(root).snapshot();
 assert.equal(state.stage,'building');assert.equal(state.words.vocabulary,4);
 assert.equal(state.words.vocabularyDue,2);assert.equal(state.words.saved,0);assert.equal(state.words.completedLessons,0);
});

test('Words invitation uses the actual eligible pool rather than an arbitrary count of known characters',()=>{
 let pool=[];
 const root={ModeAtlasKanaLearning:{read:()=>({introduced:{ア:1,イ:1,ウ:1,エ:1,オ:1}})},ModeAtlasVocabulary:{pool:()=>pool}};
 const api=create(root);assert.equal(api.readiness().words.recommended,false);
 pool=[{id:'eligible-word'}];assert.equal(api.readiness().words.recommended,true);assert.equal(api.readiness().words.eligible,1);
});

test('new-course Kanji invitations require its checkpoint while legacy familiar evidence stays valid',()=>{
 let course={startedAt:0,kanjiReady:false,checkpointAt:0};
 const chars=[...'あいうえおかきくけこさしすせそ'];
 const api=create({ModeAtlasKanaLearning:{read:()=>({earned:{reading:Object.fromEntries(chars.map(char=>[char,3]))}}),rows:[0,1,2].map(i=>({script:'hiragana',group:'base',chars:chars.slice(i*5,i*5+5)})),courseStatus:()=>course}});
 assert.equal(api.readiness().kanji.recommended,true);
 course={startedAt:1,kanjiReady:false,checkpointAt:0};assert.equal(api.readiness().kanji.recommended,false);
 course={startedAt:1,kanjiReady:true,checkpointAt:10};assert.equal(api.readiness().kanji.recommended,true);assert.equal(api.readiness().kanji.checkpointAt,10);
 course={startedAt:1,kanjiReady:true,checkpointAt:0,legacyEligible:true};assert.equal(api.readiness().kanji.recommended,true);
});

function branchesFixture(last){
 const fs=require('node:fs'),vm=require('node:vm');
 const action=(title,href)=>({kind:'resume',title,label:'Resume',detail:'Saved task',href});
 const root={ModeAtlasStorage:{json:()=>last},ModeAtlasStudyPlan:{recommend:()=>action('Kana saved lesson','/kana/?view=course&script=katakana')},
  ModeAtlasKanjiState:{nextAction:()=>action('Kanji saved lesson','/kanji/?continue=1')},
  ModeAtlasVocabulary:{nextAction:()=>action('Words saved lesson','/wordbank/?view=course&session=course')},
  ModeAtlasWordLessonState:{read:()=>({}),due:()=>[]},ModeAtlasWordBank:{nextAction:()=>action('Bank saved lesson','/wordbank/?view=bank&session=bank')}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/app/mode-atlas-branches.js'),'utf8'),{window:root,location:{pathname:'/'}});
 return root;
}
test('Home consumes each branch action unchanged and preserves explicit personal-bank context',()=>{
 const root=branchesFixture({branchId:'words',href:'/wordbank/'});
 assert.equal(root.ModeAtlasBranches.nextAction().href,'/wordbank/?view=course&session=course');
 assert.equal(root.ModeAtlasBranches.items.find(item=>item.id==='words').name,'Words');
 const bank=branchesFixture({branchId:'words',href:'/wordbank/?view=bank'});
 assert.equal(bank.ModeAtlasBranches.nextAction().href,'/wordbank/?view=bank&session=bank');
 const kana=branchesFixture({branchId:'kana'});
 assert.equal(kana.ModeAtlasBranches.nextAction().href,'/kana/?view=course&script=katakana');
 assert.equal(kana.ModeAtlasBranches.nextAction().label,'Resume');
 const kanji=branchesFixture({branchId:'kanji'});assert.equal(kanji.ModeAtlasBranches.nextAction().href,'/kanji/?continue=1');
});
test('a Words prerequisite action keeps the destination branch identity supplied by the course',()=>{
 const root=branchesFixture({branchId:'words'});
 root.ModeAtlasVocabulary.nextAction=()=>({branchId:'kana',kind:'resume',title:'Continue your row',label:'Continue Kana',detail:'',href:'/kana/?view=course&script=hiragana'});
 const next=root.ModeAtlasBranches.nextAction();assert.equal(next.branchId,'kana');assert.equal(next.meta,'Kana');assert.equal(next.href,'/kana/?view=course&script=hiragana');
});
test('legacy phrase continuation ignores saved word courses and keeps its own unfinished lesson',()=>{
 const root=branchesFixture({branchId:'words',href:'/wordbank/?view=phrases'});
 root.ModeAtlasWordLessonState.read=()=>({'wordbank-course':{startedAt:1,updatedAt:100,phase:'meet',course:{}},'vocab-saved':{startedAt:1,updatedAt:90,phase:'meet',vocabulary:{}},greetings:{startedAt:1,updatedAt:2,phase:'practise'}});
 assert.equal(root.ModeAtlasBranches.nextAction().href,'/wordbank/?lesson=greetings');
});

test('successful activity preserves the course or collection route without treating page visits as study',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),values=new Map(),events=[];
 const location={href:'https://mode-atlas.app/kana/?view=course&script=katakana',pathname:'/kana/',origin:'https://mode-atlas.app'};
 const root={dispatchEvent:event=>events.push(event.type),ModeAtlasStorage:{get:(key,fallback)=>values.get(key)??fallback,set:(key,value)=>values.set(key,value),setJSON:(key,value)=>values.set(key,value)}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/app/mode-atlas-visit-flows.js'),'utf8'),{window:root,location,document:{readyState:'loading',addEventListener(){}},URL,CustomEvent:class{constructor(type){this.type=type;}}});
 assert.equal(values.size,0);
 root.ModeAtlasVisitFlows.recordActivity('kana');assert.equal(values.get('modeAtlasLastMode').href,'/kana/?view=course&script=katakana');
 location.pathname='/wordbank/';location.href='https://mode-atlas.app/wordbank/?view=bank&session=bank';
 root.ModeAtlasVisitFlows.recordActivity('wordBank');assert.equal(values.get('modeAtlasLastMode').href,'/wordbank/?view=bank&session=bank');
 assert.equal(values.get('modeAtlasLastMode').branchId,'words');assert.deepEqual(events,['modeAtlasActivityChanged','modeAtlasActivityChanged']);
 root.ModeAtlasVisitFlows.recordActivity('unknown');assert.equal(events.length,2);
});
