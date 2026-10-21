'use strict';
// Policy is packaged verbatim from the shared app sources by build_social_backend.py.
const dates = require('./shared/mode-atlas-date.js');
const createProgress = require('./shared/mode-atlas-progress.js');
const createReview = require('./shared/mode-atlas-review.js');
const rewards = require('./shared/mode-atlas-reward-rules.js');
const kana = require('./shared/mode-atlas-kana-data.js');
const progress = createProgress({ModeAtlasDates: dates, ModeAtlasRewardRules: rewards});
const review = createReview({ModeAtlasDates: dates});
const identity = require('./shared/mode-atlas-social-identity.js');
const characters = require('./shared/mode-atlas-avatar-rules.js');
const learning=require('./shared/mode-atlas-kana-learning.js')({ModeAtlasKanaData:kana,ModeAtlasReview:review,ModeAtlasDates:dates});
const PROJECTION_VERSION=7;
const createMetrics=require('./shared/mode-atlas-kana-metrics.js');
const createAchievements=require('./shared/mode-atlas-achievements.js');
const createKanji=require('./shared/mode-atlas-kanji-state.js');
const curriculum=require('./shared/mode-atlas-kanji-curriculum.js');
const {gunzipSync}=require('node:zlib');

function accountInsights(save,owner,seeded,syncedAt){
  const sections=save.sections||{},data=name=>sections[name]?.data||{};
  let kanjiState=data('kanji').state||{},kanjiAvailable=true;
  if(kanjiState.evidence){
    try{
      const evidence=kanjiState.evidence;
      if(evidence.encoding!=='gzip-base64-v1'||typeof evidence.data!=='string'||evidence.data.length>1500000)throw Error('Invalid Kanji evidence');
      kanjiState={...kanjiState,sources:JSON.parse(gunzipSync(Buffer.from(evidence.data,'base64'),{maxOutputLength:16*1024*1024}).toString('utf8'))};
    }catch{kanjiState={};kanjiAvailable=false;}
  }
  const direct={modeAtlasProgress:seeded,modeAtlasKanaLearning:data('kanaLearning').state||{},modeAtlasKanji:kanjiState,modeAtlasKanjiTests:data('kanjiTests').items||[],kanaWordBank:data('wordBank').items||[],
    testModeResults:data('readingTests').primary||[],kanaTrainerTestModeResults:data('readingTests').backup||[],readingTestModeResults:data('readingTests').altPrimary||[],kanaTrainerReadingTestModeResults:data('readingTests').altBackup||[],writingTestModeResults:data('writingTests').primary||[],kanaTrainerWritingTestModeResults:data('writingTests').backup||[]};
  const storage={json:(key,fallback)=>direct[key]??fallback,get:(key,fallback)=>key==='modeAtlasLastCloudSyncAt'&&syncedAt?String(syncedAt):fallback,
    readModeJSON:(mode,key,fallback)=>data(mode)[{charStats:'stats',charTimes:'times',srs:'srs',dailyHistory:'dailyChallengeHistory'}[key]]||fallback};
  const root={ModeAtlasStorage:storage,ModeAtlasProgress:{...owner,readState:()=>seeded,readSnapshot:()=>seeded,getSummary:()=>owner.getSummary(seeded),achievementStats:()=>owner.achievementStats(seeded)},ModeAtlasDates:dates,ModeAtlasKanaData:kana,ModeAtlasReview:review,ModeAtlasKanjiCurriculum:curriculum};
  root.ModeAtlasKanaLearning=require('./shared/mode-atlas-kana-learning.js')(root);
  root.ModeAtlasKanjiState=createKanji(root);root.ModeAtlasKanaMetrics=createMetrics(root);
  const achievements=createAchievements(root),insights=achievements.profile();
  if(!kanjiAvailable){insights.kanji=null;insights.achievements=null;}
  return insights;
}

function progressOwner(save = {}, timeZone = 'UTC') {
  const sections = save.sections || {};
  const data = name => sections[name]?.data || {};
  const state = data('progress').state || {};
  const storage = {
    json: () => state,
    readModeJSON(mode, kind, fallback) {
      const key = {charStats:'stats',dailyHistory:'dailyChallengeHistory'}[kind];
      if (key) return data(mode)[key] || fallback;
      if (kind === 'testResults') return data(mode + 'Tests').primary || fallback;
      return fallback;
    }
  };
  return createProgress({ModeAtlasStorage:storage,ModeAtlasRewardRules:rewards,
    ModeAtlasDates:{...dates,localDateKey:value=>dates.dateKeyInTimeZone(value,timeZone)}});
}
function studyDaysFromSave(save,timeZone='UTC'){const owner=progressOwner(save,timeZone);return owner.studyDays(owner.ensureSeeded({sync:false,emit:false}));}
function levelFromSave(save){const owner=progressOwner(save);return owner.getSummary(owner.ensureSeeded({sync:false,emit:false})).level;}
function earningEvidence(save,timeZone='UTC'){
  const owner=progressOwner(save,timeZone),state=owner.ensureSeeded({sync:false,emit:false});
  const correct=owner.getSummary(state).lifetimeCorrect;
  const weighted=Object.values(state.credits).reduce((total,row)=>total+row.answer,correct);
  // Answer credits already contain the shared pool/hint multiplier. Session,
  // goal and developer XP are never counted as correct-answer earnings.
  return {level:owner.getSummary(state).level,answerUnits:Math.min(correct*8,weighted),days:owner.studyDays(state)};
}
function projectSave(save = {}, timeZone = 'UTC', syncedAt = 0, access = {}) {
  const sections=save.sections||{},data=name=>sections[name]?.data||{};
  const owner=progressOwner(save,timeZone);
  const seeded = owner.ensureSeeded({sync:false,emit:false});
  const summary = owner.getSummary(seeded);
  const selected = rewards.appearance(seeded.appearance.landmark,summary.level,access);
  const course=learning.normalize(data('kanaLearning').state),evidence={};
  for(const skill of ['reading','writing'])Object.assign(evidence,{[skill+'Stats']:data(skill).stats||{},[skill+'Review']:data(skill).srs||{},[skill+'Times']:data(skill).times||{}});
  let readingMastered=0,writingMastered=0,combinedMastered=0;
  for(const char of kana.collections.all){
    if(learning.earned(char,'reading',course,evidence)===5)readingMastered++;
    if(learning.earned(char,'writing',course,evidence)===5)writingMastered++;
    if(learning.stage(char,course,evidence)>=5)combinedMastered++;
  }
  return {version:progress.STATE_VERSION,projectionVersion:PROJECTION_VERSION,xp:summary.xp,level:summary.level,totalCorrect:summary.lifetimeCorrect,
    readingMastered,writingMastered,combinedMastered,kanaCount:kana.collections.all.length,insights:accountInsights(save,owner,seeded,syncedAt),
    theme:rewards.allowed('themes',seeded.appearance.theme,summary.level,access)?seeded.appearance.theme:'',landmark:selected.id,banner:rewards.banner(seeded.appearance.banner,summary.level,access).id,studyDays:owner.studyDays(seeded),syncedAt};
}

function publicProfile(uid, account, now = Date.now(), full = true) {
  if(!account?.active || account.deleting || account.restricted || !account.profile)return null;
  const saved=account.summary || projectSave();
  // A cached profile must not keep a legacy level until its owner studies again.
  const summary={...saved,level:progress.getLevelFromXP(saved.xp).level};
  const landmark=rewards.appearance(summary.landmark,summary.level,account.rewardAccess);
  const out={uid,theme:rewards.allowed('themes',summary.theme,summary.level,account.rewardAccess)?summary.theme:'',displayName:account.profile.displayName,avatar:account.profile.avatar,
    frame:landmark.frame,title:landmark.title,banner:rewards.banner(summary.banner,summary.level,account.rewardAccess).id,level:summary.level};
  if(out.avatar==='account'){
    const url=identity.photoURL(account.profile.avatarURL);if(url)out.avatarURL=url;else out.avatar='kana';
  }
  if(out.avatar==='character')out.character=characters.visible(account.profile.character,summary.level,account.rewardAccess);
  if(full&&identity.validGreeting(account.profile.greeting)&&account.profile.greeting)out.greeting=account.profile.greeting;
  if(full)out.stats={xp:summary.xp,totalCorrect:summary.totalCorrect,
    streak:progress.studyStreak(summary.studyDays,dates.dateKeyInTimeZone(now,account.profile.timeZone)),
    readingMastered:summary.readingMastered,writingMastered:summary.writingMastered,
    combinedMastered:summary.combinedMastered,kanaCount:summary.kanaCount,syncedAt:summary.syncedAt,...(summary.insights?{insights:summary.insights}:{})};
  return out;
}

function rankProfiles(profiles,metric) {
  const fields={xp:'xp',streak:'streak',reading:'readingMastered',writing:'writingMastered',mastery:'combinedMastered',correct:'totalCorrect'};
  const field=fields[metric];
  if(!field)throw new Error('Unknown ranking');
  const rows=profiles.map(profile=>({...profile,score:profile.stats[field]}))
    .sort((a,b)=>b.score-a.score || a.uid.localeCompare(b.uid,'en'));
  let rank=0,previous;
  return rows.map((row,index)=>{if(row.score!==previous)rank=index+1;previous=row.score;return {...row,rank};});
}
module.exports={projectSave,publicProfile,rankProfiles,PROJECTION_VERSION,levelFromSave,earningEvidence,studyDaysFromSave,studyStreak:progress.studyStreak,protectStreak:progress.protectStreak};
