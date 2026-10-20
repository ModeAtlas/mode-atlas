/* Shared character schema and wardrobe policy. No rendering or persistence. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mode-atlas-reward-rules.js'));
  else root.ModeAtlasAvatarRules=factory(root.ModeAtlasRewardRules);
})(typeof window!=='undefined'?window:globalThis,function(rewards){
  'use strict';
  const colours=entries=>Object.freeze(entries.map(([id,name,value])=>Object.freeze({id,name,value})));
  const skin=colours([['porcelain','Porcelain','#f4d4be'],['ivory','Ivory','#f1cab2'],['blush','Blush','#edc2a6'],['peach','Peach','#eab99a'],['apricot','Apricot','#e3af8c'],['warm-beige','Warm beige','#dca57f'],['sand','Sand','#d59b72'],['amber','Amber','#b8794f'],['umber','Umber','#935c3c'],['cocoa','Cocoa','#70432f'],['ebony','Ebony','#4b3029']]);
  const hairColor=rewards.hairColours;
  const eyes=colours([['brown','Brown','#4c3328'],['hazel','Hazel','#807044'],['blue','Blue','#4b6d85'],['green','Green','#567661'],['grey','Grey','#70747d']]);
  const outfitColor=colours([['teal','Teal','#4c8d84'],['navy','Navy','#47657e'],['coral','Coral','#c6796d'],['plum','Plum','#826484'],['cream','Cream','#d7cbb6'],['charcoal','Charcoal','#51535f']]);
  const pantsColor=Object.freeze([{id:'original',name:'Original',value:'#364553'},...outfitColor]);
  const kimonoColours=Object.freeze(['teal','navy','cream','charcoal']);
  const colourableOutfits=Object.freeze(['everyday','sport','linen','crewneck','striped','day-dress','pinafore','meadow-dress','seigaiha-kimono']);
  const choices=Object.freeze({skin,hair:rewards.hairstyles,hairColor,eyes,outfitColor,pantsColor});
  const slots=Object.freeze({hair:'hairstyles',hairColor:'hairColours',outfit:'outfits',pants:'pants',headwear:'headwear',accessory:'accessories',pet:'pets'});
  const defaults=Object.freeze({version:3,skin:'sand',hair:'sweep',hairColor:'espresso',eyes:'brown',outfit:'everyday',outfitColor:'teal',pants:'classic',pantsColor:'original',headwear:'none',accessory:'none',pet:'none',petName:''});
  const validPetName=value=>typeof value==='string'&&[...value].length<=24&&(!value||/^[\p{L}\p{N} ._'’\-]+$/u.test(value)&&/[\p{L}\p{N}]/u.test(value));
  function valid(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||![1,2,3].includes(value.version))return false;
    const keys=Object.keys(defaults).filter(key=>value.version===3||!['pantsColor','pet','petName',...(value.version===1?['pants']:[])].includes(key));
    if(Object.keys(value).length!==keys.length)return false;
    return keys.every(key=>key==='version'||key==='petName'&&validPetName(value[key])||key!=='petName'&&typeof value[key]==='string'&&(choices[key]?choices[key].some(item=>item.id===value[key]):!!rewards.item(slots[key],value[key])))&&(value.outfit!=='seigaiha-kimono'||kimonoColours.includes(value.outfitColor));
  }
  function normalize(value){
    const result={...defaults};
    if(!value||typeof value!=='object'||Array.isArray(value))return result;
    for(const key of Object.keys(defaults))if(key!=='version'&&(key==='petName'?validPetName(value[key]):choices[key]?choices[key].some(item=>item.id===value[key]):rewards.item(slots[key],value[key])))result[key]=value[key];
    if(result.outfit==='seigaiha-kimono'&&!kimonoColours.includes(result.outfitColor))result.outfitColor='navy';
    return result;
  }
  function allowed(value,level,access){const look=normalize(value);return valid(value)&&Object.entries(slots).every(([slot,type])=>rewards.allowed(type,look[slot],level,access));}
  function visible(value,level,access){
    const result=normalize(value);
    for(const [slot,type]of Object.entries(slots))if(!rewards.allowed(type,result[slot],level,access))result[slot]=defaults[slot];
    if(result.pet==='none')result.petName='';
    return result;
  }
  function colour(type,id){return choices[type]?.find(item=>item.id===id)?.value||choices[type]?.[0]?.value;}
  function compatible(value,version=1){
    if(version===3)return normalize(value);
    const {pantsColor,pet,petName,...look}=normalize(value);look.version=version;
    if(['day-dress','pinafore','meadow-dress','seigaiha-kimono'].includes(look.outfit))look.outfit='everyday';
    if(['a-line','pleated-skirt','starfall-skirt'].includes(look.pants))look.pants='classic';
    if(version===1){delete look.pants;look.hairColor=hairColor.find(item=>item.id===look.hairColor).legacy;}
    return look;
  }
  const legacy=value=>compatible(value,1);
  return Object.freeze({version:3,defaults,choices,slots,kimonoColours,colourableOutfits,validPetName,valid,normalize,allowed,visible,colour,compatible,legacy});
});
