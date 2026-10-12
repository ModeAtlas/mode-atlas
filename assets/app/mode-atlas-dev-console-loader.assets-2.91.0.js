(function ModeAtlasDevConsoleLoader(root){
  'use strict';
  if (root.ModeAtlasDevConsoleLoader) return;

  const DEV_EMAIL = 'admin@mode-atlas.com';
  const loaderScript = document.currentScript;
  const loaderUrl = loaderScript?.src || new URL('/assets/app/mode-atlas-dev-console-loader.js', location.href).href;
  const versionMatch = loaderUrl.match(/mode-atlas-dev-console-loader(\.assets-\d+\.\d+\.\d+)?\.js(?:[?#].*)?$/i);
  const suffix = versionMatch?.[1] || '';
  const consoleScriptUrl = new URL(`mode-atlas-dev-console${suffix}.js`, loaderUrl).href;
  const backupScriptUrl = new URL(`mode-atlas-dev-backups${suffix}.js`, loaderUrl).href;
  const consoleStyleUrl = new URL(`../css/mode-atlas-dev-console${suffix}.css`, loaderUrl).href;
  let loadPromise = null;

  function isLocalDevHost(){
    try {
      if (root.ModeAtlasEnv?.isNativeApp) return false;
      return !!root.ModeAtlasEnv?.isLocalhost || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname || '');
    } catch { return false; }
  }

  function currentUserEmail(){
    try {
      const user = root.KanaCloudSync?.getUser?.() || null;
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

  function loadScript(url, marker){
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.dataset[marker] = '';
      script.addEventListener('load', resolve, { once:true });
      script.addEventListener('error', () => {
        script.remove();
        reject(new Error('Mode Atlas developer diagnostics could not be loaded.'));
      }, { once:true });
      document.head.appendChild(script);
    });
  }

  function loadIfEligible(){
    if (!isEligible()) return Promise.resolve(false);
    if (root.ModeAtlasDevConsole && root.ModeAtlasDevBackups) return Promise.resolve(true);
    if (loadPromise) return loadPromise;
    ensureStyle();
    loadPromise = (async () => {
      try {
        if (!root.ModeAtlasDevBackups) await loadScript(backupScriptUrl, 'maDevBackupScript');
        if (!isEligible()) return false;
        if (!root.ModeAtlasDevConsole) await loadScript(consoleScriptUrl, 'maDevConsoleScript');
        return isEligible() && !!root.ModeAtlasDevConsole;
      } catch (error) {
        console.warn(error.message);
        return false;
      } finally { loadPromise = null; }
    })();
    return loadPromise;
  }

  root.ModeAtlasDevConsoleLoader = Object.freeze({ isEligible, isLocalDevHost, currentUserEmail, loadIfEligible });

  if (isLocalDevHost()) void loadIfEligible();
  root.addEventListener('kanaCloudSyncStatusChanged', () => { if (isEligible()) void loadIfEligible(); });
})(window);
