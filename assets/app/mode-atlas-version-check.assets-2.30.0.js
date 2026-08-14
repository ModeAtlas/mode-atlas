/* Mode Atlas deployed-version and document-revision owner.
   Sole owner of deployed version-file network reads for automatic and Settings checks.
   It is deliberately independent of Service Workers. Normal internal navigation never
   checks for updates; it only carries the already-loaded revision as a temporary
   document cache key so a fresh page cannot fall back into stale HTML. */
(function ModeAtlasVersionFile(root){
  'use strict';
  if (root.__modeAtlasVersionFileLoaded) return;
  root.__modeAtlasVersionFileLoaded = true;

  var DEFAULT_TIMEOUT_MS = 4500;
  var inFlight = null;

  function currentVersion(){
    return String(root.ModeAtlasVersion || root.MODE_ATLAS_VERSION || 'dev-local');
  }

  function currentRevision(){
    return String(root.ModeAtlasCacheRevision || root.MODE_ATLAS_CACHE_REVISION || '');
  }

  function cleanVisibleDocumentUrl(){
    try {
      var url = new URL(location.href);
      var changed = false;
      ['build', 'v', 'reload', 'swretired'].forEach(function(name){
        if (!url.searchParams.has(name)) return;
        url.searchParams.delete(name);
        changed = true;
      });
      if (!changed || !history || typeof history.replaceState !== 'function') return false;
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      return true;
    } catch(e) {
      return false;
    }
  }

  function resetDayKey(date){
    var d = date ? new Date(date) : new Date();
    if (Number.isNaN(d.getTime())) d = new Date();
    if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function safeStorageGet(key){
    try { return localStorage.getItem(key); } catch(e) { return null; }
  }

  function safeStorageSet(key, value){
    try { localStorage.setItem(key, value); } catch(e) {}
  }

  function deployedCheckKey(revision){
    return 'modeAtlasVersionFileCheckedResetDay:' + String(revision || currentRevision() || 'unknown');
  }

  function parseVersionFile(text){
    var version = (String(text || '').match(/var\s+VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '';
    var revision = (String(text || '').match(/var\s+CACHE_REVISION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '';

    if (!version && !revision) {
      throw new Error('The deployed version file did not contain version data.');
    }

    return {
      version: version || currentVersion(),
      cacheRevision: revision || ('assets-' + (version || currentVersion()))
    };
  }

  function timeoutError(){
    var error = new Error('Update check timed out. Please try again.');
    error.name = 'TimeoutError';
    return error;
  }

  function readDeployedVersion(options){
    options = options || {};
    var timeoutMs = Math.max(250, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));

    // There can only be one actual deployed-version request at a time. A manual
    // Settings check that genuinely overlaps the automatic check shares it;
    // once it settles, the next explicit Settings click performs a fresh read.
    if (inFlight) return inFlight;

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = null;
    var url = new URL('/assets/app/mode-atlas-version.js', location.origin);
    url.searchParams.set('check', String(Date.now()));

    var request = fetch(url.href, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller ? controller.signal : undefined
    }).then(function(response){
      if (!response.ok) throw new Error('Could not read the deployed version file.');
      return response.text();
    }).then(parseVersionFile);

    // The UI deadline is independent of fetch settlement. Abort is best-effort;
    // Promise.race guarantees callers are released even if a browser leaves the
    // underlying network request pending.
    var deadline = new Promise(function(resolve, reject){
      timeoutId = setTimeout(function(){
        try { if (controller) controller.abort(); } catch(e) {}
        reject(timeoutError());
      }, timeoutMs);
    });

    inFlight = Promise.race([request, deadline]).finally(function(){
      if (timeoutId) clearTimeout(timeoutId);
      inFlight = null;
    });

    return inFlight;
  }

  function compare(deployed){
    var loadedVersion = currentVersion();
    var loadedRevision = currentRevision();
    return {
      loadedVersion: loadedVersion,
      loadedRevision: loadedRevision,
      deployedVersion: String(deployed && deployed.version || loadedVersion),
      deployedRevision: String(deployed && deployed.cacheRevision || loadedRevision),
      matches: !!deployed && String(deployed.version || '') === loadedVersion && String(deployed.cacheRevision || '') === loadedRevision
    };
  }

  function check(options){
    return readDeployedVersion(options).then(function(deployed){
      return Object.assign({ deployed: deployed }, compare(deployed));
    });
  }


  function removeTransportParams(url){
    ['build', 'v', 'reload', 'swretired'].forEach(function(name){ url.searchParams.delete(name); });
    return url;
  }

  function appUrl(path){
    var raw = String(path == null ? '' : path);
    var url = new URL(raw || '/', location.origin + '/');
    if (url.origin !== location.origin) return url.href;
    removeTransportParams(url);
    return url.pathname + url.search + url.hash;
  }

  var APP_PAGE_PATHS = new Set([
    '/', '/kana/', '/reading/', '/writing/', '/results/', '/wordbank/',
    '/privacy/', '/terms/', '/index.html', '/kana.html', '/default.html',
    '/reverse.html', '/test.html', '/wordbank.html'
  ]);

  function isAppDocumentUrl(url){
    return !!url && url.origin === location.origin && APP_PAGE_PATHS.has(url.pathname || '/');
  }

  function documentRequestUrl(path, revision){
    var url = new URL(String(path == null ? '' : path) || '/', location.href);
    if (!isAppDocumentUrl(url)) return url.href;
    removeTransportParams(url);
    var buildRevision = String(revision || currentRevision() || '');
    if (buildRevision) url.searchParams.set('build', buildRevision);
    return url.href;
  }

  function cleanSearch(url){
    var copy = new URL(url.href);
    removeTransportParams(copy);
    return copy.search;
  }

  function installNavigationCacheGuard(){
    if (root.__modeAtlasNavigationCacheGuardInstalled) return false;
    root.__modeAtlasNavigationCacheGuardInstalled = true;

    document.addEventListener('click', function(event){
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download')) return;
      var target = String(anchor.getAttribute('target') || '').toLowerCase();
      if (target && target !== '_self') return;

      var raw = anchor.getAttribute('href') || '';
      if (!raw || raw.charAt(0) === '#' || /^(?:mailto:|tel:|javascript:|data:)/i.test(raw)) return;

      try {
        var destination = new URL(raw, location.href);
        if (!isAppDocumentUrl(destination)) return;

        // Same-document hash navigation should remain native and should not
        // create another document request.
        var here = new URL(location.href);
        if (destination.pathname === here.pathname && cleanSearch(destination) === cleanSearch(here) && destination.hash) return;

        var requestHref = documentRequestUrl(destination.href, currentRevision());
        event.preventDefault();
        location.assign(requestHref);
      } catch(e) {}
    }, true);

    return true;
  }

  function navigate(path, options){
    options = options || {};
    var requestHref = documentRequestUrl(path, options.revision || currentRevision());
    if (options.replace === true) location.replace(requestHref);
    else location.assign(requestHref);
  }

  // Public links remain canonical. The capture-phase navigation guard adds the
  // loaded build revision only to the actual document request, and the target
  // page removes that transport key from the visible URL in its head.
  // This is document cache separation, not an update/version-file check.

  // Normal navigation stays canonical. Build/reload query parameters are used
  // only by an explicit update reload, never as permanent page-link state.
  // Keep the historic function name for API compatibility, but its ownership is
  // now to normalize internal links back to their clean public URLs.
  function revisionizeDocumentLinks(scope){
    var rootNode = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
    rootNode.querySelectorAll('a[href]').forEach(function(anchor){
      var raw = anchor.getAttribute('href') || '';
      if (!raw || raw.charAt(0) === '#' || /^(?:mailto:|tel:|javascript:|data:)/i.test(raw)) return;
      try {
        var url = new URL(raw, location.href);
        if (url.origin !== location.origin || !APP_PAGE_PATHS.has(url.pathname || '/')) return;
        var before = url.search;
        removeTransportParams(url);
        if (url.search !== before) anchor.setAttribute('href', url.pathname + url.search + url.hash);
      } catch(e) {}
    });
  }

  function reloadWithRevision(revision){
    var deployedRevision = String(revision || currentRevision() || currentVersion());
    var url = new URL(location.href);
    url.searchParams.set('build', deployedRevision);
    url.searchParams.set('v', deployedRevision);
    url.searchParams.set('reload', String(Date.now()));
    location.replace(url.href);
  }

  function navigationType(){
    try {
      var entries = performance && typeof performance.getEntriesByType === 'function'
        ? performance.getEntriesByType('navigation')
        : [];
      return String(entries && entries[0] && entries[0].type || 'navigate');
    } catch(e) {
      return 'navigate';
    }
  }

  function automaticAttemptKey(revision){
    return 'modeAtlasVersionFileAttemptedResetDay:' + String(revision || currentRevision() || 'unknown');
  }

  function safeSessionGet(key){
    try { return sessionStorage.getItem(key); } catch(e) { return null; }
  }

  function safeSessionSet(key, value){
    try { sessionStorage.setItem(key, value); } catch(e) {}
  }

  function dailyCheckAlreadyDone(){
    return safeStorageGet(deployedCheckKey(currentRevision())) === resetDayKey();
  }

  async function runDailyCheck(options){
    options = options || {};
    if (options.enabled === false) return { skipped: 'disabled' };
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return { skipped: 'unsupported-protocol' };

    var force = options.force === true;
    var resetDay = resetDayKey();
    var loadedRevision = currentRevision();
    var loadedKey = deployedCheckKey(loadedRevision);
    var attemptKey = automaticAttemptKey(loadedRevision);

    // The successful daily flag is authoritative. Once marked, normal page
    // loads/navigation do not perform a deployed-version network request.
    if (!force && safeStorageGet(loadedKey) === resetDay) return { skipped: 'already-checked' };

    // A failed or interrupted automatic check must not turn every page change
    // into another request. Settings and an explicit browser reload can retry.
    if (!force && safeSessionGet(attemptKey) === resetDay) return { skipped: 'already-attempted-this-session' };
    if (!force) safeSessionSet(attemptKey, resetDay);

    try {
      var result = await check({ timeoutMs: Number(options.timeoutMs || 4000) });
      var deployedKey = deployedCheckKey(result.deployedRevision);
      safeStorageSet(deployedKey, resetDay);

      if (!result.matches) {
        reloadWithRevision(result.deployedRevision);
        return Object.assign({ reloading: true }, result);
      }

      return result;
    } catch(error) {
      // Automatic failures remain silent. The attempt flag above prevents
      // navigation retries; Settings/reload remain explicit retry paths.
      return { error: error };
    }
  }

  function runAutomaticCheck(options){
    options = options || {};
    var force = navigationType() === 'reload';
    return runDailyCheck({
      enabled: options.enabled !== false,
      force: force,
      timeoutMs: options.timeoutMs || 4000
    });
  }

  // Build/reload parameters are transport-only cache keys. They may be added
  // to a normal same-origin document request by the navigation cache guard or
  // to an explicit update reload, but they are never kept in the public URL.
  cleanVisibleDocumentUrl();

  root.ModeAtlasVersionFile = Object.freeze({
    currentVersion: currentVersion,
    currentRevision: currentRevision,
    readDeployedVersion: readDeployedVersion,
    check: check,
    compare: compare,
    reloadWithRevision: reloadWithRevision,
    runDailyCheck: runDailyCheck,
    runAutomaticCheck: runAutomaticCheck,
    dailyCheckAlreadyDone: dailyCheckAlreadyDone,
    resetDayKey: resetDayKey,
    deployedCheckKey: deployedCheckKey,
    automaticAttemptKey: automaticAttemptKey,
    cleanVisibleDocumentUrl: cleanVisibleDocumentUrl,
    appUrl: appUrl,
    documentRequestUrl: documentRequestUrl,
    installNavigationCacheGuard: installNavigationCacheGuard,
    navigate: navigate,
    revisionizeDocumentLinks: revisionizeDocumentLinks
  });
})(window);
