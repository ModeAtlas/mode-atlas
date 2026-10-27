const {test,expect}=require('@playwright/test');
test('a first-visit word lesson deep link waits for setup and resumes without stacked dialogs',async({page})=>{
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
 await page.goto('/wordbank/?lesson=drinks');
 await expect(page.locator('#maVisitModal.open')).toBeVisible();await expect(page.locator('.ma-word-lesson')).toHaveCount(0);
 await page.locator('[data-legal-agree]').check();await page.getByRole('button',{name:'Continue to Words',exact:true}).click();
 await expect(page.locator('#maVisitModal.open')).toHaveCount(0);
 await expect(page.locator('.ma-word-lesson h2')).toHaveText('水');await expect(page.locator('.ma-dialog-layer')).toHaveCount(1);
});
async function setup(page){
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.route(/mode-atlas-fonts-web.*\.css/,route=>route.fulfill({path:require('path').join(__dirname,'../assets/css/mode-atlas-fonts-native.css'),contentType:'text/css'}));
  await page.addInitScript(()=>{
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasBranchToursSeen',JSON.stringify({kana:true,kanji:true,words:true}));
    localStorage.setItem('modeAtlasSound','off');
  });
}
async function ready(page,path){await page.goto(path);await expect(page.locator('#maLoadingScreen')).toBeHidden();}
test('consented first-time Home remains an introduction and changes after real practice',async({page},info)=>{
  await setup(page);const errors=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,'/');
  await expect(page.locator('body')).toHaveAttribute('data-ma-home-state','new');
  await expect(page.locator('.atlas-home-personal')).toBeHidden();await expect(page.locator('.atlas-home-routine')).toBeHidden();
  await expect(page.getByRole('link',{name:'Start learning →'})).toBeVisible();
  await page.screenshot({path:info.outputPath('new-home.png'),fullPage:true});
  await page.evaluate(()=>{ModeAtlasStorage.writeModeJSON('reading','charStats',{'あ':{correct:1,wrong:1}});window.dispatchEvent(new Event('modeAtlasCloudDataChanged'));});
  await expect(page.locator('body')).toHaveAttribute('data-ma-home-state','starting');await expect(page.locator('.atlas-home-personal')).toBeHidden();
  await page.screenshot({path:info.outputPath('returning-home.png'),fullPage:true});expect(errors).toEqual([]);
});
test('first Kana lesson has one task, with advanced tools explicitly available',async({page},info)=>{
  await setup(page);await ready(page,'/kana/');
  await expect(page.getByRole('navigation',{name:'Kana sections'})).toBeHidden();await expect(page.locator('.ma-kana-path')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Take a starting-point/})).toBeHidden();
  await page.screenshot({path:info.outputPath('new-kana.png'),fullPage:true});
  await page.getByRole('button',{name:/Start lesson/}).click();await expect(page.locator('.ma-kana-lesson-shape')).toHaveText('あ');
  await expect(page.locator('.ma-kana-lesson progress')).toHaveAttribute('value','0');
  await page.getByRole('button',{name:'Back to Kana',exact:true}).click();await expect(page.getByRole('button',{name:'Continue learning',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Katakana',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Explore all Kana tools',exact:true}).click();await expect(page.getByRole('button',{name:'Katakana',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Explore the full learning path'}).click();await expect(page.locator('.ma-kana-path-step:enabled')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('Learn is a branch directory without a duplicated resume dashboard',async({page})=>{
  await setup(page);await ready(page,'/learn/');await expect(page.locator('.ma-branch-tile')).toHaveCount(3);
  await expect(page.locator('.ma-learn-next')).toHaveCount(0);await expect(page.locator('.ma-learning-route')).toHaveCount(0);
});
test('Word Bank teaches, saves and retrieves a reading with an independent schedule',async({page},info)=>{
  await setup(page);const errors=[];page.on('pageerror',error=>errors.push(error.message));await ready(page,'/wordbank/');
  await expect(page.locator('.wordbank-overview')).toBeHidden();await expect(page.locator('.wordbank-library .toolbar')).toBeHidden();
  await page.screenshot({path:info.outputPath('new-wordbank.png'),fullPage:true});
  await page.locator('[data-word-section=phrases]').click();
  await page.getByRole('button',{name:'Start lesson: Make a polite connection',exact:true}).click();
  await page.getByRole('button',{name:'Try remembering it',exact:true}).click();await page.getByLabel('Reading (kana or romaji)',{exact:true}).fill('sumimasen');await page.getByRole('button',{name:'Check answer',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const saved=await page.evaluate(()=>ModeAtlasWordBank.read()[0]);expect(saved.written).toBe('すみません');expect(saved.readingReview.last).toBeGreaterThan(0);expect(saved.review.last).toBe(0);expect(saved.example).toContain('駅');
  expect(errors).toEqual([]);
});

test('a completely fresh visitor reaches the first lesson without automatic tours or update popups',async({page})=>{
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
 await ready(page,'/');await page.getByRole('link',{name:'Start learning →'}).click();
 await page.getByRole('checkbox',{name:'I agree to the Privacy Policy and Terms of Use.'}).check();await page.getByRole('button',{name:'Continue to Kana',exact:true}).click();
 await expect(page.getByRole('button',{name:/Start lesson/})).toBeVisible();await expect(page.locator('.ma-tour')).toHaveCount(0);
 await page.getByRole('button',{name:/Start lesson/}).click();await expect(page.locator('.ma-kana-lesson-shape')).toHaveText('あ');
 await expect(page.getByRole('dialog',{name:/What’s new/})).toHaveCount(0);
});
