/* Mode Atlas platform facade.
   Web learning code calls this API; platform adapters own browser/native behavior. */
(function ModeAtlasPlatformFacade(root){
  'use strict';
  if (root.AtlasPlatform) return;

  var state = {
    name: 'unconfigured',
    adapter: Object.create(null)
  };

  // These are product destinations, shared by website navigation and native
  // entry points. Keep incoming links on known pages in the bundled app.
  var destinations = Object.freeze({
    atlas: '/', kana: '/kana/', reading: '/reading/', writing: '/writing/',
    daily: '/reading/?mode=daily', review: '/reading/?mode=review',
    results: '/results/', wordBank: '/wordbank/'
  });

  function destinationPath(destination){
    return destinations[String(destination || '')] || '';
  }

  function destinationFromUrl(raw){
    try {
      var url = new URL(String(raw || ''));
      var path = '';
      if (url.protocol === 'modeatlas:' && url.hostname === 'open') {
        path = url.pathname;
      } else if (url.protocol === 'https:' && (url.hostname === 'mode-atlas.app' || url.hostname === 'www.mode-atlas.app')) {
        path = url.pathname;
      } else return '';
      var pages = { '/':'atlas', '/kana/':'kana', '/reading/':'reading', '/writing/':'writing', '/results/':'results', '/wordbank/':'wordBank' };
      if (path !== '/' && !path.endsWith('/')) path += '/';
      var key = pages[path];
      if (!key) return '';
      if (key === 'reading' && url.searchParams.get('mode') === 'daily') return 'daily';
      if (key === 'reading' && (url.searchParams.get('mode') === 'review' || url.searchParams.get('focusWeak') === '1')) return 'review';
      return key;
    } catch (_) { return ''; }
  }

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
    destinationPath: destinationPath,
    destinationFromUrl: destinationFromUrl,
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
    revokeAppleAuthorization: function(authorizationCode){ return call('revokeAppleAuthorization', [String(authorizationCode || '')], false); },
    signOutIdentityProvider: function(){ return call('signOutIdentityProvider', [], false); }
  };

  root.AtlasPlatform = Object.freeze(api);
})(window);
