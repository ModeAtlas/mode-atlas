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
    queueLevelUp,
    naturalBreak,
    hasPendingLevelUp(){ return !!pendingLevelUp; }
  });
})(window);
