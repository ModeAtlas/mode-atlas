/* Shared character schema and wardrobe policy. No rendering or persistence. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mode-atlas-reward-rules.js'));
  else root.ModeAtlasAvatarRules=factory(root.ModeAtlasRewardRules);
})(typeof window!=='undefined'?window:globalThis,function(rewards){
  'use strict';
  const colours=entries=>Object.freeze(entries.map(([id,name,value])=>Object.freeze({id,name,value})));
  const skin=colours([['porcelain','Porcelain','#f4d4be'],['ivory','Ivory','#f1cab2'],['blush','Blush','#edc2a6'],['peach','Peach','#eab99a'],['apricot','Apricot','#e3af8c'],['warm-beige','Warm beige','#dca57f'],['sand','Sand','#d59b72'],['amber','Amber','#b8794f'],['umber','Umber','#935c3c'],['cocoa','Cocoa','#70432f'],['ebony','Ebony','#4b3029']]);
  const hairColor=colours([['ink','Ink','#24222b'],['espresso','Espresso','#49332c'],['chestnut','Chestnut','#87523c'],['copper','Copper','#bc7149'],['gold','Golden','#d0aa65'],['silver','Silver','#c3c5cf'],['rose','Rose','#ba6380'],['ocean','Ocean','#4a7489']]);
  const eyes=colours([['brown','Brown','#4c3328'],['hazel','Hazel','#807044'],['blue','Blue','#4b6d85'],['green','Green','#567661'],['grey','Grey','#70747d']]);
  const outfitColor=colours([['teal','Teal','#4c8d84'],['navy','Navy','#47657e'],['coral','Coral','#c6796d'],['plum','Plum','#826484'],['cream','Cream','#d7cbb6'],['charcoal','Charcoal','#51535f']]);
  const choices=Object.freeze({skin,hair:rewards.hairstyles,hairColor,eyes,outfitColor});
  const slots=Object.freeze({hair:'hairstyles',outfit:'outfits',headwear:'headwear',accessory:'accessories'});
  const defaults=Object.freeze({version:1,skin:'sand',hair:'sweep',hairColor:'espresso',eyes:'brown',outfit:'everyday',outfitColor:'teal',headwear:'none',accessory:'none'});
  function valid(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||Object.keys(value).length!==Object.keys(defaults).length)return false;
    return Object.keys(defaults).every(key=>key==='version'||typeof value[key]==='string'&&(choices[key]?choices[key].some(item=>item.id===value[key]):!!rewards.item(slots[key],value[key])));
  }
  function normalize(value){
    const result={...defaults};
    if(!value||typeof value!=='object'||Array.isArray(value))return result;
    for(const key of Object.keys(defaults))if(key!=='version'&&(choices[key]?choices[key].some(item=>item.id===value[key]):rewards.item(slots[key],value[key])))result[key]=value[key];
    return result;
  }
  function allowed(value,level,access){return valid(value)&&Object.entries(slots).every(([slot,type])=>rewards.allowed(type,value[slot],level,access));}
  function visible(value,level,access){
    const result=normalize(value);
    for(const [slot,type]of Object.entries(slots))if(!rewards.allowed(type,result[slot],level,access))result[slot]=defaults[slot];
    return result;
  }
  function colour(type,id){return choices[type]?.find(item=>item.id===id)?.value||choices[type]?.[0]?.value;}
  return Object.freeze({version:1,defaults,choices,slots,valid,normalize,allowed,visible,colour});
});
