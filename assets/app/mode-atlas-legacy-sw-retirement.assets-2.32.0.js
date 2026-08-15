/* Mode Atlas one-time legacy Service Worker retirement.
   Migration only: no registration, no update checks, no navigation interception. */
(function ModeAtlasLegacySwRetirement(root){
  'use strict';
  if (root.__modeAtlasLegacySwRetirementLoaded) return;
  root.__modeAtlasLegacySwRetirementLoaded = true;

  // This marker is intentionally release-independent. Legacy SW retirement is
  // a one-time migration, not something that should re-run every app version.
  var MIGRATION = 'legacy-sw-retired:v1';
  var STORAGE_KEY = 'modeAtlasLegacyServiceWorkerRetirement';
  var RELOAD_KEY = 'modeAtlasLegacyServiceWorkerRetirementReloaded:v1';
  var CACHE_PREFIX = 'mode-atlas';

  function getLocal(key){ try { return localStorage.getItem(key); } catch(e) { return null; } }
  function setLocal(key, value){ try { localStorage.setItem(key, value); } catch(e) {} }
  function getSession(key){ try { return sessionStorage.getItem(key); } catch(e) { return null; } }
  function setSession(key, value){ try { sessionStorage.setItem(key, value); } catch(e) {} }

  if (getLocal(STORAGE_KEY) === MIGRATION) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  var canUseSw = !!(navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function');
  var hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);

  async function retireRegistrations(){
    if (!canUseSw) return;
    var registrations = [];
    try { registrations = await navigator.serviceWorker.getRegistrations(); } catch(e) { return; }
    await Promise.all(registrations.map(function(registration){
      try {
        var scope = new URL(registration.scope, location.href);
        if (scope.origin !== location.origin) return false;
        return registration.unregister();
      } catch(e) { return false; }
    }));
  }

  async function clearLegacyCaches(){
    if (!root.caches || typeof caches.keys !== 'function') return;
    try {
      var keys = await caches.keys();
      await Promise.all(keys.filter(function(key){
        return String(key || '').toLowerCase().indexOf(CACHE_PREFIX) === 0;
      }).map(function(key){ return caches.delete(key); }));
    } catch(e) {}
  }

  Promise.all([retireRegistrations(), clearLegacyCaches()]).then(function(){
    // Mark retirement complete BEFORE any replacement. Older logic marked only
    // after a replacement and could schedule multiple document replacements.
    setLocal(STORAGE_KEY, MIGRATION);

    // If this document was controlled, one visible replacement releases it from
    // the retired worker. Never start a replacement while the tab is hidden:
    // backgrounding/restoring a tab must not mutate page lifecycle or blank it.
    if (!hadController || document.visibilityState !== 'visible' || getSession(RELOAD_KEY) === '1') return;

    setSession(RELOAD_KEY, '1');
    var revision = String(root.ModeAtlasCacheRevision || root.MODE_ATLAS_CACHE_REVISION || '');
    var url = new URL(location.href);
    if (revision) {
      url.searchParams.set('build', revision);
      url.searchParams.set('swretired', revision);
    }
    url.searchParams.set('reload', String(Date.now()));
    location.replace(url.href);
  }).catch(function(){
    // Best effort only. Retirement must never block app startup/navigation.
  });
})(window);
