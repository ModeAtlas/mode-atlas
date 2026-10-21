/* One Kana mastery map for the branch page and shared Progress dialog. */
(function(root){
  'use strict';
  const L=root.ModeAtlasKanaLearning,M=root.ModeAtlasKanaMetrics,R=root.ModeAtlasReview;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const link=(label,href)=>{const a=el('a','ma-button ma-button--ghost',label);a.href=href;return a;};
  const description=[
    'Meet this character in a lesson, then try Read or Recall.',
    'Try answering without hints to begin building familiarity.',
    `Build ${L.requirements.familiar.correct} correct unassisted answers at ${L.requirements.familiar.accuracy*100}% recent accuracy in Read or Recall.`,
    'Reach Familiar in both Read and Recall, then Confident in either skill.',
    'Reach Mastered in both Read and Recall.',
    'Read and Recall are Mastered. Optional handwriting adds Mastered+.',
    'Read, Recall and independent handwriting have all reached Mastered.'
  ];
  function format(value,check){return value===null?'Not recorded':check.unit==='ms'?(value/1000).toFixed(3)+'s':check.percent?value.toFixed(2)+'%':String(value);}
  function checkView(check){
    const optional=check.optional&&check.value===null,status=optional?'optional':check.met===null?(check.required===false&&['accuracy','time'].includes(check.id)?'reference':'earlier'):check.met?'met':'needed';
    const item=el('div','ma-kana-target');item.dataset.status=status;item.dataset.check=check.id;
    const label=el('dt','',check.label),result=el('dd'),value=el('strong','',format(check.value,check));
    // Do not round an unmet result into a number that looks like a pass.
    if(check.met===false&&format(check.value,check)===format(check.target,check))value.textContent=(check.maximum?'> ':'< ')+format(check.target,check);
    const diagnostic=check.required===false&&['accuracy','time'].includes(check.id);
    const target=el('span','ma-kana-target-goal',diagnostic?'For reference':`Target: ${check.maximum?'≤ ':'≥ '}${format(check.target,check)}${check.optional?' when recorded':''}`);
    const state=el('span','ma-kana-target-state',status==='met'?'✓ Met':status==='needed'?'↑ To build':status==='optional'?'Optional':diagnostic?'Does not block mastery':'Earlier practice');
    result.append(value,target,state);item.append(label,result);return item;
  }
  function detail(char){
    const state=L.read(),evidence=M.createSnapshot(),info=L.details(char,state,evidence),body=el('div','ma-kana-mastery-detail');
    const head=el('header','ma-kana-mastery-heading');head.dataset.stage=String(info.stage);head.append(el('span','ma-kicker','Kana mastery'),el('h3','ma-kana-mastery-glyph',char),el('strong','',L.labels[info.stage]),el('p','',description[info.stage]));body.append(head);
    const choices=el('div','ma-kana-segments ma-kana-mastery-skills');choices.setAttribute('role','group');choices.setAttribute('aria-label','Skill details');body.append(choices);
    const panels=[];
    for(const entry of info.skills){
      const section=el('section','ma-kana-skill-evidence');section.dataset.stage=String(entry.stage);section.hidden=entry.skill!=='reading';section.setAttribute('aria-label',entry.name+' targets');
      const pick=el('button','ma-button ma-button--ghost');pick.type='button';pick.dataset.stage=String(entry.stage);pick.setAttribute('aria-label',entry.name+' · '+L.labels[entry.stage]);pick.setAttribute('aria-pressed',String(!section.hidden));pick.append(el('strong','',entry.name),el('span','',L.labels[entry.stage]));
      pick.addEventListener('click',()=>{for(const [button,panel]of panels){const active=button===pick;button.setAttribute('aria-pressed',String(active));panel.hidden=!active;}});choices.append(pick);panels.push([pick,section]);
      const guide=L.guidance(char,entry.skill,state,evidence),title=el('div','ma-kana-skill-title');title.append(el('h4','',entry.name),el('strong','',L.labels[entry.stage]));section.append(title);
      section.append(el('p','ma-kana-target-heading',entry.stage===5?'Mastered earned · current evidence':'Working toward '+guide.label));
      if(entry.review)section.append(el('p','ma-kana-review-note','Ready to review. Your earned milestone stays with you.'));
      if(entry.skill!=='handwriting'){
        const stats=evidence[entry.skill+'Stats'][char]||{},{c:correct,t:total}=M.statTotals({[char]:stats}),ms=R.timeMilliseconds(evidence[entry.skill+'Times'][char]);
        section.append(el('p','ma-kana-evidence-summary',`${correct} / ${total} correct · ${total?(correct/total*100).toFixed(2)+'% overall':'No accuracy yet'} · ${ms?(ms/1000).toFixed(3)+'s average':'No timing yet'}`));
      }
      const checks=el('dl','ma-kana-targets');for(const check of guide.checks)checks.append(checkView(check));section.append(checks);
      if(entry.skill==='handwriting')section.append(el('p','ma-kana-muted','Write with the guide hidden and no stroke corrections. Mastered+ needs Read and Recall Mastered too.'));
      else{
        section.append(el('p','ma-kana-muted','Correct answers with hints do not count as unassisted. Recent results use your last 24 answers.'));
        if(guide.legacy)section.append(el('p','ma-kana-muted','Earlier practice is checked against accuracy and speed. New answers also build the spaced-review targets.'));
        else if(guide.target>=4){
          let copy='Study days do not need to be consecutive. A correct unassisted answer when this kana is due advances its spaced recall step.';
          if(guide.checks.some(c=>c.id==='spacing'&&!c.met)&&guide.due>Date.now())copy+=' Next step available '+new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(guide.due)+'.';
          section.append(el('p','ma-kana-muted',copy));
        }
      }
      if(L.available(entry.skill,state,evidence).has(char))section.append(link('Practise '+entry.name,L.practiceUrl(entry.skill,[char],{hints:'off'})));
      else section.append(link('Open '+entry.name+' path','/kana/?view=path&skill='+entry.skill));
      body.append(section);
    }
    return body;
  }
  function masteryHelp(){
    const help=el('details','ma-kana-mastery-help');help.append(el('summary','','How mastery works'));
    const familiar=L.requirements.familiar,hand=L.requirements.handwriting[5];
    const recallRule=stage=>{const r=R.requirements[stage];return `${r.correct} correct; ${r.attempts} recent unassisted attempts at ${r.accuracy*100}% accuracy, recall on ${r.days} days and ${r.level} spaced steps. Overall accuracy and speed are shown for reference.`;};
    const explanations=[
      'No lesson or practice recorded yet.',
      'Met in a lesson. Answer in Read or Recall to start practising.',
      'Practice has started. Work toward the Familiar targets below.',
      `Read or Recall: ${familiar.correct} correct unassisted answers at ${familiar.accuracy*100}% accuracy in recent practice. Every character in a row must be Familiar in that skill to open its next row.`,
      'Both Read and Recall are at least Familiar; one also meets: '+recallRule(2),
      'Both Read and Recall meet: '+recallRule(3),
      `Mastered, plus ${hand.correct} clean writes without a guide across ${hand.days} days. Handwriting is optional and has its own row progression.`
    ];
    const list=el('dl','ma-kana-stage-guide');L.labels.forEach((label,i)=>list.append(el('dt','',label),el('dd','',explanations[i])));help.append(list);
    help.append(el('p','','Recent means the last 24 answers; correct answers with hints are excluded. Spaced steps advance on correct unassisted answers when a review is due, not by repeating quickly. Earned milestones and unlocked rows stay earned. Earlier practice without review history uses accuracy and speed until new answers add that history.'));return help;
  }
  function render(onOpen){
    const state=L.read(),evidence=M.createSnapshot(),wrap=el('div','ma-kana-mastery-map'),counts=Object.fromEntries(L.labels.map(label=>[label,0]));
    for(const char of M.ALL)counts[L.labels[L.stage(char,state,evidence)]]++;
    wrap.append(el('p','ma-kana-muted','Two marks: Read, then Recall. Tap a kana for its targets and next practice.'));
    const summary=el('div','ma-kana-mastery-legend');
    L.labels.forEach((label,i)=>{const item=el('span','');item.dataset.stage=String(i);item.append(el('b','',counts[label]),document.createTextNode(' '+label));summary.append(item);});wrap.append(summary,masteryHelp());
    for(const [title,chars]of [['Hiragana',M.HIRA],['Katakana',M.KATA],['Voiced sounds',M.DAK],['Joined sounds',M.YOON],['Extended Katakana',M.EXT]]){
      const section=el('section','ma-mastery-group'),grid=el('div','ma-mastery-grid');section.append(el('h3','',title));
      for(const char of chars){
        const stage=L.stage(char,state,evidence),b=el('button','ma-mastery-cell');b.type='button';b.dataset.stage=String(stage);b.dataset.maMasteryKana=char;
        b.setAttribute('aria-label',`${char} mastery details: ${L.labels[stage]}`);b.append(el('strong','',char),el('span','',L.labels[stage]));
        const skills=el('span','ma-mastery-skill-marks');skills.setAttribute('aria-hidden','true');
        for(const skill of ['reading','writing']){const earned=L.earned(char,skill,state,evidence),mark=el('i');mark.dataset.stage=String(earned);mark.title=L.names[skill]+': '+L.labels[earned];skills.append(mark);}b.append(skills);
        b.addEventListener('click',()=>onOpen(char,detail(char)));grid.append(b);
      }section.append(grid);wrap.append(section);
    }return wrap;
  }
  root.ModeAtlasKanaMastery=Object.freeze({render,detail});
})(window);
