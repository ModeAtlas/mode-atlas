/* Native engagement projection: existing progress remains authoritative.
   No permission prompts or reminders are scheduled during initialization. */
(function ModeAtlasNativeEngagement(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp || root.ModeAtlasNativeEngagement) return;
  const platform = root.AtlasPlatform;
  const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  function snapshot(){
    const progress = root.ModeAtlasProgress?.getSummary?.() || {};
    const kana = root.ModeAtlasKanaMetrics?.kanaStats?.() || {};
    return {
      schemaVersion:1, updatedAt:Date.now(),
      level:Math.max(1,count(progress.level)), correct:count(progress.lifetimeCorrect),
      streak:count(kana.streak), dailyComplete:!!kana.dailyDone,
      levelProgress:Math.min(1, Math.max(0, Number(progress.progress) || 0)),
      destination:kana.dailyDone ? 'kana' : 'daily'
    };
  }
  // Call only from an explicit future reminder preference action. Disabling
  // never requests permission; the OS owns pending requests across launches.
  async function configureReminder({enabled, hour = 19, minute = 0} = {}){
    if (typeof enabled !== 'boolean' || !Number.isInteger(hour) || hour < 0 || hour > 23
        || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new TypeError('A reminder needs an enabled flag and a valid local time.');
    }
    if (!platform?.getCapabilities?.().notifications) return {supported:false, enabled:false};
    if (enabled) {
      const permission = await platform.requestNotifications();
      if (!permission.granted) return {supported:true, enabled:false, permission:permission.status || 'denied'};
    }
    return platform.configureStudyReminder({enabled, hour, minute});
  }
  let timer;
  function refresh(){
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!platform?.getCapabilities?.().widgetSnapshots) return;
      platform.publishWidgetSnapshot(snapshot()).catch(error => console.warn('Mode Atlas snapshot unavailable', error));
    }, 350);
  }
  root.ModeAtlasNativeEngagement = Object.freeze({snapshot, configureReminder, refresh});
  root.addEventListener('modeAtlasProgressChanged', refresh);
  root.addEventListener('modeAtlasCloudDataChanged', refresh);
  root.addEventListener('storage', refresh);
  root.addEventListener('modeAtlasDataCleared', refresh);
  root.addEventListener('pageshow', refresh);
  document.addEventListener('ma:ui-refresh', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh();
})(window);
