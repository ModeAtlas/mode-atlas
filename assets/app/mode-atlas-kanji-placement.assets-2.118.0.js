/* Adaptive access assessment. It never awards XP, completion or mastery. */
(function(root){
  'use strict';
  const state=root.ModeAtlasKanjiState,content=root.ModeAtlasKanjiContent,KEY='modeAtlasKanjiPlacement';
  const owner=()=>root.KanaCloudSync?.getUser?.()?.uid||'guest';
  function begin(){const value={owner:owner(),id:root.crypto.randomUUID(),band:5,index:0,correct:0,misses:0,opened:[5],feedback:null,done:false};save(value);return value;}
  function save(value){if(!root.ModeAtlasStorage.setJSON(KEY,value))throw Error('Your starting-point check could not be saved.');return value;}
  function read(){const value=root.ModeAtlasStorage.json(KEY,null);return value?.owner===owner()&&[1,2,3,4,5].includes(value.band)&&Number.isInteger(value.index)&&value.index>=0&&value.index<8?value:null;}
  function question(value){
    const band=root.ModeAtlasKanjiCurriculum.find(b=>b.level===value.band);
    const chars=[...band.chars].sort((a,b)=>content.hash(value.id+a)-content.hash(value.id+b)).slice(0,4);
    return {char:chars[Math.floor(value.index/2)],skill:value.index%2?'pronunciation':'meaning'};
  }
  function answer(value,text){if(value.feedback||value.done)return value;const q=question(value),next=structuredClone(value),correct=content.grade(q.char,q.skill,text);next.correct+=Number(correct);next.misses+=Number(!correct);next.feedback={correct};return save(next);}
  function finish(value){
    const mode=value.opened.length===1&&value.correct<4?'beginner':'placement';
    state.enter(mode,value.opened);value.done=true;value.feedback=null;save(value);return value;
  }
  function next(value){
    if(!value.feedback)return value;const result=structuredClone(value);result.feedback=null;
    if(result.misses>=3)return finish(result);
    if(result.index===7){
      if(result.correct<6||result.band===1)return finish(result);
      result.band--;result.opened.push(result.band);result.index=0;result.correct=0;result.misses=0;
    }else result.index++;
    return save(result);
  }
  return void(root.ModeAtlasKanjiPlacement=Object.freeze({KEY,begin,read,question,answer,next,finish}));
})(window);
