(function ModeAtlasProgressUi(root){
  'use strict';
  if (root.ModeAtlasProgressUI) return;

  let pendingLevelUp = null;
  let activePresentation = null;

  function queueLevelUp(detail = {}){
    const level = Math.max(1, Math.floor(Number(detail.level || 1)));
    const previousLevel = Math.max(1, Math.floor(Number(detail.previousLevel || level)));
    if (level <= previousLevel) return false;
    if (!pendingLevelUp || level >= pendingLevelUp.level) {
      pendingLevelUp = {
        level,
        previousLevel,
        xp: Math.max(0, Math.floor(Number(detail.xp || 0))),
        levelXp: Math.max(0, Math.floor(Number(detail.levelXp || 0))),
        levelRequirement: Math.max(1, Math.floor(Number(detail.levelRequirement || 1)))
      };
    }
    return true;
  }

  function levelUpContent(summary){
    const wrap = document.createElement('div');
    wrap.className = 'ma-level-up-card';
    const badge = document.createElement('div');
    badge.className = 'ma-level-up-badge';
    badge.textContent = String(summary.level);
    const label = document.createElement('div');
    label.className = 'ma-level-up-label';
    label.textContent = 'Atlas Level';
    const copy = document.createElement('p');
    const remaining = Math.max(0, summary.levelRequirement - summary.levelXp);
    copy.textContent = remaining > 0
      ? `You reached Atlas Level ${summary.level}. ${remaining.toLocaleString()} XP to Level ${summary.level + 1}.`
      : `You reached Atlas Level ${summary.level}.`;
    wrap.append(badge, label, copy);
    return wrap;
  }

  function renderSessionReward(host,session){
    const summary=root.ModeAtlasProgress.getSummary();
    if(pendingLevelUp&&pendingLevelUp.level<=summary.level)pendingLevelUp=null;
    const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
    const card=el('section','ma-session-rewards');card.setAttribute('aria-label','Session rewards');
    card.append(el('strong','ma-session-rewards__xp',`+${session.xpGain} XP`));
    const parts=el('div','ma-session-rewards__parts');
    const names={answers:'Correct kana',completion:'Set complete',accuracy:'Accuracy',streak:'Best streak',review:'Spaced review',mastery:'Mastery milestones',goals:'Study goals',daily:'Daily completion & accuracy',test:'Test completion & accuracy'};
    for(const [key,value]of Object.entries(session.xpParts||{}))if(value){const line=el('span','','');line.append(el('span','',names[key]||key),el('strong','',`+${value}`));parts.append(line);}
    card.append(parts);
    const up=summary.level>session.startLevel;
    card.append(el('p','ma-session-rewards__level',up?`Level up · Atlas Level ${summary.level}`:`Atlas Level ${summary.level}`));
    const progress=el('progress','ma-session-rewards__progress');progress.max=summary.levelRequirement;progress.value=summary.levelXp;progress.setAttribute('aria-label',`Level ${summary.level} progress`);card.append(progress);
    card.append(el('p','ma-session-rewards__next',`${summary.levelRequirement-summary.levelXp} XP to Level ${summary.level+1}`));
    const seen=new Set();for(const item of session.milestones||[]){const id=item.kana+item.stage;if(seen.has(id))continue;seen.add(id);card.append(el('span','ma-session-rewards__milestone',`${item.kana} · ${root.ModeAtlasReview.labels[item.stage]}`));}
    const unlocked=root.ModeAtlasRewardRules.landmarks.filter(item=>item.level>session.startLevel&&item.level<=summary.level);
    if(unlocked.length)card.append(el('p','ma-session-rewards__unlock',`Unlocked: ${unlocked.map(item=>item.title).join(', ')}`));
    const rewards=el('button','ma-button ma-button--ghost ma-button--small','Progress');rewards.type='button';
    rewards.addEventListener('click',()=>{root.ModeAtlasDialog.close();setTimeout(()=>root.ModeAtlasRewardsUI.open(),0);});card.append(rewards);
    host.append(card);
    root.ModeAtlasFeedback?.haptic?.(up?'milestone':'complete');
  }

  function naturalBreak(reason = 'natural-break'){
    if (activePresentation) return activePresentation;
    if (!pendingLevelUp || !root.ModeAtlasDialog?.feature) return Promise.resolve(false);
    const summary = pendingLevelUp;
    pendingLevelUp = null;
    activePresentation = root.ModeAtlasDialog.feature({
      kicker: 'Atlas Level',
      title: 'Level up',
      tone: 'success',
      contentNode: levelUpContent(summary)
    }).finally(() => {
      activePresentation = null;
      if (pendingLevelUp) queueMicrotask(() => naturalBreak(reason));
    });
    return activePresentation;
  }

  root.addEventListener('modeAtlasProgressChanged', (event) => {
    queueLevelUp(event.detail || {});
  });

  root.ModeAtlasProgressUI = Object.freeze({
    queueLevelUp, renderSessionReward,
    naturalBreak,
    hasPendingLevelUp(){ return !!pendingLevelUp; }
  });
})(window);
