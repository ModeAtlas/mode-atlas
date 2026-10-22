/* Shared achievement artwork. The SVG sprite owns illustrations; this owner
   composes earned rank frames for the collection, detail and session recap. */
(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  function node(tag,attrs){const el=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));return el;}
  function badge(trackId,rank=0,{earned=false,showRank=true}={}){
    const tier=Math.min(4,Math.max(0,Number(rank)||0));
    const svg=node('svg',{viewBox:'0 0 140 156',class:'ma-ach-art','aria-hidden':'true',focusable:'false','data-rank':tier+1,'data-earned':earned});
    const outer=tier<2?'M34 9h72l24 24v70l-60 42-60-42V33Z':'M70 3 130 30v74l-60 43-60-43V30Z';
    svg.append(node('path',{d:outer,fill:'var(--ma-badge-metal)',stroke:'#243454','stroke-width':3}),node('path',{d:'M35 19h70l14 19v60l-49 35-49-35V38Z',fill:'#eef3ff',stroke:'#fff','stroke-width':2}));
    if(tier>=2)svg.append(node('path',{d:'M8 63 1 50v44l18 19M132 63l7-13v44l-18 19',fill:'var(--ma-badge-metal)',stroke:'#243454','stroke-width':2}));
    const url=root.ModeAtlasVersionFile?.appUrl?.('/assets/achievements/mode-atlas-badges.svg')||'/assets/achievements/mode-atlas-badges.svg';
    svg.append(node('use',{href:url+'#'+trackId,x:23,y:24,width:94,height:94}));
    if(showRank)for(let i=0;i<=tier;i++)svg.append(node('path',{d:'M-3-3h6v6h-6Z',transform:`translate(${70+(i-tier/2)*12} 130) rotate(45)`,fill:'#243454'}));
    return svg;
  }
  root.ModeAtlasAchievementArt=Object.freeze({badge});
})(window);
