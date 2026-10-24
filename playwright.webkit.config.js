const base=require('./playwright.config');

// Linux WebKit checks another layout engine, not physical iOS text inflation.
// Do not inherit the optional system-Chromium executable from the base config.
module.exports={...base,use:{...base.use,launchOptions:{}},projects:[{
  name:'mobile-webkit',use:{browserName:'webkit',isMobile:true,hasTouch:true,viewport:{width:432,height:640}}
}]};
