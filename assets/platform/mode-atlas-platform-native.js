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
  var app = plugins.App || null;
  // Disabled during Personal Team testing. Enabling Apple also requires the
  // Xcode entitlement and FirebaseAuthentication provider configuration.
  var appleSignInEnabled = false;

  function hasBridge(method){ return !!(nativeBridge && typeof nativeBridge[method] === 'function'); }
  function hasFirebaseAuth(method){ return !!(firebaseAuth && typeof firebaseAuth[method] === 'function'); }

  function navigate(destination, replace){
    var path = platform.destinationPath(destination);
    if (!path) return false;
    var target = root.ModeAtlasVersionFile?.appUrl?.(path) || path;
    if (location.pathname + location.search === target) return true;
    if (replace) location.replace(target);
    else location.assign(target);
    return true;
  }

  // Capacitor's App plugin forwards scene URL events. The cold-launch URL may
  // also be delivered as an event, so navigation is idempotent for that pair.
  if (app && typeof app.addListener === 'function') {
    var receivedUrlEvent = false;
    var launchKey = 'modeAtlasNativeLaunchChecked';
    app.addListener('appUrlOpen', function(event){
      var destination = platform.destinationFromUrl(event && event.url);
      if (destination) {
        receivedUrlEvent = true;
        try { sessionStorage.setItem(launchKey, '1'); } catch (_) {}
        navigate(destination, false);
      }
    });
    if (typeof app.getLaunchUrl === 'function') {
      var alreadyChecked = false;
      try { alreadyChecked = sessionStorage.getItem(launchKey) === '1'; } catch (_) {}
      if (!alreadyChecked) {
        app.getLaunchUrl().then(function(event){
          if (receivedUrlEvent) return;
          var destination = platform.destinationFromUrl(event && event.url);
          if (!destination) return;
          // A document navigation reloads this adapter while Capacitor retains
          // its launch URL. Consume it once per WebView session.
          try { sessionStorage.setItem(launchKey, '1'); } catch (_) {}
          navigate(destination, true);
        }).catch(function(error){ console.warn('Mode Atlas launch URL unavailable', error); });
      }
    }
  }

  // Native actions are consumed once, so cold-launch and resume cannot navigate twice.
  if (hasBridge('consumeNotificationDestination')) {
    var consumeAction = function(){
      nativeBridge.consumeNotificationDestination().then(function(result){
        if (result?.destination === 'reading') navigate('reading', false);
      }).catch(function(error){console.warn('Notification action unavailable',error);});
    };
    if(typeof nativeBridge.addListener === 'function') nativeBridge.addListener('notificationAction',consumeAction);
    if(typeof app?.addListener === 'function') app.addListener('appStateChange',function(state){if(state.isActive)consumeAction();});
    consumeAction();
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
      var providers = [];
      if (hasFirebaseAuth('signInWithGoogle')) providers.push('google.com');
      if (appleSignInEnabled && hasFirebaseAuth('signInWithApple')) providers.push('apple.com');
      return {
        notifications: hasBridge('requestNotifications'),
        appBadge: hasBridge('setBadge'),
        widgets: hasBridge('getEngagementState'),
        widgetSnapshots: hasBridge('publishWidgetSnapshot'),
        appIntents: false,
        authentication: providers.length > 0,
        authProviders: providers
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
      return navigate(destination, options && options.replace === true);
    },
    requestNotifications: async function(){
      if (!hasBridge('requestNotifications')) return { granted:false, supported:false };
      return nativeBridge.requestNotifications();
    },
    getNotificationStatus: async function(){
      if (!hasBridge('getNotificationStatus')) return {granted:false, supported:false};
      return nativeBridge.getNotificationStatus();
    },
    configureStudyReminder: async function(options){
      if (!hasBridge('configureStudyReminder')) return {supported:false, enabled:false};
      return nativeBridge.configureStudyReminder(options);
    },
    getEngagementState: async function(){return hasBridge('getEngagementState') ? nativeBridge.getEngagementState() : {supported:false};},
    resetEngagement: async function(){return hasBridge('resetEngagement') ? nativeBridge.resetEngagement() : {reset:false};},
    testNotification: async function(){return hasBridge('testNotification') ? nativeBridge.testNotification() : {scheduled:false};},
    openNotificationSettings: async function(){return hasBridge('openNotificationSettings') ? nativeBridge.openNotificationSettings() : {opened:false};},
    setWidgetSharing: async function(enabled){return hasBridge('setWidgetSharing') ? nativeBridge.setWidgetSharing({enabled:!!enabled}) : {enabled:false,supported:false};},
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
      if (providerId !== 'google.com' && providerId !== 'apple.com') {
        return { handled:false, providerId:providerId };
      }
      if (providerId === 'apple.com' && !appleSignInEnabled) return { handled:false, providerId:providerId };
      var method = providerId === 'apple.com' ? 'signInWithApple' : 'signInWithGoogle';
      if (!hasFirebaseAuth(method)) {
        var unavailable = new Error('Native ' + providerId + ' authentication is unavailable in this build.');
        unavailable.code = 'native-auth-unavailable';
        throw unavailable;
      }

      // Capacitor owns only the provider chooser; the JS Auth session owns UID,
      // persistence and Firestore for both website and iOS.
      var result = await firebaseAuth[method]({ skipNativeAuth:true });
      var credential = normalizeCredential(result);
      if (!credential || !credential.idToken || (providerId === 'apple.com' && !credential.nonce)) {
        var missingCredential = new Error('Native sign-in did not return a usable ID token and nonce.');
        missingCredential.code = 'native-auth-missing-credential';
        throw missingCredential;
      }
      return {
        handled:true,
        providerId:providerId,
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
    },
    revokeAppleAuthorization: async function(authorizationCode){
      if (!hasFirebaseAuth('revokeAccessToken') || !authorizationCode) return false;
      await firebaseAuth.revokeAccessToken({ token:authorizationCode });
      return true;
    }
  });
})(window);
