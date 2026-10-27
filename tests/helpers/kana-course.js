const {expect}=require('@playwright/test');
const roman={'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su','せ':'se','そ':'so'};
async function task(page,{wrong=false,silent=false}={}){
 const frame=page.locator('.ma-course-view[data-task]');if(!await frame.count())return false;
 const kind=await frame.getAttribute('data-task');
 if(kind==='teach'){await page.getByRole('button',{name:'Continue',exact:true}).click();return true;}
 if(kind==='patternTeach'){await page.getByRole('button',{name:'Try the pattern',exact:true}).click();return true;}
 if(kind==='read'){const char=await page.locator('.ma-kana-task-glyph').textContent();if(!roman[char])throw Error('Fixture lacks reading for '+char);await page.getByLabel('Type the sound in romaji').fill(wrong?'wrong':roman[char]);await page.getByRole('button',{name:'Check answer',exact:true}).click();}
 else if(kind==='listen'||kind==='patternListen'){
   if(silent)await page.getByRole('button',{name:'Study without audio',exact:true}).click();
   else{await page.getByRole('button',{name:'Play sound',exact:true}).click();const spoken=await page.evaluate(()=>window.__spoken.at(-1)),choices=page.getByRole('group',{name:'Answer choices'});await(wrong?choices.getByRole('button').filter({hasNotText:spoken}).first():choices.getByRole('button',{name:spoken,exact:true})).click();}
 }else if(kind==='match'||kind==='recall'){
   const reading=await page.locator('.ma-kana-task-reading').textContent(),char=Object.keys(roman).find(c=>roman[c]===reading);if(!char)throw Error('Fixture lacks shape for '+reading);const choices=page.getByRole('group',{name:'Answer choices'});await(wrong?choices.getByRole('button').filter({hasNotText:char}).first():choices.getByRole('button',{name:char,exact:true})).click();
 }else if(kind==='patternApply'){
   // Authored application prompts explicitly specify the spelling operation.
   const prompt=await page.locator('.ma-kana-task-prompt').textContent();const answers={'Keep the a in か sounding for two beats. Choose the spelling.':'かあ','Keep the u in く sounding for two beats. Choose the spelling.':'くう','Write itta with a held t, using small っ.':'いった','Write sakka with a held k, using small っ.':'さっか','Hold the o in コ for another beat. Choose the spelling.':'コー','Hold the u in ク for another beat. Choose the spelling.':'クー'};
   const answer=answers[prompt];if(!answer)throw Error('Fixture lacks pattern prompt '+prompt);await page.getByRole('group',{name:'Answer choices'}).getByRole('button',{name:answer,exact:true}).click();
 }
 await page.getByRole('button',{name:/^(Continue|Finish session)$/}).click();return true;
}
async function session(page,options={}){let count=0;while(await page.locator('.ma-course-view[data-task]').count()){await task(page,options);if(++count>180)throw Error('Course did not end');}return count;}
module.exports={task,session,roman};
