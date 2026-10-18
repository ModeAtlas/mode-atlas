/* One Kana mastery map for the branch page and shared Progress dialog. */
(function(root){
  'use strict';
  const L=root.ModeAtlasKanaLearning,M=root.ModeAtlasKanaMetrics;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const link=(label,href)=>{const a=el('a','ma-button ma-button--ghost',label);a.href=href;return a;};
  const description=[
    'Ready to meet this character.','You have met its shape and sound.','Building independent answers.',
    'Ready to continue to the next row in a familiar skill.','Reliable Read and Recall, with spaced practice developing.',
    'Read and Recall have both earned mastery.','Read, Recall and independent handwriting have all earned mastery.'
  ];
  function detail(char){
    const state=L.read(),evidence=M.createSnapshot(),info=L.details(char,state,evidence),body=el('div','ma-kana-mastery-detail');
    const head=el('header','ma-kana-mastery-heading');head.append(el('span','ma-kicker','Kana mastery'),el('h3','ma-kana-mastery-glyph',char),el('strong','',L.labels[info.stage]),el('p','',description[info.stage]));body.append(head);
    for(const entry of info.skills){
      const section=el('section','ma-kana-skill-evidence');section.dataset.stage=String(entry.stage);
      const title=el('div','ma-kana-skill-title');title.append(el('h4','',entry.name),el('strong','',L.labels[entry.stage]));section.append(title);
      if(entry.review)section.append(el('p','ma-kana-review-note','Ready to review · your earned milestone is kept.'));
      if(entry.skill==='handwriting'){
        const independent=(state.handwriting[char]||[]).filter(r=>r.independent),days=new Set([...(state.handwritingDays[char]||[]),...independent.map(r=>root.ModeAtlasDates.localDateKey(new Date(r.at)))]);
        section.append(el('p','',`${independent.length} recent independent completions · ${days.size} study days`),el('p','ma-kana-muted','Mastered+ adds five clean completions without a guide across at least three days.'));
      }else{
        const stats=evidence[entry.skill+'Stats'][char]||{},total=(stats.correct||0)+(stats.wrong||0),ms=root.ModeAtlasReview.timeMilliseconds(evidence[entry.skill+'Times'][char]);
        section.append(el('p','',`${stats.correct||0} / ${total} correct · ${total?(stats.correct/total*100).toFixed(2)+'%':'No accuracy yet'} · ${ms?(ms/1000).toFixed(2)+'s':'No timing yet'}`));
        const details=el('details','ma-kana-evidence-checks');details.append(el('summary','','What builds this skill?'));
        details.append(el('p','','Familiar needs at least three correct unassisted answers and 80% accuracy in recent independent practice.'));
        const guide=root.ModeAtlasReview.guidance(evidence[entry.skill+'Review'][char],stats,evidence[entry.skill+'Times'][char]);
        const list=el('ul','ma-mastery-checks');
        for(const check of guide.checks){
          const format=v=>v===null?'Not recorded':check.unit==='ms'?(v/1000).toFixed(3)+'s':check.percent?v.toFixed(2)+'%':String(v);
          list.append(el('li','',`${check.label}: ${format(check.value)} / ${check.maximum?'≤ ':''}${format(check.target)}`));
        }
        if(guide.checks.length)details.append(el('p','',`For ${guide.next==='Reviewing'?'Confident':'Mastered'}:`),list);
        details.append(el('p','','Earned milestones stay with you. Your current recall schedule can still recommend another review.'));section.append(details);
      }
      if(L.available(entry.skill,state,evidence).has(char))section.append(link('Practise '+entry.name,L.practiceUrl(entry.skill,[char])));
      else section.append(link('Open '+entry.name+' path','/kana/?skill='+entry.skill));
      body.append(section);
    }
    return body;
  }
  function render(onOpen){
    const state=L.read(),evidence=M.createSnapshot(),wrap=el('div','ma-kana-mastery-map'),counts=Object.fromEntries(L.labels.map(label=>[label,0]));
    for(const char of M.ALL)counts[L.labels[L.stage(char,state,evidence)]]++;
    wrap.append(el('p','ma-kana-muted','One character, one journey. Tap a kana to see Read, Recall and Handwrite.'));
    const summary=el('div','ma-kana-mastery-legend');
    L.labels.forEach((label,i)=>{const item=el('span','');item.dataset.stage=String(i);item.append(el('b','',counts[label]),document.createTextNode(' '+label));summary.append(item);});wrap.append(summary);
    const help=el('details','ma-kana-mastery-help');help.append(el('summary','','How mastery works'));
    L.labels.forEach((label,i)=>help.append(el('p','',label+': '+description[i])));
    help.append(el('p','','Handwriting is optional. It earns Mastered+ without holding back Read, Recall or their row unlocks. A review reminder never relocks a row.'));wrap.append(help);
    for(const [title,chars]of [['Hiragana',M.HIRA],['Katakana',M.KATA],['Voiced sounds',M.DAK],['Joined sounds',M.YOON],['Extended Katakana',M.EXT]]){
      const section=el('section','ma-mastery-group'),grid=el('div','ma-mastery-grid');section.append(el('h3','',title));
      for(const char of chars){
        const stage=L.stage(char,state,evidence),b=el('button','ma-mastery-cell');b.type='button';b.dataset.stage=String(stage);b.dataset.maMasteryKana=char;
        b.setAttribute('aria-label',`${char} mastery details: ${L.labels[stage]}`);b.append(el('strong','',char),el('span','',L.labels[stage]));b.addEventListener('click',()=>onOpen(char,detail(char)));grid.append(b);
      }section.append(grid);wrap.append(section);
    }return wrap;
  }
  root.ModeAtlasKanaMastery=Object.freeze({render,detail});
})(window);
