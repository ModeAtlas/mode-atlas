/* Browser/PWA adapter for the shared Mode Atlas platform facade. */
(function ModeAtlasWebPlatform(root){
  'use strict';
  var platform = root.AtlasPlatform;
  if (!platform || root.ModeAtlasEnv?.isNativeApp) return;

  var DESTINATIONS = Object.freeze({
    atlas: '/',
    kana: '/kana/',
    reading: '/reading/',
    writing: '/writing/',
    daily: '/reading/?mode=daily',
    review: '/reading/?mode=review',
    results: '/results/',
    wordBank: '/wordbank/'
  });

  function destinationUrl(destination){
    var key = String(destination || '');
    var path = DESTINATIONS[key] || key || '/';
    try { return root.ModeAtlasVersionFile?.appUrl?.(path) || path; }
    catch (_) { return path; }
  }

  platform.registerAdapter('web', {
    getCapabilities: function(){
      return {
        notifications: typeof root.Notification !== 'undefined',
        appBadge: typeof navigator.setAppBadge === 'function',
        widgets: false,
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
    openExternalLink: function(url){
      if (!url) return false;
      root.open(url, '_blank', 'noopener,noreferrer');
      return true;
    },
    openDestination: function(destination, options){
      var url = destinationUrl(destination);
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
    publishWidgetSnapshot: function(){ return false; }
  });
})(window);
