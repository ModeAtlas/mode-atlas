/* Capacitor/iOS adapter for the shared Mode Atlas platform facade.
   The native plugin is intentionally thin: learning/SRS/progress logic remains in JS. */
(function ModeAtlasNativePlatform(root){
  'use strict';
  var platform = root.AtlasPlatform;
  if (!platform || !root.ModeAtlasEnv?.isNativeApp) return;

  var capacitor = root.Capacitor || {};
  var bridge = capacitor.Plugins && capacitor.Plugins.ModeAtlasNative;

  function has(method){ return !!(bridge && typeof bridge[method] === 'function'); }

  function destinationPath(destination){
    var map = {
      atlas: '/',
      kana: '/kana/',
      reading: '/reading/',
      writing: '/writing/',
      daily: '/reading/?mode=daily',
      review: '/reading/?mode=review',
      results: '/results/',
      wordBank: '/wordbank/'
    };
    var key = String(destination || '');
    return map[key] || key || '/';
  }

  platform.registerAdapter('ios', {
    getCapabilities: function(){
      return {
        notifications: has('requestNotifications'),
        appBadge: has('setBadge'),
        widgets: has('publishWidgetSnapshot'),
        appIntents: has('openDestination')
      };
    },
    getAppVersion: async function(){
      if (has('getAppVersion')) return bridge.getAppVersion();
      return {
        version: String(root.ModeAtlasVersion || root.MODE_ATLAS_VERSION || 'dev-local'),
        build: '',
        platform: 'ios'
      };
    },
    openExternalLink: async function(url){
      if (has('openExternalLink')) {
        await bridge.openExternalLink({ url:String(url || '') });
        return true;
      }
      return false;
    },
    openDestination: async function(destination, options){
      var path = destinationPath(destination);
      if (has('openDestination')) {
        await bridge.openDestination({ destination:String(destination || ''), path:path });
        return true;
      }
      var target = root.ModeAtlasVersionFile?.appUrl?.(path) || path;
      if (options && options.replace === true) location.replace(target);
      else location.assign(target);
      return true;
    },
    requestNotifications: async function(){
      if (!has('requestNotifications')) return { granted:false, supported:false };
      return bridge.requestNotifications();
    },
    setBadge: async function(value){
      if (!has('setBadge')) return false;
      await bridge.setBadge({ value:Math.max(0, Number(value || 0)) });
      return true;
    },
    publishWidgetSnapshot: async function(snapshot){
      if (!has('publishWidgetSnapshot')) return false;
      await bridge.publishWidgetSnapshot({ snapshot:JSON.stringify(snapshot || {}) });
      return true;
    }
  });
})(window);
