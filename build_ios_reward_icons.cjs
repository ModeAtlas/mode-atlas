/* Collection palettes share the canonical symbol geometry with the default icon. */
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const {symbolBody}=require('./build_brand_assets.cjs');
const palettes={Grove:['#438d79','#80bb92','#74a3b0'],Summit:['#d5a260','#c87965','#9685bd'],Horizon:['#334d79','#627bc1','#4babad'],Sakura:['#733257','#b45f8e','#cc8eac'],Midnight:['#161b42','#464477','#70639b'],Skyline:['#101b25','#294554','#496375'],Evergreen:['#102c23','#36624a','#8a9a65']};
async function main(){
  const svgOnly=process.argv.includes('--svg-only');
  const selected=process.argv.find(value=>value.startsWith('--only='))?.slice(7);
  if(selected&&!Object.hasOwn(palettes,selected))throw Error('Unknown reward icon: '+selected);
  const browser=svgOnly?null:await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
  const page=browser?await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1}):null;
  for(const [name,colours]of Object.entries(palettes)){
    if(selected&&name!==selected)continue;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="background" x2="1" y2="1"><stop stop-color="${colours[0]}"/><stop offset=".5" stop-color="${colours[1]}"/><stop offset="1" stop-color="${colours[2]}"/></linearGradient></defs><path fill="url(#background)" d="M0 0h512v512H0z"/><circle cx="126" cy="92" r="255" fill="white" opacity=".12"/><g transform="translate(36 36) scale(3.4375)">${symbolBody({base:colours[0],fold:colours[2],ink:'#fff'})}</g></svg>`;
    fs.writeFileSync(path.join(__dirname,`assets/rewards/${name}.svg`),svg+'\n');
    const directory=path.join(__dirname,`ios/App/App/Assets.xcassets/${name}.appiconset`);fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,'Contents.json'),JSON.stringify({images:[{filename:`${name}.png`,idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2)+'\n');
    if(svgOnly)continue;
    await page.setContent(`<style>html,body{margin:0;width:1024px;height:1024px}svg{width:1024px;height:1024px;display:block}</style>${svg}`);
    await page.screenshot({path:path.join(directory,`${name}.png`)});
  }
  await browser?.close();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
