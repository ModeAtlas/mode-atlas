const {expect}=require('@playwright/test');

// These are window stress cases matching the proportions of the reported
// screenshots, not device specifications. UIKit geometry is simulated here.
const outer={width:480,height:680,reservedRegionsAvailable:true,safeArea:{top:12,right:84,bottom:20,left:0},occlusions:[{x:406,y:24,width:60,height:130}]};
const inner={width:960,height:680,reservedRegionsAvailable:true,safeArea:{top:12,right:84,bottom:20,left:0},occlusions:[{x:890,y:24,width:52,height:84}]};
const portrait={width:740,height:1020,reservedRegionsAvailable:true,safeArea:{top:84,right:0,bottom:24,left:0},occlusions:[]};
const views=[['outer',outer],['inner',inner],['portrait',portrait]];
async function prepare(page,geometry=inner,theme='dark',seedKana=true,onboarded=true){
  if(seedKana)await require('./kana-fixture')(page);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.setViewportSize({width:geometry.width,height:geometry.height});
  await page.addInitScript(({geometry,theme,onboarded})=>{
    let listener=()=>{};
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{ModeAtlasNative:{
      getViewportLayout:async()=>geometry,
      addListener:(name,cb)=>{if(name==='viewportLayoutChanged')listener=cb;return Promise.resolve({remove(){}});}
    }}};
    window.applyDuoNativeGeometry=next=>{
      for(const [side,value]of Object.entries(next.safeArea))document.documentElement.style.setProperty('--ma-safe-'+side,value+'px');
      listener(next);
    };
    window.applyDuoGeometry=next=>{applyDuoNativeGeometry(next);dispatchEvent(new Event('resize'));};
    document.addEventListener('DOMContentLoaded',()=>applyDuoGeometry(geometry),{once:true});
    if(onboarded)for(const key of ['modeAtlasStarterSeen','modeAtlasOnboardingComplete','modeAtlasLegalAccepted'])localStorage.setItem(key,'true');
    localStorage.setItem('modeAtlasThemePreference',theme);
    localStorage.setItem('modeAtlasSound','off');
    for(const key of ['settings','reverseSettings'])if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({hiraganaRows:['h_a','h_ka','h_sa'],katakanaRows:[],hint:false,srs:false,keyboardMode:false,choiceCount:8}));
  },{geometry,theme,onboarded});
}
async function settle(page){
  await expect(page.locator('#maLoadingScreen')).toBeHidden();
  await page.evaluate(()=>document.fonts.ready);
}

module.exports={outer,inner,portrait,views,prepare,settle};
