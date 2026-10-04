/* Public save management. File-based testing belongs to developer diagnostics. */
(function ModeAtlasDataControls(){
  'use strict';
  if (window.__modeAtlasDataControlsLoaded) return;
  window.__modeAtlasDataControlsLoaded = true;
  let resetting = false;

  async function resetData(){
    if (resetting) return;
    resetting = true;
    const owner = window.KanaCloudSync?.getUser?.()?.uid || null;
    try {
      const confirmed = await window.ModeAtlasFeedback?.confirm?.({
        kicker: 'Save management',
        title: 'Reset all Mode Atlas data?',
        message: 'This clears Mode Atlas save data on this device. If you are signed in and cloud is available, it also clears the cloud save for this account. This cannot be undone.',
        confirmLabel: 'Reset data', cancelLabel: 'Keep data', tone: 'danger'
      });
      if (!confirmed) return;
      if (window.KanaCloudSync?.ready) await window.KanaCloudSync.ready;
      if (owner !== (window.KanaCloudSync?.getUser?.()?.uid || null)) {
        window.ModeAtlasFeedback?.status?.('[data-ma-save-status]', 'The account changed. Start the reset again.', 'warning');
        return;
      }
      window.ModeAtlasFeedback?.status?.('[data-ma-save-status]', 'Resetting save data…', 'warning');
      if (window.KanaCloudSync?.resetAllData) await window.KanaCloudSync.resetAllData();
      else {
        const store = window.ModeAtlasStorage;
        if (!store?.clearAppData) throw new Error('Mode Atlas storage boundary is unavailable');
        store.clearAppData();
      }
      if (window.ModeAtlasVersionFile?.navigate) window.ModeAtlasVersionFile.navigate('/');
      else location.href = '/';
    } catch (error) {
      console.warn('Reset failed.', error);
      const message = 'Reset failed. Please check your connection and try again.';
      window.ModeAtlasFeedback?.status?.('[data-ma-save-status]', message, 'error');
      window.ModeAtlasFeedback?.toast?.(message, 'error', 4200);
    } finally {
      resetting = false;
    }
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-ma-unified-reset]')) return;
    event.preventDefault();
    void resetData();
  });
})();
