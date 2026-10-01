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

function projectSave(save = {}, timeZone = 'UTC', syncedAt = 0) {
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
  const owner = createProgress({ModeAtlasStorage:storage,ModeAtlasRewardRules:rewards,
    ModeAtlasDates:{...dates,localDateKey:value=>dates.dateKeyInTimeZone(value,timeZone)}});
  const seeded = owner.ensureSeeded({sync:false,emit:false});
  const summary = owner.getSummary(seeded);
  const selected = rewards.appearance(seeded.appearance.landmark,summary.level);
  let readingMastered=0,writingMastered=0,combinedMastered=0;
  for (const char of kana.collections.all) {
    const reading={review:data('reading').srs?.[char],stats:data('reading').stats?.[char],time:data('reading').times?.[char]};
    const writing={review:data('writing').srs?.[char],stats:data('writing').stats?.[char],time:data('writing').times?.[char]};
    if(review.stage(reading.review,reading.stats,reading.time)===3)readingMastered++;
    if(review.stage(writing.review,writing.stats,writing.time)===3)writingMastered++;
    if(review.combinedStage(reading,writing)===3)combinedMastered++;
  }
  return {xp:summary.xp,level:summary.level,totalCorrect:summary.lifetimeCorrect,
    readingMastered,writingMastered,combinedMastered,kanaCount:kana.collections.all.length,
    landmark:selected.id,banner:rewards.banner(seeded.appearance.banner,summary.level).id,studyDays:owner.studyDays(seeded),syncedAt};
}

function publicProfile(uid, account, now = Date.now(), full = true) {
  if(!account?.active || account.deleting || account.restricted || !account.profile)return null;
  const summary=account.summary || projectSave();
  const landmark=rewards.appearance(summary.landmark,summary.level);
  const out={uid,displayName:account.profile.displayName,avatar:account.profile.avatar,
    frame:landmark.frame,title:landmark.title,banner:rewards.banner(summary.banner,summary.level).id,level:summary.level};
  if(out.avatar==='account'){
    const url=identity.photoURL(account.profile.avatarURL);if(url)out.avatarURL=url;else out.avatar='kana';
  }
  if(full)out.stats={xp:summary.xp,totalCorrect:summary.totalCorrect,
    streak:progress.studyStreak(summary.studyDays,dates.dateKeyInTimeZone(now,account.profile.timeZone)),
    readingMastered:summary.readingMastered,writingMastered:summary.writingMastered,
    combinedMastered:summary.combinedMastered,kanaCount:summary.kanaCount,syncedAt:summary.syncedAt};
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
module.exports={projectSave,publicProfile,rankProfiles};
