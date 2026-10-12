/* Stable product IDs outlive their sale windows. Rewards own cosmetic access. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ModeAtlasShopCatalogue=factory();
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const currency=Object.freeze({id:'atlas-coins',name:'Atlas Coins',expires:false});
  const collection=(id,name,description)=>Object.freeze({id,name,description,kind:'collection',grant:'shop-'+id,
    coinPrice:500,rewards:Object.freeze(['banners','frames','icons','themes'].map(type=>Object.freeze({type,id})))});
  const products=Object.freeze([
    collection('sakura','Sakura','Cherry blossom pinks for a fresh perspective.'),
    collection('midnight','Midnight','A starry indigo world for your next chapter.'),
    Object.freeze({id:'streak-freeze',name:'Streak Freeze',kind:'consumable',coinPrice:150,limit:2,
      description:'Automatically covers a missed study day. Keep up to two ready.'}),
    Object.freeze({id:'streak-repair',name:'Streak Repair',kind:'consumable',coinPrice:250,limit:3,
      description:'Reconnect a streak after one missed day. Use it the following day.'})
  ]);
  const item=id=>products.find(product=>product.id===id)||null;
  function offer(product,overrides={},at=Date.now()){
    const config=Object.hasOwn(overrides,product.id)?overrides[product.id]:{};
    if(!config||config.enabled===false)return null;
    const {startsAt=null,endsAt=null}=config;
    if([startsAt,endsAt].some(value=>value!==null&&(!Number.isFinite(value)||value<0))||startsAt!==null&&endsAt!==null&&endsAt<=startsAt)return null;
    if(startsAt!==null&&at<startsAt||endsAt!==null&&at>=endsAt)return null;
    return {id:product.id,coinPrice:product.coinPrice,endsAt};
  }
  return Object.freeze({version:2,currency,products,item,offer,coinPurchasesEnabled:false});
});
