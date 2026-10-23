/* Lazy administrator directory. The server owns authorization and pagination;
   no private account data is cached in storage or shared with Friends UI. */
(function(root){
  'use strict';
  const el=(tag,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
  const button=(label,action)=>{const node=el('button','ma-button ma-button--small',label);node.type='button';node.addEventListener('click',action);return node;};
  const date=value=>value?new Date(value).toLocaleString():'—';
  function render(){
    const host=el('section','ma-dev-accounts'),uid=root.KanaCloudSync?.getUser?.()?.uid;let generation=0;
    const active=ticket=>host.isConnected&&ticket===generation&&uid===root.KanaCloudSync?.getUser?.()?.uid&&root.ModeAtlasDevConsoleLoader.isEligible();
    const request=(action,data)=>root.ModeAtlasSocial.call(action,data,uid);
    const status=el('p','ma-status');status.setAttribute('role','status');
    const form=el('form','ma-dev-search'),input=el('input','ma-dev-progress-input');input.type='search';input.placeholder='Exact email or account ID';input.setAttribute('aria-label','Find account');input.maxLength=254;
    const search=el('button','ma-button ma-button--small','Find');search.type='submit';form.append(input,search,button('All accounts',()=>{input.value='';void load();}));
    const list=el('div','ma-dev-account-list'),paging=el('div','ma-dev-actions');host.append(el('h3','','Account directory'),form,status,list,paging);
    let currentCursor;
    async function load(cursor){
      const ticket=++generation;currentCursor=cursor;list.replaceChildren();paging.replaceChildren();status.textContent='Loading accounts…';form.setAttribute('aria-busy','true');
      try{
        const result=await request('adminUsers',input.value.trim()?{query:input.value.trim()}:cursor?{cursor}:{});if(!active(ticket))return;
        status.textContent=result.rows.length?`${result.rows.length} accounts on this page`:'No matching accounts.';
        for(const item of result.rows){
          const row=el('article','ma-dev-account-row'),copy=el('div','ma-dev-account-copy');copy.append(el('strong','',item.displayName),el('span','',item.email||item.uid),el('small','',`${item.role} · ${item.disabled?'Disabled':item.verified?'Verified':'Unverified'}${item.restricted?' · Restricted':''}`));
          row.append(copy,button('Inspect',()=>void inspect(item)));list.append(row);
        }
        if(cursor)paging.append(button('First page',()=>void load()));
        if(result.nextCursor)paging.append(button('Next 25',()=>void load(result.nextCursor)));
      }catch(error){if(active(ticket))status.textContent=root.ModeAtlasSocial.message(error);}
      finally{if(active(ticket))form.removeAttribute('aria-busy');}
    }
    async function inspect(item){
      const ticket=++generation;list.replaceChildren();paging.replaceChildren();status.textContent='Reading account health…';
      try{
        const data=await request('adminInspect',{uid:item.uid});if(!active(ticket))return;
        status.textContent=item.displayName+' · '+(item.email||item.uid);
        const details=el('dl','ma-dev-detail-grid');
        const fields={'Account ID':data.uid,'Save health':data.save.problem||'Readable','Sign-in providers':data.providers.join(', ')||'Email','Cloud save':data.save.exists?`Revision ${data.save.revision} · generation ${data.save.generation}`:'No save yet','Last server save':date(data.save.updatedAt),'Sections':data.save.sections.map(s=>s.name+(s.partitioned?` (${s.parts} parts)`:'' )).join(', ')||'—','Friends':data.social.restricted?'Restricted':data.social.active?'Active':'Not joined','Profile projection':`v${data.social.projectionVersion}${data.social.refreshQueued?' · Refresh queued':''}`,'Last profile sync':date(data.social.syncedAt),'Atlas Coins':data.wallet.balance,'Study Tokens':data.wallet.tokenBalance,'Purchases':data.wallet.purchases,'Warnings':data.warningCount,'Deletion':data.deleting?'In progress':'None'};
        for(const [name,value]of Object.entries(fields)){details.append(el('dt','',name),el('dd','',String(value)));}list.append(details);
        if(data.learning){list.append(el('p','','Introduced: '+((data.learning.introduced||[]).join(' ')||'—')),el('h4','','Reported learning progress'),el('p','',`Level ${data.learning.level} · ${data.learning.correct}/${data.learning.attempts} Kana answers`),el('p','ma-dev-kana-list','Practised: '+(data.learning.kana.join(' ')||'—')));}
        if(data.receipts.length){list.append(el('h4','','Recent verified study receipts'));for(const receipt of data.receipts)list.append(el('p','ma-dev-receipt',`${receipt.branch} · ${receipt.answers} answers · ${receipt.finished?'Finished':'In progress'} · ${date(receipt.updatedAt)}`));}
        const moderation=el('a','ma-button ma-button--small','Moderation & warnings');moderation.href='/friends/?moderate='+encodeURIComponent(item.uid);
        paging.append(button('Back to accounts',()=>void load(currentCursor)),moderation);
        if(item.uid!==uid&&item.role!=='admin'){
          const reason=el('input','ma-dev-progress-input');reason.placeholder='Reason for access change';reason.maxLength=240;reason.setAttribute('aria-label','Reason for access change');
          const access=el('div','ma-dev-access');access.append(reason);
          for(const [operation,label]of [['revoke','End all sessions'],[data.disabled?'restore':'suspend',data.disabled?'Restore access':'Suspend account']])access.append(button(label,async()=>{
            if(!active(ticket))return;
            if(reason.value.trim().length<5){status.textContent='Enter a reason of at least 5 characters.';reason.focus();return;}
            const approved=await root.ModeAtlasFeedback.confirm({title:label+'?',message:`Account: ${item.email||item.uid}. ${operation==='restore'?'They will need to sign in again.':'Cloud access will stop immediately. Local offline data cannot be recalled.'}`,confirmLabel:label,cancelLabel:'Cancel',tone:'warning'});
            if(!approved||!active(ticket))return;
            access.inert=true;
            try{await root.KanaCloudSync.confirmCurrentSignIn();if(!active(ticket))return;await request('adminAccess',{uid:item.uid,operation,reason:reason.value.trim()});if(active(ticket))await inspect({...item,disabled:operation==='suspend'?true:operation==='restore'?false:item.disabled});}
            catch(error){if(active(ticket))status.textContent=root.ModeAtlasSocial.message(error);}
            finally{access.inert=false;}
          }));list.append(access);
        }
      }catch(error){if(active(ticket)){status.textContent=root.ModeAtlasSocial.message(error);paging.append(button('Back to accounts',()=>void load(currentCursor)));}}
    }
    form.addEventListener('submit',event=>{event.preventDefault();void load();});queueMicrotask(()=>void load());return host;
  }
  root.ModeAtlasDevAccounts=Object.freeze({render});
})(window);
