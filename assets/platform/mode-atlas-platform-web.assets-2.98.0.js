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

  platform.registerAdapter('web', {
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
