// Tests of scoring/navigation pass through the optional earned-level event.
// Celebration behavior itself is asserted explicitly in progression.spec.js.
module.exports=async page=>{
  await page.locator('.ma-level-up-card,.ma-study-summary,.ma-kanji-recap').first().waitFor({state:'visible'});
  if(await page.locator('.ma-level-up-card').isVisible())await page.locator('.ma-level-up-card').getByRole('button',{name:'Continue',exact:true}).click();
};
