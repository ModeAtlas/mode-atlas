const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const source = read('assets/css/mode-atlas-ios-theme.css');
const blocks = [...source.matchAll(/html\[data-ma-runtime="ios"\](?:\[data-ma-theme="light"\])?\{([^}]+)\}/g)];
function palette(index) {
  const tokens = {};
  for (const block of blocks.slice(0, index + 1)) {
    for (const match of block[1].matchAll(/--ma-native-([\w-]+):([^;]+);/g)) tokens[match[1]] = match[2].trim();
  }
  const resolve = key => tokens[key].replace(/var\(--ma-native-([\w-]+)\)/g, (_, role) => resolve(role));
  return Object.fromEntries(Object.keys(tokens).map(key => [key, resolve(key)]));
}
function luminance(hex) {
  const rgb = hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value,16)/255)
    .map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  return rgb[0]*.2126 + rgb[1]*.7152 + rgb[2]*.0722;
}
function contrast(a,b) { const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05); }

test('native palette has one scoped colour authority and no component/layout overrides', () => {
  const selectors = [...source.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim());
  for(const selector of selectors) assert.ok(selector.startsWith('html[data-ma-runtime="ios"]') || selector.startsWith('@media'),selector);
  assert.doesNotMatch(source,/!important|\b(?:padding|margin|width|height|display|position):/);
  for(const file of ['assets/css/mode-atlas-ios-home.css','assets/css/mode-atlas-ios-chrome.css']) {
    assert.doesNotMatch(read(file),/#[0-9a-f]{3,8}\b|rgba?\(/i,`${file} must consume palette roles`);
  }
  const legacy = read('assets/css/mode-atlas-theme.css').split('/* Light mode readability:')[1];
  assert.ok(legacy);
  assert.doesNotMatch(legacy,/html\[data-ma-theme="light"\](?!:where\(:not\(\[data-ma-runtime="ios"\]\)\))/);
  const manifest=read('frontend_components.py');
  assert.ok(manifest.indexOf('assets/css/mode-atlas-ios-theme.css') > manifest.indexOf('assets/css/mode-atlas-theme.css'));
});

for(const [index,theme] of ['dark','light'].entries()) test(`${theme} semantic text pairs meet 4.5:1 contrast`,()=>{
  const p=palette(index);
  const pairs=[['primary-text','primary'],['selected-text','selected'],['reading','success-bg'],['danger','danger-bg'],['gold','warning-bg']];
  for(const surface of ['page','surface','elevated','inset','control','hover']) {
    for(const text of ['text','heading','secondary']) pairs.push([text,surface]);
  }
  for(const role of ['reading','writing','kana','gold','danger','rank-1','rank-2','rank-3','rank-4','rank-5']) pairs.push([role,'surface']);
  for(const [fg,bg] of pairs) assert.ok(contrast(p[fg],p[bg])>=4.5,`${theme} ${fg}/${bg}: ${contrast(p[fg],p[bg]).toFixed(2)}`);
});

test('native asset canvas matches the CSS palette for both appearances',()=>{
  const asset=JSON.parse(read('ios/App/App/Assets.xcassets/AppCanvas.colorset/Contents.json'));
  for(const [index,appearance] of ['dark','light'].entries()) {
    const colour=asset.colors.find(item=>appearance==='dark'?item.appearances?.[0]?.value==='dark':!item.appearances);
    const components=colour.color.components;
    const hex='#'+['red','green','blue'].map(c=>parseInt(components[c],16).toString(16).padStart(2,'0')).join('');
    assert.equal(hex,palette(index).page);
  }
  assert.match(read('ios/App/App/Base.lproj/LaunchScreen.storyboard'),/backgroundColor" name="AppCanvas"/);
  assert.doesNotMatch(read('ios/App/App/SceneDelegate.swift'),/red: 18\/255/);
});

test('theme owner updates native chrome and charts while System remains live', async()=>{
  let saved='dark',systemLight=true,mediaListener;
  const nativeCalls=[],events=[],meta={};
  const document={documentElement:{dataset:{}},readyState:'complete',querySelector:()=>meta,querySelectorAll:()=>[],addEventListener:()=>{},dispatchEvent:event=>events.push(event)};
  const window={addEventListener:()=>{},AtlasPlatform:{isNative:true,setAppearance:async pref=>nativeCalls.push(pref)},matchMedia:()=>({get matches(){return systemLight;},addEventListener:(_,cb)=>{mediaListener=cb;}})};
  const context={window,document,console,localStorage:{getItem:()=>saved,setItem:(_,value)=>{saved=value;}},CustomEvent:class {constructor(type,init){this.type=type;this.detail=init.detail;}},getComputedStyle:()=>({getPropertyValue:()=>document.documentElement.dataset.maTheme==='light'?'#f5f5f7':'#101011'})};
  vm.runInNewContext(read('assets/app/mode-atlas-theme.js'),context);
  assert.equal(meta.content,'#101011');
  window.ModeAtlasTheme.set('system',{toast:false});
  assert.equal(document.documentElement.dataset.maTheme,'light');
  assert.equal(nativeCalls.at(-1),'system');
  systemLight=false;mediaListener();
  assert.equal(document.documentElement.dataset.maTheme,'dark');
  assert.equal(saved,'system');
  window.ModeAtlasTheme.set('light',{toast:false});
  mediaListener();
  assert.equal(document.documentElement.dataset.maTheme,'light');
  assert.equal(meta.content,'#f5f5f7');
  assert.deepEqual(events.map(event=>event.detail.effective),['dark','light','dark','light']);
});
