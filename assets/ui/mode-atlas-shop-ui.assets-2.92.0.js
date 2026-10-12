/* Shop browses collections; Progress → Rewards owns equipping every item. */
(function(root){
  'use strict';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const button=(label,cls='ma-button ma-button--ghost')=>{const node=el('button',cls,label);node.type='button';return node;};
  const catalogue=root.ModeAtlasShopCatalogue,rules=root.ModeAtlasRewardRules;
  const available=product=>rules.unlocked(rules.item('banners',product.id),root.ModeAtlasProgress.getSummary().level,root.ModeAtlasRewardAccess?.current());
  function icon(name){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(svg.namespaceURI,'use');
    svg.classList.add('ma-icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href','/assets/mode-atlas-icons.svg#icon-'+name);svg.append(use);return svg;
  }
  function appIcon(product){const image=el('img');image.src='/assets/rewards/'+rules.item('icons',product.id).icon+'.svg';image.alt=product.name+' app icon';image.width=96;image.height=96;return image;}
  function frame(product){const reward=rules.item('frames',product.id),avatar=el('span','ma-atlas-avatar',reward.symbol);avatar.dataset.maFrame=reward.frame;avatar.setAttribute('aria-hidden','true');return avatar;}
  function look(product){
    const preview=el('div','ma-shop-look ma-profile-banner');preview.dataset.maBanner=product.id;
    const copy=el('span','ma-shop-look__copy');copy.append(el('strong','','Your profile'),el('span','',rules.item('frames',product.id).title));preview.append(frame(product),copy);return preview;
  }
  function openRewards(){root.ModeAtlasDialog.close();root.ModeAtlasRewardsUI.open('rewards');}
  function preview(product){
    const content=el('div','ma-shop-detail');content.dataset.maShopDetail=product.id;content.append(look(product));
    const includes=el('div','ma-shop-includes'),copy=el('div');
    copy.append(el('strong','','The complete collection'),el('p','','Profile banner, title and frame, plus an iOS app icon.'));includes.append(appIcon(product),copy);content.append(includes);
    const note=el('p','ma-atlas-rewards__note');note.dataset.maShopDetailStatus='';content.append(note);
    const owned=button('Open Rewards','ma-button ma-button--primary');owned.dataset.maShopOwnedAction='';owned.addEventListener('click',openRewards);content.append(owned);
    void root.ModeAtlasDialog.feature({title:product.name,kicker:'Collection preview',contentNode:content});refresh();
  }
  function refresh(){
    const host=document.querySelector('[data-ma-shop]');if(!host||host.hidden)return;
    const wallet=root.ModeAtlasShop?.current()||{status:'guest',balance:null},balance=host.querySelector('[data-ma-token-balance]');
    balance.textContent=wallet.balance!==null?wallet.balance.toLocaleString()+' tokens':wallet.status==='guest'?'Sign in to view your balance':wallet.status==='loading'?'Checking balance…':wallet.status==='offline'?'Balance unavailable offline':'Balance not available yet';
    host.querySelector('[data-ma-shop-refresh]').hidden=!['unavailable','offline'].includes(wallet.status);
    for(const product of catalogue.products){
      const owned=available(product),item=host.querySelector('[data-ma-shop-product="'+product.id+'"]');
      item.querySelector('[data-ma-shop-availability]').textContent=owned?'In your Rewards':'Explore collection';item.dataset.owned=String(owned);
      const detail=document.querySelector('[data-ma-shop-detail="'+product.id+'"]');
      if(detail){detail.querySelector('[data-ma-shop-detail-status]').textContent=owned?'In your Rewards. Choose your banner, title, frame and app icon in Progress → Rewards.':'Preview only. Purchases aren’t available yet. Once owned, these items appear in Progress → Rewards.';detail.querySelector('[data-ma-shop-owned-action]').hidden=!owned;}
    }
  }
  function mount(host){
    host.dataset.maShop='';host.classList.add('ma-shop');
    const wallet=el('section','ma-shop-wallet');wallet.setAttribute('aria-label','Premium token wallet');
    const coin=el('span','ma-shop-coin');coin.append(icon('star'));
    const copy=el('div','ma-shop-wallet__copy'),value=el('p','ma-shop-wallet__balance');value.dataset.maTokenBalance='';value.setAttribute('role','status');copy.append(el('strong','',catalogue.currency.name),value);
    const info=button('i','ma-info-button');info.setAttribute('aria-label','About Atlas Tokens');info.setAttribute('aria-haspopup','dialog');
    info.addEventListener('click',()=>root.ModeAtlasDialog.alert({title:'Atlas Tokens',message:'A planned currency for optional shop items, separate from earned XP. When purchases launch, you’ll be able to buy tokens or eligible collections directly. Purchased tokens won’t expire. Prices and token packs will be shown before you buy. Purchases are unavailable in this version.',confirmLabel:'Got it'}));
    const retry=button('Refresh balance','ma-button ma-button--ghost ma-button--small');retry.dataset.maShopRefresh='';retry.hidden=true;retry.addEventListener('click',()=>void root.ModeAtlasShop.refresh(true));wallet.append(coin,copy,info,retry);
    const intro=el('div','ma-shop-intro');intro.append(el('h3','','Make it yours.'),el('p','','Collections for your profile and Home Screen.'),el('span','ma-shop-notice','Purchases aren’t available yet.'));
    const products=el('div','ma-shop-products');
    for(const product of catalogue.products){
      const item=button('','ma-shop-product ma-profile-banner');item.dataset.maBanner=product.id;item.dataset.maShopProduct=product.id;item.setAttribute('aria-label','Preview '+product.name+' collection');item.setAttribute('aria-haspopup','dialog');
      const text=el('span','ma-shop-product__copy');text.append(el('span','ma-shop-eyebrow','Profile collection'),el('strong','ma-shop-product__name',product.name),el('span','ma-shop-product__description',product.description));
      const scene=el('span','ma-shop-scene');scene.setAttribute('aria-hidden','true');scene.append(appIcon(product),frame(product));
      const footer=el('span','ma-shop-product__footer'),availability=el('span');availability.dataset.maShopAvailability='';footer.append(availability,icon('arrow'));
      item.append(text,scene,footer);item.addEventListener('click',()=>preview(product));products.append(item);
    }
    const collection=button('','ma-shop-rewards-link'),label=el('span');label.append(el('strong','','Your rewards'),el('span','','Find and equip your owned looks in Progress.'));collection.append(icon('achievement'),label,icon('arrow'));collection.addEventListener('click',openRewards);
    const free=el('details','ma-shop-free');free.append(el('summary','','Your learning stays free'),el('p','ma-atlas-rewards__note','All current practice modes, spaced reviews, Word Bank, progress, goals, Friends and rankings. Existing level rewards stay earnable. Shop items won’t boost XP, protect streaks or improve leaderboard scores.'));
    host.replaceChildren(wallet,intro,products,collection,free);refresh();
  }
  for(const event of ['modeAtlasShopChanged','modeAtlasRewardAccessChanged','modeAtlasProgressChanged'])root.addEventListener(event,refresh);
  root.ModeAtlasShopUI=Object.freeze({mount,refresh});
})(window);
