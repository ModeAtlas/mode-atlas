/* Mode Atlas platform facade.
   Web learning code calls this API; platform adapters own browser/native behavior. */
(function ModeAtlasPlatformFacade(root){
  'use strict';
  if (root.AtlasPlatform) return;

  var state = {
    name: 'unconfigured',
    adapter: Object.create(null)
  };

  function asPromise(value){
    return value && typeof value.then === 'function' ? value : Promise.resolve(value);
  }

  function call(method, args, fallback){
    var fn = state.adapter && state.adapter[method];
    if (typeof fn !== 'function') return asPromise(typeof fallback === 'function' ? fallback() : fallback);
    try { return asPromise(fn.apply(state.adapter, args || [])); }
    catch (error) { return Promise.reject(error); }
  }

  var api = {
    registerAdapter: function(name, adapter){
      if (!adapter || typeof adapter !== 'object') throw new TypeError('Mode Atlas platform adapter must be an object.');
      state.name = String(name || 'custom');
      state.adapter = adapter;
      return api;
    },
    get environment(){ return state.name; },
    get isNative(){ return state.name === 'ios'; },
    getCapabilities: function(){
      var value = state.adapter && typeof state.adapter.getCapabilities === 'function'
        ? state.adapter.getCapabilities()
        : {};
      return Object.assign({}, value || {});
    },
    getAppVersion: function(){
      return call('getAppVersion', [], function(){
        return {
          version: String(root.ModeAtlasVersion || root.MODE_ATLAS_VERSION || 'dev-local'),
          build: '',
          platform: 'web'
        };
      });
    },
    openExternalLink: function(url){ return call('openExternalLink', [String(url || '')], false); },
    openDestination: function(destination, options){ return call('openDestination', [destination, options || {}], false); },
    requestNotifications: function(){ return call('requestNotifications', [], { granted:false, supported:false }); },
    setBadge: function(value){ return call('setBadge', [value], false); },
    publishWidgetSnapshot: function(snapshot){ return call('publishWidgetSnapshot', [snapshot], false); },
    authenticate: function(provider){ return call('authenticate', [String(provider || '')], { handled:false }); },
    signOutIdentityProvider: function(){ return call('signOutIdentityProvider', [], false); }
  };

  root.AtlasPlatform = Object.freeze(api);
})(window);
