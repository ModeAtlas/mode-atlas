/* Capacitor/iOS adapter for the shared Mode Atlas platform facade.
   Native provider UI lives here; Firebase session/cloud ownership remains in
   the existing JavaScript Firebase layer so website and iOS cannot drift. */
(function ModeAtlasNativePlatform(root){
  'use strict';
  var platform = root.AtlasPlatform;
  if (!platform || !root.ModeAtlasEnv?.isNativeApp) return;

  var capacitor = root.Capacitor || {};
  var plugins = capacitor.Plugins || {};
  var nativeBridge = plugins.ModeAtlasNative || null;
  var firebaseAuth = plugins.FirebaseAuthentication || null;

  function hasBridge(method){ return !!(nativeBridge && typeof nativeBridge[method] === 'function'); }
  function hasFirebaseAuth(method){ return !!(firebaseAuth && typeof firebaseAuth[method] === 'function'); }

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

  function normalizeCredential(result){
    var credential = result && result.credential ? result.credential : null;
    if (!credential) return null;
    return {
      providerId: String(credential.providerId || ''),
      idToken: String(credential.idToken || ''),
      accessToken: String(credential.accessToken || ''),
      nonce: String(credential.nonce || ''),
      authorizationCode: String(credential.authorizationCode || '')
    };
  }

  platform.registerAdapter('ios', {
    getCapabilities: function(){
      return {
        notifications: hasBridge('requestNotifications'),
        appBadge: hasBridge('setBadge'),
        widgets: hasBridge('publishWidgetSnapshot'),
        appIntents: hasBridge('openDestination'),
        authentication: hasFirebaseAuth('signInWithGoogle'),
        authProviders: hasFirebaseAuth('signInWithGoogle') ? ['google.com'] : []
      };
    },
    getAppVersion: async function(){
      if (hasBridge('getAppVersion')) return nativeBridge.getAppVersion();
      return {
        version: String(root.ModeAtlasVersion || root.MODE_ATLAS_VERSION || 'dev-local'),
        build: '',
        platform: 'ios'
      };
    },
    openExternalLink: async function(url){
      if (hasBridge('openExternalLink')) {
        await nativeBridge.openExternalLink({ url:String(url || '') });
        return true;
      }
      return false;
    },
    openDestination: async function(destination, options){
      var path = destinationPath(destination);
      if (hasBridge('openDestination')) {
        await nativeBridge.openDestination({ destination:String(destination || ''), path:path });
        return true;
      }
      var target = root.ModeAtlasVersionFile?.appUrl?.(path) || path;
      if (options && options.replace === true) location.replace(target);
      else location.assign(target);
      return true;
    },
    requestNotifications: async function(){
      if (!hasBridge('requestNotifications')) return { granted:false, supported:false };
      return nativeBridge.requestNotifications();
    },
    setBadge: async function(value){
      if (!hasBridge('setBadge')) return false;
      await nativeBridge.setBadge({ value:Math.max(0, Number(value || 0)) });
      return true;
    },
    publishWidgetSnapshot: async function(snapshot){
      if (!hasBridge('publishWidgetSnapshot')) return false;
      await nativeBridge.publishWidgetSnapshot({ snapshot:JSON.stringify(snapshot || {}) });
      return true;
    },
    authenticate: async function(provider){
      var providerId = String(provider || '');
      if (providerId !== 'google.com') {
        return { handled:false, providerId:providerId };
      }
      if (!hasFirebaseAuth('signInWithGoogle')) {
        var unavailable = new Error('Native Google authentication is unavailable in this build.');
        unavailable.code = 'native-auth-unavailable';
        throw unavailable;
      }

      // skipNativeAuth is deliberate: Capacitor owns the native Google account
      // chooser only. The existing Firebase JS Auth instance remains the single
      // session owner used by cloud-sync.js and Firestore.
      var result = await firebaseAuth.signInWithGoogle({ skipNativeAuth:true });
      var credential = normalizeCredential(result);
      if (!credential || !credential.idToken) {
        var missingCredential = new Error('Google Sign-In did not return an ID token.');
        missingCredential.code = 'native-auth-missing-credential';
        throw missingCredential;
      }
      return {
        handled:true,
        providerId:'google.com',
        credential:credential
      };
    },
    signOutIdentityProvider: async function(){
      if (!hasFirebaseAuth('signOut')) return false;
      try {
        await firebaseAuth.signOut();
        return true;
      } catch (_) {
        // With skipNativeAuth there may be no native Firebase session. Sign-out
        // is best-effort here; JavaScript Firebase Auth remains authoritative.
        return false;
      }
    }
  });
})(window);
