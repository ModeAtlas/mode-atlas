/* Shared identity policy. The server alone reserves names and supplies account photos. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ModeAtlasSocialIdentity=factory();
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const avatars=Object.freeze({kana:['あ','Hiragana'],katakana:['ア','Katakana'],book:['本','Book'],sakura:['桜','Cherry blossom'],mountain:['山','Mountain'],moon:['月','Moon']});
  const emojis=Object.freeze(['🌸','🌙','🍵','🍙','🍜','🍣','🍪','🍓','🦊','🐱','🐶','🐼','🐸','🦋','🐉','🌻','🍀','⭐','🔥','🌈','🎮','🎧','📚','🧠']);
  const cleanName=value=>(typeof value==='string'?value:'').normalize('NFKC').trim().replace(/\s+/g,' ');
  const nameKey=value=>cleanName(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/ß/g,'ss').replace(/[ ._'’\-]/g,'');
  function validName(value){const name=cleanName(value);return [...name].length>=2&&[...name].length<=24&&/^[\p{L}\p{N} ._'’\-]+$/u.test(name)&&/[\p{L}\p{N}]/u.test(name);}
  const confusables={'а':'a','ɑ':'a','α':'a','е':'e','ε':'e','і':'i','ι':'i','ı':'i','ӏ':'l','о':'o','ο':'o','р':'p','ρ':'p','с':'c','ϲ':'c','ѕ':'s','т':'t','τ':'t','υ':'u','ν':'v','х':'x','χ':'x','у':'y','0':'o','1':'i','3':'e','4':'a','5':'s','7':'t'};
  function reservedName(value){
    const fold=text=>text.replace(/./gu,char=>confusables[char]||char);
    const normalized=cleanName(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase(),folded=fold(normalized);
    const compact=nameKey(folded),withoutSuffix=nameKey(fold(normalized.replace(/[0-9]+$/,''))),reserved=['admin','administrator','owner','staff','moderator','support','official','founder','developer','helpdesk','system','modeatlas','modteam','devteam'];
    return reserved.some(word=>compact===word||withoutSuffix===word||folded.split(/[ ._'’\-]+/).includes(word))||/^(admin|moderator|modeatlas)/.test(compact);
  }
  function emoji(value){
    if(typeof value!=='string'||value.length>40||typeof Intl.Segmenter!=='function')return null;
    const clean=value.trim().normalize('NFC');
    if([...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(clean)].length!==1)return null;
    return /\p{Extended_Pictographic}/u.test(clean)||/^(?:\p{Regional_Indicator}){2}$/u.test(clean)||/^[0-9#*]\uFE0F?\u20E3$/u.test(clean)?clean:null;
  }
  function avatar(value){
    if(typeof value!=='string')return null;
    if(Object.hasOwn(avatars,value)||value==='account')return value;
    const symbol=typeof value==='string'&&value.startsWith('emoji:')?emoji(value.slice(6)):null;
    return symbol?'emoji:'+symbol:null;
  }
  function photoURL(value){
    try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&/^(?:[a-z0-9-]+\.)*googleusercontent\.com$/i.test(url.hostname)&&url.href.length<=2048?url.href:null;}catch{return null;}
  }
  return Object.freeze({avatars,emojis,cleanName,nameKey,validName,reservedName,emoji,avatar,photoURL});
});
