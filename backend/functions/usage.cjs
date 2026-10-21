'use strict';
// Voluntary guest snapshots. No Auth identity, IP, typed answers or word-bank
// content is stored. App Check is mandatory, including in direct service calls.
const {createHash}=require('node:crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const kana=new Set(require('./shared/mode-atlas-kana-data.js').collections.all);
const fail=(code,message)=>{throw new HttpsError(code,message);};
function createUsage({db,now=Date.now}){
  async function call(request){
    if(!request.app)fail('unauthenticated','App verification is required.');
    const data=request.data;
    if(!data||Object.keys(data).some(key=>!['action','id','snapshot'].includes(key))||!['report','delete'].includes(data.action)||typeof data.id!=='string'||!/^[a-f0-9]{64}$/.test(data.id))fail('invalid-argument','Invalid usage report.');
    const id=createHash('sha256').update(data.id).digest('hex'),at=now(),ref=db.doc('usageReports/'+id),removed=db.doc('usageOptOuts/'+id),budget=db.doc('usageLimits/global');
    if(data.action==='delete'){
      if(data.snapshot!==undefined)fail('invalid-argument','Invalid usage request.');
      await db.runTransaction(async tx=>{
        const [old,report,limit]=await tx.getAll(removed,ref,budget);if(old.exists)return;
        if(!report.exists){
          const day=Math.floor(at/86400000),data=limit.data()||{},count=data.day===day?data.created||0:0;
          if(count>=100)fail('resource-exhausted','Removal is pending. Please retry later.');
          tx.set(budget,{...data,...(data.day===day?{}:{day,reports:0}),created:count+1});
        }
        tx.delete(ref);tx.set(removed,{expiresAt:new Date(at+35*86400000)});
      });return {deleted:true};
    }
    if(request.auth)fail('failed-precondition','Guest reports cannot contain signed-in learning.');
    const s=data.snapshot,allowed=['platform','version','level','xp','kana','introduced','correct','attempts','branch'];
    if(!s||Object.keys(s).length!==allowed.length||Object.keys(s).some(key=>!allowed.includes(key))||!['web','ios'].includes(s.platform)||!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s.version)||!['atlas','kana','kanji','wordbank','progress','friends','shop','other'].includes(s.branch))fail('invalid-argument','Invalid usage summary.');
    for(const key of ['level','xp','correct','attempts'])if(!Number.isSafeInteger(s[key])||s[key]<0||s[key]>(key==='level'?999:1000000000))fail('invalid-argument','Invalid usage totals.');
    for(const key of ['kana','introduced'])if(!Array.isArray(s[key])||s[key].length>kana.size||new Set(s[key]).size!==s[key].length||s[key].some(char=>!kana.has(char)))fail('invalid-argument','Invalid Kana summary.');
    if(s.correct>s.attempts||s.level<1)fail('invalid-argument','Invalid usage totals.');
    return db.runTransaction(async tx=>{
      const [record,optout,limit]=await tx.getAll(ref,removed,budget);
      if(optout.exists)fail('permission-denied','Usage sharing was turned off.');
      const previous=record.data(),old=limit.data()||{},day=Math.floor(at/86400000),minute=Math.floor(at/60000);
      if(previous&&at-previous.lastSeen<60000)return {accepted:false};
      const today=old.day===day?old:{day,reports:0,created:0},perMinute=old.minute===minute?old.minuteReports:0;
      if(today.reports>=3000||perMinute>=60||!record.exists&&today.created>=100)fail('resource-exhausted','Usage reporting is at capacity. Learning is unaffected.');
      tx.set(budget,{day,reports:today.reports+1,created:today.created+(record.exists?0:1),minute,minuteReports:(perMinute||0)+1});
      tx.set(ref,{...s,firstSeen:previous?.firstSeen||at,lastSeen:at,expiresAt:new Date(at+30*86400000)});
      return {accepted:true};
    });
  }
  return {call};
}
module.exports={createUsage};
