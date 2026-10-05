/* Versioned reward policy; the progression owner alone persists awards. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.ModeAtlasRewardRules = factory();
})(typeof window !== 'undefined' ? window : globalThis, function ModeAtlasRewardRules(){
  'use strict';
  function accuracy(value){return value>=1?50:value>=.9?35:value>=.8?20:0;}
  function kanaRate(poolSize=5,assisted=false){
    const size=Math.max(1,Number(poolSize)||5);
    const base=size>=150?8:size>=90?7:size>=45?6:size>=20?4:size>=10?3:2;
    return assisted?Math.max(1,Math.floor(base/2)):base;
  }
  function levelRequirement(level){
    const n=Math.max(1,Math.min(999,Math.floor(Number(level)||1)));
    if(n<=5)return 100+(n-1)*50;
    if(n<=10)return 300+(n-5)*140;
    return Math.round((1000+180*(n-10)+18*(n-10)**2)/10)*10;
  }
  function session(input){
    const ratio=input.answered?input.correct/input.answered:0;
    const eligible=input.answered>=10&&input.unique>=3&&ratio>=.25;
    const precision=eligible&&!input.assisted&&!input.hintsEnabled?accuracy(ratio):0;
    const streak=eligible&&!input.assisted&&!input.hintsEnabled?(input.bestStreak>=50?60:input.bestStreak>=25?35:input.bestStreak>=10?15:0):0;
    const finite=['guided','dailyChallenge','testMode','speedRun','timeTrial'].includes(input.mode);
    const scale=kanaRate(input.poolSize,input.hintsEnabled)/8;
    const scaled=value=>Math.round(value*scale);
    return {eligible,completion:eligible&&input.completed&&input.mode==='guided'?scaled(input.count*2):0,
      accuracy:eligible&&input.completed&&finite?scaled(precision):0,streak:scaled(streak),
      daily:eligible&&input.completed&&input.mode==='dailyChallenge'?scaled(60+precision):0,
      test:eligible&&input.completed&&input.mode==='testMode'?scaled(Math.min(150,50+50*Math.floor(input.unique/50))+precision):0};
  }
  // Metrics belong to branches; the rotation only includes launched branches.
  // A new branch adds its templates here and records namespaced activity through
  // ModeAtlasProgress.recordActivity, using the same durable run receipts.
  const goalBranches=Object.freeze(['kana']);
  const goal=(id,period,slot,label,short,target,xp,metric,branch='kana')=>Object.freeze({id,period,slot,label,short,target,xp,metric,branch});
  const goalPool=Object.freeze([
    goal('recall-25','daily',0,'Recall 25 kana','25 correct',25,40,'kana.correct'),
    goal('read-20','daily',0,'Read 20 kana correctly','20 Reading',20,40,'kana.reading'),
    goal('write-20','daily',0,'Write 20 kana correctly','20 Writing',20,40,'kana.writing'),
    goal('recall-40','daily',0,'Recall 40 kana','40 correct',40,60,'kana.correct'),
    goal('independent-20','daily',0,'Recall 20 kana without hints','No hints',20,50,'kana.independent'),
    goal('balance-10','daily',1,'Read 10 and write 10 correctly','Both directions',20,60,'kana.balance'),
    goal('variety-12','daily',1,'Recall 12 different kana','12 different',12,50,'kana.variety'),
    goal('katakana-15','daily',1,'Recall 15 katakana','15 katakana',15,50,'kana.katakana'),
    goal('hiragana-20','daily',1,'Recall 20 hiragana','20 hiragana',20,40,'kana.hiragana'),
    goal('broad-15','daily',1,'Recall 15 kana from a pool of at least 45','Wider practice',15,60,'kana.broad'),
    goal('guided-1','daily',2,'Complete a guided set','Finish a set',1,40,'kana.guided'),
    goal('sessions-2','daily',2,'Finish 2 sessions of at least 10 answers','Two sessions',2,60,'kana.sessions'),
    goal('streak-10','daily',2,'Reach a 10-answer streak without hints','10 in a row',10,50,'kana.streak'),
    goal('daily-1','daily',2,'Complete a Daily Challenge','Daily Challenge',1,60,'kana.daily'),
    goal('precision-1','daily',2,'Complete a set with 90% accuracy and no hints','Precise practice',1,60,'kana.precise'),
    goal('days-3','weekly',0,'Practise on 3 days this week','3 study days',3,200,'study.days'),
    goal('days-4','weekly',0,'Practise on 4 days this week','4 study days',4,250,'study.days'),
    goal('goals-8','weekly',0,'Complete 8 daily goals this week','8 daily goals',8,250,'study.goals'),
    goal('days-5','weekly',0,'Practise on 5 days this week','5 study days',5,300,'study.days'),
    goal('recall-250','weekly',1,'Recall 250 kana this week','250 correct',250,250,'kana.correct'),
    goal('guided-6','weekly',1,'Complete 6 guided sets this week','6 guided sets',6,250,'kana.guided'),
    goal('variety-60','weekly',1,'Recall 60 different kana this week','60 different',60,250,'kana.variety'),
    goal('tests-2','weekly',1,'Complete 2 formal tests this week','2 formal tests',2,300,'kana.tests'),
    goal('independent-200','weekly',1,'Recall 200 kana without hints this week','Independent recall',200,250,'kana.independent')
  ]);
  const goalCatalogue=Object.freeze([...goalPool,
    goal('days-1','weekly',0,'Practise on 1 day this week','1 study day',1,60,'study.days'),
    goal('days-2','weekly',0,'Practise on 2 days this week','2 study days',2,120,'study.days'),
    goal('recall-50','weekly',1,'Recall 50 kana this week','50 correct',50,100,'kana.correct'),
    goal('guided-2','weekly',1,'Complete 2 guided sets this week','2 guided sets',2,100,'kana.guided')
  ]);
  function suitable(goal,profile){
    const {metric,target,period}=goal,days=profile.daysAvailable||7;
    if(metric==='kana.katakana'&&profile.katakana<5)return false;
    if(metric==='kana.variety'&&profile.variety<target)return false;
    if(['kana.broad','kana.tests'].includes(metric)&&profile.variety<45)return false;
    if(['kana.independent','kana.streak','kana.precise','kana.tests'].includes(metric)&&profile.independent<20)return false;
    if(metric==='kana.daily'&&profile.variety<20)return false;
    if(period==='weekly'){
      if(metric==='study.days')return target<=days&&(target>=3||target===Math.min(days,2));
      if(metric==='study.goals'&&days<3)return false;
      if(metric==='kana.correct')return target<100?days<5:days>=5;
      if(metric==='kana.guided')return target<3?days<3:days>=3;
      if(metric==='kana.independent'&&days<4)return false;
    }
    return true;
  }
  function goals(key,period,profile){
    const ordinal=Math.floor(Date.parse(key+'T12:00:00Z')/86400000/(period==='weekly'?7:1));
    if(!Number.isFinite(ordinal))return [];
    const catalogue=profile?goalCatalogue:goalPool;
    return [...new Set(catalogue.filter(g=>g.period===period).map(g=>g.slot))].map(slot=>{
      const pool=catalogue.filter(g=>g.period===period&&g.slot===slot&&goalBranches.includes(g.branch)&&(!profile||suitable(g,profile)));
      return pool[((ordinal+slot*3)%pool.length+pool.length)%pool.length];
    }).filter(Boolean);
  }
  const landmarks=Object.freeze([
    {id:'trail',level:1,title:'Trail Finder',name:'First trail',symbol:'◇',frame:'plain',icon:null},
    {id:'grove',level:5,title:'Grove Explorer',name:'Kana grove',symbol:'♧',frame:'grove',icon:'Grove'},
    {id:'bridge',level:10,title:'Bridge Builder',name:'Recall bridge',symbol:'⌁',frame:'bridge',icon:null},
    {id:'summit',level:20,title:'Summit Seeker',name:'Memory summit',symbol:'△',frame:'summit',icon:'Summit'},
    {id:'lantern',level:35,title:'Lantern Keeper',name:'Lantern passage',symbol:'✧',frame:'lantern',icon:null},
    {id:'horizon',level:50,title:'Horizon Explorer',name:'Open horizon',symbol:'◎',frame:'horizon',icon:'Horizon'}
  ].map(Object.freeze));
  // A grant may unlock one item or a coordinated event set across categories.
  // Audience rules and award windows belong to the server, never this catalogue.
  const banners=Object.freeze([{id:'plain',level:1,name:'Original'},...landmarks.map(({id,level,name})=>({id,level,name:id==='trail'?'First light':name})),
    {id:'hunny',name:'Hunny',grant:'hunny-tester',kind:'exclusive'}].map(Object.freeze));
  const icons=Object.freeze([{id:'original',name:'Original',icon:null,level:1},...landmarks.filter(item=>item.icon).map(item=>({id:item.id,name:item.icon,icon:item.icon,level:item.level}))].map(Object.freeze));
  const avatars=Object.freeze([
    {id:'kana',symbol:'あ',name:'Hiragana',level:1},{id:'katakana',symbol:'ア',name:'Katakana',level:1},
    {id:'book',symbol:'本',name:'Book',level:1},{id:'sakura',symbol:'桜',name:'Cherry blossom',level:1},
    {id:'mountain',symbol:'山',name:'Mountain',level:1},{id:'moon',symbol:'月',name:'Moon',level:1}
  ].map(Object.freeze));
  const catalogue=Object.freeze({banners,frames:landmarks,icons,avatars});
  function item(type,id){return catalogue[type]?.find(reward=>reward.id===id)||null;}
  function unlocked(reward,level,access={}){
    if(!reward)return false;
    return reward.grant?access?.allCustom===true||Array.isArray(access?.grants)&&access.grants.includes(reward.grant):Number(level)>=reward.level;
  }
  function visible(reward,level,access){return !!reward&&(!reward.grant||unlocked(reward,level,access));}
  function allowed(type,id,level,access){return unlocked(item(type,id),level,access);}
  function appearance(id,level,access){const reward=item('frames',id);return unlocked(reward,level,access)?reward:landmarks[0];}
  function banner(id,level,access){const reward=item('banners',id);return unlocked(reward,level,access)?reward:banners[0];}
  return Object.freeze({accuracy,kanaRate,levelRequirement,session,goalBranches,goalPool,goalCatalogue,goals,landmarks,appearance,banners,banner,icons,avatars,catalogue,item,unlocked,visible,allowed});
});
