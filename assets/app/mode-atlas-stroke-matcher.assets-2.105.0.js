/* Direction-aware trace guidance in KanjiVG's 109-unit coordinate space.
   This is tolerant stroke guidance, not handwriting recognition or mastery. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ModeAtlasStrokeMatcher=factory();})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const length=points=>points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
  function sample(points,count=32){
    const total=length(points);if(!total)return Array.from({length:count},()=>points[0]);
    const out=[points[0]];let segment=1,passed=0;
    for(let i=1;i<count-1;i++){
      const goal=total*i/(count-1);
      while(segment<points.length-1&&passed+distance(points[segment-1],points[segment])<goal){passed+=distance(points[segment-1],points[segment]);segment++;}
      const a=points[segment-1],b=points[segment],ratio=(goal-passed)/(distance(a,b)||1);
      out.push({x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio});
    }out.push(points.at(-1));return out;
  }
  function matches(points,reference){
    if(points.length<2||reference.length<2||[...points,...reference].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
    const actual=length(points),expected=length(reference);
    if(actual<2||actual<expected*.45||actual>expected*2.1)return false;
    if(distance(points[0],reference[0])>15||distance(points.at(-1),reference.at(-1))>19)return false;
    const a=sample(points),b=sample(reference),errors=a.map((p,i)=>distance(p,b[i]));
    return Math.max(...errors)<=24&&errors.reduce((x,y)=>x+y,0)/errors.length<=10;
  }
  return Object.freeze({matches,sample,length});
});
