/* Shared study recommendations and bounded-practice policy. No storage writes,
   timers, scoring or platform-specific behaviour belong in this owner. */
(function ModeAtlasStudyPlan(root){
  'use strict';
  const lengths = Object.freeze([10, 20, 30]);
  const number = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
  function practiceCount(settings = {}){
    if (settings.dailyChallenge || settings.testMode || settings.timeTrial || settings.speedRun || settings.endless || settings.comboKana) return 0;
    return lengths.includes(Number(settings.practiceCount)) ? Number(settings.practiceCount) : 0;
  }
  function availableChars(settings = {}){
    return Object.keys(root.ModeAtlasKanaData.selectedKanaMap(settings));
  }

  function evidence(stats = {}, chars = []){
    const rows = chars.map(kana => {
      const correct = number(stats?.[kana]?.correct), wrong = number(stats?.[kana]?.wrong);
      return {kana, correct, wrong, attempts: correct + wrong};
    });
    return {answered: rows.reduce((n, row) => n + row.attempts, 0), weak: rows.filter(row => row.attempts >= 4 && row.wrong >= 2 && row.correct / row.attempts < .8)};
  }
  function recommend(input = {}){
    const reading = evidence(input.readingStats, availableChars(input.readingSettings));
    const writing = evidence(input.writingStats, availableChars(input.writingSettings));
    let mode = input.lastMode === 'writing' ? 'writing' : 'reading';
    let focus = false, title = mode === 'writing' ? 'Build your recall' : 'Build your reading';
    let reason = mode === 'writing' ? 'Match each sound to its kana.' : 'A short set with your current kana selection.';
    if (!reading.answered && !writing.answered) {
      mode = 'reading'; title = 'Start small'; reason = 'Start small. There is time to learn each answer.';
    } else if (reading.weak.length || writing.weak.length) {
      mode = writing.weak.length > reading.weak.length ? 'writing' : 'reading';
      const count = (mode === 'writing' ? writing : reading).weak.length;
      focus = true; title = mode === 'writing' ? 'Recall tricky kana' : 'Read tricky kana';
      reason = `${count} ${count === 1 ? 'kana has' : 'kana have'} been tricky in your selected set. Give them another look.`;
    } else if (reading.answered >= 20 && writing.answered < reading.answered / 4) {
      mode = 'writing'; title = 'Try writing'; reason = 'You have been reading kana. Try matching sounds back to characters.';
    }
    const params = new URLSearchParams({practice: '10'});
    if (!input.readingSettings && mode === 'reading' && !reading.answered) params.set('starter', 'starter');
    if (focus) params.set('focusWeak', '1');
    return Object.freeze({mode, title, reason, focus, count: 10, meta: '10 questions · At your pace', href: `/${mode}/?${params}`});
  }
  function summarise(answers = []){
    const rows = new Map();
    for (const answer of answers) {
      const row = rows.get(answer.kana) || {kana: answer.kana, correct: 0, wrong: 0};
      row[answer.correct ? 'correct' : 'wrong'] += 1;
      rows.set(answer.kana, row);
    }
    return {unique: rows.size, mistakes: [...rows.values()].filter(row => row.wrong > 0).sort((a,b) => b.wrong - a.wrong)};
  }
  root.ModeAtlasStudyPlan = Object.freeze({lengths, practiceCount, availableChars, evidence, recommend, summarise});
})(window);
