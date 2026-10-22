'use strict';
// Read-only aggregate of opt-in guest reports. No identifiers or study content
// leave the query. These installation cohorts are not all-user retention.
const names=['lessonStarted','lessonCompleted','practiceCompleted','reviewCompleted','lessonExited','saveFailed','saveRecovered'];
function summarize(reports,at=Date.now()){
 const total={installations:0,branchReports:0,day2:{eligible:0,returned:0},day7:{eligible:0,returned:0},branches:{}};
 for(const report of reports){
  const expiry=report.expiresAt?.toMillis?.()??new Date(report.expiresAt).getTime();if(!Number.isFinite(expiry)||expiry<=at)continue;
  total.installations++;if(report.funnelBranches)total.branchReports++;
  for(const [label,age,event]of [['day2',1,'day2Return'],['day7',6,'day7Return']]){
   // Guest visit days use UTC day boundaries; use the same basis for eligibility.
   if(Math.floor(at/86400000)-(report.funnelStartDay??Math.floor(report.firstSeen/86400000))>=age){total[label].eligible++;if(report.funnel?.[event])total[label].returned++;}
  }
  for(const branch of ['kana','kanji','wordbank','other']){
   total.branches[branch]??=Object.fromEntries(names.map(name=>[name,0]));
   for(const name of names)total.branches[branch][name]+=Math.max(0,Number(report.funnelBranches?.[branch]?.[name])||0);
  }
 }
 return total;
}
module.exports={summarize};
if(require.main===module){
 const load=require('node:module').createRequire(require.resolve('../functions/package.json'));
 load('firebase-admin/app').initializeApp();
 (async()=>{
  const db=load('firebase-admin/firestore').getFirestore(),rows=[];let cursor;
  do{
   let query=db.collection('usageReports').orderBy('__name__').limit(250);if(cursor)query=query.startAfter(cursor);
   const page=await query.get();rows.push(...page.docs.map(row=>row.data()));cursor=page.size===250?page.docs.at(-1):null;
  }while(cursor);
  console.log(JSON.stringify({scope:'Consented guest installations with unexpired reports',...summarize(rows)},null,2));
 })().catch(error=>{console.error(error.message);process.exitCode=1;});
}
