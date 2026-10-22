/* Branch discovery has one presentation owner for Home and Learn.
   Destinations enter the real branch controllers; this module owns no progress. */
(function(root){
  'use strict';
  const branches=root.ModeAtlasBranches.items;
  function render(host,{compact=false,experience=root.ModeAtlasLearningExperience.snapshot()}={}){
    if(!host)return;
    host.replaceChildren();host.className='ma-branch-library'+(compact?' ma-branch-library--compact':'');
    for(const branch of branches){
      const link=document.createElement('a');link.className='ma-branch-tile';link.href=branch.href;
      link.dataset.branch=branch.id;link.setAttribute('aria-label',branch.action);
      const art=document.createElement('img');art.src='/assets/illustrations/'+branch.id+'-scene.svg';art.alt='';art.width=480;art.height=300;art.decoding='async';
      const copy=document.createElement('span');copy.className='ma-branch-tile__copy';
      const state=experience[branch.id],status=branch.id==='kana'?(state.attempts?`${state.familiar} familiar`:state.started?'Lesson in progress':''):branch.id==='kanji'?(state.attempts?`${state.studied} studied`:''):(state.saved?`${state.saved} saved · ${state.due} due`:'');
      const lines=[['strong','title',branch.name],['span','description',branch.description]];
      if(status)lines.push(['span','detail',status]);
      for(const [tag,cls,text]of lines){
        const node=document.createElement(tag);node.className='ma-branch-tile__'+cls;node.textContent=text;copy.append(node);
      }
      link.append(art,copy);host.append(link);
    }
  }
  root.ModeAtlasBranchLibrary=Object.freeze({render});
})(window);
