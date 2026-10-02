/* Native engagement projection: existing progress remains authoritative.
   No permission prompts or reminders are scheduled during initialization. */
(function ModeAtlasNativeEngagement(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp || root.ModeAtlasNativeEngagement) return;
  const platform = root.AtlasPlatform;
  const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  let preferenceRevision = 0;
  const suspendedKey='modeAtlasWidgetSuspended';
  const suspended=()=>root.ModeAtlasStorage?.get?.(suspendedKey)==='true';
  function snapshot(){
    const owner=root.ModeAtlasProgress,state=owner?.readState?.();
    const progress = owner?.getSummary?.(state) || {};
    const routine=owner?.routine?.(state)||{streak:0,goals:[]};
    const appearance=root.ModeAtlasRewardRules?.appearance(state?.appearance?.landmark,progress.level);
    const next=root.ModeAtlasRewardRules?.landmarks.find(item=>item.level>progress.level);
    const kana = root.ModeAtlasKanaMetrics?.kanaStats?.() || {};
    const store = root.ModeAtlasStorage;
    const words = store?.json?.(store.KEYS.wordBank, []) || [];
    return {
      schemaVersion:4, updatedAt:Date.now(), localDay:root.ModeAtlasDates?.localDateKey?.() || null,
      level:Math.max(1,count(progress.level)), correct:count(progress.lifetimeCorrect),
      readingCorrect:count(progress.readingCorrect), writingCorrect:count(progress.writingCorrect),
      words:Array.isArray(words) ? words.length : 0,
      lastActivityAt:count(store?.number?.('modeAtlasLastStudiedAt', 0)),
      levelXp:count(progress.levelXp), levelRequirement:Math.max(1,count(progress.levelRequirement)),
      streak:count(kana.streak), dailyComplete:!!kana.dailyDone,
      levelProgress:Math.min(1, Math.max(0, Number(progress.progress) || 0)),
      destination:'yourAtlas',
      title:appearance?.title||'Trail Finder',frame:appearance?.frame||'plain',
      nextTitle:next?.title||null,nextLevel:next?.level||null,
      studyStreak:count(routine.streak),lastStudyDay:owner?.studyDays?.(state).sort().at(-1)||null,
      goals:routine.goals.map(({id,label,period,value,target})=>({id,label,period,value:Math.min(count(value),count(target)),target:count(target)}))
    };
  }
  // Call only from an explicit reminder preference action. Disabling
  // never requests permission; the OS owns pending requests across launches.
  async function configureReminder({enabled, hour = 19, minute = 0} = {}){
    if (typeof enabled !== 'boolean' || !Number.isInteger(hour) || hour < 0 || hour > 23
        || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new TypeError('A reminder needs an enabled flag and a valid local time.');
    }
    if (!platform?.getCapabilities?.().notifications) return {supported:false, enabled:false};
    const revision = preferenceRevision;
    if (enabled) {
      const permission = await platform.requestNotifications();
      if (!permission.granted) return {supported:true, enabled:false, permission:permission.status || 'denied'};
    }
    if(revision!==preferenceRevision)return {enabled:false,cancelled:true};
    return platform.configureStudyReminder({enabled, hour, minute});
  }
  let timer;
  function publish(){
    clearTimeout(timer);
    if (suspended()||!platform?.getCapabilities?.().widgetSnapshots) return;
    return platform.publishWidgetSnapshot(snapshot()).catch(error => console.warn('Mode Atlas snapshot unavailable', error));
  }
  function refresh(){
    clearTimeout(timer);
    timer = setTimeout(publish, 350);
  }
  async function reset(){
    preferenceRevision += 1;
    clearTimeout(timer);
    await platform.resetEngagement();
    root.dispatchEvent(new CustomEvent('modeAtlasEngagementChanged'));
  }
  root.ModeAtlasNativeEngagement = Object.freeze({snapshot, configureReminder, refresh, reset});
  root.addEventListener('modeAtlasProgressChanged', refresh);
  root.addEventListener('modeAtlasCloudDataChanged', refresh);
  root.addEventListener('modeAtlasActivityChanged', refresh);
  root.addEventListener('storage', refresh);
  const resetPreferences = () => reset().catch(error=>console.warn('Could not clear native preferences',error));
  root.addEventListener('modeAtlasDataCleared', resetPreferences);
  root.addEventListener('modeAtlasAccountSignedOut',()=>{root.ModeAtlasStorage?.set?.(suspendedKey,'true');resetPreferences();});
  root.addEventListener('kanaCloudSyncStatusChanged',()=>{if(root.KanaCloudSync?.getUser?.()&&suspended()){root.ModeAtlasStorage?.remove?.(suspendedKey);refresh();}});
  root.addEventListener('pageshow', refresh);
  document.addEventListener('ma:ui-refresh', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  root.addEventListener('modeAtlasAppStateChanged', event => { event.detail.isActive ? refresh() : publish(); });
  refresh();
})(window);
