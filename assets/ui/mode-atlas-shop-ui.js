/* Shop presentation reuses the existing reward selection and dialog owners. */
(function(root){
  'use strict';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const button=(label,cls='ma-button ma-button--ghost')=>{const node=el('button',cls,label);node.type='button';return node;};
  const catalogue=root.ModeAtlasShopCatalogue,rules=root.ModeAtlasRewardRules;
  const available=product=>rules.unlocked(rules.item('banners',product.id),root.ModeAtlasProgress.getSummary().level,root.ModeAtlasRewardAccess?.current());
  function look(product){
    const frame=rules.item('frames',product.id),preview=el('div','ma-shop-look ma-profile-banner');preview.dataset.maBanner=product.id;
    const avatar=el('span','ma-atlas-avatar',frame.symbol);avatar.dataset.maFrame=frame.frame;avatar.setAttribute('aria-hidden','true');
    const copy=el('span','ma-shop-look__copy');copy.append(el('strong','','Your profile'),el('span','',frame.title));preview.append(avatar,copy);return preview;
  }
  function preview(product){
    const content=el('div','ma-shop-detail');content.append(look(product));
    const includes=el('div','ma-shop-includes'),icon=el('img');icon.src='/assets/rewards/'+rules.item('icons',product.id).icon+'.svg';icon.alt=product.name+' app icon';
    const copy=el('div');copy.append(el('strong','','One coordinated look'),el('p','','Profile banner, title and frame, plus an iOS app icon.'));includes.append(icon,copy);content.append(includes);
    const note=el('p','ma-atlas-rewards__note',available(product)?'Available on your account. Choose the parts you want to use.':'Preview only. Purchases aren’t available yet.');content.append(note);
    const actions=el('div','ma-atlas-rewards__actions');
    if(available(product)){
      const apply=button('Use banner & frame','ma-button ma-button--primary');
      apply.addEventListener('click',()=>{
        if(!available(product)){root.ModeAtlasFeedback.toast('This look is no longer available on this account.','info');return;}
        if(root.ModeAtlasProgress.selectBanner(product.id)&&root.ModeAtlasProgress.selectAppearance(product.id)){
          note.textContent='Banner and frame applied. Your learning progress is unchanged.';root.ModeAtlasFeedback.toast('Your look is updated.','success');
        }
      });actions.append(apply);
      if(root.AtlasPlatform.getCapabilities().alternateIcons){
        const useIcon=button('Use app icon');
        useIcon.addEventListener('click',async()=>{
          if(useIcon.disabled||!available(product))return;
          useIcon.disabled=true;
          try{await root.AtlasPlatform.setAppIcon(rules.item('icons',product.id).icon);root.ModeAtlasFeedback.toast('App icon updated.','success');}
          catch{root.ModeAtlasFeedback.toast('The app icon could not be changed. Please try again.','error');}
          finally{useIcon.disabled=false;}
        });actions.append(useIcon);
      }
    }
    content.append(actions);void root.ModeAtlasDialog.feature({title:product.name,kicker:'Shop',contentNode:content});
  }
  function refresh(){
    const host=document.querySelector('[data-ma-shop]');if(!host)return;
    const wallet=root.ModeAtlasShop?.current()||{status:'guest',balance:null},balance=host.querySelector('[data-ma-token-balance]');
    balance.textContent=wallet.balance!==null?wallet.balance.toLocaleString()+' tokens':wallet.status==='guest'?'Sign in to view your balance':wallet.status==='loading'?'Checking balance…':wallet.status==='offline'?'Balance unavailable offline':'Balance not available yet';
    const retry=host.querySelector('[data-ma-shop-refresh]');retry.hidden=!['unavailable','offline'].includes(wallet.status);
    for(const product of catalogue.products){const label=host.querySelector('[data-ma-shop-product="'+product.id+'"] [data-ma-shop-availability]');label.textContent=available(product)?'Available on your account':'Preview collection';}
  }
  function mount(host){
    host.dataset.maShop='';host.classList.add('ma-shop');
    const intro=el('div','ma-shop-intro');intro.append(el('span','ma-shop-eyebrow','Make Atlas yours'),el('h3','','A little more you.'),el('p','ma-atlas-rewards__note','Optional looks. Your learning stays free.'));
    const notice=el('p','ma-shop-notice','Explore the collections below. Purchases aren’t available yet.');
    const products=el('div','ma-shop-products');
    for(const product of catalogue.products){
      const item=button('','ma-shop-product');item.dataset.maShopProduct=product.id;item.setAttribute('aria-label','Preview '+product.name+' collection');item.setAttribute('aria-haspopup','dialog');
      const detail=el('span','ma-shop-product__copy'),availability=el('span','ma-shop-product__availability');availability.dataset.maShopAvailability='';
      detail.append(el('strong','',product.name),el('span','',product.description),availability);item.append(look(product),detail);item.addEventListener('click',()=>preview(product));products.append(item);
    }
    const wallet=el('section','ma-shop-wallet');wallet.setAttribute('aria-label','Premium token wallet');
    const heading=el('div','ma-shop-wallet__heading');heading.append(el('h3','',catalogue.currency.name));
    const info=button('i','ma-info-button');info.setAttribute('aria-label','About Atlas Tokens');info.setAttribute('aria-haspopup','dialog');
    info.addEventListener('click',()=>root.ModeAtlasDialog.alert({title:'Atlas Tokens',message:'A planned currency for optional shop items, separate from earned XP. When purchases launch, you’ll be able to buy tokens or eligible collections directly. Purchased tokens won’t expire. Prices and token packs will be shown before you buy. Purchases are unavailable in this version.',confirmLabel:'Got it'}));heading.append(info);
    const value=el('p','ma-shop-wallet__balance');value.dataset.maTokenBalance='';value.setAttribute('role','status');
    const retry=button('Refresh balance');retry.dataset.maShopRefresh='';retry.hidden=true;retry.addEventListener('click',()=>void root.ModeAtlasShop.refresh(true));
    wallet.append(heading,value,retry);
    const free=el('details','ma-shop-free');free.append(el('summary','','What stays free?'),el('p','ma-atlas-rewards__note','All current practice modes, spaced reviews, Word Bank, progress, goals, Friends and rankings. Existing level rewards stay earnable. Shop items won’t boost XP, protect streaks or improve leaderboard scores.'));
    host.append(intro,notice,products,wallet,free);refresh();
  }
  for(const event of ['modeAtlasShopChanged','modeAtlasRewardAccessChanged','modeAtlasProgressChanged'])root.addEventListener(event,refresh);
  root.ModeAtlasShopUI=Object.freeze({mount,refresh});
})(window);
