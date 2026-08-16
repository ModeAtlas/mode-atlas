(function ModeAtlasDevConsoleLoader(root){
  'use strict';
  if (root.ModeAtlasDevConsoleLoader) return;

  const DEV_EMAIL = 'admin@mode-atlas.com';
  const loaderScript = document.currentScript;
  const loaderUrl = loaderScript?.src || new URL('/assets/app/mode-atlas-dev-console-loader.js', location.href).href;
  const versionMatch = loaderUrl.match(/mode-atlas-dev-console-loader(\.assets-\d+\.\d+\.\d+)?\.js(?:[?#].*)?$/i);
  const suffix = versionMatch?.[1] || '';
  const consoleScriptUrl = new URL(`mode-atlas-dev-console${suffix}.js`, loaderUrl).href;
  const consoleStyleUrl = new URL(`../css/mode-atlas-dev-console${suffix}.css`, loaderUrl).href;
  let loadPromise = null;

  function isLocalDevHost(){
    try {
      return !!root.ModeAtlasEnv?.isLocalhost || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname || '');
    } catch { return false; }
  }

  function currentUserEmail(){
    try {
      const user = root.KanaCloudSync?.getUser?.() || root.currentUser || null;
      return String(user?.email || '').trim().toLowerCase();
    } catch { return ''; }
  }

  function isEligible(){
    return isLocalDevHost() || currentUserEmail() === DEV_EMAIL;
  }

  function ensureStyle(){
    if (document.querySelector('link[data-ma-dev-console-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = consoleStyleUrl;
    link.dataset.maDevConsoleStyle = '';
    document.head.appendChild(link);
  }

  function loadIfEligible(){
    if (root.ModeAtlasDevConsole) return Promise.resolve(true);
    if (!isEligible()) return Promise.resolve(false);
    if (loadPromise) return loadPromise;

    ensureStyle();
    loadPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-ma-dev-console-script]');
      if (existing) {
        existing.addEventListener('load', () => resolve(!!root.ModeAtlasDevConsole), { once:true });
        existing.addEventListener('error', () => { loadPromise = null; resolve(false); }, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = consoleScriptUrl;
      script.defer = true;
      script.dataset.maDevConsoleScript = '';
      script.addEventListener('load', () => resolve(!!root.ModeAtlasDevConsole), { once:true });
      script.addEventListener('error', () => {
        loadPromise = null;
        console.warn('Mode Atlas developer diagnostics could not be loaded.');
        resolve(false);
      }, { once:true });
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  root.ModeAtlasDevConsoleLoader = Object.freeze({ isEligible, loadIfEligible });

  if (isLocalDevHost()) void loadIfEligible();
  root.addEventListener('kanaCloudSyncStatusChanged', () => { if (isEligible()) void loadIfEligible(); });
})(window);
