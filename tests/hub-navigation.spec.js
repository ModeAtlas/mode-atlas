const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>require('./helpers/returning-tours')(page));
for(const [native,width,theme]of [[true,320,'light'],[true,393,'dark'],[true,768,'light'],[false,1280,'dark']])test(`shared hub navigation ${native?'iOS':'web'} ${width} ${theme}`,async({page},info)=>{
  test.setTimeout(60000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:852});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await require('./helpers/firebase-guest')(page);
  await page.addInitScript(({native,theme})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','hub-navigation');localStorage.setItem('modeAtlasThemePreference',theme);
  },{native,theme});
  if(native){const device=await page.context().newCDPSession(page);await device.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}});}
  const nav=()=>page.locator(native?'.ma-ios-tabs':'.ma-nav__links');
  const destinations=native?['Atlas','Learn','Progress','Friends']:['Atlas','Learn','Progress','Friends','Shop'];
  await page.goto('/learn/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect(nav().locator(native?'.ma-ios-tab__label':'a')).toHaveText(destinations);
  await expect(page.getByRole('link',{name:'Open Words',exact:true})).toBeVisible();
  await expect(page.locator('.ma-branch-tile')).toHaveCount(3);
  await expect(page.getByRole('link',{name:'Phrase lessons Everyday expressions'})).toHaveAttribute('href','/wordbank/?view=phrases');
  for(const [name,href] of [['Open Kana','/kana/'],['Open Kanji','/kanji/'],['Open Words','/wordbank/']]){
    const link=page.getByRole('link',{name,exact:true});await expect(link).toHaveAttribute('href',href);
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('.ma-learn-next,.ma-learn-results')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(native&&width===393){
    await page.getByRole('link',{name:'Open Words',exact:true}).scrollIntoViewIfNeeded();
    const words=await page.getByRole('link',{name:'Open Words',exact:true}).boundingBox(),dock=await nav().boundingBox();
    expect(words.y+words.height).toBeLessThanOrEqual(dock.y-8);
  }
  await page.screenshot({path:info.outputPath('learn.png'),animations:'disabled'});
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('link',{name:'Open Words',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('link',{name:'Open Words',exact:true})).toBeInViewport();
  expect(await page.locator('.ma-branch-tile__copy,.ma-learn-next>div').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1))).toBe(true);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:info.outputPath('learn-large-text.png'),animations:'disabled'});
  await page.evaluate(()=>{document.documentElement.style.fontSize='';document.documentElement.removeAttribute('data-ma-large-text');});
  await page.getByRole('link',{name:'Open Kana',exact:true}).click();
  await expect(page).toHaveURL(/\/kana\/$/);await expect(nav().locator(native?'.ma-ios-tab__label':'a')).toHaveText(destinations);
  await nav().getByRole('link',{name:'Progress',exact:true}).click();
  await expect(page.locator('.ma-hub-header h1')).toHaveText('Progress');
  await page.getByRole('button',{name:'Explore goals & rewards',exact:true}).click();
  await expect(page.locator('.ma-routine-goal')).toHaveCount(5);
  await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  await page.locator('#profileOpenBtn').click();await page.getByRole('tab',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('tablist',{name:'Account sections'}).getByRole('tab')).toHaveText(['Profile','Shop','Settings']);
  await page.locator('#maAccountClose').click();await expect(page.getByRole('tabpanel',{name:'Rewards',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Goals',exact:true}).click();
  await page.screenshot({path:info.outputPath('progress.png'),animations:'disabled'});
  await nav().getByRole('link',{name:'Friends',exact:true}).click();
  await expect(page.locator('.ma-hub-header h1')).toHaveText('Friends');await expect(page.locator('.ma-social')).toBeVisible();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#profileAuthBtn')).toBeVisible();await page.locator('#maAccountClose').click();
  await page.screenshot({path:info.outputPath('friends.png'),animations:'disabled'});
  await page.goto('/?section=friends&ranking=weekly');await expect(page).toHaveURL(/\/friends\/\?ranking=weekly$/);
  await page.goto('/?section=atlas');await expect(page).toHaveURL(/\/progress\/$/);
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await page.getByRole('tablist',{name:'Progress',exact:true}).getByRole('tab').evaluateAll(tabs=>tabs.every(tab=>{const range=document.createRange();range.selectNodeContents(tab);return range.getClientRects().length===1&&tab.scrollWidth<=tab.clientWidth+1;}))).toBe(true);
  if(native)expect(await nav().evaluate(dock=>[...dock.querySelectorAll('.ma-ios-tab__label')].every(node=>{const range=document.createRange();range.selectNodeContents(node);return range.getClientRects().length===1&&node.scrollWidth<=node.clientWidth+1;}))).toBe(true);
  await page.screenshot({path:info.outputPath('progress-large-text.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});

for(const [width,height,theme] of [[960,400,'light'],[1280,900,'dark']])test(`branch invitations grow from learning evidence ${width} ${theme}`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await require('./helpers/firebase-guest')(page);
  await page.addInitScript(theme=>{
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','journey');localStorage.setItem('modeAtlasThemePreference',theme);
  },theme);
  await page.goto('/learn/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  const kana=page.locator('.ma-branch-tile[data-branch="kana"]'),kanji=page.locator('.ma-branch-tile[data-branch="kanji"]'),words=page.locator('.ma-branch-tile[data-branch="words"]');
  await expect(kana).toContainText('Start here');await expect(kanji).toContainText('After your first Kana checkpoint');
  await expect(kanji).toHaveAttribute('href','/kanji/');await kanji.click();await expect(page).toHaveURL(/\/kanji\/$/);
  await page.goto('/learn/');
  await page.evaluate(()=>{
    const state=ModeAtlasKanaLearning.read();state.startedAt=1;state.startKind='beginner';
    for(const char of 'あいうえおかきくけこさしすせ')state.earned.reading[char]=3;
    ModeAtlasKanaLearning.save(state);
  });
  await expect(kanji).not.toContainText('Ready to try');
  await page.evaluate(()=>{const state=ModeAtlasKanaLearning.read();state.earned.reading.そ=3;ModeAtlasKanaLearning.save(state);});
  await expect(kanji).toContainText('Ready to try');await expect(words).toContainText('Try words with your kana');
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';document.documentElement.setAttribute('data-ma-large-text','');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await page.locator('.ma-branch-tile__copy').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth+1))).toBe(true);
  expect(await words.locator('img').evaluate(node=>node.getBoundingClientRect().height)).toBeLessThanOrEqual(110);
  await words.scrollIntoViewIfNeeded();await expect(words).toBeInViewport();
  await page.screenshot({path:info.outputPath('branch-invitations.png'),animations:'disabled'});
  expect(errors).toEqual([]);
});

test('Home continues a beginner lesson and the Words course without redirecting into unrelated tools',async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());await require('./helpers/firebase-guest')(page);
  await page.addInitScript(()=>{
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','journey');
    if(!localStorage.getItem('modeAtlasKanaLearning'))localStorage.setItem('modeAtlasKanaLearning',JSON.stringify({startedAt:1,startKind:'beginner'}));
  });
  await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect(page.locator('#homeContinueAction')).toHaveAttribute('href','/kana/?view=course&script=hiragana');
  await expect(page.locator('.atlas-home .ma-branch-tile')).toHaveCount(0);
  await expect(page.locator('#homeDaily')).toHaveCount(0);
  await expect(page.locator('.atlas-home-directory')).toHaveAttribute('href','/learn/');
  await page.evaluate(()=>{
    const state=ModeAtlasKanaLearning.read();for(const char of 'あいうえお')state.introduced[char]=Date.now();ModeAtlasKanaLearning.save(state);
    ModeAtlasStorage.setJSON('modeAtlasLastMode',{branchId:'words',href:'/wordbank/'});
  });
  await page.reload();
  await expect(page.locator('#homeContinueAction')).toHaveAttribute('href','/wordbank/?view=course&session=course');
});

test('Home counts guided Kana effort as daily practice without fabricated XP',async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());await require('./helpers/firebase-guest')(page);
  await page.addInitScript(()=>{
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','journey');
  });
  await page.goto('/kana/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  const result=await page.evaluate(()=>{
    ModeAtlasKanaLearning.start();let session=ModeAtlasKanaLearning.beginCourse(),guard=0;
    while(ModeAtlasProgress.routine().todayUnits<5&&!session.complete&&guard++<80){
      const task=session.queue[session.index],audio=['listen','patternListen'].includes(task.kind);
      ModeAtlasKanaLearning.answerCourse('wrong',{skipAudio:audio});session=ModeAtlasKanaLearning.advanceCourse();
    }
    return {units:ModeAtlasProgress.routine().todayUnits,xp:ModeAtlasProgress.getXP()};
  });
  expect(result).toEqual({units:5,xp:0});
  await page.goto('/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await expect(page.locator('#homeGoals')).toContainText('Today’s practice complete');
  await expect(page.locator('#homeStreak')).toHaveText('1');
  await expect(page.locator('#homeTotalXp')).toHaveText('0');
  await expect(page.locator('[data-ma-home-week-days]')).toHaveText('1 / 7');
});

async function prepareResume(page){
  await page.setViewportSize({width:430,height:932});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());await require('./helpers/firebase-guest')(page);
  await page.addInitScript(()=>{
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('maWhatsNewSeen','resume-journey');
  });
}
test('Home resumes the actual Kanji task after teaching and exit',async({page},info)=>{
  await prepareResume(page);await page.goto('/kanji/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.getByRole('button',{name:'Start as a beginner',exact:true}).click();
  await page.locator('.ma-kanji-current .ma-button--primary').click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const body=await page.locator('.ma-course-body').innerText(),position=await page.locator('.ma-course-position span').innerText(),title=await page.locator('.ma-course-title').innerText();
  await page.getByRole('button',{name:'Save & exit',exact:true}).click();
  await page.locator('.ma-ios-tabs').getByRole('link',{name:'Atlas',exact:true}).click();
  await expect(page.locator('#homeContinueAction')).toHaveAttribute('href','/kanji/?continue=1');
  await expect(page.locator('#homeContinueAction')).toHaveText('Resume');await expect(page.locator('#homeContinueTitle')).toHaveText(title);
  await expect(page.locator('.atlas-home-learning__art img')).toHaveAttribute('src','/assets/illustrations/kanji-scene.svg');
  await page.locator('#homeContinueAction').click();
  await expect(page.locator('.ma-course-body')).toHaveText(body,{useInnerText:true});
  await expect(page.locator('.ma-course-position span')).toHaveText(position);
  await page.screenshot({path:info.outputPath('home-resumed-kanji.png'),animations:'disabled'});
});
test('Home resumes Words after meeting a word before any scored answer',async({page},info)=>{
  await prepareResume(page);await page.goto('/learn/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
  // A returning learner has met these kana; the test performs the Words lesson
  // through visible controls and does not fabricate word attempts or completion.
  await page.evaluate(()=>{const state=ModeAtlasKanaLearning.read();state.startedAt=1;state.startKind='existing';for(const char of 'あいうえおかきくけこ')state.introduced[char]=Date.now();ModeAtlasKanaLearning.save(state);});
  await page.getByRole('link',{name:'Open Words',exact:true}).click();
  await page.getByRole('link',{name:/Learn words/}).click();
  await page.locator('.ma-vocabulary-next .ma-button--primary').click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  const body=await page.locator('.ma-course-body').innerText(),position=await page.locator('.ma-course-position span').innerText();
  expect(await page.evaluate(()=>ModeAtlasWordLessonState.vocabularyOverview().attempts)).toBe(0);
  await page.getByRole('button',{name:'Save & exit',exact:true}).click();
  await page.locator('.ma-ios-tabs').getByRole('link',{name:'Atlas',exact:true}).click();
  await expect(page.locator('#homeContinueAction')).toHaveAttribute('href','/wordbank/?view=course&session=course');
  await page.locator('#homeContinueAction').click();
  await expect(page.locator('.ma-course-body')).toHaveText(body,{useInnerText:true});
  await expect(page.locator('.ma-course-position span')).toHaveText(position);
  await page.screenshot({path:info.outputPath('home-resumed-words.png'),animations:'disabled'});
});
