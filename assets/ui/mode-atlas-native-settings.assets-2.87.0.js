/* iOS engagement controls. Account navigation owns presentation/focus; this module
   owns only reminder preferences and never stores a second OS schedule. */
(function(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp) return;
  let bound = false, busy = false, state = null, readRevision = 0;
  const $ = id => document.getElementById(id);
  const status = message => { const node=$('maReminderStatus'); if(node){node.textContent=message;node.hidden=!message;} };
  const pad = value => String(value).padStart(2,'0');
  const timingFields=[['reminderMinute','Goal & streak alert time'],['quietStart','Quiet hours start'],['quietEnd','Quiet hours end']];
  const alertKinds=[['dailyGoals','Daily goals ending'],['weeklyGoals','Weekly goals ending'],['streak','Streak at risk'],['overtaken','Overtaken in weekly ranking']];
  function render(){
    if(!state)return;
    const reminder=state.reminder||{};
    $('maReminderEnabled').checked=!!reminder.enabled;
    $('maReminderTime').value=`${pad(reminder.hour??19)}:${pad(reminder.minute??0)}`;
    $('maReminderEnabled').disabled=busy||!state.supported;
    $('maReminderTime').disabled=busy||!state.supported;
    $('maNotificationSettings').disabled=busy;
    for(const [key]of alertKinds){const control=$('maAlert-'+key);control.checked=!!state.alerts?.preferences?.[key];control.disabled=busy||!state.alerts?.supported||!state.alerts?.signedIn||!!state.alerts?.error;}
    const schedule=root.ModeAtlasNotificationRules.normalize(state.alerts?.schedule);
    for(const [key]of timingFields){const control=$('maAlertTime-'+key);control.value=`${pad(Math.floor(schedule[key]/60))}:${pad(schedule[key]%60)}`;control.disabled=busy||!state.alerts?.signedIn||!!state.alerts?.error||!state.alerts?.supported;}
    $('maSaveAlertTimes').disabled=busy||!state.alerts?.signedIn||!!state.alerts?.error||!state.alerts?.supported;
    $('maAccountAlertsStatus').textContent=state.alerts?.error?'Connect to refresh your notification preferences.':!state.alerts?.signedIn?'Sign in to choose account notifications.':!state.alerts?.supported?'Push notifications are unavailable in this build.':'Goal and streak alerts arrive within two hours of your chosen time, only when needed and outside quiet hours. Rank changes are limited to one alert a day. All times follow this device’s time zone. Goal and streak alerts are skipped on this iPhone when its daily reminder is within an hour.';
    status(!state.supported?'Reminders are unavailable in this build.':'');
  }
  async function refresh(){
    if(!bound||busy)return;
    const revision=++readRevision;
    try{
      const [next,alerts]=await Promise.all([root.AtlasPlatform.getEngagementState(),root.ModeAtlasNotifications?.read().catch(()=>({error:true,signedIn:true}))||Promise.resolve({supported:false,signedIn:false})]);
      if(revision!==readRevision||busy)return;state={...next,alerts};render();
    }
    catch{status('Could not read iPhone preferences. Close and reopen Settings to try again.');}
  }
  async function change(action, success){
    if(busy)return;
    busy=true;++readRevision;render();
    let message='';
    try{const result=await action();message=typeof success==='function'?success(result):success;}
    catch(error){message=error.message||'Could not save this preference. Please try again.';}
    finally{busy=false;await refresh();if(message)status(message);}
  }
  function reminder(enabled){
    const value=$('maReminderTime').value;
    const match=/^(\d{2}):(\d{2})$/.exec(value);
    if(!match){render();status('Choose a valid reminder time.');return;}
    change(async()=>{const result=await root.ModeAtlasNativeEngagement.configureReminder({enabled,hour:Number(match[1]),minute:Number(match[2])});await root.ModeAtlasNotifications?.reconnect();return result;},
      result=>enabled&&!result.enabled?'Reminder was not enabled. Check notification access in iPhone Settings.':'');
  }
  root.ModeAtlasNativeSettings={
    markup(){return `<section class="ma-settings-section" aria-labelledby="maEngagementTitle">
      <div class="ma-settings-section-head"><h3 class="ma-settings-section-title" id="maEngagementTitle">Notifications</h3></div>
      <div class="ma-setting-list">
        <div class="ma-setting-row ma-setting-row--stack">
          <label class="ma-native-preference" for="maReminderEnabled"><span>Daily study reminder</span><input id="maReminderEnabled" type="checkbox" role="switch" disabled></label>
          <label class="ma-native-preference" for="maReminderTime"><span>Reminder time</span><input id="maReminderTime" type="time" value="19:00" aria-describedby="maReminderStatus" disabled></label>
          ${alertKinds.map(([key,label])=>`<label class="ma-native-preference" for="maAlert-${key}"><span>${label}</span><input id="maAlert-${key}" type="checkbox" role="switch" aria-describedby="maAccountAlertsStatus" disabled></label>`).join('')}
          ${timingFields.map(([key,label])=>`<label class="ma-native-preference" for="maAlertTime-${key}"><span>${label}</span><input id="maAlertTime-${key}" type="time" step="900" required disabled></label>`).join('')}
          <button type="button" class="ma-button" id="maSaveAlertTimes" disabled>Save alert times</button>
          <p id="maAccountAlertsStatus" class="ma-setting-row__description"></p>
          <div class="ma-action-row"><button type="button" class="ma-button" id="maNotificationSettings">Open iPhone Settings</button></div>
          <div id="maReminderStatus" class="ma-setting-row__description" role="status" aria-live="polite" hidden></div>
        </div>

      </div></section>`;},
    bind(){
      if(bound||!$('maReminderEnabled'))return;bound=true;
      $('maReminderEnabled').addEventListener('change',event=>reminder(event.target.checked));
      $('maReminderTime').addEventListener('change',()=>{if(state?.reminder?.enabled)reminder(true);});
      for(const [key]of alertKinds)$('maAlert-'+key).addEventListener('change',event=>{
        const preferences={...state.alerts.preferences,[key]:event.target.checked};
        change(()=>root.ModeAtlasNotifications.configure(preferences),'');
      });
      $('maSaveAlertTimes').addEventListener('click',()=>{
        const schedule=Object.fromEntries(timingFields.map(([key])=>{const value=$('maAlertTime-'+key).value.split(':').map(Number);return [key,value.length===2?value[0]*60+value[1]:NaN];}));
        change(()=>root.ModeAtlasNotifications.configure(state.alerts.preferences,schedule),'Alert times saved.');
      });
      $('maNotificationSettings').addEventListener('click',()=>change(()=>root.AtlasPlatform.openNotificationSettings(),result=>result.opened?'':'Could not open iPhone Settings.'));
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
      root.addEventListener('modeAtlasEngagementChanged',refresh);
      let account=root.KanaCloudSync?.getUser?.()?.uid;
      root.addEventListener('kanaCloudSyncStatusChanged',()=>{const next=root.KanaCloudSync?.getUser?.()?.uid;if(next!==account){account=next;refresh();}});
      refresh();
    },refresh
  };
})(window);
