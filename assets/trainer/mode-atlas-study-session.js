/* Guided practice presentation. The existing trainer owns answers, scoring,
   persistence and progression; this owner holds only the current study set. */
(function ModeAtlasStudySession(root){
  'use strict';
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  function create(config){
    const snapshot = config.getSnapshot;
    let pendingReview = [];
    const byId = id => document.getElementById(id);
    const study = () => snapshot().sessionStats?.study;
    function sync(){
      const state = snapshot(), count = root.ModeAtlasStudyPlan.practiceCount(state.settings);
      const active = state.sessionStarted && study()?.count;
      const select = byId('studyLength');
      if (select) { select.value = String(count); select.disabled = state.sessionStarted; }
      const setup = byId('studySetSetup');
      if (setup) setup.hidden = !!(state.settings.dailyChallenge || state.settings.testMode || state.settings.timeTrial || state.settings.speedRun || state.settings.endless || state.settings.comboKana);
      const caption = byId('studySetDescription');
      if (caption) caption.textContent = count ? `${count} questions. Mistakes pause so you can learn the answer.` : 'Practise freely, or choose a short guided set.';
      const progress = byId('studySessionProgress');
      if (progress) progress.hidden = !active;
      if (active) {
        const answered = Math.min(study().count, state.sessionStats.answered);
        byId('studyProgressLabel').textContent = `${answered} of ${study().count} answered`;
        byId('studyProgressBar').max = study().count;
        byId('studyProgressBar').value = answered;
      }
      document.body.classList.toggle('ma-guided-practice', !!active);
    }
    function begin(sessionStats){
      const state = snapshot();
      const count = root.ModeAtlasStudyPlan.practiceCount(state.settings);
      const weak = state.settings.focusWeak ? root.ModeAtlasStudyPlan.evidence(state.stats, state.activeChars).weak.map(row => row.kana) : [];
      sessionStats.study = count ? {count, answers:[], focusChars:pendingReview.length ? pendingReview.slice() : weak} : null;
      pendingReview = [];
      clearFeedback();
    }
    function queueReview(chars){
      pendingReview = [...new Set(chars)].filter(kana => root.ModeAtlasKanaCoaching.reading(kana)).slice(0,30);
    }
    function pool(chars){
      const focus = study()?.focusChars;
      return focus?.length ? chars.filter(kana => focus.includes(kana)) : chars;
    }
    function beforeQuestion(){
      sync();
      if (study()?.count && snapshot().sessionStats.answered >= study().count) {
        config.finish();
        return false;
      }
      return true;
    }
    function recordAnswer(answer){
      const current = study();
      if (!current || current.answers.length >= current.count) return;
      current.answers.push({kana:String(answer.kana).slice(0,20), answer:String(answer.answer || '').slice(0,30), correct:!!answer.correct, skipped:!!answer.skipped});
      sync();
    }
    function clearFeedback(){
      const panel = byId('studyFeedback');
      if (panel) { panel.hidden = true; panel.replaceChildren(); }
      document.body.classList.remove('ma-study-feedback-open');
    }
    function showFeedback(onContinue){
      const answer = study()?.answers.at(-1), panel = byId('studyFeedback');
      if (!answer || answer.correct || !panel) return false;
      const heading = el('h2','ma-study-feedback__title',answer.skipped ? 'Take a moment to learn this one' : 'A chance to learn');
      heading.id = 'studyFeedbackTitle';
      const reading = root.ModeAtlasKanaCoaching.reading(answer.kana);
      const correct = config.mode === 'writing' ? answer.kana : reading;
      const attempted = answer.skipped ? 'Skipped' : (answer.answer || '—');
      const correction = el('p','ma-study-feedback__correction');
      correction.append(el('span','',`Your answer: ${attempted}`), el('strong','',`Correct answer: ${correct}`));
      const explanation = root.ModeAtlasKanaCoaching.explain(answer.kana);
      const contrast = el('div','ma-study-contrast');
      contrast.setAttribute('aria-label','Kana and their readings');
      for (const kana of explanation.chars) {
        const item = el('div','ma-study-contrast__item');
        item.classList.toggle('is-target', kana === answer.kana);
        const symbol = el('strong','',kana); symbol.lang = 'ja';
        item.append(symbol,el('span','',root.ModeAtlasKanaCoaching.reading(kana)));
        contrast.appendChild(item);
      }
      const next = el('button','ma-button ma-button--accent','Continue');
      next.type = 'button'; next.id = 'studyFeedbackContinue';
      next.addEventListener('click', () => { if (next.disabled) return; next.disabled = true; onContinue(); }, {once:true});
      panel.replaceChildren(heading, correction, contrast, el('p','ma-study-feedback__note',explanation.note), next);
      panel.hidden = false;
      document.body.classList.add('ma-study-feedback-open');
      root.requestAnimationFrame(() => next.focus({preventScroll:true}));
      return true;
    }
    function showSummary(sessionStats, xpGain){
      const current = sessionStats.study;
      if (!current) return false;
      sync();
      const {unique, mistakes} = root.ModeAtlasStudyPlan.summarise(current.answers);
      const answered = sessionStats.answered, complete = answered >= current.count;
      const content = el('div','ma-study-summary');
      const intro = complete ? 'A little practice, a stronger foundation.' : answered ? 'Your progress counts, even in a shorter set.' : 'Ready whenever you are. No answers were recorded.';
      content.appendChild(el('p','ma-study-summary__intro',intro));
      const grid = el('div','ma-study-summary__stats');
      for (const [label,value] of [['Answered',`${answered} / ${current.count}`],['Correct',sessionStats.correct],['Accuracy',answered ? `${Math.round(sessionStats.correct / answered * 100)}%` : '—']]) {
        const card = el('div',''); card.append(el('strong','',value),el('span','',label)); grid.appendChild(card);
      }
      content.append(grid,el('p','ma-study-summary__meta',`${unique} different kana practised · +${xpGain} XP`));
      if (mistakes.length) {
        content.appendChild(el('h3','','Worth another look'));
        const list = el('div','ma-study-summary__kana');
        for (const row of mistakes) {
          const item = el('span','');
          const kana = el('strong','',row.kana); kana.lang = 'ja';
          item.append(kana,el('span','',root.ModeAtlasKanaCoaching.reading(row.kana))); list.appendChild(item);
        }
        content.append(list,el('p','ma-study-summary__note','Your next set can focus on these kana. Mistakes are part of learning.'));
      } else if (answered) content.appendChild(el('p','ma-study-summary__note','You answered this set without mistakes. Try the other direction when you feel ready.'));
      const actions = el('div','ma-study-summary__actions');
      let reviewing = false;
      const done = el('button','ma-button ma-button--primary','Done'); done.type='button';
      done.addEventListener('click', () => root.ModeAtlasDialog.close()); actions.appendChild(done);
      if (mistakes.length) {
        const review = el('button','ma-button ma-button--ghost','Practise these kana'); review.type='button';
        review.addEventListener('click', () => {
          if (reviewing) return; reviewing = true;
          queueReview(mistakes.map(row => row.kana));
          root.ModeAtlasDialog.close();
        });
        actions.appendChild(review);
      }
      content.appendChild(actions);
      root.ModeAtlasDialog.feature({kicker:config.mode === 'writing' ? 'Writing practice' : 'Reading practice',title:complete ? 'Set complete' : 'Practice saved',contentNode:content}).then(() => {
        if (reviewing) { root.ModeAtlasTrainerControls.setPracticeCount(10); config.start(); }
        else config.naturalBreak();
      });
      return true;
    }
    byId('studyLength')?.addEventListener('change', event => root.ModeAtlasTrainerControls.setPracticeCount(Number(event.target.value)));
    return Object.freeze({sync, begin, pool, beforeQuestion, recordAnswer, showFeedback, clearFeedback, showSummary});
  }
  root.ModeAtlasStudySession = Object.freeze({create});
})(window);
