/* In-app support and the bundled legal reader. Policy HTML stays in its one
   canonical document; reading it never navigates away from unfinished practice. */
(function ModeAtlasHelp(root){
  'use strict';
  const support='support@mode-atlas.com';let feedbackOpen=false,legalOpen=0;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!=null)node.textContent=text;return node;};
  const button=(label,action)=>{const node=el('button','ma-button',label);node.type='button';node.addEventListener('click',action);return node;};
  function field(label,node){const holder=el('label','ma-help-field',label);holder.append(node);return holder;}
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
    if(event.target.closest?.('[data-ma-support]')){event.preventDefault();feedback();return;}
    if(!root.ModeAtlasEnv?.isNativeApp)return;
    const link=event.target.closest?.('a[href]');if(!link)return;
    const url=new URL(link.href,location.href),base=new URL(root.ModeAtlasVersionFile.appUrl('/'),location.href).pathname;
    const path=url.pathname.slice(base.length).replace(/^\/+|\/+$/g,'');
    if(url.origin===location.origin&&['privacy','terms'].includes(path)){
      event.preventDefault();void legal(path);
    }else if(['mailto:','https:'].includes(url.protocol)&&url.origin!==location.origin){event.preventDefault();void root.AtlasPlatform.openExternalLink(url.href).catch(()=>{});}
  });
  root.ModeAtlasHelp=Object.freeze({feedback,legal});
})(window);
