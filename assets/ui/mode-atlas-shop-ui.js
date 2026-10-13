/* Shop owns browsing/purchasing. Progress → Rewards owns using purchased items. */
(function(root){
  'use strict';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const button=(label,cls='ma-button ma-button--ghost')=>{const node=el('button',cls,label);node.type='button';return node;};
  const catalogue=root.ModeAtlasShopCatalogue,rules=root.ModeAtlasRewardRules;
  const owned=product=>!!product.grant&&rules.unlocked(rules.item(product.rewards[0].type,product.rewards[0].id),root.ModeAtlasProgress.getSummary().level,root.ModeAtlasRewardAccess?.current());
  const state=()=>root.ModeAtlasShop?.current()||{status:'guest',balance:null,offers:null,inventory:{},owned:[]};
  function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(svg.namespaceURI,'use');svg.classList.add('ma-icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href','/assets/mode-atlas-icons.svg#icon-'+name);svg.append(use);return svg;}
  function appIcon(product){const image=el('img');image.src='/assets/rewards/'+rules.item('icons',product.id).icon+'.svg';image.alt=product.name+' app icon';image.width=96;image.height=96;return image;}
  function frame(product){const reward=rules.item('frames',product.id),avatar=el('span','ma-atlas-avatar',reward.symbol);avatar.dataset.maFrame=reward.frame;avatar.setAttribute('aria-hidden','true');return avatar;}
  function look(product){const preview=el('div','ma-shop-look ma-profile-banner');preview.dataset.maBanner=product.id;const copy=el('span','ma-shop-look__copy');copy.append(el('strong','','Your profile'),el('span','',rules.item('frames',product.id).title));preview.append(frame(product),copy);return preview;}
  function openRewards(){root.ModeAtlasDialog.close();root.ModeAtlasRewardsUI.open('rewards');}
  function coinPrompt(){return root.ModeAtlasDialog.alert({title:'Atlas Coins',message:'Coin purchases are coming soon. You can still use coins already in your account.',confirmLabel:'Got it'});}
  function themePreview(product){
    const sample=el('div','ma-shop-theme-preview');sample.dataset.maThemeSample=product.id;
    const heading=el('div');heading.append(el('span','','あ'),el('strong','',product.name+' theme'));
    const body=el('div');body.append(el('span','','Your next chapter'),el('span','ma-shop-theme-preview__pill','Continue learning →'));sample.append(heading,body);return sample;
  }
  async function purchase(product){
    const wallet=state(),account=root.KanaCloudSync?.getUser?.()?.uid;
    if(wallet.status==='guest'){root.ModeAtlasDialog.close();root.ModeAtlasAccountNavigation.open('profile');return;}
    if(product.grant&&(owned(product)||wallet.owned?.includes(product.id))){openRewards();return;}
    const offer=wallet.offers?.find(item=>item.id===product.id);if(!offer||wallet.busy)return;
    root.ModeAtlasDialog.close();
    if(wallet.balance<offer.coinPrice){await root.ModeAtlasDialog.alert({title:'A few more coins',message:`You need ${(offer.coinPrice-wallet.balance).toLocaleString()} more Atlas Coins for ${product.name}.`,confirmLabel:'Got it'});return;}
    const confirmed=await root.ModeAtlasDialog.confirm({title:`Buy ${product.name}?`,message:`${offer.coinPrice.toLocaleString()} Atlas Coins · Balance after purchase: ${(wallet.balance-offer.coinPrice).toLocaleString()}.`,confirmLabel:'Buy item'});
    if(!confirmed||account!==root.KanaCloudSync?.getUser?.()?.uid)return;
    try{await root.ModeAtlasShop.purchase(product.id);root.ModeAtlasFeedback.toast(product.grant?product.name+' is in your Rewards.':product.name+' added.','success');}
    catch(error){await root.ModeAtlasDialog.alert({title:'Purchase could not finish',message:root.ModeAtlasShop.message(error),confirmLabel:'Got it'});void root.ModeAtlasShop.refresh(true);}
  }
  function preview(product){
    const content=el('div','ma-shop-detail');content.dataset.maShopDetail=product.id;content.append(look(product));
    const includes=el('div','ma-shop-includes'),copy=el('div');copy.append(el('strong','','The complete collection'),el('p','','An app-wide theme, profile banner, title and frame, iOS app icon, plus a matching avatar outfit and headwear.'));includes.append(appIcon(product),copy);const outfit=el('div','ma-shop-outfit-preview');root.ModeAtlasAvatarArt.render(outfit,{...root.ModeAtlasAvatarRules.defaults,outfit:product.id,headwear:product.id});outfit.setAttribute('role','img');outfit.setAttribute('aria-label',product.name+' avatar outfit and headwear');content.append(includes,outfit,themePreview(product));
    const note=el('p','ma-atlas-rewards__note');note.dataset.maShopDetailStatus='';content.append(note);
    const buy=button('','ma-button ma-button--primary');buy.dataset.maShopBuy=product.id;buy.addEventListener('click',()=>void purchase(product));
    const rewards=button('Open Rewards','ma-button ma-button--primary');rewards.dataset.maShopOwnedAction='';rewards.addEventListener('click',openRewards);content.append(buy,rewards);
    void root.ModeAtlasDialog.feature({title:product.name,kicker:'Collection',contentNode:content});refresh();
  }
  function availability(product,wallet){
    if(owned(product)||wallet.owned?.includes(product.id))return 'In your Rewards';
    const offer=wallet.offers?.find(item=>item.id===product.id);
    return offer?offer.coinPrice.toLocaleString()+' coins':wallet.offers===null?product.coinPrice.toLocaleString()+' coins':'Out of rotation';
  }
  function refresh(){
    const host=document.querySelector('[data-ma-shop]'),wallet=state();
    if(host&&!host.hidden){
      const balance=host.querySelector('[data-ma-coin-balance]');balance.textContent=wallet.balance!==null?wallet.balance.toLocaleString()+' coins':wallet.status==='guest'?'Sign in to view your balance':wallet.status==='loading'?'Checking balance…':wallet.status==='offline'?'Connect to view your balance':'Couldn’t load your balance';
      host.querySelector('[data-ma-shop-refresh]').hidden=!['unavailable','offline'].includes(wallet.status);
      for(const product of catalogue.products){
        const item=host.querySelector('[data-ma-shop-product="'+product.id+'"]');
        const isOwned=owned(product)||wallet.owned?.includes(product.id),offer=wallet.offers?.find(p=>p.id===product.id);
        item.hidden=wallet.offers!==null&&!offer;
        item.querySelector('[data-ma-shop-availability]').textContent=product.kind==='consumable'?`${availability(product,wallet)} · ${wallet.inventory?.[product.id]||0} ready`:availability(product,wallet);
        item.dataset.owned=String(isOwned);
        const ending=item.querySelector('[data-ma-shop-ends]');
        if(ending){ending.hidden=!offer?.endsAt;ending.textContent=offer?.endsAt?'Until '+new Date(offer.endsAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';}
        if(product.kind==='consumable')item.disabled=wallet.busy||(wallet.inventory?.[product.id]||0)>=product.limit||wallet.status!=='guest'&&wallet.status!=='ready';
      }
      for(const group of host.querySelectorAll('[data-ma-shop-group]'))group.hidden=![...group.querySelectorAll('[data-ma-shop-product]')].some(item=>!item.hidden);
    }
    // Account changes must also update an already open collection dialog.
    for(const product of catalogue.products.filter(p=>p.kind==='collection')){
      const detail=document.querySelector('[data-ma-shop-detail="'+product.id+'"]');if(!detail)continue;
      const isOwned=owned(product)||wallet.owned?.includes(product.id),offer=wallet.offers?.find(p=>p.id===product.id),buy=detail.querySelector('[data-ma-shop-buy]');
      detail.querySelector('[data-ma-shop-detail-status]').textContent=isOwned?'Yours to keep. Choose your look in Rewards.':offer?.endsAt?'Available until '+new Date(offer.endsAt).toLocaleDateString()+'. Yours to keep once purchased.':'';
      detail.querySelector('[data-ma-shop-owned-action]').hidden=!isOwned;buy.hidden=isOwned;
      buy.textContent=wallet.status==='guest'?'Sign in to buy':wallet.busy?'Finishing purchase…':offer?'Buy for '+offer.coinPrice.toLocaleString()+' coins':'Out of rotation';
      buy.disabled=wallet.busy||wallet.status!=='guest'&&(!offer||wallet.status!=='ready');
    }
    for(const host of document.querySelectorAll('[data-ma-shop-inventory]'))renderInventory(host);
  }
  async function useRepair(){
    const wallet=state(),account=root.KanaCloudSync?.getUser?.()?.uid;if(wallet.busy||!wallet.repairDay)return;
    if(!await root.ModeAtlasDialog.confirm({title:'Repair your streak?',message:'Use one Streak Repair to reconnect yesterday with your previous study days.',confirmLabel:'Use repair'}))return;
    if(account!==root.KanaCloudSync?.getUser?.()?.uid)return;
    try{await root.ModeAtlasShop.useRepair();root.ModeAtlasFeedback.toast('Your study streak is reconnected.','success');}
    catch(error){await root.ModeAtlasDialog.alert({title:'Streak repair',message:root.ModeAtlasShop.message(error),confirmLabel:'Got it'});}
  }
  function renderInventory(host){
    const wallet=state(),freezes=wallet.inventory?.['streak-freeze']||0,repairs=wallet.inventory?.['streak-repair']||0;
    host.dataset.maShopInventory='';host.classList.add('ma-streak-items');host.hidden=!freezes&&!repairs;
    const signature=JSON.stringify([freezes,repairs,wallet.repairDay,wallet.busy,wallet.status]);if(host.dataset.state===signature)return;host.dataset.state=signature;
    host.replaceChildren(el('h3','','Streak essentials'));
    if(freezes)host.append(el('p','',`${freezes} Streak ${freezes===1?'Freeze':'Freezes'} ready · Used automatically for a missed day.`));
    if(repairs){const row=el('div','ma-streak-items__row'),use=button('Use repair','ma-button ma-button--primary');use.dataset.maUseRepair='';use.disabled=wallet.busy||wallet.status!=='ready'||!wallet.repairDay;use.addEventListener('click',()=>void useRepair());row.append(el('span','',`${repairs} Streak ${repairs===1?'Repair':'Repairs'}`),use);host.append(row);if(!wallet.repairDay)host.append(el('p','ma-atlas-rewards__note','Ready if you miss a day. Use it the following day to reconnect your streak.'));}
  }
  function mount(host){
    host.dataset.maShop='';host.classList.add('ma-shop');
    const wallet=el('section','ma-shop-wallet');wallet.setAttribute('aria-label','Atlas Coins wallet');
    const coin=el('span','ma-shop-coin');coin.append(icon('star'));
    const copy=el('div','ma-shop-wallet__copy'),value=el('p','ma-shop-wallet__balance');value.dataset.maCoinBalance='';value.setAttribute('role','status');copy.append(el('strong','',catalogue.currency.name),value,el('p','ma-shop-wallet__balance','Earn 20 coins each level · +50 every fifth level'));
    const topup=button('Purchase Atlas Coins','ma-button ma-button--primary ma-button--small');topup.dataset.maPurchaseCoins='';topup.addEventListener('click',()=>void coinPrompt());
    const retry=button('Refresh balance','ma-button ma-button--ghost ma-button--small');retry.dataset.maShopRefresh='';retry.hidden=true;retry.addEventListener('click',()=>void root.ModeAtlasShop.refresh(true));wallet.append(coin,copy,topup,retry);
    const intro=el('div','ma-shop-intro');intro.append(el('h3','','Make it yours.'),el('p','','A new look. A little breathing room. Your Atlas.'));
    const collections=el('section','ma-shop-products');collections.dataset.maShopGroup='collections';
    const wardrobe=el('section','ma-shop-essentials');wardrobe.dataset.maShopGroup='wardrobe';wardrobe.append(el('h3','','The finishing touches'));
    const essentials=el('section','ma-shop-essentials');essentials.dataset.maShopGroup='essentials';essentials.append(el('h3','','Streak essentials'));
    for(const product of catalogue.products){
      const collection=product.kind==='collection',item=button('',collection?'ma-shop-product ma-profile-banner':'ma-shop-essential');item.dataset.maShopProduct=product.id;
      if(collection){
        item.dataset.maBanner=product.id;item.setAttribute('aria-label','Preview '+product.name+' collection');item.setAttribute('aria-haspopup','dialog');
        const text=el('span','ma-shop-product__copy'),ends=el('span','ma-shop-eyebrow');ends.dataset.maShopEnds='';ends.hidden=true;
        text.append(el('span','ma-shop-eyebrow','Theme + profile collection'),el('strong','ma-shop-product__name',product.name),el('span','ma-shop-product__description',product.description),ends);
        const scene=el('span','ma-shop-scene');scene.setAttribute('aria-hidden','true');scene.append(appIcon(product),frame(product));item.append(text,scene);
      }else{
        const symbol=el('span','ma-shop-essential__symbol',product.id==='streak-freeze'?'❄':'↺');symbol.setAttribute('aria-hidden','true');
        if(product.kind==='cosmetic'){symbol.classList.add('ma-shop-wardrobe-portrait');root.ModeAtlasAvatarArt.render(symbol,{...root.ModeAtlasAvatarRules.defaults,[product.rewards[0].type==='headwear'?'headwear':'accessory']:product.id},{portrait:true});}
        const copy=el('span','ma-shop-essential__copy');copy.append(el('strong','',product.name),el('span','',product.description));item.append(symbol,copy);
      }
      const footer=el('span',collection?'ma-shop-product__footer':'ma-shop-essential__footer'),availability=el('span');availability.dataset.maShopAvailability='';footer.append(availability,icon('arrow'));item.append(footer);
      item.addEventListener('click',()=>collection?preview(product):void purchase(product));(collection?collections:product.kind==='cosmetic'?wardrobe:essentials).append(item);
    }
    const rewards=button('','ma-shop-rewards-link'),label=el('span');label.append(el('strong','','Your rewards'),el('span','','Your collections, wardrobe, themes and streak items.'));rewards.append(icon('achievement'),label,icon('arrow'));rewards.addEventListener('click',openRewards);
    host.replaceChildren(wallet,intro,collections,wardrobe,essentials,rewards);refresh();
  }
  for(const event of ['modeAtlasShopChanged','modeAtlasRewardAccessChanged','modeAtlasProgressChanged'])root.addEventListener(event,refresh);
  root.ModeAtlasShopUI=Object.freeze({mount,refresh,renderInventory});
})(window);
