/* Full-page learning, progress and social destinations reuse their feature owners. */
(function(root){
  'use strict';
  const kind=document.body.dataset.maHub,host=document.getElementById('maHubContent');
  if(!host)return;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;};
  if(kind==='progress'){
    root.ModeAtlasRewardsUI.mount(host);
    const achievements=el('button','ma-button ma-button--ghost','View achievements');achievements.type='button';achievements.dataset.maAchievementsOpen='';host.append(achievements);
  }else if(kind==='friends'){
    if(root.ModeAtlasSocial?.isEnabled())root.ModeAtlasSocialUI.mount(host);
    else host.append(el('p','ma-hub-note','Friends is not available yet. Your learning progress is still saved.'));
  }else if(kind==='learn'){
    const next=el('a','ma-hub-next'),heading=el('strong'),reason=el('span');next.append(el('small','','Recommended for you'),heading,reason);
    function refresh(){
      const storage=root.ModeAtlasStorage,plan=root.ModeAtlasStudyPlan.recommend({
        readingSettings:storage.json('settings',undefined),writingSettings:storage.json('reverseSettings',undefined),
        readingStats:storage.readModeJSON('reading','charStats',{}),writingStats:storage.readModeJSON('writing','charStats',{}),
        readingReview:storage.readModeJSON('reading','srs',{}),writingReview:storage.readModeJSON('writing','srs',{})});
      next.href=plan.href;heading.textContent=plan.title;reason.textContent=plan.meta+' · '+plan.reason;
    }
    host.append(next);refresh();
    for(const event of ['modeAtlasCloudDataChanged','modeAtlasProgressChanged'])root.addEventListener(event,refresh);
    const branches=el('div','ma-learning-branches');
    for(const [title,description,links]of [
      ['Kana','Build recognition and recall, then revisit the characters that need practice.',[['Overview','/kana/'],['Reading','/reading/'],['Writing','/writing/'],['Results','/results/']]],
      ['Word Bank','Keep vocabulary, meanings and notes together. Practice sessions are coming later.',[['Open Word Bank','/wordbank/']]]
    ]){
      const card=el('section','ma-learning-branch');card.append(el('h2','',title),el('p','',description));
      const actions=el('div','ma-learning-branch__actions');for(const [label,url]of links){const link=el('a','ma-button ma-button--ghost',label);link.href=url;actions.append(link);}card.append(actions);branches.append(card);
    }
    host.append(branches);
    const upcoming=el('details','ma-hub-upcoming');upcoming.append(el('summary','','More ways to learn'),el('p','','Listening, Grammar and Reading Comprehension are planned. They will appear here when ready.'));host.append(upcoming);
  }
})(window);
