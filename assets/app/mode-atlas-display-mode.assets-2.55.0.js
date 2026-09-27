/* Mode Atlas display mode controller. Owns saved display mode and viewport-derived effective mode. */
(function () {
  const STORAGE_KEY = 'modeAtlasDisplayMode';
  const LEGACY_ALIASES = { compact: 'tablet', mobile: 'phone' };
  const VALID_MODES = new Set(['auto', 'desktop', 'tablet', 'phone']);
  let resizeTimer = 0;

  function storeGet(key, fallback = '') {
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  }

  function storeSet(key, value) {
    const store = window.ModeAtlasStorage;
    return store?.set?.(key, value) ?? localStorage.setItem(key, String(value));
  }

  function normalizeMode(mode) {
    const value = String(mode || 'auto').toLowerCase();
    const normalized = LEGACY_ALIASES[value] || value;
    return VALID_MODES.has(normalized) ? normalized : 'auto';
  }

  function readStoredMode() {
    const raw = storeGet(STORAGE_KEY, 'auto') || 'auto';
    const normalized = normalizeMode(raw);
    if (raw && raw !== normalized && raw !== 'auto') writeStoredMode(normalized);
    return normalized;
  }

  function writeStoredMode(mode) {
    storeSet(STORAGE_KEY, mode);
  }

  function getMode() { return readStoredMode(); }

  function resolveAutoMode() {
    const width = Math.min(window.innerWidth || 1200, document.documentElement?.clientWidth || window.innerWidth || 1200);
    if (width <= 700) return 'phone';
    if (width <= 1180) return 'tablet';
    return 'desktop';
  }

  function getEffectiveMode(mode = getMode()) {
    const normalized = normalizeMode(mode);
    return normalized === 'auto' ? resolveAutoMode() : normalized;
  }

  function setMode(mode) {
    const normalized = normalizeMode(mode);
    writeStoredMode(normalized);
    applyMode();
    window.dispatchEvent(new CustomEvent('modeAtlasDisplayModeChanged', { detail: { mode: normalized, effectiveMode: getEffectiveMode(normalized) } }));
  }

  function applyMode() {
    const mode = getMode();
    const effectiveMode = getEffectiveMode(mode);
    const targets = [document.documentElement, document.body].filter(Boolean);
    targets.forEach((target) => {
      target.dataset.displayMode = mode;
      target.dataset.effectiveDisplayMode = effectiveMode;
      target.classList.toggle('ma-display-desktop', effectiveMode === 'desktop');
      target.classList.toggle('ma-display-tablet', effectiveMode === 'tablet');
      target.classList.toggle('ma-display-phone', effectiveMode === 'phone');
    });
    document.querySelectorAll('.ma-display-option').forEach((button) => {
      const buttonMode = normalizeMode(button.dataset.modeAtlasDisplay || button.dataset.display || 'auto');
      button.classList.toggle('active', buttonMode === mode);
      button.setAttribute('aria-pressed', buttonMode === mode ? 'true' : 'false');
    });
  }

  function onResize() {
    if (getMode() !== 'auto') return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyMode, 80);
  }

  function injectDisplayControls() { applyMode(); }
  window.ModeAtlasDisplay = { getMode, setMode, applyMode, injectDisplayControls, getEffectiveMode, normalizeMode };
  applyMode();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectDisplayControls);
  else injectDisplayControls();
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', applyMode);
  document.addEventListener('ma:ui-refresh', injectDisplayControls);
  document.addEventListener('ma:trainer-ready', injectDisplayControls);
})();
