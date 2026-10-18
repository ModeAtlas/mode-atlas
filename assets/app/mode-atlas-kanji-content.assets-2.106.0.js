/* Lazy dictionary loading and pure answer policy. The same grading owner is
   packaged for verified weekly answers; it never reads or writes user data. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasKanjiContent=factory(root);
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  let pending,index;
  const hira=s=>String(s||'').normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
  const mappings=Object.assign({},...Object.values(root.ModeAtlasKanaData.maps));
  const kanaPairs=Object.entries(mappings).filter(([kana])=>kana===hira(kana)).sort((a,b)=>b[0].length-a[0].length);
  const romanPairs=[...new Map([...kanaPairs.map(([kana,roman])=>[roman,kana]),['ji','じ'],['zu','ず'],['di','ぢ'],['du','づ'],['si','し'],['ti','ち'],['tu','つ'],['hu','ふ']]).entries()].sort((a,b)=>b[0].length-a[0].length);
  function romaji(text){
    let s=hira(text),out='',geminate=false;
    while(s){
      if(s[0]==='っ'){geminate=true;s=s.slice(1);continue;}
      const pair=kanaPairs.find(([kana])=>s.startsWith(kana));
      if(pair){let r=pair[1];if(pair[0]==='ん'&&/^[あいうえおやゆよ]/.test(s.slice(1)))r="n'";if(geminate&&/^[bcdfghjklmpqrstvwxyz]/.test(r)){r=(r.startsWith('ch')?'t':r[0])+r;geminate=false;}out+=r;s=s.slice(pair[0].length);}
      else{out+=s[0];s=s.slice(1);}
    }return out;
  }
  function kana(text){
    let s=hira(text).trim().toLowerCase().replace(/\s+/g,''),out='';
    while(s){
      if(/^[bcdfghjklmpqrstvwxyz]/.test(s)&&s[0]===s[1]){out+='っ';s=s.slice(1);continue;}
      if(s[0]==='n'&&(s.length===1||s[1]==="'"||s[1]==='n'||!/^[aeiouy]/.test(s.slice(1)))){out+='ん';s=s.slice(s[1]==="'"||s==='nn'||s.startsWith('nn')&&!/^[aeiouy]/.test(s.slice(2))?2:1);continue;}
      const pair=romanPairs.find(([roman])=>s.startsWith(roman));
      if(pair){out+=pair[1];s=s.slice(pair[0].length);}else{out+=s[0];s=s.slice(1);}
    }return out;
  }
  function english(value){
    return String(value||'').normalize('NFKC').trim().toLowerCase().replace(/\([^)]*\)/g,'').replace(/^(?:to|a|an|the)\s+/,'').replace(/colour/g,'color').replace(/centre/g,'center').replace(/grey/g,'gray').replace(/[^a-z0-9]/g,'');
  }
  function entries(){return root.ModeAtlasKanjiData||[];}
  function get(char){if(!index&&entries().length)index=new Map(entries().map(row=>[row.char,row]));return index?.get(char);}
  function load(){
    if(entries().length)return Promise.resolve(entries());
    if(pending)return pending;
    pending=new Promise((resolve,reject)=>{
      const script=root.document.createElement('script');
      script.src='/assets/data/mode-atlas-kanji-data.'+root.ModeAtlasCacheRevision+'.js';
      script.onload=()=>entries().length?resolve(entries()):reject(new Error('Kanji content could not load.'));
      script.onerror=()=>{script.remove();pending=null;reject(new Error('Kanji content could not load. Try again when connected.'));};
      root.document.head.append(script);
    });return pending;
  }
  function pronunciation(entry){
    if(entry.example)return {prompt:entry.example.word,answers:entry.example.readings.map(hira),kind:'word',gloss:entry.example.meanings.join(' · ')};
    if(entry.on.length)return {prompt:entry.char,answers:entry.on.map(hira),kind:'on',gloss:entry.meanings.join(' · ')};
    const reading=entry.kun.find(s=>!s.includes('-'))||entry.kun[0];
    return {prompt:entry.char+(reading.split('.')[1]||''),answers:[hira(reading.replace(/[.-]/g,''))],kind:'word',gloss:entry.meanings.join(' · ')};
  }
  function meaningAnswers(entry){
    const values=entry.meanings.flatMap(s=>[s,...s.split(/[,;]/)]);
    const numbers={'一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10','百':'100','千':'1000','万':'10000'};
    if(numbers[entry.char])values.push(numbers[entry.char]);
    return [...new Set(values.map(english).filter(Boolean))];
  }
  function grade(char,mode,answer){
    const entry=get(char);if(!entry||String(answer).length>160)return false;
    return mode==='pronunciation'?pronunciation(entry).answers.includes(kana(answer)):['meaning','match'].includes(mode)&&meaningAnswers(entry).includes(english(answer));
  }
  function hash(s){let n=2166136261;for(const c of String(s))n=Math.imul(n^c.codePointAt(0),16777619);return n>>>0;}
  function choices(char,seed){
    const entry=get(char),correct=entry.meanings[0],answers=new Set(meaningAnswers(entry));
    const seen=new Set([english(correct)]);
    // Prefer familiar alternatives from this band and avoid near-synonyms
    // that could make more than one option defensible.
    const groups=[['soil','earth','ground','land'],['sun','day','sunlight'],['moon','month'],['wood','tree','timber'],['river','stream'],['fire','flame'],['water','liquid'],['big','large','great','huge'],['little','small','tiny'],['man','male','boy'],['woman','female','girl'],['person','people','human'],['study','learn','learning'],['say','speak','talk','speech']].map(g=>g.map(english));
    for(const group of groups)if(group.some(m=>answers.has(m)))for(const m of group)answers.add(m);
    const distractors=entries().filter(r=>r.char!==char&&!meaningAnswers(r).some(m=>answers.has(m))).sort((a,b)=>Number(a.level!==entry.level)-Number(b.level!==entry.level)||hash(seed+a.char)-hash(seed+b.char));
    const out=[correct];
    for(const candidate of distractors){const word=candidate.meanings[0],key=english(word);if(seen.has(key)||word.length>70)continue;out.push(word);seen.add(key);if(out.length===4)break;}
    return out.sort((a,b)=>hash(seed+a)-hash(seed+b));
  }
  function description(entry){
    if(entry.example)return {ja:`「${entry.example.kana}」という ことばに でてくる かんじです。よみかたは、ことばによって かわります。`,en:`In ${entry.example.word}, this character helps form “${entry.example.meanings[0]}”. Its pronunciation can change with the word.`};
    return {ja:'かんじには、いくつかの よみかたが あります。おんよみと くんよみを みくらべましょう。',en:`This character can mean “${entry.meanings[0]}”. Compare its on’yomi (used in many compounds) and kun’yomi (Japanese word readings).`};
  }
  return Object.freeze({load,entries,get,hira,kana,romaji,english,pronunciation,meaningAnswers,grade,hash,choices,description});
});
