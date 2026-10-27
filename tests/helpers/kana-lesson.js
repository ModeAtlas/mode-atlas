const {expect}=require('@playwright/test');
async function checkCharacter(page,char,roman,{audio=false,wrong=false,last=false}={}){
  await page.getByRole('button',{name:'Check this character',exact:true}).click();await page.locator('.ma-kana-lesson-choices').getByRole('button',{name:char,exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
  if(audio){await page.getByRole('button',{name:'Play sound',exact:true}).click();await page.locator('.ma-kana-lesson-choices').getByRole('button',{name:char,exact:true}).click();await page.getByRole('button',{name:'Play sound',exact:true}).click();await expect(page.getByRole('button',{name:'Continue',exact:true})).toHaveCount(1);await expect(page.locator('.ma-kana-lesson-choices button').first()).toBeDisabled();await page.getByRole('button',{name:'Continue',exact:true}).click();}
  else await page.getByRole('button',{name:'Continue without audio',exact:true}).click();
  if(wrong){await page.getByLabel('Type the sound in romaji').fill('wrong');await page.getByRole('button',{name:'Check answer',exact:true}).click();expect(await page.evaluate(char=>ModeAtlasKanaLearning.read().lessonChecks[char]||0,char)).toBe(0);}
  await page.getByLabel('Type the sound in romaji').fill(roman);await page.getByRole('button',{name:'Check answer',exact:true}).click();await page.getByRole('button',{name:last?'Finish row lesson':'Next character',exact:true}).click();
}
module.exports=checkCharacter;
