/* Pure session rules. Existing save fields stay compatible with web and iOS. */
(function ModeAtlasPracticeModes(root){
  'use strict';
  const flags = ['endless','timeTrial','speedRun','dailyChallenge','testMode'];
  const list = Object.freeze([
    {id:'guided', label:'Guided set', detail:'10, 20 or 30 questions. Learn from each mistake.', action:'Start set', feedback:'learn'},
    {id:'free', label:'Free practice', detail:'No target or timer. Take your time with each kana.', action:'Start practice', feedback:'learn'},
    {id:'endless', label:'Endless', detail:'Keep your rhythm and build a personal best.', action:'Start endless', feedback:'quick'},
    {id:'speedRun', label:'Speed Run', detail:'60 seconds. Balance speed with accuracy.', action:'Start Speed Run', feedback:'quick'},
    {id:'timeTrial', label:'Time Trial', detail:'Choose a time limit and a correct-answer target.', action:'Start Time Trial', feedback:'quick'},
    {id:'dailyChallenge', label:'Daily Challenge', detail:'20 kana. Your first completed run sets today’s score.', action:'Start daily challenge', feedback:'quick'},
    {id:'testMode', label:'Test Mode', detail:'One full pass. Finish to save a formal result.', action:'Start test', feedback:'quick'}
  ].map(Object.freeze));
  function selected(settings = {}){
    return ['testMode','dailyChallenge','speedRun','timeTrial','endless'].find(key => settings[key])
      || ([10,20,30].includes(Number(settings.practiceCount)) && !settings.comboKana ? 'guided' : 'free');
  }
  function select(settings, id){
    if (!list.some(mode => mode.id === id)) return settings;
    flags.forEach(key => { settings[key] = key === id; });
    settings.practiceCount = id === 'guided' ? ([10,20,30].includes(Number(settings.practiceCount)) ? Number(settings.practiceCount) : 10) : 0;
    if (!['free','endless','timeTrial'].includes(id)) settings.comboKana = false;
    if (['dailyChallenge','testMode'].includes(id)) Object.assign(settings,{hint:false,focusWeak:false,confusableKana:false});
    return settings;
  }
  function normalize(settings){ return select(settings, selected(settings)); }
  function describe(settings){ return list.find(mode => mode.id === selected(settings)); }
  function timed(settings){ return !!(settings.timeTrial || settings.speedRun); }
  function fixedPool(settings){ return !!(settings.dailyChallenge || settings.testMode); }
  function trial(minutes, target){
    const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {minutes:Math.round(Math.max(.1, Math.min(60, finite(minutes,.5))) * 10) / 10,
      target:Math.round(Math.max(1, Math.min(1000, finite(target,20))))};
  }
  root.ModeAtlasPracticeModes = Object.freeze({list, selected, select, normalize, describe, timed, fixedPool, trial});
})(window);
