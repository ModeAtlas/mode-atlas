/* iOS engagement controls. Existing drawer owns presentation/focus; this module
   owns only reminder preferences and never stores a second OS schedule. */
(function(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp) return;
  let bound = false, busy = false, state = null, readRevision = 0;
  const $ = id => document.getElementById(id);
  const status = message => { const node=$('maReminderStatus'); if(node){node.textContent=message;node.hidden=!message;} };
  const pad = value => String(value).padStart(2,'0');
  function render(){
    if(!state)return;
    const reminder=state.reminder||{};
    $('maReminderEnabled').checked=!!reminder.enabled;
    $('maReminderTime').value=`${pad(reminder.hour??19)}:${pad(reminder.minute??0)}`;
    $('maReminderEnabled').disabled=busy||!state.supported;
    $('maReminderTime').disabled=busy||!state.supported;
    $('maNotificationSettings').disabled=busy;
    status(!state.supported?'Reminders are unavailable in this build.':'');
  }
  async function refresh(){
    if(!bound||busy)return;
    const revision=++readRevision;
    try{const next=await root.AtlasPlatform.getEngagementState();if(revision!==readRevision||busy)return;state=next;render();}
    catch{status('Could not read iPhone preferences. Close and reopen Settings to try again.');}
  }
  async function change(action, success){
    if(busy)return;
    busy=true;++readRevision;render();
    let message='';
    try{const result=await action();message=typeof success==='function'?success(result):success;}
    catch{message='Could not save this preference. Please try again.';}
    finally{busy=false;await refresh();if(message)status(message);}
  }
  function reminder(enabled){
    const value=$('maReminderTime').value;
    const match=/^(\d{2}):(\d{2})$/.exec(value);
    if(!match){render();status('Choose a valid reminder time.');return;}
    change(()=>root.ModeAtlasNativeEngagement.configureReminder({enabled,hour:Number(match[1]),minute:Number(match[2])}),
      result=>enabled&&!result.enabled?'Reminder was not enabled. Check notification access in iPhone Settings.':'');
  }
  root.ModeAtlasNativeSettings={
    markup(){return `<section class="ma-settings-section" aria-labelledby="maEngagementTitle">
      <div class="ma-settings-section-head"><div class="ma-settings-section-title" id="maEngagementTitle">Reminders</div></div>
      <div class="ma-setting-list">
        <div class="ma-setting-row ma-setting-row--stack">
          <label class="ma-native-preference" for="maReminderEnabled"><span>Daily study reminder</span><input id="maReminderEnabled" type="checkbox" role="switch" disabled></label>
          <label class="ma-native-preference" for="maReminderTime"><span>Reminder time</span><input id="maReminderTime" type="time" value="19:00" aria-describedby="maReminderStatus" disabled></label>
          <div class="ma-action-row"><button type="button" class="ma-button" id="maNotificationSettings">Open iPhone Settings</button></div>
          <div id="maReminderStatus" class="ma-setting-row__description" role="status" aria-live="polite" hidden></div>
        </div>

      </div></section>`;},
    bind(){
      if(bound||!$('maReminderEnabled'))return;bound=true;
      $('maReminderEnabled').addEventListener('change',event=>reminder(event.target.checked));
      $('maReminderTime').addEventListener('change',()=>{if(state?.reminder?.enabled)reminder(true);});
      $('maNotificationSettings').addEventListener('click',()=>change(()=>root.AtlasPlatform.openNotificationSettings(),result=>result.opened?'':'Could not open iPhone Settings.'));
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
      root.addEventListener('modeAtlasEngagementChanged',refresh);
      refresh();
    },refresh
  };
})(window);
