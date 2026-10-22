/* Lazy operational views. All data is fetched through administrator callables. */
(function(root){
  'use strict';
  const el=(tag,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
  const date=value=>value?new Date(value).toLocaleString():'—';
  function render(kind){
    const host=el('section','ma-dev-monitoring'),uid=root.KanaCloudSync?.getUser?.()?.uid;
    let generation=0;
    const active=ticket=>host.isConnected&&ticket===generation&&uid===root.KanaCloudSync?.getUser?.()?.uid&&root.ModeAtlasDevConsoleLoader.isEligible();
    const status=el('p','ma-status');status.setAttribute('role','status');
    const body=el('div','ma-dev-account-list'),controls=el('div','ma-dev-actions');
    const button=(label,action)=>{const b=el('button','ma-button ma-button--small',label);b.type='button';b.onclick=action;return b;};
    host.append(el('h3','',kind==='usage'?'Guest learning reports':'Security & access'),status,body,controls);
    async function load(cursor){
      const ticket=++generation;status.textContent='Loading…';body.replaceChildren();controls.replaceChildren();
      try{
        const data=await root.ModeAtlasSocial.call(kind==='usage'?'adminUsage':'adminSecurity',cursor?{cursor}:{},uid);if(!active(ticket))return;
        if(kind==='usage'){
          status.textContent=`Participating devices: ${data.counts[0]} in 24 hours · ${data.counts[1]} in 7 days · ${data.counts[2]} in 30 days`;
          body.append(el('p','','Opt-in guest summaries, not total visitors or verified study receipts. Clearing browser data or using another device creates a separate participant.'));
          if(!root.ModeAtlasAppCheck?.ready())body.append(el('p','ma-status','Collection is inactive on this build. Complete the App Check setup in docs/security-2.120.0.md before enabling guest reporting.'));
          for(const row of data.rows){
            const card=el('article','ma-dev-monitoring-card');card.append(el('h4','',`Device ${row.id} · ${row.platform} ${row.version}`),el('p','',`Level ${row.level} · ${row.xp} XP · ${row.correct}/${row.attempts} Kana answers`),el('p','',`Last branch: ${row.branch} · ${date(row.lastSeen)}`),el('p','',`Introduced: ${(row.introduced||[]).join(' ')||'—'}`),el('p','',`Practised: ${row.kana.join(' ')||'—'}`));if(row.funnel)card.append(el('p','',Object.entries(row.funnel).map(([key,value])=>key+': '+value).join(' · ')));body.append(card);
          }
          if(!data.rows.length)body.append(el('p','','No participating guest devices in this period.'));
          if(data.nextCursor)controls.append(button('Next 25',()=>void load(data.nextCursor)));
        }else{
          status.textContent=`App Check on account calls: ${data.appCheckEnforced?'enforced':'monitoring only'} · Guest reporting: always enforced`;
          body.append(el('p','','Use Accounts → Inspect to end sessions or suspend/restore access. Those actions require a fresh sign-in and a reason. Pending actions keep access blocked until a retry completes.'));
          const link=el('a','ma-button ma-button--small','Open Firebase security & usage');link.href='https://console.firebase.google.com/project/mode-atlus/overview';link.target='_blank';link.rel='noopener noreferrer';body.append(link);
          body.append(el('h4','','Recent access changes · 90-day retention'));
          for(const row of data.audit){const card=el('article','ma-dev-monitoring-card');card.append(el('strong','',`${row.operation} · ${row.status}`),el('p','',row.reason),el('small','',`${row.target} · ${date(row.at)}`));body.append(card);}
          if(!data.audit.length)body.append(el('p','','No recorded access changes.'));
          if(data.studyReviews?.length){body.append(el('h4','','Study rewards held for review'));for(const row of data.studyReviews)body.append(el('p','',`${row.uid} · ${row.reason} · ${date(row.at)}`));}
          if(data.rewardReviews?.length){
            body.append(el('h4','','Weekly rewards held for review'));
            for(const row of data.rewardReviews)body.append(el('p','',`${row.uid} · ${row.week} · #${row.rank} · ${row.reason} · ${date(row.at)}`));
          }
        }
        controls.append(button('Refresh',()=>void load()));
      }catch(error){if(active(ticket)){status.textContent=root.ModeAtlasSocial.message(error);controls.append(button('Retry',()=>void load(cursor)));}}
    }
    queueMicrotask(()=>void load());return host;
  }
  root.ModeAtlasDevMonitoring=Object.freeze({render});
})(window);
