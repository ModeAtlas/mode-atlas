/* Shared practice lifecycle. Page adapters evaluate answers; this coordinator
   sends outcomes to the review/progression owners and presents one session UI. */
(function ModeAtlasStudySession(root){
  'use strict';
  const el = (tag,className,text) => {
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  function create(config){
    const snapshot=config.getSnapshot, byId=id=>document.getElementById(id);
    let pendingReview=[];
    const study=()=>snapshot().sessionStats?.study;
    function sync(){
      const state=snapshot(), count=root.ModeAtlasStudyPlan.practiceCount(state.settings);
      const active=state.sessionStarted, current=study();
      const select=byId('studyLength');
      if(select){select.value=String(count);select.disabled=active;}
      byId('studySetSetup').hidden=!!(state.settings.dailyChallenge||state.settings.testMode||state.settings.timeTrial||state.settings.speedRun||state.settings.endless||state.settings.comboKana);
      byId('studySetDescription').textContent=count?`${count} questions. Mistakes pause so you can learn the answer.`:'No timer. Learn from each mistake and continue when you are ready.';
      const goal=current?.count || (current?.mode==='dailyChallenge'?20:current?.mode==='testMode'?state.testSequence?.length:0);
      const progress=byId('studySessionProgress');
      progress.hidden=!active||!goal;
      if(active&&goal){
        const answered=Math.min(goal,state.sessionStats.answered);
        byId('studyProgressLabel').textContent=`${answered} of ${goal} answered`;
        byId('studyProgressBar').max=goal;byId('studyProgressBar').value=answered;
      }
      document.body.classList.toggle('ma-guided-practice',!!(active&&count));
    }
    function begin(sessionStats){
      const state=snapshot(), mode=root.ModeAtlasPracticeModes.describe(state.settings);
      const weak=state.settings.focusWeak&&!root.ModeAtlasPracticeModes.fixedPool(state.settings)?root.ModeAtlasStudyPlan.evidence(state.stats,state.activeChars).weak.map(row=>row.kana):[];
      sessionStats.study={mode:mode.id,feedback:mode.feedback,count:root.ModeAtlasStudyPlan.practiceCount(state.settings),items:{},lastAnswer:null,
        focusChars:pendingReview.length?pendingReview.slice():weak,dateKey:root.getTodayKey()};
      const current=sessionStats.study;
      current.runId=root.crypto?.randomUUID?.()||`set-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      current.owner=root.ModeAtlasSessionRecovery.accountId();
      current.startLevel=root.ModeAtlasProgress.getSummary().level;
      current.xpParts={};current.milestones=[];current.retryQueue=[];current.assisted=0;current.questionAnswered=false;
      root.ModeAtlasProgress.startRun(current.runId);
      pendingReview=[];clearFeedback();
    }
    function pool(chars){
      const state=snapshot(),current=study();
      const available=state.sessionStarted&&current?.focusChars.length?current.focusChars.slice():chars;
      if(!state.sessionStarted||current?.feedback!=='learn')return available;
      const waiting=new Set(current.retryQueue.filter(item=>item.after>state.sessionStats.answered).map(item=>item.kana));
      const spaced=available.filter(kana=>!waiting.has(kana));
      return spaced.length?spaced:available;
    }
    function beforeQuestion(){
      sync();
      if(study()?.count&&snapshot().sessionStats.answered>=study().count){config.finish();return false;}
      if(study())study().questionAnswered=false;
      root.ModeAtlasFeedback?.question?.(document.getElementById(config.mode==='writing'?'prompt':'hiragana'));
      return true;
    }
    function retryDue(kana){return study()?.retryQueue.some(item=>item.kana===kana&&item.after<=snapshot().sessionStats.answered)||false;}
    function nextPick(pool){
      const current=study();if(!current)return '';
      if(current.resumeKana){const kana=current.resumeKana;current.resumeKana='';return pool.includes(kana)?kana:'';}
      if(current.feedback!=='learn')return '';
      const item=current.retryQueue?.find(item=>item.after<=snapshot().sessionStats.answered&&pool.includes(item.kana));
      if(!item)return '';current.retryQueue=current.retryQueue.filter(row=>row!==item);return item.kana;
    }
    function addXp(result){
      const current=study();for(const [key,value]of Object.entries(result.parts||{}))current.xpParts[key]=(current.xpParts[key]||0)+value;
    }
    function finish(completed){
      const state=snapshot(),current=study();if(!current)return;
      addXp(root.ModeAtlasProgress.finishRun({runId:current.runId,direction:config.mode,day:current.dateKey,mode:current.mode,count:current.count,
        answered:state.sessionStats.answered,correct:state.sessionStats.correct,unique:Object.keys(current.items).length,
        bestStreak:state.sessionStats.bestStreak,assisted:current.assisted,completed}));
    }
    function prepareAnswer(){
      const state=snapshot();
      // Freeze legacy achievements before the answer changes averages/counts.
      // This runs inside the same transaction as scoring and the checkpoint.
      for(const kana of root.ModeAtlasKanaData.splitKana(state.currentChar)){
        if(state.srs[kana]?.reviewVersion!==1)state.srs[kana]=root.ModeAtlasReview.normalize(state.srs[kana],state.stats[kana],state.times[kana]);
      }
    }
    function recordAnswer(answer){
      const current=study();if(!current)return;
      current.lastAnswer={kana:String(answer.kana).slice(0,20),answer:String(answer.answer||'').slice(0,40),correct:!!answer.correct,skipped:!!answer.skipped};
      for(const kana of root.ModeAtlasKanaData.splitKana(answer.kana)){
        const row=current.items[kana]||(current.items[kana]={kana,correct:0,wrong:0});
        row[answer.correct?'correct':'wrong']+=1;
      }
      const state=snapshot(),at=Date.now(),assisted=!!current.hintShown;
      if(assisted)current.assisted+=1;current.hintShown=false;current.questionAnswered=true;
      const reviewed=[],milestones=[];
      for(const kana of root.ModeAtlasKanaData.splitKana(answer.kana)){
        const result=root.ModeAtlasReview.answer(state.srs[kana],{id:`${current.runId}:${state.sessionStats.answered}`,at,correct:answer.correct,assisted},state.stats[kana],state.times[kana]);
        state.srs[kana]=result.entry;
        if(result.reviewed)reviewed.push(kana);
        if(result.milestone>=2)milestones.push({kana,stage:result.milestone});
        if(!answer.correct&&current.feedback==='learn'&&!current.retryQueue.some(item=>item.kana===kana))current.retryQueue.push({kana,after:state.sessionStats.answered+3});
      }
      current.milestones.push(...milestones);
      addXp(root.ModeAtlasProgress.recordAnswer({runId:current.runId,index:state.sessionStats.answered,at,mode:config.mode,correct:answer.correct,
        units:root.ModeAtlasKanaData.splitKana(answer.kana).length,reviewed,milestones}));
      sync();
    }
    function clearFeedback(){
      const panel=byId('studyFeedback');panel.hidden=true;panel.replaceChildren();
      const quick=byId('answerFeedback');quick.textContent='';delete quick.dataset.outcome;
      document.body.classList.remove('ma-study-feedback-open');
    }
    function showFeedback(onContinue){
      const current=study(),answer=current?.lastAnswer;
      if(!answer)return false;
      const reading=root.ModeAtlasKanaData.splitKana(answer.kana).map(kana=>root.ModeAtlasKanaCoaching.reading(kana)).join('');
      const correct=config.mode==='writing'?answer.kana:reading;
      const outcome=answer.correct?'correct':answer.skipped?'skipped':'incorrect';
      const label=answer.correct?'✓ Correct':answer.skipped?'− Skipped':'✕ Incorrect';
      const quick=byId('answerFeedback');
      quick.dataset.outcome=outcome;
      quick.textContent=answer.correct?label:`${label} · Answer: ${correct}`;
      if(answer.correct||current.feedback!=='learn')return false;
      quick.textContent='';
      const panel=byId('studyFeedback');panel.dataset.outcome=outcome;
      const heading=el('h2','ma-study-feedback__title',label);heading.id='studyFeedbackTitle';
      const correction=el('p','ma-study-feedback__correction');correction.id='studyFeedbackCorrection';
      correction.append(el('span','',`Your answer: ${answer.skipped?'Skipped':answer.answer||'—'}`),el('strong','',`Correct answer: ${correct}`));
      const units=root.ModeAtlasKanaData.splitKana(answer.kana);
      const explanation=units.length===1?root.ModeAtlasKanaCoaching.explain(answer.kana):{chars:units,note:'Read each kana in order, then join the sounds together.'};
      const contrast=el('div','ma-study-contrast');contrast.setAttribute('aria-label','Kana and their readings');
      for(const kana of explanation.chars){
        const item=el('div','ma-study-contrast__item');
        const symbol=el('strong','',kana);symbol.lang='ja';
        item.append(symbol,el('span','',root.ModeAtlasKanaCoaching.reading(kana)));contrast.appendChild(item);
      }
      const next=el('button','ma-button ma-button--primary','Continue');next.type='button';next.id='studyFeedbackContinue';next.setAttribute('aria-describedby','studyFeedbackTitle studyFeedbackCorrection');
      next.addEventListener('click',()=>{if(next.disabled)return;next.disabled=true;onContinue();},{once:true});
      panel.replaceChildren(heading,correction,contrast,el('p','ma-study-feedback__note',explanation.note),next);
      panel.hidden=false;document.body.classList.add('ma-study-feedback-open');
      root.requestAnimationFrame(()=>{if(!panel.hidden)next.focus({preventScroll:true});});
      return true;
    }
    function showSummary(sessionStats,xpGain,options={}){
      const current=sessionStats.study;if(!current)return false;
      sync();
      const state=snapshot(),mode=root.ModeAtlasPracticeModes.list.find(mode=>mode.id===current.mode);
      const rows=Object.values(current.items),mistakes=rows.filter(row=>row.wrong).sort((a,b)=>b.wrong-a.wrong);
      const answered=sessionStats.answered,complete=!!options.completed||(!!current.count&&answered>=current.count);
      const goal=current.count||(current.mode==='dailyChallenge'?20:current.mode==='testMode'?state.testSequence.length:0);
      let title=current.count?(complete?'Set complete':'Practice saved'):complete?`${mode.label} complete`:'Practice saved';
      let intro=answered?'Your progress counts, even in a shorter session.':'Ready whenever you are. No answers were recorded.';
      if(complete)intro='A little practice, a stronger foundation.';
      if(current.mode==='dailyChallenge'){
        const record=state.dailyChallengeHistory[current.dateKey];
        intro=complete?`Official score: ${record?.officialScore??0} / ${record?.total??20}. ${record?.attempts>1?'This replay keeps your first completed score.':'Today’s score is saved.'}`:'Finish all 20 questions to record today’s official score. Your individual answers are saved.';
      }else if(current.mode==='testMode')intro=complete?'Your formal result is saved. Review your missed kana or explore the full breakdown in Results.':'Your individual answers are saved. Finish the full test to save a formal result.';
      else if(current.mode==='timeTrial')intro=complete?`${sessionStats.correct>=state.trialTarget?'Target reached':'Keep building your speed'} · ${sessionStats.correct} / ${state.trialTarget} correct.`:'Your practice is saved. Finish the timer to enter the records.';
      else if(current.mode==='speedRun'&&!complete)intro='Your practice is saved. Finish the full minute to enter the records.';
      const content=el('div','ma-study-summary');content.appendChild(el('p','ma-study-summary__intro',intro));
      const grid=el('div','ma-study-summary__stats');
      for(const [label,value]of[['Answered',goal?`${answered} / ${goal}`:answered],['Correct',sessionStats.correct],['Accuracy',answered?`${Math.round(sessionStats.correct/answered*100)}%`:'—']]){
        const card=el('div','');card.append(el('strong','',value),el('span','',label));grid.appendChild(card);
      }
      content.append(grid,el('p','ma-study-summary__meta',`${rows.length} different kana practised`));
      root.ModeAtlasProgressUI.renderSessionReward(content,{...current,xpGain});
      const details=el('details','ma-study-summary__details');details.appendChild(el('summary','','Session details'));
      const times=sessionStats.timings||[];
      const info=[['Best streak',sessionStats.bestStreak],['Average answer',times.length?root.formatDuration(root.average(times)):'—'],['Active time',root.formatDuration((sessionStats.endTime||Date.now())-sessionStats.startTime)]];
      if(current.mode==='speedRun'&&complete)info.unshift(['Speed score',root.ModeAtlasTrainerCore.speedScore(sessionStats)]);
      for(const [label,value]of info){const line=el('p','');line.append(el('span','',label),el('strong','',value));details.append(line);}
      content.append(details);
      if(mistakes.length){
        content.appendChild(el('h3','','Worth another look'));
        const list=el('div','ma-study-summary__kana');
        for(const row of mistakes.slice(0,12)){
          const item=el('span',''),kana=el('strong','',row.kana);kana.lang='ja';item.append(kana,el('span','',root.ModeAtlasKanaCoaching.reading(row.kana)));list.appendChild(item);
        }
        content.append(list,el('p','ma-study-summary__note',mistakes.length>12?`${mistakes.length-12} more kana to revisit. A guided set can draw from all your missed kana.`:'A short guided set can help these kana stick.'));
      }else if(answered)content.appendChild(el('p','ma-study-summary__note','No mistakes this time. Keep going when you are ready.'));
      const actions=el('div','ma-study-summary__actions');let reviewing=false;
      const done=el('button','ma-button ma-button--primary','Done');done.type='button';done.addEventListener('click',()=>root.ModeAtlasDialog.close());actions.appendChild(done);
      if(mistakes.length){
        const review=el('button','ma-button ma-button--ghost','Practise these kana');review.type='button';
        review.addEventListener('click',()=>{if(reviewing)return;reviewing=true;pendingReview=mistakes.map(row=>row.kana);root.ModeAtlasDialog.close();});actions.appendChild(review);
      }
      if(current.mode==='testMode'&&complete){const results=el('a','ma-button ma-button--ghost','View Results');results.href='/results/';actions.appendChild(results);}
      content.append(actions);
      root.ModeAtlasDialog.feature({kicker:`${config.mode==='writing'?'Writing':'Reading'} · ${mode.label}`,title,contentNode:content}).then(()=>{
        if(reviewing){root.ModeAtlasTrainerControls.setPracticeCount(10);config.start();}else config.naturalBreak();
      });
      return true;
    }
    byId('studyLength').addEventListener('change',event=>root.ModeAtlasTrainerControls.setPracticeCount(Number(event.target.value)));
    return Object.freeze({sync,begin,pool,beforeQuestion,nextPick,retryDue,requestDue(){pendingReview=root.ModeAtlasReview.due(snapshot().srs);},prepareAnswer,recordAnswer,finish,showFeedback,clearFeedback,showSummary,hasPendingReview:()=>pendingReview.length>0});
  }
  root.ModeAtlasStudySession=Object.freeze({create});
})(window);
