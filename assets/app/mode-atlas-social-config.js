/* Activate after the reviewed Firebase backend and rules are deployed. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.ModeAtlasSocialConfig = factory();
})(typeof window !== 'undefined' ? window : globalThis, function(){
  // Sydney supports the callable/Firestore functions and the v1 Auth trigger.
  // The existing default Firestore database is in Melbourne.
  return Object.freeze({enabled: false, region: 'australia-southeast1'});
});
