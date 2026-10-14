/* Stable product IDs outlive their sale windows. Rewards own cosmetic access. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mode-atlas-reward-rules.js'));
  else root.ModeAtlasShopCatalogue=factory(root.ModeAtlasRewardRules);
})(typeof window!=='undefined'?window:globalThis,function(rules){
  'use strict';
  const currency=Object.freeze({id:'atlas-coins',name:'Atlas Coins',expires:false});
  const earnedCurrency=Object.freeze({id:'study-tokens',name:'Study Tokens',expires:false});
  // Quantities are presentation data. Localised prices and payment authority
  // will come from the platform store; no guessed currency amounts are shown.
  const coinPacks=Object.freeze([500,1200,2500,6000].map(coins=>Object.freeze({id:'coins-'+coins,coins})));
  const streakRepair=Object.freeze({maxMissedDays:3,windowDays:7});
  const featured=Object.freeze(['evergreen','sakura','midnight','skyline','japanese-spitz','seigaiha-kimono','meadow-dress','hunny-jumper','hunny-pendant','moon-fox','streak-freeze','streak-repair']);
  const boundedLevel=level=>Number.isFinite(level)?Math.max(1,Math.min(999,Math.floor(level))):1;
  // Retained solely to verify and migrate already-awarded balances.
  const legacyLevelCoins=Object.freeze({total(level){const n=boundedLevel(level);return (n-1)*20+Math.floor(n/5)*50;}});
  const coinMilestones=Object.freeze([[10,25],[20,40],[35,60],[50,100]]);
  const levelCoins=Object.freeze({version:2,total(level){const n=boundedLevel(level);return coinMilestones.reduce((sum,[at,coins])=>sum+(n>=at?coins:0),0)+Math.max(0,Math.floor((n-50)/25))*100;}});
  const studyTokens=Object.freeze({answerDivisor:8,
    levelTotal(level){const n=boundedLevel(level);return (n-1)*60+Math.floor(n/5)*150;},
    streakDay(streak){return 10+Math.min(20,Math.floor(Math.max(0,streak-1)/7)*5);}
  });
  const collection=(id,name,description)=>Object.freeze({id,name,description,kind:'collection',grant:'shop-'+id,
    coinPrice:750,tokenPrice:null,rewards:Object.freeze(['banners','frames','icons','themes','outfits','pants','headwear'].map(type=>Object.freeze({type,id})))});
  const cosmetic=(id,name,description,coinPrice,type)=>Object.freeze({id,name,description,coinPrice,kind:'cosmetic',grant:'shop-'+id,rewards:Object.freeze([Object.freeze({type,id})])});
  const products=Object.freeze([
    collection('sakura','Sakura','Cherry blossom pinks for a fresh perspective.'),
    collection('midnight','Midnight','Silver moonlight and quiet skies for your next chapter.'),
    collection('skyline','Skyline','Warm windows, tall towers and the city after dark.'),
    collection('evergreen','Evergreen','Sunlit ferns, deep forest greens and a quieter path.'),
    Object.freeze({id:'studio-headphones',name:'Studio headphones',description:'A little music for your next chapter.',kind:'cosmetic',grant:'shop-studio-headphones',coinPrice:300,rewards:Object.freeze([{type:'headwear',id:'studio-headphones'}])}),
    Object.freeze({id:'round-glasses',name:'Round glasses',description:'A classic finishing touch for your avatar.',kind:'cosmetic',grant:'shop-round-glasses',coinPrice:230,rewards:Object.freeze([{type:'accessories',id:'round-glasses'}])}),
    cosmetic('textured-fade','Textured fade','Sculpted curls with a clean, tapered finish.',270,'hairstyles'),
    cosmetic('ribbon-waves','Ribbon waves','Long flowing waves tied with a rose ribbon.',300,'hairstyles'),
    cosmetic('sculpted-pompadour','Sculpted pompadour','A high swept crest with carved texture and tapered sides.',330,'hairstyles'),
    cosmetic('braided-undercut','Braided undercut','Intricate crown braids, close-cut sides and a tied finish.',360,'hairstyles'),
    cosmetic('amber-ombre','Amber ombré','Deep brunette roots melt into warm amber ends. Works with every hairstyle.',150,'hairColours'),
    cosmetic('rose-gold','Rose gold','Soft rose, warm gold and luminous tips. Works with every hairstyle.',180,'hairColours'),
    cosmetic('moonlit-silver','Moonlit silver','Smoky roots and icy silver tips. Works with every hairstyle.',180,'hairColours'),
    cosmetic('pinstripe','Tailored pinstripes','Fine chalk stripes, sharp creases and a tailored finish.',330,'pants'),
    cosmetic('aurora','Aurora joggers','Midnight fabric, iridescent side panels and reflective cuffs.',360,'pants'),
    cosmetic('starfall-skirt','Starfall skirt','Layered fabric with embroidered stars and a scalloped hem. Choose your colour.',360,'pants'),
    cosmetic('meadow-dress','Meadow dress','A flowing dress with embroidered vines, a waist bow and your choice of colour.',420,'outfits'),
    cosmetic('seigaiha-kimono','Ocean waves kimono','Layered wave motifs, wide sleeves and a woven obi. Choose jade, navy, ivory or charcoal.',520,'outfits'),
    cosmetic('japanese-spitz','Japanese Spitz','A bright white coat, a curled tail and a friend for every chapter. Give them a name of their own.',680,'pets'),
    cosmetic('moon-fox','Moon fox','An ivory fox with midnight paws, silver markings and a crescent charm.',750,'pets'),
    cosmetic('koi','Golden koi','A golden companion swimming through a little floating water garden.',520,'pets'),
    cosmetic('varsity','Varsity jacket','Cream sleeves, forest green and a stitched Atlas crest.',380,'outfits'),
    cosmetic('cable-knit','Cable knit','A warm oatmeal knit with a woven cable pattern.',380,'outfits'),
    Object.freeze({...cosmetic('hunny-jumper','Hunny jumper','A little bear to keep you company.',15,'outfits'),audience:'hunny-tester',rewards:Object.freeze([{type:'outfits',id:'hunny'}])}),
    Object.freeze({...cosmetic('hunny-pendant','Hunny pendant','A golden drop of sweetness.',15,'accessories'),audience:'hunny-tester',rewards:Object.freeze([{type:'accessories',id:'hunny'}])}),
    Object.freeze({id:'streak-freeze',name:'Streak Freeze',kind:'consumable',coinPrice:150,limit:2,
      description:'Automatically covers a missed study day. Keep up to two ready.'}),
    Object.freeze({id:'streak-repair',name:'Streak Repair',kind:'consumable',coinPrice:300,limit:3,
      description:'Restore up to three consecutive missed days, within seven days of the last missed day. Keep studying while you decide.'})
    ,...Object.entries(rules.starter).flatMap(([type])=>rules.catalogue[type].filter(reward=>reward.legacyLevel).map(reward=>{
      const pricing={hairstyles:[50,300],hairColours:[20,120],outfits:[90,550],pants:[70,400],headwear:[60,350],accessories:[50,300]};
      const petPrices={rabbit:[120,900],calico:[170,1200],shiba:[200,1500],tanuki:[450,4000],crane:[500,4500]};
      const [coinPrice,tokenPrice]=type==='pets'?petPrices[reward.id]:pricing[type];
      const description=type==='pets'?'A companion for your next chapter. Give them a name of their own.':type==='hairColours'?'A new shade for your favourite hairstyle.':'A new detail for your everyday look.';
      return {...cosmetic(reward.id,reward.name,description,coinPrice,type),tokenPrice};
    }))
  ].map(product=>Object.freeze({...product,tokenPrice:product.kind==='collection'?null:product.tokenPrice??product.coinPrice*(product.kind==='consumable'?6:8)})));
  const item=id=>products.find(product=>product.id===id)||null;
  function offer(product,overrides={},at=Date.now(),access={}){
    if(product.audience&&!access.allCustom&&!access.grants?.includes(product.audience))return null;
    const config=Object.hasOwn(overrides,product.id)?overrides[product.id]:{};
    if(!config||config.enabled===false)return null;
    const {startsAt=null,endsAt=null}=config;
    if([startsAt,endsAt].some(value=>value!==null&&(!Number.isFinite(value)||value<0))||startsAt!==null&&endsAt!==null&&endsAt<=startsAt)return null;
    if(startsAt!==null&&at<startsAt||endsAt!==null&&at>=endsAt)return null;
    return {id:product.id,coinPrice:product.coinPrice,tokenPrice:product.tokenPrice,endsAt};
  }
  return Object.freeze({version:3,currency,earnedCurrency,coinPacks,featured,legacyLevelCoins,levelCoins,coinMilestones,studyTokens,streakRepair,products,item,offer,coinPurchasesEnabled:false});
});
