const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test.beforeEach(async({page})=>{
  await require('./helpers/returning-tours')(page);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await page.addInitScript(()=>{
    window.widgetMessages=[];
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{
      publishWidgetSnapshot:async value=>{window.widgetMessages.push(value);return {stored:true,avatarStored:!!value.avatarPNG};},
      resetEngagement:async()=>({reset:true})
    }}};
  });
  await page.goto('/');
  await expect.poll(()=>page.evaluate(()=>!!window.ModeAtlasWidgetAvatar)).toBe(true);
});

test('widgets reuse the full avatar and pet, cache the raster, and replace it after an edit',async({page},testInfo)=>{
  await page.evaluate(()=>{
    const svg=ModeAtlasAvatarArt.svg;window.widgetRenderCount=0;
    window.ModeAtlasAvatarArt={...ModeAtlasAvatarArt,svg(...args){window.widgetRenderCount++;return svg(...args);}};
    window.widgetCharacter=ModeAtlasAvatarRules.normalize({...ModeAtlasAvatarRules.defaults,hair:'curtains',pet:'japanese-spitz',petName:'Shiro'});
    window.ModeAtlasAvatar={presentation:()=>({character:window.widgetCharacter})};
    dispatchEvent(new CustomEvent('modeAtlasAvatarChanged'));
  });
  await expect.poll(()=>page.evaluate(()=>widgetMessages.filter(x=>x.avatarPNG).length)).toBe(1);
  const first=await page.evaluate(()=>widgetMessages.find(x=>x.avatarPNG));
  expect(JSON.stringify(JSON.parse(first.snapshot))).not.toContain('data:image');
  expect(first.avatarPNG.length).toBeLessThan(700000);
  const size=await page.evaluate(async png=>{const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();return [image.naturalWidth,image.naturalHeight];},first.avatarPNG);
  expect(size).toEqual([640,680]);
  if(process.env.MODE_ATLAS_WIDGET_FIXTURE&&testInfo.project.name==='desktop-chromium')fs.writeFileSync(process.env.MODE_ATLAS_WIDGET_FIXTURE,Buffer.from(first.avatarPNG,'base64'));
  await page.evaluate(()=>{for(let i=0;i<30;i++)dispatchEvent(new CustomEvent('modeAtlasProgressChanged'));dispatchEvent(new CustomEvent('modeAtlasAppStateChanged',{detail:{isActive:false}}));});
  expect(await page.evaluate(()=>widgetRenderCount)).toBe(1);
  expect(await page.evaluate(()=>widgetMessages.filter(x=>x.avatarPNG).length)).toBe(1);
  await page.evaluate(()=>{widgetCharacter={...widgetCharacter,hair:'quiff'};dispatchEvent(new CustomEvent('modeAtlasAvatarChanged'));});
  await expect.poll(()=>page.evaluate(()=>widgetMessages.filter(x=>x.avatarPNG).length)).toBe(2);
  expect(await page.evaluate(()=>widgetRenderCount)).toBe(2);
  expect(await page.evaluate(()=>widgetMessages.filter(x=>x.avatarPNG).at(-1).avatarPNG)).not.toBe(first.avatarPNG);
});

test('late avatar decoding cannot restore artwork after an account change',async({page})=>{
  await page.evaluate(()=>{
    window.ModeAtlasAvatar={presentation:()=>({character:ModeAtlasAvatarRules.defaults})};
    const decode=Image.prototype.decode;
    Image.prototype.decode=function(){const image=this;return new Promise(resolve=>{window.releaseWidgetImage=async()=>{await decode.call(image);resolve();};});};
    dispatchEvent(new CustomEvent('modeAtlasAvatarChanged'));
  });
  await expect.poll(()=>page.evaluate(()=>!!window.releaseWidgetImage)).toBe(true);
  await page.evaluate(async()=>{
    dispatchEvent(new CustomEvent('modeAtlasAccountWillChange'));
    window.ModeAtlasAvatar={presentation:()=>null};
    await window.releaseWidgetImage();
  });
  expect(await page.evaluate(()=>ModeAtlasWidgetAvatar.pending())).toBeNull();
  expect(await page.evaluate(()=>widgetMessages.some(x=>x.avatarPNG))).toBe(false);
});
