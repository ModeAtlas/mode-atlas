const test=require('node:test');
const assert=require('node:assert/strict');
const catalogue=require('../assets/app/mode-atlas-shop-catalogue.js');
const rules=require('../assets/app/mode-atlas-reward-rules.js');
const createShop=require('../assets/app/mode-atlas-shop.js');
const createProgress=require('../assets/app/mode-atlas-progress.js');
const dates=require('../assets/app/mode-atlas-date.js');
const wallet=(balance,extra={})=>({version:2,currency:'atlas-coins',balance,coinPurchasesEnabled:false,offers:catalogue.products.map(p=>catalogue.offer(p)).filter(Boolean),owned:[],inventory:{'streak-freeze':0,'streak-repair':0},protection:[],repairDay:null,checkedAt:1000,...extra});

test('pants and dyes migrate old characters and enforce level and permanent purchase access',()=>{
  const chars=require('../assets/app/mode-atlas-avatar-rules.js'),art=require('../assets/ui/mode-atlas-avatar-art.js');
  const old=chars.legacy({...chars.defaults,hair:'flow',hairColor:'amber-ombre',pants:'pinstripe'});
  assert.equal(old.version,1);assert.equal(old.pants,undefined);assert.equal(old.hairColor,'chestnut');assert.ok(chars.valid(old));assert.equal(chars.normalize(old).pants,'classic');
  assert.equal(chars.valid({...old,pants:'classic'}),false);assert.equal(chars.valid({...chars.defaults,pants:'made-up'}),false);
  for(const [id,level]of [['trail',5],['cargo',10],['alpine',20]]){assert.equal(chars.allowed({...chars.defaults,pants:id},level-1,{}),false);assert.equal(chars.allowed({...chars.defaults,pants:id},level,{}),true);}
  for(const [slot,id]of [['pants','pinstripe'],['pants','aurora'],['hairColor','amber-ombre'],['hairColor','rose-gold'],['hairColor','moonlit-silver']]){
    const look={...chars.defaults,[slot]:id};assert.equal(chars.allowed(look,999,{}),false);assert.equal(chars.allowed(look,1,{grants:['shop-'+id]}),true);assert.equal(chars.visible(look,1,{})[slot],chars.defaults[slot]);assert.ok(!art.svg(look).includes('undefined'));
  }
  const a=art.svg({...chars.defaults,hairColor:'rose-gold'}),b=art.svg({...chars.defaults,hairColor:'rose-gold'});assert.notEqual(a.match(/id="([^"]+)"/)[1],b.match(/id="([^"]+)"/)[1]);
});

test('level coin milestones start after level one and remain cumulative through level 999',()=>{
  for(const [level,total]of [[1,0],[2,20],[5,130],[10,280],[15,430],[19,510],[20,580],[999,29910]])assert.equal(catalogue.levelCoins.total(level),total);
  assert.equal(catalogue.levelCoins.total(5)-catalogue.levelCoins.total(4),70);
  assert.equal(catalogue.levelCoins.total(21)-catalogue.levelCoins.total(20),20);
});
test('character options are bounded, earned clothing follows level and old collection grants include new wardrobe items',()=>{
  const characters=require('../assets/app/mode-atlas-avatar-rules.js'),art=require('../assets/ui/mode-atlas-avatar-art.js');
  assert.equal(characters.valid({...characters.defaults,skin:'<script>'}),false);
  assert.equal(characters.valid({...characters.defaults,extra:'no'}),false);
  assert.equal(characters.allowed({...characters.defaults,outfit:'grove'},4,{}),false);
  assert.equal(characters.allowed({...characters.defaults,outfit:'grove'},5,{}),true);
  for(const id of ['sakura','midnight','skyline','evergreen']){
    const look={...characters.defaults,outfit:id,headwear:id};
    assert.equal(characters.allowed(look,999,{allCustom:true}),false);
    assert.equal(characters.allowed(look,1,{grants:['shop-'+id]}),true);
    assert.equal(characters.visible(look,1,{}).outfit,'everyday');
    assert.match(art.svg(look),/^<svg/);
  }
  for(const [slot,items]of Object.entries(characters.choices))for(const item of items)assert.ok(!art.svg({...characters.defaults,[slot]:item.id}).includes('undefined'));
  assert.ok(!art.svg({skin:'<script>alert(1)</script>'}).includes('<script>'));
});

test('catalogue has stable priced products and themes; paid ownership does not come from admin preview access',()=>{
  assert.equal(catalogue.coinPurchasesEnabled,false);assert.equal(catalogue.currency.expires,false);
  assert.equal(new Set(catalogue.products.map(p=>p.id)).size,catalogue.products.length);
  for(const product of catalogue.products){
    assert.ok(Number.isSafeInteger(product.coinPrice)&&product.coinPrice>0);
    for(const reference of product.rewards||[]){
      const item=rules.item(reference.type,reference.id);assert.ok(item);assert.equal(item.kind,product.audience?'exclusive':'shop');assert.equal(item.grant,product.grant);
      assert.equal(rules.unlocked(item,999,{}),false);assert.equal(rules.unlocked(item,1,{grants:[product.grant,...(product.audience?[product.audience]:[])]}),true);assert.equal(rules.unlocked(item,1,{allCustom:true}),!!product.audience);
    }
  }
  for(const [id,level]of [['trail',1],['grove',5],['bridge',10],['summit',20],['lantern',35],['horizon',50]])assert.equal(rules.allowed('frames',id,level,{}),true);
  assert.equal(rules.allowed('banners','hunny',1,{allCustom:true}),true);
});
test('sale windows are inclusive at opening, exclusive at closing and independent of permanent rewards',()=>{
  const product=catalogue.item('sakura'),offers={sakura:{startsAt:1000,endsAt:2000}};
  assert.equal(catalogue.offer(product,offers,999),null);assert.ok(catalogue.offer(product,offers,1000));assert.equal(catalogue.offer(product,offers,2000),null);
  assert.equal(catalogue.offer(product,{sakura:{enabled:false}}),null);
  assert.equal(catalogue.offer(product,{sakura:{startsAt:2000,endsAt:1000}}),null);
  assert.equal(rules.allowed('themes','sakura',1,{grants:['shop-sakura']}),true);
});
test('wallet shares reads, hides a stale balance offline and keeps only account-bound inventory',async()=>{
  let uid='alice',calls=0,clock=1000,online=true,cache=null;
  const shop=createShop({user:()=>uid,online:()=>online,now:()=>clock,read:()=>cache,write:value=>{cache=value;},call:async(action,data,account)=>{assert.equal(account,'alice');calls++;return wallet(250,{protection:['2026-10-01']});}});
  await Promise.all([shop.refresh(),shop.refresh()]);assert.equal(calls,1);assert.equal(shop.current().balance,250);
  await shop.refresh();assert.equal(calls,1);clock+=60001;await shop.refresh();assert.equal(calls,2);
  online=false;await shop.refresh();assert.equal(shop.current().balance,null);assert.deepEqual(shop.protection(),['2026-10-01']);
  uid='bob';assert.deepEqual(shop.protection(),[]);uid='';shop.clear();assert.equal(shop.current().status,'guest');assert.equal(cache,null);
});
test('wallet rejects malformed balances, products and foreign currencies',async()=>{
  for(const result of [wallet(-1),wallet(1.2),wallet(1_000_000_001),wallet(5,{currency:'xp'}),wallet(5,{offers:[{id:'sakura',coinPrice:-1,endsAt:null}]}),null]){
    const shop=createShop({user:()=> 'alice',online:()=>true,call:async()=>result});await shop.refresh();assert.equal(shop.current().status,'unavailable');assert.equal(shop.current().balance,null);
  }
});
test('ambiguous purchase retries reuse the receipt ID across reload without optimistic balance or inventory writes',async()=>{
  let cache=null,attempt=0,ids=[];
  const deps={user:()=> 'alice',online:()=>true,read:()=>cache,write:value=>{cache=structuredClone(value);},requestId:()=> 'unique-request-id-123',sync:async()=>true,
    call:async(action,data)=>{if(action==='shop')return wallet(1000);ids.push(data.requestId);if(++attempt===1)throw Object.assign(new Error('timeout'),{code:'deadline-exceeded'});return wallet(500,{owned:['sakura']});}};
  const shop=createShop(deps);await shop.refresh();await assert.rejects(shop.purchase('sakura'));assert.equal(shop.current().balance,1000);assert.deepEqual(shop.current().owned,[]);
  const restored=createShop(deps);await restored.refresh();await restored.purchase('sakura');assert.deepEqual(ids,['unique-request-id-123','unique-request-id-123']);assert.equal(restored.current().balance,500);assert.deepEqual(restored.current().owned,['sakura']);assert.deepEqual(cache.requests,{});
});
test('a delayed purchase cannot apply to a new account and repeated taps do not start another request',async()=>{
  let uid='alice',finish,calls=0;
  const shop=createShop({user:()=>uid,online:()=>true,requestId:()=> 'long-request-123456',call:async action=>{if(action==='shop')return wallet(1000);calls++;return new Promise(resolve=>{finish=resolve;});}});
  await shop.refresh();const old=shop.purchase('sakura');await new Promise(resolve=>setImmediate(resolve));await assert.rejects(shop.purchase('sakura'),/previous purchase/);assert.equal(calls,1);
  uid='bob';shop.clear();finish(wallet(500,{owned:['sakura']}));await assert.rejects(old,/account changed/);assert.equal(shop.current().balance,null);assert.deepEqual(shop.current().owned,[]);
});
test('a repair requires synced study evidence while shopping stays independent of an active lesson',async()=>{
  let calls=0;const shop=createShop({user:()=> 'alice',online:()=>true,sync:async()=>false,requestId:()=> 'long-request-123456',call:async()=>{calls++;return wallet(1000);}});
  await shop.refresh();await shop.purchase('sakura');await assert.rejects(shop.useRepair(),/could not sync/);assert.equal(calls,2);
});
test('protected days bridge a study streak without counting as study days or inventing a new streak',()=>{
  const progress=createProgress({ModeAtlasDates:dates,ModeAtlasRewardRules:rules});
  assert.equal(progress.studyStreak(['2026-10-01','2026-10-02','2026-10-04'],'2026-10-04',['2026-10-03']),3);
  assert.equal(progress.studyStreak(['2026-10-01','2026-10-02'],'2026-10-04',['2026-10-03']),2);
  assert.equal(progress.studyStreak(['2026-10-01','2026-10-02'],'2026-10-05',['2026-10-03']),0);
  assert.equal(progress.studyStreak([],'2026-10-04',['2026-10-03']),0);
});

test('expanded styles preserve old IDs and exclusive Hunny access covers every matching piece',()=>{
  const characters=require('../assets/app/mode-atlas-avatar-rules.js'),art=require('../assets/ui/mode-atlas-avatar-art.js');
  for(const id of ['crop','sweep','bob','waves','long','coils','bun','shaved','curtains','quiff','short-curls','ponytail','braids','pixie','side-part','french-crop','messy-fringe','slick-back','flow','bald'])assert.equal(characters.allowed({...characters.defaults,hair:id},1,{}),true);
  assert.equal(characters.choices.skin.length,11);
  for(const id of ['textured-fade','ribbon-waves','sculpted-pompadour','braided-undercut']){
    const value={...characters.defaults,hair:id};assert.equal(characters.allowed(value,999,{allCustom:true}),false);
    assert.equal(characters.allowed(value,1,{grants:['shop-'+id]}),true);assert.equal(characters.visible(value,1,{}).hair,'sweep');
  }
  const look={...characters.defaults,outfit:'hunny',headwear:'hunny',accessory:'hunny'};
  assert.equal(characters.allowed(look,999,{}),false);assert.equal(characters.allowed(look,1,{grants:['hunny-tester']}),false);assert.equal(characters.allowed(look,1,{allCustom:true}),true);
  assert.equal(characters.allowed(look,1,{grants:['hunny-tester','shop-hunny-jumper','shop-hunny-pendant']}),true);
  assert.equal(characters.allowed(look,1,{grants:['shop-hunny-jumper','shop-hunny-pendant']}),false);
  for(const id of ['hunny-jumper','hunny-pendant']){
    const item=catalogue.item(id);assert.equal(catalogue.offer(item),null);
    assert.equal(catalogue.offer(item,{},0,{grants:['hunny-tester']}).coinPrice,10);
    assert.equal(catalogue.offer(item,{},0,{allCustom:true}).coinPrice,10);
  }
  assert.equal(catalogue.products.some(p=>p.grant==='hunny-tester'),false);
  for(const [slot,type]of Object.entries(characters.slots))for(const item of rules.catalogue[type])assert.ok(!art.svg({...characters.defaults,[slot]:item.id}).includes('undefined'));
});

test('companion milestones, dress ownership and old-client projections stay bounded',()=>{
  const rules=require('../assets/app/mode-atlas-avatar-rules.js'),rewards=require('../assets/app/mode-atlas-reward-rules.js');
  for(const [pet,level]of [['shiba',10],['calico',15],['rabbit',20],['tanuki',40],['crane',50]]){
    assert.equal(rules.allowed({...rules.defaults,pet},level-1,{}),false);assert.equal(rules.allowed({...rules.defaults,pet},level,{}),true);
  }
  const look={...rules.defaults,outfit:'seigaiha-kimono',outfitColor:'navy',pants:'starfall-skirt',pantsColor:'plum',pet:'japanese-spitz',petName:'Shiro'};
  assert.equal(rules.allowed(look,99,{}),false);
  assert.equal(rules.allowed(look,1,{grants:['shop-seigaiha-kimono','shop-starfall-skirt','shop-japanese-spitz']}),true);
  assert.equal(rules.valid({...look,outfitColor:'coral'}),false);assert.equal(rules.valid({...look,petName:'<script>'}),false);assert.equal(rules.valid({...look,petName:'x'.repeat(25)}),false);
  for(const version of [1,2]){const older=rules.compatible(look,version);assert.equal(older.version,version);assert.equal(older.pet,undefined);assert.equal(older.outfit,'everyday');assert.equal(rules.valid(older),true);}
});
