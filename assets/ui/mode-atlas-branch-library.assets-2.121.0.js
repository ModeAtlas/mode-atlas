/* Branch discovery has one presentation owner for Home and Learn.
   Destinations enter the real branch controllers; this module owns no progress. */
(function(root){
  'use strict';
  const branches=root.ModeAtlasBranches.items;
  function render(host,{compact=false}={}){
    if(!host)return;
    host.replaceChildren();host.className='ma-branch-library'+(compact?' ma-branch-library--compact':'');
    for(const [index,branch]of branches.entries()){
      const link=document.createElement('a');link.className='ma-branch-tile';link.href=branch.href;
      link.dataset.branch=branch.id;link.setAttribute('aria-label',branch.action);
      const art=document.createElement('img');art.src='/assets/illustrations/'+branch.id+'-scene.svg';art.alt='';art.width=480;art.height=300;art.decoding='async';
      const copy=document.createElement('span');copy.className='ma-branch-tile__copy';
      for(const [tag,cls,text]of [['span','number','0'+(index+1)],['strong','title',branch.name],['span','description',branch.description],['span','detail',branch.detail]]){
        const node=document.createElement(tag);node.className='ma-branch-tile__'+cls;node.textContent=text;copy.append(node);
      }
      link.append(art,copy);host.append(link);
    }
  }
  root.ModeAtlasBranchLibrary=Object.freeze({render});
})(window);
