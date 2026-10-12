/* Shop products reference the reward owner's items; no duplicated unlock policy. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ModeAtlasShopCatalogue=factory();
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const currency=Object.freeze({id:'atlas-tokens',name:'Atlas Tokens',expires:false});
  const product=(id,name,description)=>Object.freeze({id,name,description,grant:'shop-'+id,
    storeProductId:'app.modeatlas.collection.'+id,
    rewards:Object.freeze(['banners','frames','icons'].map(type=>Object.freeze({type,id}))),
    // Prices and token packs are assigned when the live storefront is configured.
    paymentOptions:Object.freeze(['direct','tokens']),tokenPrice:null});
  const products=Object.freeze([
    product('sakura','Sakura','Soft blossom tones for your next chapter.'),
    product('midnight','Midnight','A quiet night sky for your study space.')
  ]);
  return Object.freeze({version:1,currency,products,purchasesEnabled:false});
});
