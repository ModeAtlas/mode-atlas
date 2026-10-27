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
    const library=el('div');host.append(library);
    function refresh(){
      const experience=root.ModeAtlasLearningExperience.snapshot();
      root.ModeAtlasBranchLibrary.render(library,{experience});
    }
    refresh();for(const event of ['modeAtlasCloudDataChanged','modeAtlasProgressChanged','modeAtlasWordsChanged','modeAtlasWordLessonsChanged','modeAtlasKanaLearningChanged'])root.addEventListener(event,refresh);
  }
})(window);
