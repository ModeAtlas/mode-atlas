/* Full-page learning, progress and social destinations reuse their feature owners. */
(function(root){
  'use strict';
  const kind=document.body.dataset.maHub,host=document.getElementById('maHubContent');
  if(!host)return;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;};
  if(kind==='progress'){
    root.ModeAtlasRewardsUI.mount(host);
  }else if(kind==='shop'){
    root.ModeAtlasShopUI.mount(host,{full:true});
  }else if(kind==='friends'){
    if(root.ModeAtlasSocial?.isEnabled())root.ModeAtlasSocialUI.mount(host);
    else host.append(el('p','ma-hub-note','Friends is not available yet. Your learning progress is still saved.'));
  }else if(kind==='learn'){
    const library=el('div');root.ModeAtlasBranchLibrary.render(library);host.append(library);
    const route=el('ol','ma-learning-route');route.setAttribute('aria-label','How learning works');
    for(const [index,label]of ['Discover','Practise','Remember','Master'].entries()){
      const step=el('li');step.append(el('span','',String(index+1).padStart(2,'0')),el('strong','',label));route.append(step);
    }
    const next=el('a','ma-learn-next'),copy=el('div'),heading=el('h2'),meta=el('p'),reason=el('p');
    heading.id='maLearnNextTitle';reason.id='maLearnNextReason';next.setAttribute('aria-labelledby',heading.id);
    copy.append(el('span','ma-kicker','PICK UP WHERE YOU LEFT OFF'),heading,reason,meta);
    next.append(copy,el('span','ma-learn-next__arrow','→'));
    function refresh(){
      const storage=root.ModeAtlasStorage,plan=root.ModeAtlasStudyPlan.recommend({
        readingSettings:storage.json('settings',undefined),writingSettings:storage.json('reverseSettings',undefined),
        readingStats:storage.readModeJSON('reading','charStats',{}),writingStats:storage.readModeJSON('writing','charStats',{}),
        readingReview:storage.readModeJSON('reading','srs',{}),writingReview:storage.readModeJSON('writing','srs',{})});
      next.href=plan.href;next.dataset.mode=plan.mode;heading.textContent=plan.title;
      meta.textContent=plan.meta;reason.textContent=plan.reason;
    }
    refresh();for(const event of ['modeAtlasCloudDataChanged','modeAtlasProgressChanged'])root.addEventListener(event,refresh);
    const support=el('div','ma-learn-support'),results=el('a','ma-learn-results');results.href='/results/';
    results.append(el('span','ma-kicker','YOUR RESULTS'),el('strong','','See how far you’ve come →'),el('span','','Kana and Kanji tests, together.'));
    support.append(next,results);host.append(route,support);
  }
})(window);
