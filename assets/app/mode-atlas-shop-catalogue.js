/* Stable product IDs outlive their sale windows. Rewards own cosmetic access. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ModeAtlasShopCatalogue=factory();
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const currency=Object.freeze({id:'atlas-coins',name:'Atlas Coins',expires:false});
  // Quantities are presentation data. Localised prices and payment authority
  // will come from the platform store; no guessed currency amounts are shown.
  const coinPacks=Object.freeze([500,1200,2500,6000].map(coins=>Object.freeze({id:'coins-'+coins,coins})));
  const featured=Object.freeze(['sakura','midnight','skyline','hunny-jumper','hunny-pendant','varsity','studio-headphones','ribbon-waves','streak-freeze','streak-repair']);
  const levelCoins=Object.freeze({perLevel:20,bonusEvery:5,bonus:50,
    total(level){const n=Number.isFinite(level)?Math.max(1,Math.min(999,Math.floor(level))):1;return (n-1)*20+Math.floor(n/5)*50;}});
  const collection=(id,name,description)=>Object.freeze({id,name,description,kind:'collection',grant:'shop-'+id,
    coinPrice:500,rewards:Object.freeze(['banners','frames','icons','themes','outfits','headwear'].map(type=>Object.freeze({type,id})))});
  const cosmetic=(id,name,description,coinPrice,type)=>Object.freeze({id,name,description,coinPrice,kind:'cosmetic',grant:'shop-'+id,rewards:Object.freeze([Object.freeze({type,id})])});
  const products=Object.freeze([
    collection('sakura','Sakura','Cherry blossom pinks for a fresh perspective.'),
    collection('midnight','Midnight','Silver moonlight and quiet skies for your next chapter.'),
    collection('skyline','Skyline','Warm windows, tall towers and the city after dark.'),
    Object.freeze({id:'studio-headphones',name:'Studio headphones',description:'A little music for your next chapter.',kind:'cosmetic',grant:'shop-studio-headphones',coinPrice:200,rewards:Object.freeze([{type:'headwear',id:'studio-headphones'}])}),
    Object.freeze({id:'round-glasses',name:'Round glasses',description:'A classic finishing touch for your avatar.',kind:'cosmetic',grant:'shop-round-glasses',coinPrice:150,rewards:Object.freeze([{type:'accessories',id:'round-glasses'}])}),
    cosmetic('textured-fade','Textured fade','Sculpted curls with a clean, tapered finish.',180,'hairstyles'),
    cosmetic('ribbon-waves','Ribbon waves','Long flowing waves tied with a rose ribbon.',200,'hairstyles'),
    cosmetic('varsity','Varsity jacket','Cream sleeves, forest green and a stitched Atlas crest.',250,'outfits'),
    cosmetic('cable-knit','Cable knit','A warm oatmeal knit with a woven cable pattern.',250,'outfits'),
    Object.freeze({...cosmetic('hunny-jumper','Hunny jumper','A little bear to keep you company.',10,'outfits'),audience:'hunny-tester',rewards:Object.freeze([{type:'outfits',id:'hunny'}])}),
    Object.freeze({...cosmetic('hunny-pendant','Hunny pendant','A golden drop of sweetness.',10,'accessories'),audience:'hunny-tester',rewards:Object.freeze([{type:'accessories',id:'hunny'}])}),
    Object.freeze({id:'streak-freeze',name:'Streak Freeze',kind:'consumable',coinPrice:150,limit:2,
      description:'Automatically covers a missed study day. Keep up to two ready.'}),
    Object.freeze({id:'streak-repair',name:'Streak Repair',kind:'consumable',coinPrice:250,limit:3,
      description:'Reconnect a streak after one missed day. Use it the following day.'})
  ]);
  const item=id=>products.find(product=>product.id===id)||null;
  function offer(product,overrides={},at=Date.now(),access={}){
    if(product.audience&&!access.allCustom&&!access.grants?.includes(product.audience))return null;
    const config=Object.hasOwn(overrides,product.id)?overrides[product.id]:{};
    if(!config||config.enabled===false)return null;
    const {startsAt=null,endsAt=null}=config;
    if([startsAt,endsAt].some(value=>value!==null&&(!Number.isFinite(value)||value<0))||startsAt!==null&&endsAt!==null&&endsAt<=startsAt)return null;
    if(startsAt!==null&&at<startsAt||endsAt!==null&&at>=endsAt)return null;
    return {id:product.id,coinPrice:product.coinPrice,endsAt};
  }
  return Object.freeze({version:2,currency,coinPacks,featured,levelCoins,products,item,offer,coinPurchasesEnabled:false});
});
