const test=require('node:test');
const assert=require('node:assert/strict');
const catalogue=require('../assets/app/mode-atlas-shop-catalogue.js');
const rules=require('../assets/app/mode-atlas-reward-rules.js');
const createShop=require('../assets/app/mode-atlas-shop.js');
const wallet=balance=>({version:1,currency:'atlas-tokens',balance,purchasesEnabled:false});

test('shop products resolve to real cosmetics without changing free level rewards or enabling payments',()=>{
  assert.equal(catalogue.purchasesEnabled,false);assert.equal(catalogue.currency.expires,false);
  assert.equal(new Set(catalogue.products.map(p=>p.storeProductId)).size,catalogue.products.length);
  for(const product of catalogue.products){
    assert.equal(product.tokenPrice,null);
    for(const reference of product.rewards){
      const item=rules.item(reference.type,reference.id);assert.ok(item);assert.equal(item.kind,'shop');assert.equal(item.grant,product.grant);
      assert.equal(rules.unlocked(item,999,{}),false);assert.equal(rules.unlocked(item,1,{grants:[product.grant]}),true);assert.equal(rules.unlocked(item,1,{allCustom:true}),true);
    }
  }
  for(const [id,level]of [['trail',1],['grove',5],['bridge',10],['summit',20],['lantern',35],['horizon',50]]){
    assert.equal(rules.allowed('frames',id,level,{}),true);assert.equal(rules.allowed('banners',id,level,{}),true);
  }
});
test('wallet loads once for the active account, remains read-only and clears on sign-out',async()=>{
  let uid='alice',calls=0,clock=1000;
  const shop=createShop({user:()=>uid,online:()=>true,now:()=>clock,fetch:async account=>{assert.equal(account,'alice');calls++;return wallet(250);}});
  await Promise.all([shop.refresh(),shop.refresh()]);assert.equal(calls,1);assert.deepEqual(shop.current(),{status:'ready',balance:250});
  await shop.refresh();assert.equal(calls,1);clock+=60001;await shop.refresh();assert.equal(calls,2);
  assert.deepEqual(Object.keys(shop).sort(),['clear','current','refresh']);uid='';shop.clear();assert.deepEqual(shop.current(),{status:'guest',balance:null});
  await shop.refresh();assert.equal(calls,2);
});
test('wallet rejects malformed values and never invents a balance while offline or unavailable',async()=>{
  for(const result of [wallet(-1),wallet(1.2),wallet(1_000_000_001),{...wallet(5),currency:'xp'},{...wallet(5),purchasesEnabled:true},null]){
    const shop=createShop({user:()=> 'alice',online:()=>true,fetch:async()=>result});await shop.refresh();assert.deepEqual(shop.current(),{status:'unavailable',balance:null});
  }
  let online=true;
  const shop=createShop({user:()=> 'alice',online:()=>online,fetch:async()=>wallet(600)});await shop.refresh();online=false;await shop.refresh();assert.deepEqual(shop.current(),{status:'offline',balance:null});
});
test('a delayed wallet response cannot leak into the next signed-in account',async()=>{
  let uid='alice',finish;
  const shop=createShop({user:()=>uid,online:()=>true,fetch:async()=>new Promise(resolve=>{finish=resolve;})});
  const old=shop.refresh();uid='bob';shop.clear();finish(wallet(1500));await old;assert.equal(shop.current().balance,null);
  const fresh=shop.refresh();finish(wallet(0));await fresh;assert.deepEqual(shop.current(),{status:'ready',balance:0});
});
