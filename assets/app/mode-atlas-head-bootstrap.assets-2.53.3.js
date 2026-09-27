/* Mode Atlas head bootstrap: environment, early appearance, manifest, and version-check startup. */
(function ModeAtlasHeadBootstrap(){
  if (window.__modeAtlasHeadBootstrapLoaded) return;
  window.__modeAtlasHeadBootstrapLoaded = true;

  var APP_VERSION = (window.ModeAtlasVersion || window.MODE_ATLAS_VERSION || 'dev-local');
  var protocol = location.protocol;
  var host = location.hostname;
  var search = location.search || '';
  var isLocalFile = protocol === 'file:';
  var isLocalhost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(host || '');
  var isLocalServer = isLocalhost && (protocol === 'http:' || protocol === 'https:');
  var isGitHubPages = host === 'modeatlas.github.io';
  var isOfficialDomain = /^(mode-atlas\.app|www\.mode-atlas\.app|mode-atlas\.com|www\.mode-atlas\.com)$/i.test(host || '');
  var isHttp = protocol === 'http:' || protocol === 'https:';
  var isProduction = isOfficialDomain || isGitHubPages;
  var isSupportedHost = isHttp;
  var canUseFirebase = isSupportedHost;


  function getPageName(){
    var path = (location.pathname || '/').replace(/\/+$/, '/');

    if (path === '/' || /\/index\.html$/i.test(path)) return 'index.html';
    if (/\/kana\/?$/i.test(path) || /\/kana\/index\.html$/i.test(path)) return 'kana.html';
    if (/\/reading\/?$/i.test(path) || /\/reading\/index\.html$/i.test(path) || /\/default\.html$/i.test(path)) return 'default.html';
    if (/\/writing\/?$/i.test(path) || /\/writing\/index\.html$/i.test(path) || /\/reverse\.html$/i.test(path)) return 'reverse.html';
    if (/\/results\/?$/i.test(path) || /\/results\/index\.html$/i.test(path) || /\/test\.html$/i.test(path)) return 'test.html';
    if (/\/wordbank\/?$/i.test(path) || /\/wordbank\/index\.html$/i.test(path)) return 'wordbank.html';

    return (path.split('/').filter(Boolean).pop() || 'index.html').toLowerCase();
  }

  window.ModeAtlasPageName = getPageName;

  function safeStorageGet(key){
    try { return localStorage.getItem(key); } catch(e) { return null; }
  }

  var THEME_KEY = 'modeAtlasThemePreference';

  function normalizeThemePreference(value){
    value = String(value || '').toLowerCase();
    return /^(dark|light|system)$/.test(value) ? value : 'dark';
  }

  function systemPrefersLight(){
    try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches); }
    catch(e) { return false; }
  }

  function applyEarlyTheme(){
    try {
      var preference = normalizeThemePreference(safeStorageGet(THEME_KEY) || 'dark');
      var effective = preference === 'system' ? (systemPrefersLight() ? 'light' : 'dark') : preference;
      document.documentElement.dataset.maTheme = effective;
      document.documentElement.dataset.maThemePreference = preference;
    } catch(e) {}
  }


  function normalizeDisplayMode(mode){
    mode = String(mode || 'auto').toLowerCase();
    if (mode === 'compact') return 'tablet';
    if (mode === 'mobile') return 'phone';
    return /^(auto|desktop|tablet|phone)$/.test(mode) ? mode : 'auto';
  }

  function resolveDisplayMode(mode){
    mode = normalizeDisplayMode(mode);
    if (mode !== 'auto') return mode;
    var width = Math.min(window.innerWidth || 1200, document.documentElement.clientWidth || window.innerWidth || 1200);
    if (width <= 700) return 'phone';
    if (width <= 1180) return 'tablet';
    return 'desktop';
  }

  function applyEarlyDisplayMode(){
    try {
      var mode = normalizeDisplayMode(safeStorageGet('modeAtlasDisplayMode') || 'auto');
      var effective = resolveDisplayMode(mode);
      document.documentElement.dataset.displayMode = mode;
      document.documentElement.dataset.effectiveDisplayMode = effective;
      document.documentElement.classList.toggle('ma-display-desktop', effective === 'desktop');
      document.documentElement.classList.toggle('ma-display-tablet', effective === 'tablet');
      document.documentElement.classList.toggle('ma-display-phone', effective === 'phone');
    } catch(e) {}
  }

  window.ModeAtlasEnv = Object.freeze({
    appVersion: APP_VERSION,
    cacheRevision: String(window.ModeAtlasCacheRevision || window.MODE_ATLAS_CACHE_REVISION || ''),
    saveSchemaVersion: Number(window.ModeAtlasSaveSchemaVersion || 1),
    backupFormatVersion: Number(window.ModeAtlasBackupFormatVersion || 1),
    cloudSnapshotVersion: Number(window.ModeAtlasCloudSnapshotVersion || 1),
    buildDate: String(window.ModeAtlasBuildDate || ''),
    isLocalFile: isLocalFile,
    isLocalhost: isLocalhost,
    isLocalServer: isLocalServer,
    isGitHubPages: isGitHubPages,
    isOfficialDomain: isOfficialDomain,
    primaryDomain: 'mode-atlas.app',
    canonicalOrigin: 'https://mode-atlas.app',
    supportEmail: 'support@mode-atlas.com',
    isHosted: isSupportedHost,
    isProduction: isProduction,
    isSupportedHost: isSupportedHost,
    canUseFirebase: canUseFirebase,
    allowDevTools: (isLocalServer || search.indexOf('dev=1') !== -1 || safeStorageGet('modeAtlasDevTools') === '1'),
    baseUrl: (isOfficialDomain ? 'https://mode-atlas.app/' : (location.origin + '/'))
  });

  document.documentElement.dataset.maEnv = isLocalFile ? 'file-fallback' : (isProduction ? 'production' : (isLocalServer ? 'local-server' : 'hosted'));
  document.documentElement.dataset.maVersion = APP_VERSION;
  applyEarlyTheme();
  applyEarlyDisplayMode();


  function syncVersionLabels(){
    try {
      var version = String(APP_VERSION || '');
      var nodes = document.querySelectorAll('[data-ma-app-version]');
      nodes.forEach(function(node){ node.textContent = version; });
    } catch(e) {}
  }

  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  onReady(syncVersionLabels);

  function attachManifest(){
    try {
      if (!isSupportedHost) return;
      if (document.querySelector('link[rel="manifest"]')) return;
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/site.webmanifest';
      document.head.appendChild(link);
    } catch(e) {}
  }

  function runDailyVersionFileCheck(){
    var versionFile = window.ModeAtlasVersionFile;
    if (!versionFile || typeof versionFile.runAutomaticCheck !== 'function') return;
    versionFile.runAutomaticCheck({ enabled: isSupportedHost });
  }


  // Service Worker registration is intentionally NOT performed during normal
  // app startup. The deployed-version file is the sole update mechanism, and
  // no SW lifecycle work is allowed to race or participate in page navigation.

  attachManifest();
  try { window.ModeAtlasVersionFile?.installNavigationCacheGuard?.(); } catch(e) {}
  runDailyVersionFileCheck();
  onReady(function(){
    try { window.ModeAtlasVersionFile?.revisionizeDocumentLinks?.(document); } catch(e) {}
  });
})();
