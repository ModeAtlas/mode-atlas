const {test,expect}=require('@playwright/test');
const pages=['/','/kana/','/reading/','/writing/','/results/','/wordbank/'];
const layouts=[
  {name:'web-phone',width:320,height:700},
  {name:'web-tablet',width:820,height:1180},
  {name:'web-desktop',width:1440,height:900},
  {name:'ios-small',width:320,height:700,native:true},
  {name:'ios-phone',width:393,height:852,native:true},
  {name:'ios-tablet',width:820,height:1180,native:true}
];
async function prepare(page,layout,theme){
  await page.setViewportSize(layout);
  await page.route(/https:\/\/([\w-]+\.)?(gstatic|googleapis)\.com\/.*/,route=>route.abort());
  await page.addInitScript(({native,theme})=>{
    localStorage.setItem('maWhatsNewSeen','polish');
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasThemePreference',theme);
    localStorage.setItem('modeAtlasSound','off');
    localStorage.setItem('settings',JSON.stringify({hiraganaRows:['h_a'],katakanaRows:[],hint:true,activeBottomTab:null}));
    localStorage.setItem('reverseSettings',JSON.stringify({hiraganaRows:['h_ka'],katakanaRows:[],hint:false,keyboardMode:false,choiceCount:4,activeBottomTab:null}));
    localStorage.setItem('kanaWordBank',JSON.stringify([{id:'layout-word',kana:'あいうえお'.repeat(10),romaji:'aiueo'.repeat(10),english:'A long meaning to check wrapping inside a saved vocabulary entry.',notes:'Useful study notes.',createdAt:1,updatedAt:1}]));
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{
      getNotificationStatus:async()=>({granted:false,status:'notDetermined'}),
      getEngagementState:async()=>({supported:true,reminder:{enabled:false,granted:false,status:'notDetermined',hour:19,minute:0},widgets:{available:true,progressSupported:false}}),
      publishWidgetSnapshot:async()=>({stored:false})
    }}};
  },{native:!!layout.native,theme});
}
async function settleDrawer(page,selector){
  await page.locator(selector).evaluate(async el=>{
    el.getBoundingClientRect();
    await Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{})));
  });
}
async function checkLayout(page,scope='body'){
  const issues=await page.evaluate(scope=>{
    const issues=[];
    if(document.documentElement.scrollWidth>innerWidth+2)issues.push(`document ${document.documentElement.scrollWidth}>${innerWidth}`);
    const root=document.querySelector(scope);
    for(const el of root.querySelectorAll('button,.ma-card,.wordbank-entry')){
      if(!el.getClientRects().length||el.closest('[hidden],[inert],[aria-hidden="true"]'))continue;
      const r=el.getBoundingClientRect();
      if(r.width===0||r.right<=0||r.left>=innerWidth)continue;
      const name=(el.id||el.textContent.trim().slice(0,45));
      if(r.left < -2 || r.right > innerWidth+2)issues.push(`${name}: outside viewport (${r.left},${r.right})`);
      if(el.tagName==='BUTTON'&&(el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2))issues.push(`${name}: clipped text`);
    }
    for(const tile of root.querySelectorAll('.ma-level-activity>div')){
      const boxes=Array.from(tile.children).map(el=>el.getBoundingClientRect());
      for(let i=1;i<boxes.length;i++)if(boxes[i].top<boxes[i-1].bottom-1)issues.push('profile activity text overlaps');
    }
    return issues;
  },scope);
  expect(issues).toEqual([]);
}
for(const layout of layouts)for(const theme of ['dark','light']){
  test(`${layout.name} ${theme}: pages, drawers and long text fit`,async({page},testInfo)=>{
    test.setTimeout(120000);
    await prepare(page,layout,theme);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    for(const route of pages){
      await page.goto(route,{waitUntil:'domcontentloaded'});
      await expect(page.locator('#maLoadingScreen')).toBeHidden();
      await checkLayout(page);
      await page.evaluate(()=>window.ModeAtlasSettings.open());
      await expect(page.locator('#maAccount-settings')).toHaveAttribute('aria-hidden','false');
      await expect(page.locator('#settingsDeleteAccountBtn')).toBeHidden();
      if(layout.native)await expect(page.locator('[data-ma-check-updates]')).toHaveCount(0);
      await settleDrawer(page,'#maAccount-settings');
      await checkLayout(page,'#maAccount-settings');
      await page.evaluate(()=>{window.ModeAtlasSettings.close();window.ModeAtlasProfile.open();});
      await page.evaluate(()=>{
        document.getElementById('profileName').textContent='A very long account display name for a small screen';
        document.getElementById('profileEmail').textContent='averylongaccountaddresswithoutspaces@example.mode-atlas.com';
        for(const id of ['profileReadingCorrect','profileWritingCorrect'])document.getElementById(id).textContent='123456789';
      });
      await settleDrawer(page,'#maAccount-profile');
      await checkLayout(page,'#maAccount-profile');
      if(layout.name==='ios-phone')await page.screenshot({path:testInfo.outputPath(`profile-${theme}.png`)});
      await page.evaluate(()=>window.ModeAtlasProfile.close());
      await settleDrawer(page,'#maAccount-profile');
      if(route==='/reading/'){
        await page.locator('#modifiersTab').click();
        await page.locator('summary').filter({hasText:'Learning options'}).click();
        await page.locator('[data-ma-control-key="confusableKana"]').click();
        const chars=await page.evaluate(()=>getHeatmapCharsForDisplay());
        expect(chars.length).toBeGreaterThan(0);
        expect(chars.every(char=>'シツソンぬめれわねクケタナメ'.includes(char))).toBe(true);
        await page.locator('[data-ma-control-key="confusableKana"]').click();
        const row=page.locator('#rowOptions [data-row-key="h_a"]');
        await row.focus();
        await page.keyboard.press('Space');
        await expect(row).toHaveAttribute('aria-pressed','true');
        await page.keyboard.press('Space');
        await expect(row).toHaveAttribute('aria-pressed','false');
        await page.locator('#practiceSetupDone').click();
      }
      if(route==='/writing/'){
        const reading=await page.evaluate(()=>localStorage.getItem('settings'));
        await page.locator('#modifiersTab').click();
        if(layout.name==='ios-phone')await page.screenshot({path:testInfo.outputPath(`setup-${theme}.png`)});
        await page.locator('#keyboardModeBtn').click();
        await expect(page.locator('#keyboardModeBtn')).toHaveAttribute('aria-pressed','true');
        await page.locator('#choice4Btn').click();
        await expect(page.locator('#choice4Btn')).toHaveAttribute('aria-pressed','true');
        expect(await page.evaluate(()=>localStorage.getItem('settings'))).toBe(reading);
        await checkLayout(page);
        await page.locator('#buttonsModeBtn').click();
        await expect(page.locator('#choice8Btn')).toBeVisible();
        await page.locator('#practiceSetupDone').click();
      }
      if(route==='/' && layout.name==='ios-phone')await page.screenshot({path:testInfo.outputPath(`home-${theme}.png`)});
      if(route==='/wordbank/' && layout.width===320)await page.screenshot({path:testInfo.outputPath(`words-${theme}.png`)});
    }
    expect(errors).toEqual([]);
  });
}

test('About reports the cloud owner status and shared menus toggle consistently',async({page})=>{
  await prepare(page,layouts[2],'dark');
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.locator('[data-settings-open]').click();
  await expect(page.locator('#maAccount-settings')).toHaveAttribute('aria-hidden','false');
  await page.evaluate(()=>document.querySelector('[data-settings-open]').click());
  await expect(page.locator('#maAccount-settings')).toHaveAttribute('aria-hidden','true');
  await page.evaluate(()=>{
    window.KanaCloudSync={...window.KanaCloudSync,getSyncStatus:()=>({user:{uid:'test'},state:'offline',text:'Offline · changes will sync later',lastSync:0})};
    window.ModeAtlas.openAbout();
  });
  await expect(page.locator('[data-ma-info="cloudStatus"]')).toHaveText('Offline · changes will sync later');
  await expect(page.locator('[data-ma-info="saveSchema"],[data-ma-info="build"],[data-ma-info="installSupport"]')).toHaveCount(0);
});
