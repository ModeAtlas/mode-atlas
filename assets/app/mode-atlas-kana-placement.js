/* Adaptive starting-point assessment. Placement opens course rows, never awards
   XP, correct-answer counters or mastery. Each direction/script stops at a gap. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasKanaPlacement=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const learning=root.ModeAtlasKanaLearning,KEY='modeAtlasKanaPlacementCheckpoint';
  const owner=()=>root.KanaCloudSync?.getUser?.()?.uid||'guest';
  const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
  function tracks(scripts){return scripts.flatMap(script=>['reading','writing'].map(skill=>({script,skill})));}
  function row(session){const track=session.tracks[session.track];return track?learning.rows.filter(r=>r.script===track.script&&r.group==='base')[session.row]:null;}
  function characters(session){const r=row(session);return r?[...r.chars].sort((a,b)=>hash(session.id+a)-hash(session.id+b)).slice(0,3):[];}
  function question(session){const r=row(session),char=characters(session)[session.question];return r&&char?{char,roman:learning.map[char],row:r,...session.tracks[session.track]}:null;}
  function create(scripts=['hiragana']){
    return {version:1,id:'placement-'+root.crypto.randomUUID(),owner:owner(),tracks:tracks(learning.scripts.filter(s=>scripts.includes(s))),track:0,row:0,question:0,rowCorrect:0,answered:0,correct:0,feedback:null,finished:false};
  }
  function valid(value){
    if(value?.version!==1||value.owner!==owner()||typeof value.id!=='string'||!/^placement-[a-zA-Z0-9-]{1,80}$/.test(value.id))return null;
    if(!Array.isArray(value.tracks)||!value.tracks.length||value.tracks.length>4||value.tracks.some(t=>!t||!learning.scripts.includes(t.script)||!['reading','writing'].includes(t.skill)))return null;
    if(![value.track,value.row,value.question,value.answered,value.correct].every(Number.isInteger)||value.track<0||value.track>value.tracks.length||value.row<0||value.row>9||value.question<0||value.question>2||value.answered<0||value.answered>120||value.correct<0||value.correct>value.answered)return null;
    if(new Set(value.tracks.map(t=>t.script+':'+t.skill)).size!==value.tracks.length||typeof value.finished!=='boolean')return null;
    if(!value.finished&&value.track===value.tracks.length)return null;
    if(value.feedback){const q=question(value);if(!q||typeof value.feedback.correct!=='boolean'||value.feedback.char!==q.char||value.feedback.roman!==q.roman)return null;}
    return value;
  }
  function read(){return valid(root.ModeAtlasStorage.json(KEY,null));}
  function save(session){if(!valid(session)||!root.ModeAtlasStorage.setJSON(KEY,session))throw new Error('Your starting-point check could not be saved. Please try again.');}
  function begin(scripts){learning.start('placement');const s=create(scripts);if(!s.tracks.length)throw new Error('Choose a script.');save(s);return s;}
  function grade(q,answer){
    if(q.skill==='writing')return String(answer).normalize('NFKC')===q.char;
    const actual=String(answer).normalize('NFKC').trim().toLowerCase(),expected=q.roman;
    const alternatives={shi:['si'],chi:['ti'],tsu:['tu'],fu:['hu'],ji:['zi'],wo:['o'],n:["n'",'nn']};
    return actual===expected||(alternatives[expected]||[]).includes(actual);
  }
  function answer(session,value){
    if(!valid(session)||session.finished||session.feedback)return session;
    const q=question(session);if(!q)return session;
    const next=structuredClone(session),correct=grade(q,value);next.answered++;if(correct)next.correct++;
    next.feedback={correct,char:q.char,roman:q.roman};save(next);return next;
  }
  function advance(session){
    if(!valid(session)||!session.feedback)return session;
    const next=structuredClone(session),r=row(next),pass=next.feedback.correct;
    next.rowCorrect=(next.rowCorrect||0)+Number(pass);
    const attempts=next.question+1;
    if(next.rowCorrect>=2){
      learning.place(next.tracks[next.track].skill,r.id);next.question=0;next.rowCorrect=0;next.row++;
      if(next.row===10){next.track++;next.row=0;}
    }else if(attempts-next.rowCorrect>=2||attempts===3){next.track++;next.row=0;next.question=0;next.rowCorrect=0;}
    else next.question++;
    next.feedback=null;next.finished=next.track>=next.tracks.length;save(next);return next;
  }
  function finish(session){const next=structuredClone(session);next.finished=true;next.feedback=null;save(next);return next;}
  function choices(session){
    const q=question(session);if(!q)return [];
    const all=learning.rows.filter(r=>r.script===q.script&&r.group==='base').flatMap(r=>r.chars);
    const rest=all.filter(c=>c!==q.char).sort((a,b)=>hash(session.id+q.char+a)-hash(session.id+q.char+b)).slice(0,5);
    return [q.char,...rest].sort((a,b)=>hash(q.char+a+session.id)-hash(q.char+b+session.id));
  }
  return Object.freeze({KEY,begin,read,save,valid,question,grade,answer,advance,finish,choices});
});
