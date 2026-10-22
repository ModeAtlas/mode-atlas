/* Pure save schema shared by live snapshots, legacy import and restore.
   No storage, account, network or UI side effects belong here. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.ModeAtlasSaveSections=factory(root.ModeAtlasStorage?.KEYS||{});
})(typeof window==='undefined'?globalThis:window,function(keys){
  'use strict';
  keys=keys||{};
  const keyOr=(name,fallback)=>keys[name]||fallback;
const SECTION_DEFS = {
  reading: {
    updatedAtKey: 'cloudReadingUpdatedAt',
    scalar: { highScore: keyOr('readingHighScore', 'highScore') },
    json: {
      settings: keyOr('readingSettings', 'settings'),
      stats: keyOr('readingCharStats', 'charStats'),
      evidence:'modeAtlasKanaEvidence:reading',
      times: keyOr('readingCharTimes', 'charTimes'),
      srs: keyOr('readingSrs', 'charSrs'),
      scoreHistory: keyOr('readingScoreHistory', 'scoreHistory'),
      dailyChallengeHistory: keyOr('readingDailyHistory', 'dailyChallengeHistory')
    }
  },
  writing: {
    updatedAtKey: 'cloudWritingUpdatedAt',
    scalar: { highScore: keyOr('writingHighScore', 'reverseHighScore') },
    json: {
      settings: keyOr('writingSettings', 'reverseSettings'),
      stats: keyOr('writingCharStats', 'reverseCharStats'),
      evidence:'modeAtlasKanaEvidence:writing',
      times: keyOr('writingCharTimes', 'reverseCharTimes'),
      srs: keyOr('writingSrs', 'reverseCharSrs'),
      scoreHistory: keyOr('writingScoreHistory', 'reverseScoreHistory'),
      dailyChallengeHistory: keyOr('writingDailyHistory', 'reverseDailyChallengeHistory')
    }
  },
  readingTests: {updatedAtKey:'testModeResultsUpdatedAt',scalar:{},json:{primary:'testModeResults',deleted:'modeAtlasResultsDeleted:reading'}},
  writingTests: {updatedAtKey:'writingTestModeResultsUpdatedAt',scalar:{},json:{primary:'writingTestModeResults',deleted:'modeAtlasResultsDeleted:writing'}},
  wordBank: {
    updatedAtKey: 'kanaWordBankUpdatedAt',
    scalar: {},
    json: {
      items: keyOr('wordBank', 'kanaWordBank'),
      lessons:'modeAtlasWordLessons',
      deleted:'modeAtlasWordBankDeleted'
    }
  },
  kanaLearning: {updatedAtKey:'modeAtlasKanaLearningUpdatedAt',scalar:{},json:{state:'modeAtlasKanaLearning'}},
  kanji: {updatedAtKey:'modeAtlasKanjiUpdatedAt',scalar:{},json:{state:'modeAtlasKanji'}},
  kanjiTests: {updatedAtKey:'modeAtlasKanjiTestsUpdatedAt',scalar:{},json:{items:'modeAtlasKanjiTests',deleted:'modeAtlasResultsDeleted:kanji'}},
  progress: {
    updatedAtKey: keyOr('progressUpdatedAt', 'modeAtlasProgressUpdatedAt'),
    scalar: {},
    json: {
      state: keyOr('progress', 'modeAtlasProgress')
    }
  }
};

const SECTION_TIMESTAMP_KEYS = {
  reading: 'settingsUpdatedAt',
  writing: 'settingsUpdatedAt',
  readingTests: 'resultsUpdatedAt',
  writingTests: 'resultsUpdatedAt',
  wordBank: 'profileUpdatedAt',
  kanaLearning: 'modeAtlasKanaLearningUpdatedAt',
  kanji: 'modeAtlasKanjiUpdatedAt', kanjiTests: 'modeAtlasKanjiTestsUpdatedAt',
  progress: keyOr('progressUpdatedAt', 'modeAtlasProgressUpdatedAt')
};
const SECTION_EXTRA_TIMESTAMP_KEYS = {
  reading: ['srsUpdatedAt', 'dailyUpdatedAt'],
  writing: ['srsUpdatedAt', 'dailyUpdatedAt'],
  readingTests: [],
  writingTests: [],
  wordBank: [],
  kanaLearning: [], kanji: [], kanjiTests: [],
  progress: []
};

  const arrays=new Set(['readingTests:primary','writingTests:primary','wordBank:items','kanjiTests:items']);
  function empty(section,field){return arrays.has(section+':'+field)?[]:{};}
  function project(section,reader){
    const def=SECTION_DEFS[section];
    if(!def)throw new Error('Unknown save section: '+section);
    return Object.fromEntries([
      ...Object.entries(def.scalar).map(([field,key])=>[field,reader.scalar(key,'0')]),
      ...Object.entries(def.json).map(([field,key])=>[field,reader.json(key,empty(section,field))])
    ]);
  }
  for(const def of Object.values(SECTION_DEFS)){Object.freeze(def.scalar);Object.freeze(def.json);Object.freeze(def);}
  for(const value of Object.values(SECTION_EXTRA_TIMESTAMP_KEYS))Object.freeze(value);
  return Object.freeze({definitions:Object.freeze(SECTION_DEFS),timestamps:Object.freeze(SECTION_TIMESTAMP_KEYS),extraTimestamps:Object.freeze(SECTION_EXTRA_TIMESTAMP_KEYS),empty,project});
});
