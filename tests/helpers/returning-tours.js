/* Presentation baseline for regression journeys unrelated to first-use tours.
   First-use offers have their own browser case; no course access is granted. */
module.exports=async function returningTours(page){
  await page.addInitScript(()=>localStorage.setItem('modeAtlasBranchToursSeen',JSON.stringify({kana:true,kanji:true,words:true})));
};
