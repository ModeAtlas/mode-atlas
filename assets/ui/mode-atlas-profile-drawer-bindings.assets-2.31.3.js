(function ModeAtlasSharedDrawers(){
  'use strict';
  if (window.__modeAtlasSharedDrawersInstalled) return;
  window.__modeAtlasSharedDrawersInstalled = true;

  const appRoot = new URL((window.ModeAtlasEnv && window.ModeAtlasEnv.baseUrl) || '/', location.origin);
  const href = (path) => window.ModeAtlasVersionFile?.appUrl?.(path) || new URL(path, appRoot).href;

  function storageGet(key, fallback = '') {
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
  }

  function storageSet(key, value) {
    const store = window.ModeAtlasStorage;
    return store?.set?.(key, value) ?? localStorage.setItem(key, String(value));
  }

  function readJson(key, fallback){
    try {
      const raw = storageGet(key, null);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function countUnlockedAchievements(){
    const set = readJson('modeAtlasSeenAchievementUnlocks', []);
    return Array.isArray(set) ? set.length : 0;
  }

  function formatTime(ts){
    const n = Number(ts || 0);
    if (!n) return 'Never synced';
    const date = new Date(n);
    if (Number.isNaN(date.getTime())) return 'Never synced';
    const diff = Math.max(0, Date.now() - n);
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
    return date.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }

  function appVersionLabel(){
    return String(window.ModeAtlasVersion || window.MODE_ATLAS_VERSION || 'dev-local');
  }

  function setUpdateStatus(message, tone){
    const status = document.getElementById('maUpdateStatus');
    if (!status) return;
    window.ModeAtlasFeedback?.status?.(status, message, tone || 'info');
  }

  function refreshUpdateLabels(){
    document.querySelectorAll('[data-ma-current-version]').forEach((node) => {
      node.textContent = appVersionLabel();
    });
    const status = document.getElementById('maUpdateStatus');
    if (status && !status.dataset.userSet) status.textContent = 'Current version: ' + appVersionLabel();
  }

  let settingsUpdateOperation = null;
  let settingsUpdateRequestToken = 0;
  let settingsUpdateBurstGuardUntil = 0;
  let settingsUpdateLastStatus = '';
  let settingsUpdateLastTone = '';
  const SETTINGS_UPDATE_BURST_GUARD_MS = 2000;

  function setSettingsUpdateButtonBusy(button, busy){
    if (!button) return;
    button.disabled = !!busy;
    button.dataset.maUpdateBusy = busy ? '1' : '0';
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    const label = button.querySelector('[data-ma-update-label]');
    if (label) label.textContent = busy ? 'Checking…' : 'Check for updates';
    else button.textContent = busy ? 'Checking…' : 'Check for updates';
  }

  function rememberUpdateStatus(message, tone){
    settingsUpdateLastStatus = String(message || '');
    settingsUpdateLastTone = String(tone || '');
    setUpdateStatus(settingsUpdateLastStatus, settingsUpdateLastTone);
  }

  function checkForUpdatesFromSettings(button){
    // One Settings request owns the button at a time. Extra clicks while that
    // request exists are strict no-ops; they do not queue another network read.
    if (settingsUpdateOperation) return settingsUpdateOperation;

    // Protect the browser from a burst of completed checks caused by rapid
    // clicking around the exact moment the button is restored. This is UI
    // de-bouncing only; a normal later click still performs a fresh no-store read.
    if (Date.now() < settingsUpdateBurstGuardUntil) {
      if (settingsUpdateLastStatus) setUpdateStatus(settingsUpdateLastStatus, settingsUpdateLastTone);
      return Promise.resolve({ skipped: 'settings-burst-guard' });
    }

    const requestToken = ++settingsUpdateRequestToken;
    const loadedVersion = appVersionLabel();
    let reloadRevision = '';

    setSettingsUpdateButtonBusy(button, true);
    rememberUpdateStatus('Checking for updates… Current version: ' + loadedVersion, 'info');

    const operation = (async () => {
      try {
        const versionFile = window.ModeAtlasVersionFile;
        if (!versionFile || typeof versionFile.check !== 'function') {
          throw new Error('The version checker is not available. Refresh the page and try again.');
        }

        const result = await versionFile.check({ timeoutMs: 4500 });

        // Ignore an obsolete completion if ownership ever changes in a future
        // implementation. Only the current request token may update Settings UI.
        if (requestToken !== settingsUpdateRequestToken) return { skipped: 'stale-settings-result' };

        if (result.matches) {
          rememberUpdateStatus('You are up to date — version ' + result.loadedVersion + '.', 'success');
          return result;
        }

        reloadRevision = result.deployedRevision;
        rememberUpdateStatus('Update found: ' + result.deployedVersion + '. Reloading to apply it…', 'info');
        return result;
      } catch (error) {
        if (requestToken !== settingsUpdateRequestToken) return { skipped: 'stale-settings-error' };
        const message = error?.name === 'TimeoutError' || error?.name === 'AbortError'
          ? 'Update check timed out. Please try again.'
          : 'Update check failed: ' + (error?.message || String(error)) + '.';
        rememberUpdateStatus(message, 'error');
        return { error };
      } finally {
        // Only the owner that started this operation may restore the control.
        if (requestToken === settingsUpdateRequestToken) {
          settingsUpdateOperation = null;
          settingsUpdateBurstGuardUntil = Date.now() + SETTINGS_UPDATE_BURST_GUARD_MS;
          setSettingsUpdateButtonBusy(button, false);
        }
      }
    })();

    settingsUpdateOperation = operation;

    return operation.then((result) => {
      if (reloadRevision && requestToken === settingsUpdateRequestToken) {
        setTimeout(() => window.ModeAtlasVersionFile?.reloadWithRevision?.(reloadRevision), 150);
      }
      return result;
    });
  }

  function removeStaticDrawers(){
    document.querySelectorAll('#profileDrawer,#profileBackdrop,#drawerBackdrop,#studyProfileOverlay,#settingsDrawer,#settingsBackdrop').forEach((node) => node.remove());
  }

  let activeDrawerName = '';
  let drawerReturnFocus = null;

  function drawerElement(name){
    return document.getElementById(name === 'settings' ? 'settingsDrawer' : 'profileDrawer');
  }

  function setDrawerOpen(name, open){
    const drawer = drawerElement(name);
    const backdrop = document.getElementById(name === 'settings' ? 'settingsBackdrop' : 'profileBackdrop');
    if (drawer) {
      drawer.classList.toggle('open', open);
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (backdrop) backdrop.classList.toggle('open', open);
    document.body.classList.toggle(name === 'settings' ? 'settings-open' : 'profile-open', open);
    if (open) setTimeout(() => document.getElementById(name === 'settings' ? 'settingsCloseBtn' : 'profileCloseBtn')?.focus(), 0);
  }

  function openDrawer(name, trigger){
    if (activeDrawerName && activeDrawerName !== name) setDrawerOpen(activeDrawerName, false);
    drawerReturnFocus = trigger || document.activeElement || drawerReturnFocus;
    activeDrawerName = name;
    setDrawerOpen(name, true);
  }

  function closeDrawer(name, restoreFocus = true){
    if (!name) return;
    const wasActive = activeDrawerName === name;
    setDrawerOpen(name, false);
    if (wasActive) activeDrawerName = '';
    if (restoreFocus && wasActive) {
      const target = drawerReturnFocus;
      drawerReturnFocus = null;
      if (target && target.isConnected && typeof target.focus === 'function') setTimeout(() => target.focus(), 0);
    }
  }

  function openProfile(trigger){ openDrawer('profile', trigger); }
  function closeProfile(){ closeDrawer('profile'); }
  function openSettings(trigger){ openDrawer('settings', trigger); }
  function closeSettings(){ closeDrawer('settings'); }
  function closeAll(){ if (activeDrawerName) closeDrawer(activeDrawerName); }

  function trapDrawerFocus(event){
    if (event.key !== 'Tab' || !activeDrawerName) return;
    const drawer = drawerElement(activeDrawerName);
    if (!drawer) return;
    const focusable = Array.from(drawer.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter((node) => !node.hidden && node.getAttribute('aria-hidden') !== 'true' && node.getClientRects().length > 0);
    if (!focusable.length) { event.preventDefault(); drawer.focus?.(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function profileTriggerButtons(){
    return Array.from(document.querySelectorAll('[data-profile-open]'));
  }

  function bindOpenClose(){
    profileTriggerButtons().forEach((button) => {
      if (button.dataset.profileBound === 'shared') return;
      button.dataset.profileBound = 'shared';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openProfile(button);
      }, true);
    });
    document.querySelectorAll('[data-settings-open]').forEach((button) => {
      if (button.dataset.settingsBound === 'shared') return;
      button.dataset.settingsBound = 'shared';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openSettings(button);
      }, true);
    });
    document.querySelectorAll('[data-ma-drawer-close="profile"],#profileCloseBtn').forEach((button) => {
      if (button.dataset.profileCloseBound === 'shared') return;
      button.dataset.profileCloseBound = 'shared';
      button.addEventListener('click', (event) => { event.preventDefault(); closeProfile(); });
    });
    document.querySelectorAll('[data-ma-drawer-close="settings"],#settingsCloseBtn').forEach((button) => {
      if (button.dataset.settingsCloseBound === 'shared') return;
      button.dataset.settingsCloseBound = 'shared';
      button.addEventListener('click', (event) => { event.preventDefault(); closeSettings(); });
    });
  }

  function bindSettings(){
    const display = window.ModeAtlasDisplay;
    const normalize = (value) => display?.normalizeMode ? display.normalizeMode(value) : String(value || 'auto').toLowerCase();
    const currentMode = () => display?.getMode ? display.getMode() : normalize(storageGet('modeAtlasDisplayMode', 'auto') || 'auto');
    const apply = () => {
      if (display?.applyMode) display.applyMode();
      else {
        const mode = currentMode();
        document.body.dataset.displayMode = mode;
        document.querySelectorAll('.ma-display-option').forEach((button) => button.classList.toggle('active', normalize(button.dataset.display) === mode));
      }
    };
    document.querySelectorAll('.ma-display-option').forEach((button) => {
      if (button.dataset.displayBound === 'shared') return;
      button.dataset.displayBound = 'shared';
      button.addEventListener('click', () => {
        const nextMode = normalize(button.dataset.display || 'auto');
        if (display?.setMode) display.setMode(nextMode);
        else {
          storageSet('modeAtlasDisplayMode', nextMode);
          window.dispatchEvent(new CustomEvent('modeAtlasDisplayModeChanged', { detail: { mode: nextMode } }));
        }
        apply();
        try { window.ModeAtlasTheme?.updateButtons?.(); } catch {}
      });
    });
    document.querySelectorAll('[data-ma-check-updates]').forEach((button) => {
      if (button.dataset.updateBound === 'shared') return;
      button.dataset.updateBound = 'shared';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        if (button.dataset.maUpdateBusy === '1') return;
        void checkForUpdatesFromSettings(button);
      });
    });
    refreshUpdateLabels();

    apply();
    try { window.ModeAtlasTheme?.updateButtons?.(); } catch {}
  }

  let profileCloudBinding = null;

  function bindCloudUi(){
    if (profileCloudBinding) return true;
    const sync = window.KanaCloudSync;
    if (!sync?.bindUi) return false;
    try {
      profileCloudBinding = sync.bindUi({
        signInBtn: document.getElementById('profileSignInBtn'),
        signOutBtn: document.getElementById('profileSignOutBtn'),
        statusEl: null,
        nameEl: document.getElementById('profileName'),
        emailEl: document.getElementById('profileEmail'),
        photoEl: document.getElementById('profileAvatar')
      });
      return !!profileCloudBinding;
    } catch (error) {
      console.warn('Profile cloud controls could not bind.', error);
      profileCloudBinding = null;
      return false;
    }
  }

  function updateProfileDot(){
    const user = window.KanaCloudSync?.getUser?.();
    document.querySelectorAll('#topProfileDot').forEach((dot) => {
      if (!dot) return;
      if (user?.photoURL) {
        const image = document.createElement('img');
        image.src = user.photoURL;
        image.alt = '';
        dot.replaceChildren(image);
      }
      else {
        const label = (user?.displayName || user?.email || 'M').trim();
        dot.textContent = (label[0] || 'M').toUpperCase();
      }
    });
  }

  function updateSyncStatus(){
    const status = window.KanaCloudSync?.getSyncStatus?.() || { state:'local', tone:'neutral', text:'Progress saves on this device · sign in to sync', lastSync: Number(storageGet('modeAtlasLastCloudSyncAt', '0') || 0), user: null };
    const tone = status.tone || status.state || 'neutral';
    const summary = document.getElementById('profileSyncSummary');
    const detail = document.getElementById('profileSyncDetail');
    const meta = document.getElementById('profileSyncMeta');
    const dot = document.getElementById('profileSyncDot');
    if (summary) summary.textContent = status.text || 'Progress saves on this device';
    if (detail) detail.textContent = status.user ? 'Signed in with Google. Cloud sync updates automatically when progress changes.' : 'Not signed in. Your progress is saved locally on this device.';
    if (meta) meta.textContent = 'Last cloud sync: ' + formatTime(status.lastSync || storageGet('modeAtlasLastCloudSyncAt', '0'));
    if (dot) dot.className = 'ma-sync-dot ' + tone;
    const chip = document.getElementById('profileSyncChip');
    if (chip) {
      const normalizedTone = ['ok','cloud','success'].includes(tone) ? 'success' : ['warning','offline'].includes(tone) ? 'warning' : ['error','danger'].includes(tone) ? 'danger' : 'info';
      chip.className = 'ma-status-chip ma-status-chip--' + normalizedTone;
      chip.textContent = status.user ? (normalizedTone === 'success' ? 'Synced' : status.state || 'Cloud') : 'Local only';
    }
    updateProfileDot();
    const ach = document.getElementById('profileAchievementCount');
    if (ach) ach.textContent = String(countUnlockedAchievements());
  }

  function install(){
    removeStaticDrawers();
    const profileMarkup = window.ModeAtlasProfileMenu?.markup?.({ href });
    const settingsMarkup = window.ModeAtlasSettingsMenu?.markup?.({ href });
    if (!profileMarkup || !settingsMarkup) {
      console.warn('Mode Atlas profile/settings menu markup was not available.');
      return;
    }
    document.body.insertAdjacentHTML('afterbegin', profileMarkup + settingsMarkup);
    bindOpenClose();
    bindSettings();
    try { window.ModeAtlasTheme?.updateButtons?.(); } catch {}
    bindCloudUi();
    updateSyncStatus();
    try { window.ModeAtlasSounds?.refresh?.(); } catch {}
    refreshUpdateLabels();
    window.ModeAtlasProfile = Object.assign(window.ModeAtlasProfile || {}, { open: openProfile, close: closeProfile, refresh: updateSyncStatus });
    window.ModeAtlasSettings = Object.assign(window.ModeAtlasSettings || {}, { open: openSettings, close: closeSettings });
    try { window.dispatchEvent(new CustomEvent('modeAtlasProfileMenuReady')); } catch {}
    try { window.dispatchEvent(new CustomEvent('modeAtlasSettingsMenuReady')); } catch {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeDrawerName) { event.preventDefault(); closeAll(); return; }
    trapDrawerFocus(event);
  });
  window.addEventListener('kanaCloudSyncStatusChanged', () => {
    if (!profileCloudBinding) bindCloudUi();
    updateSyncStatus();
  });
  window.addEventListener('online', updateSyncStatus);
  window.addEventListener('offline', updateSyncStatus);
})();
