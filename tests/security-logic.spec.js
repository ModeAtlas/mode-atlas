const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>require('./helpers/kana-fixture')(page));
async function words(page,native,entries=[]){
  await page.setViewportSize({width:native?393:1280,height:native?852:900});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(({native,entries})=>{
    if(native)window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{}};
    for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasKanaSetupComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasSound','off');localStorage.setItem('maWhatsNewSeen','review');
    if(!sessionStorage.getItem('reviewSeeded')){localStorage.setItem('kanaWordBank',JSON.stringify(entries));sessionStorage.setItem('reviewSeeded','1');}
  },{native,entries});
  await page.goto('/wordbank/');await expect(page.locator('#maLoadingScreen')).toBeHidden();
}
async function add(page,value){
  await page.locator('#wordBankAddJumpBtn').click();await page.locator('#kanaInput').fill(value);await page.locator('#addWordBtn').click();
}
for(const native of [false,true]){
  test(`Words ${native?'iOS':'web'}: normalized kana, syllabic n, duplicate protection, editing and all filters/sorts`,async({page})=>{
    test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await words(page,native);
    const examples=[['しんよう',"shin'you"],['ｺｰﾋｰ','koohii'],['か\u3099く','gaku'],['がっこう','gakkou'],['キャット','kyatto'],['ティー','tii'],['しんい',"shin'i"],['きょう','kyou']];
    for(const [kana,romaji]of examples){await add(page,kana);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kanaWordBank'))[0].romaji)).toBe(romaji);}
    await add(page,'コーヒー');await expect(page.locator('#statusMsg')).toContainText('already');
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kanaWordBank')).length)).toBe(8);await page.keyboard.press('Escape');
    const row=page.locator('.wordbank-entry').filter({has:page.locator('.kana',{hasText:'コーヒー'})});
    if(!await row.evaluate(el=>el.open))await row.locator('summary').click();
    await row.locator('[data-field=english]').fill('Coffee');await row.locator('[data-field=notes]').fill('<img src=x onerror=alert(1)>');await row.locator('[data-action=save]').click();
    await row.locator('[data-action=favorite]').click();
    for(const [filter,count]of [['all',8],['favorites',1],['missingEnglish',7],['withNotes',1],['hiragana',5],['katakana',3],['mixed',0]]){
      await page.locator('#filterSelect').selectOption(filter);await expect(page.locator('.wordbank-entry')).toHaveCount(count);
    }
    await page.locator('#filterSelect').selectOption('all');await page.locator('#searchInput').fill('coffee');await expect(page.locator('.wordbank-entry')).toHaveCount(1);
    await page.locator('#searchInput').fill('');
    for(const sort of ['newest','oldest','kanaAZ','kanaZA','romajiAZ','englishAZ','updated']){await page.locator('#sortSelect').selectOption(sort);await expect(page.locator('.wordbank-entry')).toHaveCount(8);}
    await expect(page.locator('.wordbank-entry img')).toHaveCount(0);
    await page.reload();await expect(page.locator('.wordbank-entry')).toHaveCount(8);expect(errors).toEqual([]);
  });
  test(`Words ${native?'iOS':'web'}: malformed rows and quoted IDs remain editable without script or selector injection`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await words(page,native,[null,12,{kana:42},{id:'quoted"id',kana:'ねこ',english:5,notes:{bad:true}}, {id:'quoted"id',kana:'いぬ'}]);
    await expect(page.locator('.wordbank-entry')).toHaveCount(2);const row=page.locator('.wordbank-entry').filter({has:page.locator('.kana',{hasText:'ねこ'})});
    await row.locator('summary').click();await row.locator('[data-field=english]').fill('Cat');await row.locator('[data-action=save]').click();
    await expect(row.locator('.wordbank-meaning')).toHaveText('Cat');expect(errors).toEqual([]);
  });
  test(`Words ${native?'iOS':'web'}: a delayed clear confirmation cannot erase the next account's words`,async({page})=>{
    await words(page,native,[{id:'a',kana:'ねこ',english:'Private A',notes:''}]);
    await page.evaluate(()=>{window.ModeAtlasFeedback={...ModeAtlasFeedback,confirm:()=>new Promise(resolve=>{window.finishOldClear=resolve;})};document.querySelector('#clearAllBtn').click();});
    await expect.poll(()=>page.evaluate(()=>typeof finishOldClear)).toBe('function');
    await page.evaluate(()=>{dispatchEvent(new Event('modeAtlasAccountWillChange'));localStorage.setItem('kanaWordBank',JSON.stringify([{id:'b',kana:'いぬ',english:'Private B',notes:''}]));dispatchEvent(new CustomEvent('modeAtlasCloudDataChanged',{detail:{source:'account-switch',sections:['wordBank']}}));finishOldClear(true);});
    await expect(page.locator('.wordbank-entry')).toHaveCount(1);await expect(page.locator('.wordbank-meaning')).toHaveText('Private B');
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kanaWordBank'))[0].id)).toBe('b');
    await page.evaluate(()=>ModeAtlasStorage.clearAppData());await expect(page.locator('.wordbank-entry')).toHaveCount(0);
  });
}

for(const native of [false,true])test(`Word recall ${native?'iOS':'web'} reveals meaning and persists its review schedule`,async({page})=>{
  await words(page,native,[{id:'nihon',written:'日本',reading:'にほん',english:'Japan'}]);
  await expect(page.getByRole('button',{name:'Review words',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'Review words',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Review your words'});await expect(dialog.getByRole('heading',{name:'日本'})).toBeVisible();await expect(dialog).not.toContainText('Japan');
  await dialog.getByRole('button',{name:'Reveal',exact:true}).click();await expect(dialog).toContainText('にほん');await expect(dialog).toContainText('Japan');
  await dialog.getByRole('button',{name:'Remembered',exact:true}).click();await expect(dialog).toContainText('Set complete');
  expect(await page.evaluate(()=>ModeAtlasWordBank.read()[0].review.due)).toBeGreaterThan(Date.now());
  await page.reload();expect(await page.evaluate(()=>ModeAtlasWordBank.due().length)).toBe(0);
});
