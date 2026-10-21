/* Existing-account fixture for regression cases unrelated to course unlocking.
   Fresh-entry and curriculum tests deliberately do not use this fixture. */
const data=require('../../assets/data/mode-atlas-kana-data.js');
const rows=['hiragana','katakana'].flatMap(script=>[['base',data[script+'Rows']],['dakuten',data.dakutenRows],['yoon',data.yoonRows],['extended',script==='katakana'?data.extendedKatakanaRows:{}]].flatMap(([kind,groups])=>Object.keys(groups).filter(key=>key.startsWith(script==='hiragana'?'h_':'k_')).map(key=>script+':'+kind+':'+key.slice(2))));
module.exports=async function existingKana(page){
  await page.addInitScript(rows=>{
    localStorage.setItem('modeAtlasBranchToursSeen',JSON.stringify({kana:true,kanji:true,words:true}));
    if(localStorage.getItem('modeAtlasKanaLearning'))return;
    const placed=Object.fromEntries(rows.map(row=>[row,1]));
    localStorage.setItem('modeAtlasKanaLearning',JSON.stringify({version:1,startedAt:1,startKind:'existing',placed:{reading:placed,writing:placed,handwriting:placed}}));
  },rows);
};
