/* Raster outputs derive from the approved outlined brand symbol. Reward icons
   retain their collection artwork and original mark in build_ios_reward_icons. */
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('@playwright/test');

async function main(){
  const root=__dirname;
  const symbol=fs.readFileSync(path.join(root,'assets/brand/mode-atlas-symbol.svg'),'utf8');
  const inner=symbol.slice(symbol.indexOf('>')+1,symbol.lastIndexOf('</svg>'));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#4453d9"/>${inner}</svg>`;
  fs.writeFileSync(path.join(root,'assets/mode-atlas-icon.svg'),svg+'\n');
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  try{
    const page=await browser.newPage({deviceScaleFactor:1});
    for(const [file,size,transparent]of [
      ['assets/favicon-32.png',32,true],['assets/apple-touch-icon.png',180,false],
      ['assets/android-chrome-512.png',512,false],
      ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',1024,false],
      ['ios/App/App/Assets.xcassets/ModeAtlasLaunchMark.imageset/ModeAtlasLaunchMark.png',512,true]
    ]){
      await page.setViewportSize({width:size,height:size});
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${transparent?symbol:svg}`);
      await page.screenshot({path:path.join(root,file),omitBackground:transparent});
    }
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
