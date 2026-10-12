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
    const icon=name=>{
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.classList.add('ma-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
      const use=document.createElementNS('http://www.w3.org/2000/svg','use');
      use.setAttribute('href','/assets/mode-atlas-icons.svg#icon-'+name);svg.append(use);return svg;
    };
    const layout=el('div','ma-learn-layout'),suggestion=el('section','ma-learn-suggestion');
    const next=el('a','ma-learn-next'),copy=el('div','ma-learn-next__copy');
    const heading=el('h2'),meta=el('p','ma-learn-next__meta'),reason=el('p','ma-learn-next__reason');
    heading.id='maLearnNextTitle';reason.id='maLearnNextReason';
    next.setAttribute('aria-labelledby',heading.id);next.setAttribute('aria-describedby',reason.id);
    copy.append(heading,meta);
    const art=el('span','ma-learn-next__art');art.setAttribute('aria-hidden','true');art.append(el('span','','あ'),el('span','','ア'));
    const start=el('span','ma-learn-next__start'),startLabel=el('span');start.append(startLabel,icon('arrow'));
    next.append(copy,art,reason,start);
    suggestion.append(el('p','ma-learn-eyebrow','Suggested for you'),next);
    function refresh(){
      const storage=root.ModeAtlasStorage,plan=root.ModeAtlasStudyPlan.recommend({
        readingSettings:storage.json('settings',undefined),writingSettings:storage.json('reverseSettings',undefined),
        readingStats:storage.readModeJSON('reading','charStats',{}),writingStats:storage.readModeJSON('writing','charStats',{}),
        readingReview:storage.readModeJSON('reading','srs',{}),writingReview:storage.readModeJSON('writing','srs',{})});
      next.href=plan.href;next.dataset.mode=plan.mode;heading.textContent=plan.title;
      meta.textContent=plan.meta;reason.textContent=plan.reason;
      startLabel.textContent=plan.mode==='writing'?'Start Writing':'Start Reading';
    }
    refresh();
    for(const event of ['modeAtlasCloudDataChanged','modeAtlasProgressChanged'])root.addEventListener(event,refresh);
    function learningLink(key,label,description,href,symbol,accessibleLabel=label){
      const link=el('a','ma-learn-row');link.href=href;link.dataset.subject=key;link.setAttribute('aria-label',accessibleLabel);
      const mark=el('span','ma-learn-row__mark');mark.setAttribute('aria-hidden','true');
      if(key==='reading'){mark.textContent='あ';mark.lang='ja';}else mark.append(icon(symbol));
      const text=el('span','ma-learn-row__copy'),detail=el('span','',description);detail.id='maLearnDetail-'+key;
      text.append(el('strong','',label),detail);link.setAttribute('aria-describedby',detail.id);
      link.append(mark,text,icon('chevron'));return link;
    }
    const library=el('div','ma-learn-library'),kana=el('section','ma-learn-kana');
    const sectionHeading=el('div','ma-learn-section-heading'),kanaHeading=el('h2','','Kana');kanaHeading.id='maLearnKanaTitle';kana.setAttribute('aria-labelledby',kanaHeading.id);
    const overview=el('a','','Overview');overview.href='/kana/';overview.setAttribute('aria-label','Kana overview');overview.append(icon('chevron'));
    sectionHeading.append(kanaHeading,overview);kana.append(sectionHeading);
    const practice=el('div','ma-learn-practice');
    practice.append(
      learningLink('reading','Reading','Recognise kana and their sounds.','/reading/'),
      learningLink('writing','Writing','Match sounds to the right kana.','/writing/','edit'),
      learningLink('results','Results','Look back at your saved tests.','/results/','chart')
    );
    kana.append(practice);library.append(kana);
    const words=el('section','ma-learn-words');words.setAttribute('aria-label','Vocabulary');
    words.append(learningLink('words','Word Bank','Your vocabulary, meanings and notes.','/wordbank/','book','Open Word Bank'));
    library.append(words);
    const upcoming=el('details','ma-learn-upcoming');upcoming.append(el('summary','','More ways to learn'),el('p','','Listening, Grammar and Reading Comprehension are planned. They will appear here when ready.'));library.append(upcoming);
    layout.append(suggestion,library);host.append(layout);
  }
})(window);
