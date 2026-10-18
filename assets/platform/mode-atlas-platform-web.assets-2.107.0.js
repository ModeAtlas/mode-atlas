/* Browser/PWA adapter for the shared Mode Atlas platform facade. */
(function ModeAtlasWebPlatform(root){
  'use strict';
  var platform = root.AtlasPlatform;
  if (!platform || root.ModeAtlasEnv?.isNativeApp) return;

  function destinationUrl(destination){
    var path = platform.destinationPath(destination);
    if (!path) return '';
    try { return root.ModeAtlasVersionFile?.appUrl?.(path) || path; }
    catch (_) { return path; }
  }

  let utterance=null,speechGeneration=0;
  platform.registerAdapter('web', {
    speakJapanese: async function(text,slow){
      if(!root.speechSynthesis||!root.SpeechSynthesisUtterance||typeof text!=='string'||text.length>80||!text.trim())return {played:false};
      const request=++speechGeneration,synth=root.speechSynthesis;synth.cancel();
      if(!synth.getVoices().length)await new Promise(resolve=>{
        const ready=()=>{clearTimeout(timer);synth.removeEventListener('voiceschanged',ready);resolve();};
        const timer=setTimeout(ready,1000);synth.addEventListener('voiceschanged',ready);
      });
      if(request!==speechGeneration)return {played:false};
      const voice=synth.getVoices().find(v=>/^ja(?:-|_)/i.test(v.lang)||v.lang==='ja');
      if(!voice)return {played:false};
      synth.cancel();utterance=new SpeechSynthesisUtterance(text);utterance.lang='ja-JP';utterance.voice=voice;utterance.rate=slow?.65:.9;
      return new Promise(resolve=>{
        const current=utterance,timer=setTimeout(()=>{if(utterance===current)synth.cancel();resolve({played:false});},4000);
        current.onstart=()=>{clearTimeout(timer);resolve({played:true});};
        current.onerror=()=>{clearTimeout(timer);resolve({played:false});};
        synth.speak(current);
      });
    },
    stopSpeech: function(){speechGeneration++;root.speechSynthesis?.cancel();utterance=null;return true;},
    getCapabilities: function(){
      return {
        notifications: typeof root.Notification !== 'undefined',
        appBadge: typeof navigator.setAppBadge === 'function',
        widgets: false,
        friendSharing: typeof navigator.share === 'function',
        appIntents: false
      };
    },
    getAppVersion: function(){
      return {
        version: String(root.ModeAtlasVersion || root.MODE_ATLAS_VERSION || 'dev-local'),
        build: '',
        platform: 'web'
      };
    },
    composeFeedback: function(draft){
      location.href='mailto:support@mode-atlas.com?subject='+encodeURIComponent(draft.subject)+'&body='+encodeURIComponent(draft.body);
      return {status:'opened'};
    },
    shareFriendCode: async function(code){
      if(!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){4}$/.test(code))throw new Error('Invalid friend code');
      if(typeof navigator.share!=='function')return {status:'unavailable'};
      try{
        await navigator.share({title:'Learn with me on Mode Atlas',text:`Add me in Mode Atlas: ${code}\nOpen Profile → Friends → Add friend and enter this code.`});
        return {status:'shared'};
      }catch(error){if(error?.name==='AbortError')return {status:'cancelled'};throw error;}
    },
    openExternalLink: function(url){
      if (!url) return false;
      root.open(url, '_blank', 'noopener,noreferrer');
      return true;
    },
    exportBackup: function(file){
      const url = URL.createObjectURL(new Blob([file.contents], {type:'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return {completed:true, supported:true};
    },
    openDestination: function(destination, options){
      var url = destinationUrl(destination);
      if (!url) return false;
      if (options && options.replace === true) location.replace(url);
      else location.assign(url);
      return true;
    },
    requestNotifications: async function(){
      if (typeof root.Notification === 'undefined' || typeof root.Notification.requestPermission !== 'function') {
        return { granted:false, supported:false };
      }
      var permission = await root.Notification.requestPermission();
      return { granted: permission === 'granted', supported:true, permission:permission };
    },
    setBadge: async function(value){
      if (typeof navigator.setAppBadge !== 'function') return false;
      var count = Math.max(0, Number(value || 0));
      if (!count && typeof navigator.clearAppBadge === 'function') await navigator.clearAppBadge();
      else await navigator.setAppBadge(count);
      return true;
    },
    publishWidgetSnapshot: function(){ return false; },
    authenticate: function(){ return { handled:false }; },
    signOutIdentityProvider: function(){ return false; }
  });
})(window);
