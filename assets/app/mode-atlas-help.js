/* Searchable reference help, in-app support and the bundled legal reader. Policy HTML stays in its one
   canonical document; reading it never navigates away from unfinished practice. */
(function ModeAtlasHelp(root){
  'use strict';
  const support='support@mode-atlas.com';let feedbackOpen=false,legalOpen=0;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!=null)node.textContent=text;return node;};
  const button=(label,action)=>{const node=el('button','ma-button',label);node.type='button';node.addEventListener('click',action);return node;};
  function field(label,node){const holder=el('label','ma-help-field',label);holder.append(node);return holder;}
  const topics=[
    {id:'reviews',title:'Reviews & study days',keywords:'due spaced schedule streak goals',read:()=>[
      ['When to review',root.ModeAtlasReview.dueHelp()],
      ['Study goals','Daily goals reset at local midnight; weekly goals run Monday to Sunday. Personal goals can repeat. Editing a goal does not award its XP a second time.']
    ]},
    {id:'kana',title:'Kana progress & mastery',keywords:'read recall handwriting familiar confident mastered rows unlock hints speed accuracy',read:()=>{
      const learning=root.ModeAtlasKanaLearning,familiar=learning.requirements.familiar,hand=learning.requirements.handwriting[5];
      const recallRule=stage=>{const r=root.ModeAtlasReview.requirements[stage];return `${r.correct} correct; ${r.attempts} recent unassisted attempts at ${r.accuracy*100}% accuracy, recall on ${r.days} days and ${r.level} spaced steps.`;};
      return [
        ['New','No lesson or practice recorded yet.'],['Introduced','Met in a lesson. Answer in Read or Recall to start practising.'],
        ['Learning','Practice has started. Work toward the Familiar targets.'],
        ['Familiar',`Read or Recall: ${familiar.correct} correct unassisted answers at ${familiar.accuracy*100}% recent accuracy. Every character in a row must be Familiar in that skill to open its next row.`],
        ['Confident','Both Read and Recall are at least Familiar; one also meets: '+recallRule(2)],
        ['Mastered','Both Read and Recall meet: '+recallRule(3)],
        ['Mastered+',`Mastered, plus ${hand.correct} clean writes without a guide across ${hand.days} days. Handwriting is optional and has its own row progression.`],
        ['Recent practice','The last 24 answers; correct answers with hints are excluded. Spaced steps advance on correct unassisted answers when a review is due. Repeating quickly does not advance those steps.'],
        ['Earned progress','Milestones and unlocked rows stay earned. Overall accuracy and speed are reference measures. Earlier practice without review history uses accuracy and speed until new answers add that history.']
      ];
    }},
    {id:'kanji',title:'Kanji levels & mastery',keywords:'N5 N4 N3 N2 N1 band pronunciation meaning unlocked recent',read:()=>[
      ['Opening the next band','Recall each character’s reading and meaning without hints to complete it. Completing a band opens the next one. N5–N1 group content by approximate difficulty.'],
      ['Building mastery','Practise readings and meanings without hints across several days. Your last 12 answers show what to revisit. Tap a character in the Mastery Map for its exact targets. Earned milestones stay saved.']
    ]},
    {id:'milestones',title:'Achievements & profile percentages',keywords:'count milestones ranks completion friends mastered locked',read:()=>[
      ['Achievements','Each rank is a milestone. Completion counts current study milestones across Atlas, Kana, Kanji and Words. Special rewards and retired milestones stay in your collection without affecting the percentage. Earned ranks stay earned.'],
      ['Mastery percentages','Only characters at Mastered or Mastered+ count toward the percentage. Confident and Building show progress on the way there. Each branch uses its full current curriculum, including locked characters.']
    ]},
    {id:'weekly',title:'Weekly competition',keywords:'leaderboard ladder rankings prizes rules XP coins reset ties',read:()=>[
      ['Reset & prizes','Everyone resets on Monday at 00:00 UTC. At least two learners must earn 100 weekly XP. First, second and third receive 500, 300 and 150 personal XP. First place also earns 100 Atlas Coins. Ties share the same place and prize.'],
      ['What counts','Online Kana Read and Recall answers are checked by the server. Broader practice earns more; hints reduce the rate. Completion and goal bonuses, old saves and prizes count only toward personal XP.'],
      ['Connection & limits','Submit before the reset. Interrupted connections can retry within the same one-hour session. The daily safety limit is 20,000 weekly XP.'],
      ['Leaving','Use Leave weekly competition on the weekly board. Rejoining that week restores your existing weekly score. Your personal XP and Friends remain available.']
    ]},
    {id:'rewards',title:'Coins, tokens & rewards',keywords:'shop currency earn purchases themes banners wardrobe icons frames',read:()=>[
      ['Study Tokens','Earn tokens through correct answers, level-ups and consistent study days. Wider kana practice earns more, and hints reduce the rate. Sign in and connect before starting a session to earn verified rewards. Offline practice still saves personal learning progress.'],
      ['Your collection','Choose collected themes, banners, titles and frames in Progress → Rewards. Edit avatar & pet opens your wardrobe. Available app icons change this device’s Home Screen icon.'],
      ['Atlas Coins','Shop items show their price before purchase. Coin-purchase buttons are placeholders; coin purchases are not available yet.']
    ]},
    {id:'saving',title:'Saving & offline study',keywords:'account sync cloud data device restore backup internet pronunciation',read:()=>[
      ['Your learning','Practice saves on this device. Sign in to sync learning between devices; check your account’s sync status before clearing storage or changing devices.'],
      ['Offline','The installed iOS app bundles its lessons and character guidance. A browser needs a connection to load pages; an already-open practice session saves locally. Verified rewards require a connected, signed-in session.'],
      ['Pronunciation','Pronunciation uses your device’s Japanese voice. Listening practice requires successful playback; other practice remains available without audio.']
    ]}
  ];
  let helpOpen=false;
  function open(topicId){
    if(helpOpen)return;helpOpen=true;
    const host=el('div','ma-help-browser'),search=el('input'),index=el('div','ma-help-index'),article=el('article','ma-help-article');
    search.type='search';search.placeholder='Search help';search.setAttribute('aria-label','Search help');
    const searchField=field('Find a topic',search),status=el('p','ma-help-note');status.setAttribute('role','status');
    host.append(searchField,status,index,article);article.hidden=true;
    function top(){const panel=host.closest('.ma-dialog');if(panel)panel.scrollTop=0;}
    function showIndex(focusId){
      searchField.hidden=false;index.hidden=false;article.hidden=true;status.hidden=false;
      const words=search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const matches=topics.filter(topic=>words.every(word=>(topic.title+' '+topic.keywords).toLocaleLowerCase().includes(word)));
      status.textContent=matches.length?'':'No matching topics. Try another word.';
      index.replaceChildren(...matches.map(topic=>{const control=button(topic.title,()=>showTopic(topic));control.dataset.helpTopic=topic.id;return control;}));
      top();if(focusId)index.querySelector(`[data-help-topic="${focusId}"]`)?.focus({preventScroll:true});
    }
    function showTopic(topic){
      searchField.hidden=true;index.hidden=true;status.hidden=true;article.hidden=false;
      const back=button('All help topics',()=>showIndex(topic.id)),title=el('h3','',topic.title);title.tabIndex=-1;
      article.replaceChildren(back,title);
      for(const [label,copy]of topic.read()){const section=el('section');section.append(el('h4','',label),el('p','',copy));article.append(section);}
      top();title.focus({preventScroll:true});
    }
    search.addEventListener('input',()=>showIndex());showIndex();
    root.ModeAtlasDialog.feature({title:'Help',kicker:'Mode Atlas',contentNode:host,size:'wide'}).finally(()=>{helpOpen=false;});
    const initial=topics.find(topic=>topic.id===topicId);if(initial)showTopic(initial);
  }
  function feedback(){
    if(feedbackOpen)return;feedbackOpen=true;
    const form=el('form','ma-help-form'),category=el('select'),message=el('textarea'),reply=el('input');
    for(const text of ['Something went wrong','An idea or suggestion','Account or safety','Other']){const option=el('option','',text);category.append(option);}
    category.name='category';message.name='message';message.rows=5;message.required=true;message.minLength=5;message.maxLength=4000;message.placeholder='Tell us what happened or what you would like to improve.';
    reply.name='reply';reply.type='email';reply.autocomplete='email';reply.maxLength=254;reply.value=root.KanaCloudSync?.getUser?.()?.email||'';
    const info=el('p','ma-help-note','Your message becomes an email to '+support+'. Review it before sending. Your progress and account identifiers are not attached.');
    const include=el('input');include.type='checkbox';include.name='diagnostics';
    const consent=el('label','ma-help-consent');consent.append(include,document.createTextNode('Include technical error details (optional)'));
    const technical=root.ModeAtlasDiagnostics?.report()||'No recent technical errors recorded.';
    const preview=el('details','ma-help-diagnostics');preview.append(el('summary','','View technical details'),el('pre','',technical));
    const state=el('p','ma-help-note');state.setAttribute('role','status');
    const submit=el('button','ma-button ma-button--primary','Continue to email');submit.type='submit';
    form.append(field('What is this about?',category),field('Message',message),field('Reply email (optional)',reply),info,consent,preview,submit,state);
    const fallback=el('div','ma-help-fallback');fallback.hidden=true;form.append(fallback);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!form.reportValidity()||submit.disabled)return;submit.disabled=true;fallback.hidden=true;state.textContent='Preparing your email…';
      const subject=`Mode Atlas · ${category.value}`;
      try{
        const version=await root.AtlasPlatform.getAppVersion().catch(()=>({}));
        const body=`${message.value.trim()}\n\n${reply.value?'Reply email: '+reply.value+'\n':''}Mode Atlas ${root.ModeAtlasVersion||'dev'}${version.build?' ('+version.build+')':''} · ${root.ModeAtlasEnv?.isNativeApp?'iOS':'website'}\nScreen: ${root.ModeAtlasDiagnostics?.screenLabel()||'Mode Atlas'}${include.checked?'\n\nTechnical details:\n'+technical:''}`;
        const result=await root.AtlasPlatform.composeFeedback({subject,body});
        state.textContent={queued:'Added to your Mail outbox.',saved:'Draft saved in Mail.',cancelled:'Your message is still here if you want to edit it.',opened:'Review and send the draft in your email app. If it did not open, copy your message below.',failed:'Mail could not prepare this message.'}[result.status]||'Set up Mail or use another email app.';
        if(['unavailable','failed','opened'].includes(result.status)){
          const url=`mailto:${support}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          const open=button('Open email app',async()=>{try{const opened=await root.AtlasPlatform.openExternalLink(url);state.textContent=opened?'Send the draft in your email app.':'No email app is available. Copy your message below.';}catch{state.textContent='Copy your message and send it from your email app.';}});
          const copy=button('Copy email',async()=>{try{await navigator.clipboard.writeText(`To: ${support}\nSubject: ${subject}\n\n${body}`);state.textContent='Email copied.';}catch{message.focus();message.select();state.textContent='Select and copy your message.';}});
          fallback.replaceChildren(open,copy);fallback.hidden=false;
        }
      }catch(error){root.ModeAtlasDiagnostics?.record('feedback',error);state.textContent='Your message is still here. Please try again.';}
      finally{submit.disabled=false;}
    });
    root.ModeAtlasDialog.feature({title:'Send feedback',contentNode:form}).finally(()=>{feedbackOpen=false;});
  }
  async function legal(path){
    if(!['privacy','terms'].includes(path))return;
    const ticket=++legalOpen;
    const content=el('div','ma-help-legal'),status=el('p','','Loading…');content.append(status);
    // An About dialog gives way to its reader instead of queueing a hidden dialog.
    if(root.ModeAtlasDialog.isOpen())root.ModeAtlasDialog.close();
    const title=path==='privacy'?'Privacy Policy':'Terms of Use';
    const closed=root.ModeAtlasDialog.feature({title,contentNode:content,size:'large'});
    try{
      const url=root.ModeAtlasVersionFile.appUrl('/'+path+'/');
      const response=await fetch(url);if(!response.ok)throw new Error('Unavailable');
      const documentCopy=new DOMParser().parseFromString(await response.text(),'text/html');
      const article=documentCopy.querySelector('.ma-legal-document');if(!article)throw new Error('Unavailable');
      article.querySelectorAll('script,style').forEach(node=>node.remove());
      article.querySelector('h1')?.remove();article.removeAttribute('aria-labelledby');content.replaceChildren(article);
    }catch{
      status.textContent='This document could not be opened. Please try again.';
      content.append(button('Open website',()=>root.AtlasPlatform.openExternalLink('https://mode-atlas.app/'+path+'/')));
    }
    await closed;if(legalOpen===ticket)legalOpen=0;
  }
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-ma-help-open]')){event.preventDefault();open();return;}
    if(event.target.closest?.('[data-ma-support]')){event.preventDefault();feedback();return;}
    if(!root.ModeAtlasEnv?.isNativeApp)return;
    const link=event.target.closest?.('a[href]');if(!link)return;
    const url=new URL(link.href,location.href),base=new URL(root.ModeAtlasVersionFile.appUrl('/'),location.href).pathname;
    const path=url.pathname.slice(base.length).replace(/^\/+|\/+$/g,'');
    if(url.origin===location.origin&&['privacy','terms'].includes(path)){
      event.preventDefault();void legal(path);
    }else if(['mailto:','https:'].includes(url.protocol)&&url.origin!==location.origin){event.preventDefault();void root.AtlasPlatform.openExternalLink(url.href).catch(()=>{});}
  });
  root.ModeAtlasHelp=Object.freeze({open,feedback,legal});
})(window);
