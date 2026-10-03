/* One font transport per document. Native fonts are bundled and fully offline. */
(function ModeAtlasFonts(){
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  const target = window.ModeAtlasEnv?.isNativeApp ? 'native' : 'web';
  const revision = window.ModeAtlasCacheRevision;
  link.href = new URL(`assets/css/mode-atlas-fonts-${target}.${revision}.css`, window.ModeAtlasEnv.baseUrl).href;
  link.dataset.maFonts = target;
  document.head.appendChild(link);
})();
