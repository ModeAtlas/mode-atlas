(function ModeAtlasAccountBindings(){
  'use strict';
  if (window.__modeAtlasAccountBindingsInstalled) return;
  window.__modeAtlasAccountBindingsInstalled = true;

  const appRoot = new URL((window.ModeAtlasEnv && window.ModeAtlasEnv.baseUrl) || '/', location.origin);
  const href = (path) => window.ModeAtlasVersionFile?.appUrl?.(path) || new URL(path, appRoot).href;

  function storageGet(key, fallback = '') {
    const store = window.ModeAtlasStorage;
    return store?.get?.(key, fallback) ?? localStorage.getItem(key) ?? fallback;
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

  function atlasLevelRank(level){
    if (level >= 75) return 'teal';
    if (level >= 50) return 'violet';
    if (level >= 25) return 'gold';
    if (level >= 10) return 'silver';
    return 'bronze';
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

  let nativeBuild = '';
  function appVersionLabel(){
    return String(window.ModeAtlasVersion || window.MODE_ATLAS_VERSION || 'dev-local')+(nativeBuild?' · Build '+nativeBuild:'');
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

  function bindSettings(){
    const display = window.ModeAtlasDisplay;
    document.querySelectorAll('.ma-display-option').forEach((button) => {
      if (button.dataset.displayBound === 'shared') return;
      button.dataset.displayBound = 'shared';
      button.addEventListener('click', () => display?.setMode(button.dataset.display || 'auto'));
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

    display?.applyMode();
    try { window.ModeAtlasTheme?.updateButtons?.(); } catch {}
  }

  let profileCloudBinding = null;

  function bindCloudUi(){
    if (profileCloudBinding) return true;
    const sync = window.KanaCloudSync;
    if (!sync?.bindUi) return false;
    try {
      profileCloudBinding = sync.bindUi({
        authBtn: document.getElementById('profileAuthBtn'),
        onSignIn: window.ModeAtlasEnv?.isNativeApp ? openAccountMethods : null,
        signInLabel: window.ModeAtlasEnv?.isNativeApp ? 'Sign in' : '',
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

  let accountMethodsOpen = false;
  let accountActionBusy = false;
  async function openAccountMethods(){
    if (accountMethodsOpen || accountActionBusy || !window.ModeAtlasDialog?.feature) return;
    const sync = window.KanaCloudSync;
    const user = sync?.getUser?.();
    const uid = user?.uid || null;
    const available = window.AtlasPlatform?.getCapabilities?.().authProviders || [];
    const linked = user?.providerData?.map((item) => item.providerId) || [];
    const content = document.createElement('div');
    content.className = 'ma-account-methods';
    const providers = [...new Set([...available, ...linked])].filter((id) => ['google.com','apple.com'].includes(id));
    providers.forEach((id) => {
      const name = id === 'apple.com' ? 'Apple' : 'Google';
      const connected = linked.includes(id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ma-button ma-button--wide';
      button.dataset.maAccountProvider = id;
      button.textContent = connected ? name + ' · Connected' : (user ? 'Link ' : 'Continue with ') + name;
      button.disabled = connected || !available.includes(id);
      button.addEventListener('click', async () => {
        if (accountActionBusy || (sync?.getUser?.()?.uid || null) !== uid) return;
        accountActionBusy = true;
        content.querySelectorAll('button').forEach((el) => { el.disabled = true; });
        window.ModeAtlasDialog.close();
        try {
          if (user) await sync.linkNativeProvider(id);
          else if (id === 'apple.com') await sync.signInWithApple();
          else await sync.signInWithGoogle();
        } finally { accountActionBusy = false; updateSyncStatus(); }
      });
      content.appendChild(button);
    });
    accountMethodsOpen = true;
    try {
      await window.ModeAtlasDialog.feature({
        kicker:'Mode Atlas account', title:user ? 'Sign-in methods' : 'Sign in',
        message:user
          ? 'Connected methods open this same account and progress. Link another method here before using it to sign in.'
          : 'Continue to sign in or create an account. Already have progress in an account? Use your usual sign-in method first.',
        contentNode:content
      });
    } finally { accountMethodsOpen = false; }
  }

  function bindAccountActions(){
    const retry=document.getElementById('profileSyncRetry');
    retry?.addEventListener('click',async()=>{
      if(retry.disabled)return;retry.disabled=true;
      try{await window.KanaCloudSync?.syncNow();}
      catch(error){window.ModeAtlasDiagnostics?.record('cloud-sync',error);}
      finally{retry.disabled=false;updateSyncStatus();}
    });
    const link = document.getElementById('profileLinkBtn');
    const remove = document.getElementById('settingsDeleteAccountBtn');
    link?.addEventListener('click', openAccountMethods);
    remove?.addEventListener('click', async () => {
      if (accountActionBusy) return;
      accountActionBusy = true;
      try { await window.KanaCloudSync?.deleteAccount?.(); }
      finally { accountActionBusy = false; updateSyncStatus(); }
    });
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

  function updateProgressStatus(){
    window.ModeAtlasRewardsUI?.refresh();
    const summary = window.ModeAtlasProgress?.getSummary?.();
    if (!summary) return;
    const atlasLevel = Math.max(1, Math.min(999, Math.floor(Number(summary.level) || 1)));
    const atlasRank = atlasLevelRank(atlasLevel);
    const level = document.getElementById('profileAtlasLevel');
    const xp = document.getElementById('profileAtlasXp');
    const next = document.getElementById('profileAtlasXpNext');
    const progress = document.getElementById('profileAtlasProgress');
    const bar = document.getElementById('profileAtlasXpBar');
    const reading = document.getElementById('profileReadingCorrect');
    const writing = document.getElementById('profileWritingCorrect');
    const percent = Math.max(0, Math.min(100, Math.round(Number(summary.progress || 0) * 100)));
    if (level) level.textContent = String(atlasLevel);
    if (xp) xp.textContent = `${summary.xp || 0} XP`;
    if (next) next.textContent = `${summary.levelXp || 0} / ${summary.levelRequirement || 100} XP`;
    if (progress) progress.setAttribute('aria-valuenow', String(percent));
    if (bar) bar.style.width = `${percent}%`;
    if (reading) reading.textContent = String(summary.readingCorrect || 0);
    if (writing) writing.textContent = String(summary.writingCorrect || 0);
    document.querySelectorAll('.ma-nav__profile').forEach((button) => {
      button.dataset.maAtlasRank = atlasRank;
      button.setAttribute('aria-label', `Open profile, Atlas Level ${atlasLevel}`);
      const label = button.querySelector('.ma-nav__action-label');
      if (label) label.textContent = `Lv ${atlasLevel}`;
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
    if (detail) detail.textContent = !status.user?'Sign in whenever you want to keep progress across devices.':({offline:'You can keep practising. Sync resumes when your connection returns.',paused:status.canRetry?'Your cloud save could not be updated. Check your connection and try again.':'Free some device storage, then reopen Mode Atlas.',pending:'Changes will sync automatically. You can keep practising.',cloud:'Your latest changes are saved to your account.'}[status.state]||'Cloud sync updates automatically when progress changes.');
    const retry=document.getElementById('profileSyncRetry');
    if(retry)retry.hidden=!status.canRetry;
    if (meta) meta.textContent = 'Last cloud sync: ' + formatTime(status.lastSync || storageGet('modeAtlasLastCloudSyncAt', '0'));
    if (dot) dot.className = 'ma-sync-dot ' + tone;
    const chip = document.getElementById('profileSyncChip');
    if (chip) {
      const normalizedTone = ['ok','cloud','success'].includes(tone) ? 'success' : ['warning','offline'].includes(tone) ? 'warning' : ['error','danger'].includes(tone) ? 'danger' : 'info';
      chip.className = 'ma-status-chip ma-status-chip--' + normalizedTone;
      chip.textContent = status.user ? (normalizedTone === 'success' ? 'Synced' : ({pending:'Pending',paused:'Paused',offline:'Offline'}[status.state]||'Cloud')) : 'Local only';
    }
    const native = window.ModeAtlasEnv?.isNativeApp === true;
    const link = document.getElementById('profileLinkBtn');
    if (link) link.hidden = !native || !status.user;
    const remove = document.getElementById('settingsDeleteAccountBtn');
    if (remove) remove.hidden = !status.user;
    updateProfileDot();
    updateProgressStatus();
    const ach = document.getElementById('profileAchievementCount');
    if (ach) ach.textContent = String(countUnlockedAchievements());
  }

  function install(){
    const profileMarkup = window.ModeAtlasProfileMenu?.markup?.({ href });
    const settingsMarkup = window.ModeAtlasSettingsMenu?.markup?.({ href });
    if (!profileMarkup || !settingsMarkup) {
      console.warn('Mode Atlas account content was not available.');
      return;
    }
    window.ModeAtlasAccountNavigation.install({href,profileMarkup,settingsMarkup});
    bindSettings();
    window.ModeAtlasNativeSettings?.bind?.();
    try { window.ModeAtlasTheme?.updateButtons?.(); } catch {}
    bindCloudUi();
    bindAccountActions();
    updateSyncStatus();
    try { window.ModeAtlasSounds?.refresh?.(); } catch {}
    refreshUpdateLabels();
    window.ModeAtlasProfile = Object.assign(window.ModeAtlasProfile || {}, { open: trigger => window.ModeAtlasAccountNavigation.open('profile',trigger), close: () => window.ModeAtlasAccountNavigation.close(), refresh: updateSyncStatus });
    if(window.ModeAtlasEnv?.isNativeApp)window.AtlasPlatform.getAppVersion().then(value=>{
      if(/^[0-9]+$/.test(value.build)){nativeBuild=String(value.build);refreshUpdateLabels();}
    }).catch(()=>{});
    window.ModeAtlasSettings = Object.assign(window.ModeAtlasSettings || {}, { open: trigger => window.ModeAtlasAccountNavigation.open('settings',trigger), close: () => window.ModeAtlasAccountNavigation.close() });
    try { window.dispatchEvent(new CustomEvent('modeAtlasProfileMenuReady')); } catch {}
    try { window.dispatchEvent(new CustomEvent('modeAtlasSettingsMenuReady')); } catch {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  window.addEventListener('kanaCloudSyncStatusChanged', () => {
    if (!profileCloudBinding) bindCloudUi();
    updateSyncStatus();
  });
  window.addEventListener('modeAtlasProgressChanged', updateProgressStatus);
  window.addEventListener('modeAtlasCloudDataChanged', (event) => {
    const sections = Array.isArray(event.detail?.sections) ? event.detail.sections : [];
    if (!sections.length || sections.includes('progress')) updateProgressStatus();
  });
  window.addEventListener('online', updateSyncStatus);
  window.addEventListener('offline', updateSyncStatus);
})();
