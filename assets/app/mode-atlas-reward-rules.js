/* Versioned reward policy; the progression owner alone persists awards. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.ModeAtlasRewardRules = factory();
})(typeof window !== 'undefined' ? window : globalThis, function ModeAtlasRewardRules(){
  'use strict';
  function accuracy(value){return value>=1?15:value>=.9?10:value>=.8?5:0;}
  function session(input){
    const ratio=input.answered?input.correct/input.answered:0;
    const eligible=input.answered>=10&&input.unique>=3&&ratio>=.25;
    const precision=eligible&&!input.assisted?accuracy(ratio):0;
    const streak=eligible&&!input.assisted?(input.bestStreak>=50?15:input.bestStreak>=25?10:input.bestStreak>=10?5:0):0;
    const finite=['guided','dailyChallenge','testMode','speedRun','timeTrial'].includes(input.mode);
    return {completion:eligible&&input.completed&&input.mode==='guided'?Math.floor(input.count/2):0,
      accuracy:eligible&&input.completed&&finite?precision:0,streak,
      daily:eligible&&input.completed&&input.mode==='dailyChallenge'?10+precision:0,
      test:eligible&&input.completed&&input.mode==='testMode'?Math.min(30,10+10*Math.floor(input.unique/50))+precision:0};
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
  return Object.freeze({accuracy,session,landmarks,appearance,banners,banner,icons,avatars,catalogue,item,unlocked,visible,allowed});
});
