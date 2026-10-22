/* Explicit pronunciation playback, shared by Japanese learning branches. */
(function(root){
  'use strict';
  let generation=0;
  function stop(){generation++;root.AtlasPlatform.stopSpeech().catch(()=>{});}
  function controls(kana,{onPlayback}={}){
    const group=document.createElement('div');group.className='ma-pronunciation';
    for(const [label,slow]of [['Listen',false],['Slower',true]]){
      const button=document.createElement('button');button.type='button';button.className='ma-button ma-button--ghost';button.textContent=label;button.setAttribute('aria-label',`${label}: ${kana}`);
      button.addEventListener('click',async()=>{
        const token=++generation;button.disabled=true;
        try{const result=await root.AtlasPlatform.speakJapanese(kana,slow);if(token===generation&&button.isConnected){onPlayback?.(!!result?.played);if(!result?.played)root.ModeAtlasToast?.show?.('Japanese audio is unavailable. Add a Japanese voice in your device’s speech settings.');}}
        catch(_){if(token===generation&&button.isConnected)root.ModeAtlasToast?.show?.('Pronunciation could not play. Try again.');}
        finally{button.disabled=false;}
      });group.append(button);
    }return group;
  }
  for(const event of ['pagehide','modeAtlasAccountWillChange'])root.addEventListener(event,stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  root.ModeAtlasPronunciation=Object.freeze({controls,stop});
})(window);
