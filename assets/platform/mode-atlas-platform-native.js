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
  var messaging = plugins.FirebaseMessaging || null;
  var app = plugins.App || null;

  function hasBridge(method){ return !!(nativeBridge && typeof nativeBridge[method] === 'function'); }
  function hasFirebaseAuth(method){ return !!(firebaseAuth && typeof firebaseAuth[method] === 'function'); }
  var pendingPush=null;
  function consumePush(){
    const account=root.KanaCloudSync?.getUser?.()?.uid;
    if(!pendingPush||!account)return;
    const data=pendingPush;pendingPush=null;
    if(data.owner===account&&platform.destinationPath(data.destination))navigate(data.destination,false);
  }
  if(messaging?.addListener){
    messaging.addListener('tokenReceived',()=>root.dispatchEvent(new CustomEvent('modeAtlasPushTokenChanged')));
    messaging.addListener('notificationActionPerformed',event=>{
      pendingPush=event.notification?.data;consumePush();
    });
    root.addEventListener('kanaCloudSyncStatusChanged',consumePush);
  }

  // UIKit supplies the system text preference; the native stylesheet owns reflow.
  if (hasBridge('getAccessibilityPreferences')) {
    function applyAccessibility(preferences){
      const scale = Number(preferences?.textScale);
      if (!Number.isFinite(scale) || scale <= 0) return;
      document.documentElement.style.setProperty('--ma-ios-text-scale', String(scale));
      document.documentElement.toggleAttribute('data-ma-large-text', scale >= 1.35);
      root.dispatchEvent(new Event('modeAtlasTextSizeChanged'));
    }
    nativeBridge.addListener?.('accessibilityChanged', applyAccessibility);
    nativeBridge.getAccessibilityPreferences().then(applyAccessibility).catch(error => console.warn('Text size unavailable', error));
  }

  function navigate(destination, replace){
    var path = platform.destinationPath(destination);
    if (!path) return false;
    var target = root.ModeAtlasVersionFile?.appUrl?.(path) || path;
    if (location.pathname + location.search === target) {if(destination==='yourAtlas')root.ModeAtlasAccountNavigation?.open('atlas');if(destination==='weekly')root.ModeAtlasAccountNavigation?.open('friends');return true;}
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

  // Notifications, quick actions, App Shortcuts and controls share one destination queue.
  function consumeAction(){
    if (!hasBridge('consumeDestination')) return;
    nativeBridge.consumeDestination().then(function(result){
      if (platform.destinationPath(result?.destination)) navigate(result.destination, false);
    }).catch(function(error){console.warn('Native destination unavailable',error);});
  }
  if (hasBridge('consumeDestination')) {
    if(typeof nativeBridge.addListener === 'function') nativeBridge.addListener('destinationAction',consumeAction);
    consumeAction();
  }
  if(typeof app?.addListener === 'function') {
    app.addListener('appStateChange',function(state){
      root.dispatchEvent(new CustomEvent('modeAtlasAppStateChanged',{detail:{isActive:state.isActive === true}}));
      if(state.isActive) consumeAction();
    });
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
      if (hasFirebaseAuth('signInWithApple')) providers.push('apple.com');
      return {
        sounds: hasBridge('playSound'),
        alternateIcons: hasBridge('setAppIcon'),
        notifications: hasBridge('requestNotifications'),
        remoteNotifications: typeof messaging?.getToken==='function',
        appBadge: hasBridge('setBadge'),
        widgets: hasBridge('getEngagementState'),
        widgetSnapshots: hasBridge('publishWidgetSnapshot'),
        backupSharing: hasBridge('exportBackup'),
        friendSharing: hasBridge('shareFriendCode'),
        appIntents: hasBridge('consumeDestination'),
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
    composeFeedback: async function(draft){return hasBridge('composeFeedback')?nativeBridge.composeFeedback(draft):{status:'unavailable'};},
    shareFriendCode: async function(code){return hasBridge('shareFriendCode')?nativeBridge.shareFriendCode({code}):{status:'unavailable'};},
    openExternalLink: async function(url){
      if (hasBridge('openExternalLink')) {
        const result=await nativeBridge.openExternalLink({ url:String(url || '') });
        return result?.opened!==false;
      }
      return false;
    },
    openDestination: async function(destination, options){
      return navigate(destination, options && options.replace === true);
    },
    playSound: async function(cue,volume){return hasBridge('playSound') ? nativeBridge.playSound({cue:cue,volume:volume}) : false;},
    stopSounds: async function(){return hasBridge('stopSounds') ? nativeBridge.stopSounds() : false;},
    setAppIcon: async function(name){
      if(!hasBridge('setAppIcon'))return false;
      return nativeBridge.setAppIcon({name:name||null});
    },
    setAppearance: async function(preference){
      if (!hasBridge('setAppearance')) return false;
      return nativeBridge.setAppearance({preference:preference});
    },
    exportBackup: async function(file){
      if (!hasBridge('exportBackup')) throw new Error('Backup sharing is unavailable in this build.');
      return nativeBridge.exportBackup(file);
    },
    requestNotifications: async function(){
      if (!hasBridge('requestNotifications')) return { granted:false, supported:false };
      return nativeBridge.requestNotifications();
    },
    getNotificationStatus: async function(){
      if (!hasBridge('getNotificationStatus')) return {granted:false, supported:false};
      return nativeBridge.getNotificationStatus();
    },
    getPushToken: async function(){
      if(!messaging?.getToken)throw new Error('Push notifications are unavailable in this build.');
      return messaging.getToken();
    },
    deletePushToken: async function(){
      if(hasBridge('deletePushToken'))return nativeBridge.deletePushToken();
      if(!messaging?.deleteToken)return false;
      await messaging.deleteToken();return true;
    },
    configureStudyReminder: async function(options){
      if (!hasBridge('configureStudyReminder')) return {supported:false, enabled:false};
      return nativeBridge.configureStudyReminder(options);
    },
    getEngagementState: async function(){return hasBridge('getEngagementState') ? nativeBridge.getEngagementState() : {supported:false};},
    resetEngagement: async function(){return hasBridge('resetEngagement') ? nativeBridge.resetEngagement() : {reset:false};},
    testNotification: async function(){return hasBridge('testNotification') ? nativeBridge.testNotification() : {scheduled:false};},
    openNotificationSettings: async function(){return hasBridge('openNotificationSettings') ? nativeBridge.openNotificationSettings() : {opened:false};},
    setBadge: async function(value){
      if (!hasBridge('setBadge')) return false;
      await nativeBridge.setBadge({ value:Math.max(0, Number(value || 0)) });
      return true;
    },
    publishWidgetSnapshot: async function(snapshot){
      if (!hasBridge('publishWidgetSnapshot')) return false;
      return nativeBridge.publishWidgetSnapshot({ snapshot:JSON.stringify(snapshot || {}) });
    },
    authenticate: async function(provider){
      var providerId = String(provider || '');
      if (providerId !== 'google.com' && providerId !== 'apple.com') {
        return { handled:false, providerId:providerId };
      }
      var method = providerId === 'apple.com' ? 'signInWithApple' : 'signInWithGoogle';
      if (!hasFirebaseAuth(method)) {
        var unavailable = new Error('Native ' + providerId + ' authentication is unavailable in this build.');
        unavailable.code = 'native-auth-unavailable';
        throw unavailable;
      }

      // Capacitor owns only the provider chooser; the JS Auth session owns UID,
      // persistence and Firestore for both website and iOS.
      var result;
      try {
        result = await firebaseAuth[method]({ skipNativeAuth:true });
      } catch (error) {
        // AuthenticationServices cancellation is not an account failure. The
        // provider plugin may return only Apple's localized error description.
        if (providerId === 'apple.com' && (String(error?.code) === '1001'
          || /com\.apple\.AuthenticationServices\.AuthorizationError[^\n]*\b1001\b/.test(String(error?.message || '')))) {
          var cancelled = new Error('Apple sign-in was cancelled.');
          cancelled.code = 'auth/cancelled-popup-request';
          throw cancelled;
        }
        throw error;
      }
      var credential = normalizeCredential(result);
      if (!credential || !credential.idToken || (providerId === 'apple.com' && !credential.nonce)) {
        var missingCredential = new Error('Native sign-in did not return a usable ID token and nonce.');
        missingCredential.code = 'native-auth-missing-credential';
        throw missingCredential;
      }
      return {
        handled:true,
        providerId:providerId,
        credential:credential,
        displayName:String(result?.user?.displayName || '')
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
    revokeAppleAuthorization: async function(authorizationCode, firebaseIdToken){
      if (!hasBridge('revokeAppleAuthorization') || !authorizationCode || !firebaseIdToken) return false;
      const result = await nativeBridge.revokeAppleAuthorization({authorizationCode, firebaseIdToken});
      return result?.revoked === true;
    }
  });
})(window);
