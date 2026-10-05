/* Canonical cue scores and envelopes, shared by Web Audio and the iOS WAV build. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ModeAtlasSoundCues=factory();
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  // Frequency, seconds, waveform, level, onset and optional destination frequency.
  const cues=Object.freeze({
    tap:[[620,.055,'sine',.10,0,440]],
    correct:[[660,.085,'sine',.13,0],[880,.115,'sine',.10,.045]],
    wrong:[[220,.14,'sine',.10,0,175]],
    finish:[[523,.10,'sine',.11,0],[659,.11,'sine',.11,.08],[784,.16,'sine',.10,.17]],
    achievement:[[523,.09,'sine',.11,0],[659,.10,'sine',.11,.07],[784,.11,'sine',.10,.15],[1046,.17,'sine',.08,.24]],
    success:[[600,.08,'sine',.09,0],[750,.10,'sine',.07,.055]],
    warning:[[330,.10,'sine',.09,0],[330,.10,'sine',.07,.11]],
    error:[[260,.12,'sine',.09,0,195]]
  });
  function envelope(time,duration){
    if(time<=0||time>=duration)return 0;
    const attack=Math.sin(Math.min(1,time/.008)*Math.PI/2)**2;
    const release=Math.sin(Math.min(1,(duration-time)/.012)*Math.PI/2)**2;
    return attack*release*Math.exp(-3*time/duration);
  }
  return Object.freeze({cues,envelope});
});
