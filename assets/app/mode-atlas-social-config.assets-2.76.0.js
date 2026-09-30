/* Activate after the reviewed Firebase backend and rules are deployed. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.ModeAtlasSocialConfig = factory();
})(typeof window !== 'undefined' ? window : globalThis, function(){
  return Object.freeze({enabled: false, region: 'us-central1'});
});
