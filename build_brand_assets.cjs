/* Brand geometry has two sources: the outlined kana pair and the optically
   spaced wordmark. Every platform/export is derived here, without live fonts. */
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const root=__dirname;
const outlines=[...fs.readFileSync(path.join(root,'assets/brand/mode-atlas-mark.svg'),'utf8').matchAll(/<path[^>]* d="([^"]+)"/g)].map(match=>match[1]);
const wordmark=fs.readFileSync(path.join(root,'assets/brand/mode-atlas-wordmark.svg'),'utf8');
const wordPaths=wordmark.match(/<g fill="currentColor">([\s\S]*?)<\/g>/)[1];
const shell=(width,height,body)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mode Atlas">${body}</svg>\n`;
function symbolBody({base='#4453d9',fold='#9bebd0',ink='#fff',small=false}={}){
  const pair=small?`<path transform="translate(22 102) scale(.084 -.084)" d="${outlines[0]}"/>`:`<path transform="translate(7 75) scale(.071 -.071)" d="${outlines[0]}"/><path transform="translate(52 109) scale(.073 -.073)" d="${outlines[1]}"/>`;
  return `<path d="M28 4h62l34 34v62c0 14-10 24-24 24H28C14 124 4 114 4 100V28C4 14 14 4 28 4Z" fill="${base}"/><path d="M90 4v22c0 7 5 12 12 12h22Z" fill="${fold}"/><g fill="${ink}">${pair}</g>`;
}
const word=(x,y,scale,ink)=>`<g fill="${ink}" transform="translate(${x} ${y}) scale(${scale})">${wordPaths}</g>`;
async function main(){
  const write=(file,body)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),body);};
  const symbol=shell(128,128,symbolBody()),micro=shell(128,128,symbolBody({small:true}));
  const app=shell(128,128,`<path fill="#222949" d="M0 0h128v128H0z"/><g transform="translate(9 9) scale(.86)">${symbolBody()}</g>`);
  write('assets/brand/mode-atlas-symbol.svg',symbol);
  write('assets/brand/mode-atlas-micro.svg',micro);
  write('assets/mode-atlas-icon.svg',app);
  for(const [variant,ink]of [['light','#192235'],['dark','#f5f7ff']]){
    write(`assets/brand/mode-atlas-lockup-${variant}.svg`,shell(556,128,symbolBody()+word(156,24,1,ink)));
    write(`assets/brand/mode-atlas-stacked-${variant}.svg`,shell(440,286,`<g transform="translate(124 8) scale(1.5)">${symbolBody()}</g>`+word(30,214,1,ink)));
  }
  write('assets/brand/mode-atlas-lockup-mono.svg',shell(556,128,`<defs><mask id="cut">${symbolBody({base:'#fff',fold:'#000',ink:'#000'})}</mask></defs><path d="M0 0h128v128H0z" fill="#192235" mask="url(#cut)"/>`+word(156,24,1,'#192235')));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
  try{
    const page=await browser.newPage({deviceScaleFactor:1});
    for(const [file,width,height,svg,transparent]of [
      ['assets/favicon-32.png',32,32,micro,true],['assets/apple-touch-icon.png',180,180,app,false],
      ['assets/android-chrome-512.png',512,512,app,false],
      ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',1024,1024,app,false],
      ['ios/App/App/Assets.xcassets/ModeAtlasLaunchMark.imageset/ModeAtlasLaunchMark.png',512,512,symbol,true],
      ['ios/App/App/Assets.xcassets/ModeAtlasWordmark.imageset/ModeAtlasWordmark.png',760,128,wordmark,true]
    ]){
      fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
      await page.setViewportSize({width,height});
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`);
      await page.screenshot({path:path.join(root,file),omitBackground:transparent});
    }
    write('ios/App/App/Assets.xcassets/ModeAtlasWordmark.imageset/Contents.json',JSON.stringify({images:[{filename:'ModeAtlasWordmark.png',idiom:'universal'}],info:{author:'xcode',version:1},properties:{'template-rendering-intent':'template'}},null,2)+'\n');
  }finally{await browser.close();}
}
module.exports={symbolBody};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
