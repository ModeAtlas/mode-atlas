/* Consumer learning backups and account reset, with preview and account checks. */
(function ModeAtlasDataControls(){
  'use strict';
  if (window.__modeAtlasDataControlsLoaded) return;
  window.__modeAtlasDataControlsLoaded = true;
  let resetting = false;
  let fileBusy=false;
  const account=()=>window.KanaCloudSync?.getUser?.()?.uid||null;
  async function backupAction(task){
    if(fileBusy)return;fileBusy=true;const owner=account();
    const check=()=>{if(owner!==account())throw Error('The account changed. Start the file action again.');};
    try{await task(check);}catch(error){window.ModeAtlasFeedback?.toast?.(error.message||'The backup action could not finish.','error',5000);}finally{fileBusy=false;}
  }
  function exportLearning(){return backupAction(async check=>{
    const backup=window.KanaCloudSync.createLearningBackup();check();
    const result=await window.AtlasPlatform.exportBackup({contents:JSON.stringify(backup,null,2),filename:'mode-atlas-learning-'+new Date().toISOString().slice(0,10)+'.json'});check();
    if(result.completed){window.ModeAtlasStorage.set('modeAtlasLastBackupAt',String(Date.now()));window.ModeAtlasToast?.show?.('Learning backup exported.');}
    else if(result.supported===false)throw Error('Export is unavailable on this device.');
  });}
  function restoreLearning(file){return backupAction(async check=>{
    if(file.size>window.ModeAtlasSaveLimits.MAX_BYTES)throw Error('This file exceeds the 16 MB backup limit.');
    const parsed=window.ModeAtlasSaveLimits.parse(await file.text());check();
    const preview=window.KanaCloudSync.previewLearningBackup(parsed),content=document.createElement('div');
    const exported=document.createElement('p');exported.textContent='Exported '+new Date(preview.exportedAt).toLocaleString();content.append(exported);
    const list=document.createElement('ul');for(const section of preview.sections.filter(row=>row.willImport)){const item=document.createElement('li');item.textContent=`${section.label}: ${section.incoming} — replaces ${section.current}`;list.append(item);}content.append(list);
    if(!preview.summary.willImport)throw Error('This backup has no learning data to restore.');
    const confirmed=await window.ModeAtlasFeedback.confirm({title:'Review learning backup',message:'This replaces the listed learning data on this device and syncs it to your current account when available. Coins, purchases, sign-in and rankings stay with your account. Export your current learning first if you want to keep both copies.',contentNode:content,confirmLabel:'Restore learning',cancelLabel:'Cancel',tone:'warning'});
    if(!confirmed)return;check();await window.KanaCloudSync.importLearningBackup(parsed);check();window.ModeAtlasToast?.show?.('Learning restored.');
  });}

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
    if(event.target.closest('[data-ma-export-learning]')){event.preventDefault();void exportLearning();return;}
    if(event.target.closest('[data-ma-restore-learning]')){event.preventDefault();const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',()=>{if(input.files[0])void restoreLearning(input.files[0]);},{once:true});input.click();return;}
    if (!event.target.closest('[data-ma-unified-reset]')) return;
    event.preventDefault();
    void resetData();
  });
})();
