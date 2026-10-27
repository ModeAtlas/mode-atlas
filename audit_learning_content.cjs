'use strict';
// Structural content gate, not pedagogical approval. No network or generated text.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname;
const kanji=require('./assets/data/mode-atlas-kanji-data.js');
const units=require('./assets/data/mode-atlas-word-lessons.js');
const coverage=require('./content/kanji-example-coverage.json');
const known=new Set(kanji.map(row=>row.char)),isolated=new Set(coverage.withoutContext),errors=[];
const text=value=>typeof value==='string'&&value.trim().length>0;
const check=(ok,message)=>{if(!ok)errors.push(message);};
const report={kind:'Structural and editorial coverage; independent review pending',kanji:[],wordUnits:units.length,wordItems:0,contextTasks:0};
const kanaRoot={};kanaRoot.window=kanaRoot;
const kanaContext=vm.createContext(kanaRoot);
for(const file of ['data/mode-atlas-kana-data','app/mode-atlas-japanese','data/mode-atlas-kana-coaching'])vm.runInContext(fs.readFileSync(path.join(root,'assets',file+'.js'),'utf8'),kanaContext);
const kana=kanaRoot.ModeAtlasKanaData,coaching=kanaRoot.ModeAtlasKanaCoaching;
const kanaKinds={};
for(const char of kana.collections.all){
 const lesson=coaching.teach(char);
 check(lesson&&['sound','shape','stroke'].every(key=>text(lesson[key])),char+': missing authored Kana teaching');
 if(lesson){kanaKinds[lesson.kind]=(kanaKinds[lesson.kind]||0)+1;check(!/Watch the stroke order\. Trace the shape once|Look at the shape and say the reading once/.test(lesson.shape),char+': generic-only teaching');}
}
for(const pattern of coaching.patterns()){
 check(pattern.teaching.length>0&&pattern.tasks.some(task=>task.kind==='listen')&&pattern.tasks.some(task=>task.kind==='apply'),pattern.id+': sound patterns need teaching, audio discrimination and spelling application');
 for(const task of pattern.tasks)check(task.options.filter(option=>option===task.answer).length===1,task.id+': ambiguous pattern answer');
}
const course=require('./assets/data/mode-atlas-kanji-course.js'),foundation=kanji.filter(row=>row.level===5),covered=course.units.flatMap(unit=>[...unit.chars]);
check(new Set(covered).size===covered.length,'Repeated character in foundation units');
check(covered.length===foundation.length&&foundation.every(row=>covered.includes(row.char)),'Foundation units must cover the complete existing N5 catalogue');
for(const unit of course.units)check(text(unit.id)&&text(unit.title)&&text(unit.goal)&&unit.chars.length>0,unit.id+': missing unit objective');
for(const char of covered)check(text(course.senses[char]),char+': missing focused word sense');
report.kana={units:kana.collections.all.length,teachingKinds:kanaKinds,soundPatterns:coaching.patterns().length};
report.kanjiFoundation={units:course.units.length,characters:covered.length,focusedWordSenses:Object.keys(course.senses).length};
for(const level of [5,4,3,2,1]){
 const entries=kanji.filter(row=>row.level===level);
 report.kanji.push({level,entries:entries.length,examples:entries.filter(row=>row.example).length,cues:entries.filter(row=>row.cue).length,acceptedMeaningSets:entries.filter(row=>row.acceptedMeanings?.length).length,confusionGuidance:entries.filter(row=>row.contrasts?.length).length,contexts:entries.filter(row=>row.context).length});
}
for(const row of kanji){
 const example=row.example;
 check(Array.isArray(row.meanings)&&row.meanings.length&&row.meanings.every(text),row.char+': missing meanings');
 if(example){
  check(example.word?.includes(row.char)&&text(example.kana)&&example.readings?.includes(example.kana)&&example.meanings?.every(text)&&example.meanings.length,row.char+': invalid word/reading/meaning contract');
  check(text(example.jmdictId)||Number.isInteger(example.dictionaryId),row.char+': dictionary selection has no source ID');
  check(!isolated.has(row.char),row.char+': stale isolated-reading exception');
 }else check(isolated.has(row.char),row.char+': missing example needs an explicit scoped exception');
 if(row.acceptedMeanings)check(row.acceptedMeanings.length&&row.acceptedMeanings.every(text),row.char+': empty accepted meaning');
 for(const contrast of row.contrasts||[])check(known.has(contrast.char)&&contrast.char!==row.char&&text(contrast.note),row.char+': invalid comparison');
 if(row.context)check(row.context.text?.includes(row.char)&&text(row.context.reading)&&text(row.context.translation)&&text(row.context.source),row.char+': incomplete contextual use');
}
for(const char of isolated)check(known.has(char),'Unknown isolated-reading exception: '+char);
check(new Set(units.map(unit=>unit.id)).size===units.length,'Repeated word lesson ID');
for(const unit of units){
 check(text(unit.title)&&text(unit.outcome)&&text(unit.note),unit.id+': missing teaching context');
 for(const word of unit.words){
  check(['written','reading','english','example','exampleTranslation'].every(key=>text(word[key])),unit.id+': incomplete word');report.wordItems++;
 }
 check(unit.transfer.choices.length>=3&&Number.isInteger(unit.transfer.answer)&&unit.transfer.answer>=0&&unit.transfer.answer<unit.transfer.choices.length&&text(unit.transfer.explanation),unit.id+': invalid recognition task');
 for(const task of [unit.production,...unit.reviewTasks]){
  check(text(task.prompt)&&text(task.hint)&&task.answers?.length&&task.answers.every(text),unit.id+': incomplete productive task');report.contextTasks++;
 }
 check(unit.reviewTasks.length>=2&&new Set([unit.production,...unit.reviewTasks].map(task=>task.prompt)).size===3,unit.id+': delayed tasks need new contexts');
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--report')&&!errors.length)fs.writeFileSync(path.join(root,'content/teaching-coverage.json'),JSON.stringify(report,null,2)+'\n');
