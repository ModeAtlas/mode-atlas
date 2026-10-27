const {test,expect}=require('@playwright/test');
const {prepare,settle,outer,inner}=require('./helpers/native-geometry');
for(const theme of ['light','dark'])for(const g of [outer,inner])test(`Settings Help supports search, topic navigation, focus and larger text: ${g.width} ${theme}`,async({page},info)=>{
  await prepare(page,g,theme);await page.goto('/');await settle(page);await page.evaluate(()=>ModeAtlasSettings.open());
  const open=page.getByRole('button',{name:'Help',exact:true});await open.click();const dialog=page.getByRole('dialog',{name:'Help',exact:true});
  await expect(dialog.locator('[data-help-topic]')).toHaveCount(8);await expect(dialog.locator('.ma-help-article')).toBeHidden();
  await dialog.getByRole('searchbox',{name:'Search help'}).fill('mastery');await expect(dialog.getByRole('searchbox')).toHaveValue('mastery');await expect(dialog.locator('[data-help-topic]')).toHaveCount(2);
  await dialog.getByRole('button',{name:'Kana progress & mastery'}).click();await expect(dialog.locator('.ma-help-article')).toContainText('50 correct');await expect(dialog.locator('.ma-help-article')).toContainText('correct first answer without help');await expect(dialog.locator('.ma-help-article')).toContainText('first three-row Hiragana checkpoint');await expect(dialog.locator('.ma-help-article h3')).toBeFocused();
  await dialog.getByRole('button',{name:'All help topics'}).click();await expect(dialog.getByRole('button',{name:'Kana progress & mastery'})).toBeFocused();await expect(dialog.getByRole('searchbox')).toHaveValue('mastery');
  await dialog.getByRole('searchbox').fill('no-such-topic');await expect(dialog.getByRole('status')).toHaveText('No matching topics. Try another word.');await dialog.getByRole('searchbox').fill('');
  const expected={words:'separate records and schedules',reviews:'Each skill has its own schedule',kana:'Earned progress',kanji:'correct first answers without hints',milestones:'including locked characters',weekly:'100 Atlas Coins',rewards:'correct answers',saving:'sync learning between devices'};
  for(const [id,copy]of Object.entries(expected)){await dialog.locator(`[data-help-topic="${id}"]`).click();await expect(dialog.locator('.ma-help-article')).toContainText(copy);if(id==='words'){await expect(dialog.locator('.ma-help-article')).toContainText('Two destinations');await expect(dialog.locator('.ma-help-article')).toContainText('custom one-skill test');}await dialog.getByRole('button',{name:'All help topics'}).click();}
  await page.evaluate(()=>{document.documentElement.style.setProperty('--ma-ios-text-scale','1.5');document.documentElement.setAttribute('data-ma-large-text','');});
  await page.screenshot({path:info.outputPath(`help-${g.width}-${theme}.png`),animations:'disabled'});expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(open).toBeFocused();
});

// Exercise the shared deferred focus callback without relying on frame timing.
test('a feature dialog preserves an input focused before its first animation frame',async({page})=>{
  await prepare(page,inner,'light');await page.goto('/');await settle(page);
  await page.evaluate(()=>{
    const input=document.createElement('input');input.setAttribute('aria-label','Focus preservation');
    window.__dialogFocusFrames=[];window.__dialogFocusRaf=window.requestAnimationFrame;
    window.requestAnimationFrame=callback=>{window.__dialogFocusFrames.push(callback);return window.__dialogFocusFrames.length;};
    ModeAtlasDialog.feature({title:'Focus timing',contentNode:input,onOpen:()=>input.focus()});
  });
  const input=page.getByRole('textbox',{name:'Focus preservation'});await expect(input).toBeFocused();await page.keyboard.insertText('mastery');
  await page.evaluate(()=>{const frames=window.__dialogFocusFrames;window.requestAnimationFrame=window.__dialogFocusRaf;delete window.__dialogFocusFrames;delete window.__dialogFocusRaf;for(const frame of frames)frame(performance.now());});
  await expect(input).toHaveValue('mastery');await expect(input).toBeFocused();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog',{name:'Focus timing',exact:true})).toBeHidden();
});
