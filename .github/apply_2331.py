from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def write(rel, text): (ROOT/rel).write_text(text, encoding='utf-8')
def replace_once(src, old, new, label):
    if src.count(old)!=1: raise RuntimeError(f'{label}: expected 1 occurrence, found {src.count(old)}')
    return src.replace(old,new,1)

visit=read('assets/app/mode-atlas-visit-flows.js')
visit=replace_once(visit,
"  const K={first:'modeAtlasStarterSeen',complete:'modeAtlasOnboardingComplete',pending:'modeAtlasPendingDestination',return:'modeAtlasDailyReturnSeenDate',lastVisit:'modeAtlasLastVisitStudyDate',streak:'modeAtlasVisitStreak',lastStudied:'modeAtlasLastStudiedAt',lastMode:'modeAtlasLastMode',forceFirst:'modeAtlasForceFirstVisit',forceReturn:'modeAtlasForceDailyReturn'};",
"  const K={first:'modeAtlasStarterSeen',complete:'modeAtlasOnboardingComplete',kanaSetup:'modeAtlasKanaSetupComplete',pending:'modeAtlasPendingDestination',return:'modeAtlasDailyReturnSeenDate',lastVisit:'modeAtlasLastVisitStudyDate',streak:'modeAtlasVisitStreak',lastStudied:'modeAtlasLastStudiedAt',lastMode:'modeAtlasLastMode',forceFirst:'modeAtlasForceFirstVisit',forceReturn:'modeAtlasForceDailyReturn'};",
'visit keys')
visit=replace_once(visit,
"  const BRANCH_PATHS=new Set(['/kana/','/reading/','/writing/','/results/','/wordbank/']);\n  const onboardingComplete=()=>storeGet(K.complete)==='true'||storeGet(K.first)==='true';\n  function branchDestination(raw){try{const u=new URL(raw||location.href,location.origin);return u.origin===location.origin&&BRANCH_PATHS.has(u.pathname)?u.pathname+u.search+u.hash:''}catch{return''}}\n  function destinationLabel(raw){const p=branchDestination(raw);if(p.startsWith('/wordbank/'))return'Word Bank';if(p.startsWith('/writing/'))return'Kana Writing';if(p.startsWith('/results/'))return'Kana Results';if(p.startsWith('/reading/'))return'Kana Reading';return'Kana Trainer'}",
"  const BRANCH_PATHS=new Set(['/kana/','/reading/','/writing/','/results/','/wordbank/']);\n  const KANA_SETUP_PATHS=new Set(['/kana/','/reading/','/writing/']);\n  const onboardingComplete=()=>storeGet(K.complete)==='true'||storeGet(K.first)==='true';\n  const kanaSetupComplete=()=>storeGet(K.kanaSetup)==='true'||storeGet(K.first)==='true';\n  function branchDestination(raw){try{const u=new URL(raw||location.href,location.origin);return u.origin===location.origin&&BRANCH_PATHS.has(u.pathname)?u.pathname+u.search+u.hash:''}catch{return''}}\n  function destinationPath(raw){try{return new URL(branchDestination(raw)||raw||location.href,location.origin).pathname}catch{return''}}\n  function requiresKanaSetup(raw){return KANA_SETUP_PATHS.has(destinationPath(raw))}\n  function destinationLabel(raw){const p=branchDestination(raw);if(p.startsWith('/wordbank/'))return'Word Bank';if(p.startsWith('/writing/'))return'Kana Writing';if(p.startsWith('/results/'))return'Kana Results';if(p.startsWith('/reading/'))return'Kana Reading';return'Kana Trainer'}\n  function needsSetup(raw){return !onboardingComplete()||(requiresKanaSetup(raw)&&!kanaSetupComplete())}",
'visit setup helpers')
visit=replace_once(visit,
"  function closeModal(force){const modal=document.getElementById('maVisitModal'); if(!modal)return; if(modal.dataset.locked==='true' && force!==true)return; modal.classList.remove('open'); modal.dataset.locked='false'; try{document.dispatchEvent(new CustomEvent('ma:visit-flow-closed'))}catch{}}",
"  function openModal(locked=false){const modal=document.getElementById('maVisitModal');if(!modal)return;modal.dataset.locked=locked?'true':'false';modal.classList.add('open');try{document.dispatchEvent(new CustomEvent('ma:visit-flow-opened'))}catch{}}\n  function closeModal(force,resumeInstall=true){const modal=document.getElementById('maVisitModal'); if(!modal)return; if(modal.dataset.locked==='true' && force!==true)return; modal.classList.remove('open'); modal.dataset.locked='false'; try{document.dispatchEvent(new CustomEvent('ma:visit-flow-closed',{detail:{resumeInstall}}))}catch{}}",
'modal state events')

new_first=r'''  function markLegalComplete(){
    storeSet(K.complete,'true');
    storeSet('modeAtlasLegalAccepted','true');
    storeSet('modeAtlasLegalAcceptedAt',String(Date.now()));
    storeSet('modeAtlasLegalVersion','2026-05');
  }
  function markKanaSetupComplete(){
    storeSet(K.kanaSetup,'true');
    storeSet(K.first,'true');
  }
  function first(destination,options={}){
    ensure();
    const target=branchDestination(destination)||branchDestination(storeGet(K.pending))||'/kana/';
    storeSet(K.pending,target);
    const force=options.force===true;
    const requireLegal=force||!onboardingComplete();
    const requireKana=requiresKanaSetup(target)&&(force||!kanaSetupComplete());
    if(!requireLegal&&!requireKana){storeRemove(K.pending);navigateApp(target);return;}

    const c=document.getElementById('maVisitContent');
    const presets=[
      ['starter','Starter','あ row + hint mode. Best if kana is brand new.'],
      ['intermediate','Intermediate','All hiragana rows with hints off.'],
      ['advanced','Advanced','Hiragana, katakana, and dakuten.'],
      ['pro','Pro','Everything enabled, including yōon and extended katakana.']
    ];
    c.replaceChildren();

    let copy='Review the Privacy Policy and Terms of Use, then continue to '+destinationLabel(target)+'.';
    if(requireKana&&requireLegal) copy='Choose your Kana Trainer starting level, agree to the terms, then continue to '+destinationLabel(target)+'.';
    else if(requireKana) copy='Choose the Kana Trainer starting level that feels right for you. You can change it whenever you want.';
    c.append(
      vEl('div','ma-visit-kicker',requireKana?'Kana Trainer setup':'Mode Atlas setup'),
      vEl('h2','ma-visit-title',requireKana&&!requireLegal?'Set up Kana Trainer':'Welcome to Mode Atlas'),
      vEl('p','ma-visit-copy',copy)
    );

    let selected='';
    if(requireKana){
      const panel=vEl('div','ma-card ma-card--soft ma-visit-panel');
      panel.append(vEl('div','ma-visit-label','Starting level'));
      const presetGrid=vEl('div','ma-visit-presets');
      presets.forEach(preset=>{
        const btn=vBtn('ma-visit-preset');
        btn.dataset.maOnboardingPreset=preset[0];
        btn.setAttribute('aria-pressed','false');
        btn.append(vEl('span','',preset[1]),vEl('small','',preset[2]));
        presetGrid.append(btn);
      });
      panel.append(presetGrid);
      c.append(panel);
    }

    let agree=null;
    if(requireLegal){
      const legal=vEl('div','ma-visit-legal');
      const links=vEl('div','ma-visit-legal-links');
      const privacy=vLink('', 'Privacy Policy', legalUrl('privacy'));
      privacy.target='_blank';privacy.rel='noopener';
      const terms=vLink('', 'Terms of Use', legalUrl('terms'));
      terms.target='_blank';terms.rel='noopener';
      links.append(privacy,terms);
      const label=vEl('label','ma-check ma-visit-check');
      agree=document.createElement('input');
      agree.type='checkbox';
      agree.dataset.legalAgree='';
      label.append(agree,vEl('span','','I agree to the Privacy Policy and Terms of Use.'));
      legal.append(links,label);
      c.append(legal);
    }

    const err=vEl('div','ma-status ma-status--error ma-visit-error','Could not save your starting level. Please try again.');
    err.dataset.setupError='';
    const actions=vEl('div','ma-visit-actions');
    const begin=vBtn('ma-button ma-button--primary ma-visit-btn',`Continue to ${destinationLabel(target)}`);
    begin.dataset.begin='';
    actions.append(begin);
    c.append(err,actions);

    function refresh(){
      const ready=(!requireKana||Boolean(selected))&&(!requireLegal||Boolean(agree?.checked));
      begin.disabled=!ready;
      begin.setAttribute('aria-disabled',ready?'false':'true');
      begin.classList.toggle('ready',ready);
      c.classList.toggle('ma-visit-ready',ready);
      if(ready)err.classList.remove('show');
    }
    if(requireKana){
      c.addEventListener('click',event=>{
        const preset=event.target.closest('[data-ma-onboarding-preset]');
        if(!preset||!c.contains(preset))return;
        event.preventDefault();
        selected=preset.getAttribute('data-ma-onboarding-preset')||'';
        c.querySelectorAll('[data-ma-onboarding-preset]').forEach(btn=>{
          const on=btn===preset;
          btn.classList.toggle('selected',on);
          btn.setAttribute('aria-pressed',on?'true':'false');
        });
        refresh();
      });
    }
    if(agree){agree.addEventListener('change',refresh);agree.addEventListener('input',refresh);}
    begin.addEventListener('click',()=>{
      if(begin.disabled)return;
      if(requireKana){
        const applied=window.ModeAtlasPresets?.apply?.(selected,{target:'both',source:'onboarding'});
        if(!applied){err.classList.add('show');return;}
        markKanaSetupComplete();
      }
      if(requireLegal)markLegalComplete();
      storeSet(K.return,studyDate());
      if(requireLegal)sessionStorage.setItem('modeAtlasShowWhatsNewAfterOnboarding','1');
      const next=branchDestination(storeGet(K.pending))||target;
      storeRemove(K.pending);
      closeModal(true,false);
      if(requireLegal){try{document.dispatchEvent(new CustomEvent('ma:onboarding-complete'))}catch{}}
      if(requireKana){try{document.dispatchEvent(new CustomEvent('ma:kana-setup-complete'))}catch{}}
      navigateApp(next);
    });
    openModal(true);
    refresh();
  }
'''
visit, count=re.subn(r"  function first\(destination\)\{[\s\S]*?\n  function ret\(\)\{", new_first+"  function ret(){", visit, count=1)
if count!=1: raise RuntimeError('replace first flow failed')
visit=replace_once(visit,"    document.getElementById('maVisitModal').classList.add('open');","    openModal(false);",'return modal open')
new_tail=r'''  let visitDecisionMade=false;
  async function waitForInitialCloudState(){
    let initialCloudReady=true;
    try{
      if(window.KanaCloudSync?.waitForInitialHydration)initialCloudReady=await window.KanaCloudSync.waitForInitialHydration();
      else if(window.KanaCloudSync?.beforePageLoad)await window.KanaCloudSync.beforePageLoad();
      else if(window.KanaCloudSync?.ready)await window.KanaCloudSync.ready;
    }catch{initialCloudReady=false}
    return initialCloudReady;
  }
  async function maybe(){
    if(visitDecisionMade)return;
    const q=new URLSearchParams(location.search),ff=sessionStorage.getItem(K.forceFirst)==='1'||q.has('devFirstVisit')||q.has('setup'),fr=sessionStorage.getItem(K.forceReturn)==='1'||q.has('devReturn');
    sessionStorage.removeItem(K.forceFirst);sessionStorage.removeItem(K.forceReturn);storeRemove(K.forceFirst);storeRemove(K.forceReturn);
    const initialCloudReady=await waitForInitialCloudState();
    if(visitDecisionMade)return;
    if(ff){visitDecisionMade=true;return first(branchDestination(location.href)||'/kana/',{force:true});}
    if(fr){visitDecisionMade=true;return ret();}
    if(!initialCloudReady&&window.KanaCloudSync?.getUser?.())return;
    const current=branchDestination(location.href);
    if(!current){if(onboardingComplete()&&hasData())streak();return;}
    if(needsSetup(current)){visitDecisionMade=true;return first(current);}
    if(hasData())streak();
  }
  function triggerFirst(){storeRemove(K.forceFirst);sessionStorage.removeItem(K.forceFirst);first(branchDestination(location.href)||'/kana/',{force:true})}
  function triggerReturn(){storeRemove(K.forceReturn);sessionStorage.removeItem(K.forceReturn);if(page()==='index.html')ret();else{sessionStorage.setItem(K.forceReturn,'1');navigateApp('/?devReturn=1')}}
  function reset(){[K.first,K.complete,K.kanaSetup,K.pending,K.return,K.forceFirst,K.forceReturn,K.lastVisit,K.streak].forEach(k=>storeRemove(k));console.info('Mode Atlas visit flags reset')}
  window.modeAtlasTriggerFirstVisit=triggerFirst;window.modeAtlasTriggerDailyReturn=triggerReturn;window.modeAtlasResetVisitFlags=reset;
  async function gateLink(event){
    if(event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest?.('a[href]');if(!link)return;
    const target=branchDestination(link.href);if(!target||!needsSetup(target))return;
    event.preventDefault();
    const cloudReady=await waitForInitialCloudState();
    if(!cloudReady&&window.KanaCloudSync?.getUser?.()){navigateApp(target);return;}
    if(!needsSetup(target)){navigateApp(target);return;}
    visitDecisionMade=true;
    first(target);
  }
  function init(){track();document.addEventListener('click',gateLink);maybe();window.addEventListener('kanaCloudSyncStatusChanged',maybe);document.addEventListener('ma:ui-refresh',maybe)} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();'''
visit, count=re.subn(r"  let visitDecisionMade=false;[\s\S]*?\n\}\)\(\);\s*$", new_tail, visit, count=1)
if count!=1: raise RuntimeError('replace visit tail failed')
write('assets/app/mode-atlas-visit-flows.js',visit)

pwa=read('assets/app/mode-atlas-pwa.js')
pwa=replace_once(pwa,"  function showInstallPrompt(){\n    if ($('#maInstallPrompt') || !deferredPrompt || hasSeenPrompt() || isStandalone()) return;",
"  function visitFlowOpen(){ return !!$('#maVisitModal.open'); }\n  function showInstallPrompt(){\n    if ($('#maInstallPrompt') || !deferredPrompt || hasSeenPrompt() || isStandalone() || visitFlowOpen()) return;",'pwa visit guard')
pwa=replace_once(pwa,"  window.addEventListener('appinstalled', () => {",
"  document.addEventListener('ma:visit-flow-opened', () => { $('#maInstallPrompt')?.remove(); });\n  document.addEventListener('ma:visit-flow-closed', event => {\n    if (event.detail?.resumeInstall === false) return;\n    if (deferredPrompt && !hasSeenPrompt() && !isStandalone()) showInstallPrompt();\n  });\n  window.addEventListener('appinstalled', () => {",'pwa visit events')
write('assets/app/mode-atlas-pwa.js',pwa)

css=read('assets/css/mode-atlas-app-modals.css')
css=replace_once(css,'.ma-visit-error{display:none;margin-top:10px}.ma-visit-error.show{display:flex}',
'.ma-status.ma-visit-error{display:none;margin-top:10px}.ma-status.ma-visit-error.show{display:flex}','visit error specificity')
write('assets/css/mode-atlas-app-modals.css',css)

version=read('assets/app/mode-atlas-version.js').replace("var VERSION = '2.33.0';","var VERSION = '2.33.1';").replace("var CACHE_REVISION = 'assets-2.33.0';","var CACHE_REVISION = 'assets-2.33.1';")
write('assets/app/mode-atlas-version.js',version)
for rel in ('package.json','package-lock.json'):
    data=json.loads(read(rel))
    data['version']='2.33.1'
    if rel=='package-lock.json':
        data.setdefault('packages',{}).setdefault('',{})['version']='2.33.1'
    write(rel,json.dumps(data,indent=2)+"\n")
readme=read('README.md').replace('Version: 2.33.0','Version: 2.33.1')
write('README.md',readme)
changelog=read('CHANGELOG.md')
entry="""## 2.33.1 - 2026-08-16
- Split first-use setup into general Mode Atlas consent and Kana-specific starting-level setup so Word Bank no longer asks for irrelevant Kana presets.
- Preserved the chosen destination through setup and defers Kana starting-level selection until the learner actually enters Kana, Reading, or Writing.
- Fixed Word Bank first-use completion by removing its dependency on the Kana preset module rather than loading unrelated trainer code into Word Bank.
- Prevented the install prompt from overlapping visit/setup dialogs and corrected setup-error visibility so validation feedback only appears when a real save failure occurs.

"""
if not changelog.startswith('## 2.33.1'):
    changelog=entry+changelog
write('CHANGELOG.md',changelog)

tests=read('tests/frontend.test.js')
append=r'''

test('2.33.1 onboarding separates Mode Atlas consent from Kana branch setup', () => {
  const visit = read('assets/app/mode-atlas-visit-flows.js');
  const pwa = read('assets/app/mode-atlas-pwa.js');
  const modalCss = read('assets/css/mode-atlas-app-modals.css');
  const wordbank = read('wordbank/index.html');
  assert.match(visit, /kanaSetup:'modeAtlasKanaSetupComplete'/);
  assert.match(visit, /KANA_SETUP_PATHS=new Set\(\['\/kana\/','\/reading\/','\/writing\/'\]\)/);
  assert.match(visit, /const requireLegal=force\|\|!onboardingComplete\(\)/);
  assert.match(visit, /const requireKana=requiresKanaSetup\(target\)&&\(force\|\|!kanaSetupComplete\(\)\)/);
  assert.match(visit, /if\(requireKana\)\{[\s\S]*ModeAtlasPresets\?\.apply/);
  assert.match(visit, /if\(requireLegal\)markLegalComplete\(\)/);
  assert.doesNotMatch(wordbank, /mode-atlas-presets\.assets-/);
  assert.match(pwa, /ma:visit-flow-opened/);
  assert.match(pwa, /ma:visit-flow-closed/);
  assert.match(modalCss, /\.ma-status\.ma-visit-error\{display:none/);
});
'''
if "2.33.1 onboarding separates Mode Atlas consent" not in tests:
    tests=tests.rstrip()+append
write('tests/frontend.test.js',tests)
