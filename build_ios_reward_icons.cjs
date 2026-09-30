/* Render the canonical outlined brand mark, never a modified raster source. */
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const palettes={Grove:['#438d79','#80bb92','#74a3b0'],Summit:['#d5a260','#c87965','#9685bd'],Horizon:['#334d79','#627bc1','#4babad']};
async function main(){
  const mark=fs.readFileSync(path.join(__dirname,'assets/brand/mode-atlas-mark.svg'),'utf8').match(/<g id="mark">([\s\S]*)<\/g>/)[1];
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1});
  for(const [name,colours]of Object.entries(palettes)){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="background" x2="1" y2="1"><stop stop-color="${colours[0]}"/><stop offset=".5" stop-color="${colours[1]}"/><stop offset="1" stop-color="${colours[2]}"/></linearGradient><g id="mark">${mark}</g></defs><path fill="url(#background)" d="M0 0h512v512H0z"/><circle cx="126" cy="92" r="255" fill="white" opacity=".12"/><use href="#mark" fill="#101724" transform="translate(6 8)"/><use href="#mark" fill="white"/></svg>`;
    fs.writeFileSync(path.join(__dirname,`assets/rewards/${name}.svg`),svg+'\n');
    const directory=path.join(__dirname,`ios/App/App/Assets.xcassets/${name}.appiconset`);fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,'Contents.json'),JSON.stringify({images:[{filename:`${name}.png`,idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2)+'\n');
    await page.setContent(`<style>html,body{margin:0;width:1024px;height:1024px}svg{width:1024px;height:1024px;display:block}</style>${svg}`);
    await page.screenshot({path:path.join(directory,`${name}.png`)});
  }
  await browser.close();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
