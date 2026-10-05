/* Private, account-bound safety notices. No warning counts enter public profiles. */
(function ModeAtlasAccountNotices(root){
  'use strict';
  let owner='',inflight=false,visible=false,lastCheck=0,role='member',retry;
  const busy=()=>root.ModeAtlasDialog?.isOpen()||root.ModeAtlasTour?.isOpen()||document.querySelector('#maVisitModal.open')||document.body?.classList.contains('trainer-session-active');
  const user=()=>root.KanaCloudSync?.getUser?.()?.uid||'';
  function badge(){
    const name=document.getElementById('profileName');if(!name)return;
    let node=document.getElementById('profileOfficialBadge');
    if(!node){node=document.createElement('span');node.id='profileOfficialBadge';node.className='ma-official-badge';name.after(node);}
    node.hidden=!owner||!['admin','moderator'].includes(role);node.textContent=node.hidden?'':role==='admin'?'✓ Admin':'✓ Moderator';
  }
  async function check(force=false){
    const uid=user();
    if(uid!==owner){owner=uid;role='member';lastCheck=0;if(visible)root.ModeAtlasDialog.close(false);badge();}
    if(!uid||inflight||visible||!root.ModeAtlasSocial?.isEnabled()||document.hidden)return;
    if(!force&&Date.now()-lastCheck<60000)return;
    if(busy()){clearTimeout(retry);retry=setTimeout(()=>check(force),1500);return;}
    inflight=true;
    try{
      const result=await root.ModeAtlasSocial.call('accountNotices',{},uid);if(user()!==uid)return;
      lastCheck=Date.now();role=result.role||'member';badge();
      if(!result.warnings?.length)return;
      if(busy()){lastCheck=0;retry=setTimeout(()=>check(),1500);return;}
      const content=document.createElement('div');content.className='ma-account-notices';
      for(const warning of result.warnings){const item=document.createElement('article'),date=document.createElement('small'),message=document.createElement('p');date.textContent=new Date(warning.at).toLocaleDateString();message.textContent=warning.message;item.append(date,message);content.append(item);}
      visible=true;
      const accepted=await root.ModeAtlasDialog.confirm({title:'A message from Mode Atlas',kicker:'Account warning',contentNode:content,confirmLabel:'I understand',cancelLabel:'Read later',dismissOnBackdrop:false});
      visible=false;
      if(accepted&&user()===uid)await root.ModeAtlasSocial.call('acknowledgeWarnings',{ids:result.warnings.map(item=>item.id)},uid);
    }catch(error){if(user()===uid)lastCheck=Date.now()-45000;}
    finally{inflight=false;visible=false;if(user()!==uid)void check();}
  }
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{void check();});
  root.addEventListener('modeAtlasAccountSignedOut',()=>{owner='';role='member';lastCheck=0;if(visible)root.ModeAtlasDialog.close(false);badge();});
  root.addEventListener('modeAtlasAppStateChanged',event=>{if(event.detail.isActive)void check(true);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check(true);});
  document.addEventListener('ma:visit-flow-closed',()=>{void check();});
  root.addEventListener('modeAtlasProfileMenuReady',badge);
  root.addEventListener('pageshow',()=>{void check();});
  void root.KanaCloudSync?.ready?.then(()=>check());
})(window);
