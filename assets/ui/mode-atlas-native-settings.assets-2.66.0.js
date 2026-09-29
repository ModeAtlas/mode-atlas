/* iOS engagement controls. Existing drawer owns presentation/focus; this module
   owns only reminder/widget preferences and never stores a second OS schedule. */
(function(root){
  'use strict';
  if (!root.ModeAtlasEnv?.isNativeApp) return;
  let bound = false, busy = false, state = null, readRevision = 0;
  const $ = id => document.getElementById(id);
  const status = message => { if ($('maReminderStatus')) $('maReminderStatus').textContent = message; };
  const pad = value => String(value).padStart(2,'0');
  function render(){
    if(!state)return;
    const reminder=state.reminder||{}, widgets=state.widgets||{};
    $('maReminderEnabled').checked=!!reminder.enabled;
    $('maReminderTime').value=`${pad(reminder.hour??19)}:${pad(reminder.minute??0)}`;
    $('maReminderEnabled').disabled=busy||!state.supported;
    $('maReminderTime').disabled=busy||!state.supported;
    $('maReminderTest').disabled=busy||!reminder.granted;
    $('maNotificationSettings').hidden=reminder.status!=='denied';
    $('maNotificationSettings').disabled=busy;
    $('maWidgetProgress').checked=!!widgets.showProgress;
    $('maWidgetProgress').disabled=busy||!widgets.progressSupported;
    $('maWidgetStatus').textContent=widgets.progressSupported
      ? 'Show your learning totals on your Home Screen. No account details are shared.'
      : 'Practice shortcuts are available. Progress sharing needs an App Group-enabled build.';
    status(!state.supported?'Reminders are unavailable in this build.' : reminder.status==='denied'
      ? 'Notifications are blocked in iPhone Settings.' : reminder.enabled
      ? `Daily reminder at ${$('maReminderTime').value}, in your device’s local time.` : 'Reminders are off. Enable one when you’re ready.');
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
      <div class="ma-settings-section-head"><div class="ma-menu-kicker">On your iPhone</div><div class="ma-settings-section-title" id="maEngagementTitle">Reminders &amp; widgets</div></div>
      <div class="ma-setting-list">
        <div class="ma-setting-row ma-setting-row--stack">
          <label class="ma-native-preference" for="maReminderEnabled"><span>Daily study reminder</span><input id="maReminderEnabled" type="checkbox" role="switch" disabled></label>
          <label class="ma-native-preference" for="maReminderTime"><span>Reminder time</span><input id="maReminderTime" type="time" value="19:00" aria-describedby="maReminderStatus" disabled></label>
          <div class="ma-action-row"><button type="button" class="ma-button" id="maReminderTest" disabled>Test notification</button><button type="button" class="ma-button" id="maNotificationSettings" hidden>Open iPhone Settings</button></div>
          <div id="maReminderStatus" class="ma-status" role="status" aria-live="polite">Loading reminder preferences…</div>
        </div>
        <div class="ma-setting-row ma-setting-row--stack">
          <label class="ma-native-preference" for="maWidgetProgress"><span>Show progress on widgets</span><input id="maWidgetProgress" type="checkbox" role="switch" disabled aria-describedby="maWidgetStatus"></label>
          <div id="maWidgetStatus" class="ma-setting-row__description">Loading widget preferences…</div>
          <button class="ma-button" type="button" id="maWidgetHelp">How to add a widget</button>
        </div>
      </div></section>`;},
    bind(){
      if(bound||!$('maReminderEnabled'))return;bound=true;
      $('maReminderEnabled').addEventListener('change',event=>reminder(event.target.checked));
      $('maReminderTime').addEventListener('change',()=>{if(state?.reminder?.enabled)reminder(true);});
      $('maReminderTest').addEventListener('click',()=>change(()=>root.AtlasPlatform.testNotification(),result=>result.scheduled?'Test notification scheduled for five seconds from now.':'Allow notifications in iPhone Settings before testing.'));
      $('maNotificationSettings').addEventListener('click',()=>change(()=>root.AtlasPlatform.openNotificationSettings(),result=>result.opened?'':'Could not open iPhone Settings.'));
      $('maWidgetProgress').addEventListener('change',event=>{
        const enabled=event.target.checked;
        change(async()=>{const result=await root.AtlasPlatform.setWidgetSharing(enabled);if(result.enabled)await root.AtlasPlatform.publishWidgetSnapshot(root.ModeAtlasNativeEngagement.snapshot());return result;},result=>enabled&&!result.enabled?'Progress sharing is unavailable in this build.':'');
      });
      $('maWidgetHelp').addEventListener('click',()=>root.ModeAtlasFeedback?.alert?.({title:'Add Mode Atlas to your Home Screen',message:'Touch and hold an empty area of your Home Screen. Choose Edit, then Add Widget (or tap +). Search for Mode Atlas, choose a size, and tap Add Widget. The small widget opens Reading; the medium widget offers Reading and Writing.',confirmLabel:'Got it'}));
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
      root.addEventListener('modeAtlasEngagementChanged',refresh);
      refresh();
    },refresh
  };
})(window);
