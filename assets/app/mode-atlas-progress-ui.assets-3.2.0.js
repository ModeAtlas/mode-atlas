/* Session rewards and celebrations share one presentation owner. Learning
   controllers capture a baseline; this owner presents only at a natural break. */
(function ModeAtlasProgressUi(root){
  'use strict';
  if(root.ModeAtlasProgressUI)return;
  let pendingLevelUp=null,activePresentation=null,accountGeneration=0;
  const presented=new Set();
  const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
  function queueLevelUp(detail={}){
    const level=Math.max(1,Math.floor(Number(detail.level||1))),previousLevel=Math.max(1,Math.floor(Number(detail.previousLevel||level)));
    if(level<=previousLevel)return false;
    pendingLevelUp={...(pendingLevelUp?.level>level?pendingLevelUp:detail),level:Math.max(level,pendingLevelUp?.level||1),previousLevel:Math.min(previousLevel,pendingLevelUp?.previousLevel||previousLevel)};
    return true;
  }
  function levelUpContent(summary){
    const wrap=el('div','ma-level-up-card'),copy=el('div','ma-level-up-copy'),emblem=el('div','ma-level-up-emblem');
    emblem.append(root.ModeAtlasAchievementArt.badge('atlas-level',Math.min(4,Math.floor(summary.level/10)),{earned:true,showRank:false}));
    const number=el('strong','ma-level-up-number',String(summary.level));number.setAttribute('aria-label',`Atlas Level ${summary.level}`);emblem.append(number);
    const remaining=Math.max(0,summary.levelRequirement-summary.levelXp);
    wrap.append(emblem,copy);copy.append(el('p','ma-level-up-label',`Level ${summary.previousLevel} → ${summary.level}`),el('h3','','A new height.'),el('p','',summary.level-summary.previousLevel>1?`${summary.level-summary.previousLevel} levels gained. Your practice is adding up.`:'Your practice is adding up. Keep building on it.'));
    const unlocks=root.ModeAtlasRewardRules.landmarks.filter(item=>item.level>summary.previousLevel&&item.level<=summary.level);
    if(unlocks.length)copy.append(el('p','ma-level-up-unlocks',`Unlocked: ${unlocks.map(item=>item.title).join(', ')}`));
    copy.append(el('p','ma-level-up-next',`${remaining.toLocaleString()} XP to Level ${summary.level+1}`));
    const next=el('button','ma-button ma-button--primary','Continue');next.type='button';next.addEventListener('click',()=>root.ModeAtlasDialog.close());copy.append(next);return wrap;
  }
  function naturalBreak(){
    if(activePresentation)return activePresentation;
    if(!pendingLevelUp||!root.ModeAtlasDialog?.feature||root.ModeAtlasDialog.isOpen())return Promise.resolve(false);
    const summary=pendingLevelUp;pendingLevelUp=null;
    root.ModeAtlasFeedback?.haptic?.('milestone');
    const presentation=root.ModeAtlasDialog.feature({kicker:'Atlas Level',title:'Level up!',tone:'success',contentNode:levelUpContent(summary),presentation:'outcome',size:'wide'});
    activePresentation=presentation;
    presentation.finally(()=>{if(activePresentation===presentation)activePresentation=null;});
    return presentation;
  }
  function completeSession(session){
    if(!session?.runId||presented.has(session.runId))return Promise.resolve(false);
    presented.add(session.runId);
    // Bound this page-lifetime deduplication without changing saved learning data.
    if(presented.size>100)presented.delete(presented.values().next().value);
    const summary=root.ModeAtlasProgress.getSummary();
    if(Number.isFinite(session.startLevel)&&summary.level>session.startLevel)queueLevelUp({...summary,previousLevel:session.startLevel});
    return naturalBreak();
  }
  async function presentSession(session,showSummary){
    const generation=accountGeneration;
    await completeSession(session);
    if(generation===accountGeneration)return showSummary();
    return false;
  }
  function renderSessionReward(host,session){
    const summary=root.ModeAtlasProgress.getSummary(),card=el('section','ma-session-rewards');card.setAttribute('aria-label','Session rewards');
    const xp=Math.max(0,Number(session.xpGain||0));
    if(xp)card.append(el('strong','ma-session-rewards__xp',`+${xp} XP`));
    const parts=el('div','ma-session-rewards__parts');
    const names={answers:'Correct answers',completion:'Set complete',accuracy:'Accuracy',streak:'Best streak',review:'Spaced review',mastery:'Mastery milestones',goals:'Study goals',daily:'Daily completion & accuracy',test:'Test completion & accuracy'};
    for(const [key,value]of Object.entries(session.xpParts||{}))if(value){const line=el('span');line.append(el('span','',names[key]||key),el('strong','',`+${value}`));parts.append(line);}
    if(parts.childNodes.length)card.append(parts);
    const up=summary.level>session.startLevel;
    card.append(el('p','ma-session-rewards__level',up?`Level up · Atlas Level ${summary.level}`:`Atlas Level ${summary.level}`));
    const progress=el('progress','ma-session-rewards__progress');progress.max=summary.levelRequirement;progress.value=summary.levelXp;progress.setAttribute('aria-label',`Level ${summary.level} progress`);card.append(progress);
    card.append(el('p','ma-session-rewards__next',`${Math.max(0,summary.levelRequirement-summary.levelXp)} XP to Level ${summary.level+1}`));
    const seen=new Set();for(const item of session.milestones||[]){const id=item.kana+item.stage;if(seen.has(id))continue;seen.add(id);card.append(el('span','ma-session-rewards__milestone',`${item.kana} · ${root.ModeAtlasReview.labels[item.stage]}`));}
    const unlocked=root.ModeAtlasRewardRules.landmarks.filter(item=>item.level>session.startLevel&&item.level<=summary.level);
    if(unlocked.length)card.append(el('p','ma-session-rewards__unlock',`Unlocked: ${unlocked.map(item=>item.title).join(', ')}`));
    const earned=root.ModeAtlasFeatures.sessionAchievements(session.achievementStart);
    if(earned.length){
      const section=el('section','ma-session-achievements');section.append(el('h3','',earned.length===1?'Achievement earned':'Achievements earned'));
      const list=el('ul','ma-session-achievements__list');
      for(const item of earned){const row=el('li');row.append(root.ModeAtlasAchievementArt.badge(item.trackId,item.rankIndex,{earned:true}));const copy=el('div');copy.append(el('strong','',item.name),el('span','',item.ranked?`Rank ${item.tier}`:'Earned'));row.append(copy);list.append(row);}section.append(list);card.append(section);
    }
    const rewards=el('button','ma-button ma-button--ghost ma-button--small','Progress');rewards.type='button';rewards.addEventListener('click',()=>{root.ModeAtlasDialog.close();setTimeout(()=>root.ModeAtlasRewardsUI.open(),0);});card.append(rewards);
    if(root.ModeAtlasLearningExperience?.snapshot().stage!=='returning'){const details=el('details','ma-study-summary__details');details.append(el('summary','','Rewards from this practice'),card);host.append(details);}else host.append(card);root.ModeAtlasFeedback?.haptic?.('complete');
  }
  root.addEventListener('modeAtlasProgressChanged',event=>queueLevelUp(event.detail||{}));
  for(const name of ['modeAtlasAccountWillChange','modeAtlasAccountSignedOut','modeAtlasDataCleared'])root.addEventListener(name,()=>{accountGeneration++;pendingLevelUp=null;presented.clear();if(activePresentation){root.ModeAtlasDialog.close();activePresentation=null;}});
  root.ModeAtlasProgressUI=Object.freeze({queueLevelUp,renderSessionReward,naturalBreak,completeSession,presentSession,hasPendingLevelUp:()=>!!pendingLevelUp});
})(window);
