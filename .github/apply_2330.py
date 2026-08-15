from pathlib import Path
import re

OLD='2.32.0'; NEW='2.33.0'

def req(path, old, new, count=None):
    p=Path(path); s=p.read_text()
    if old not in s: raise SystemExit(f'missing expected text in {path}: {old[:90]!r}')
    p.write_text(s.replace(old,new) if count is None else s.replace(old,new,count))

def sub(path, pattern, repl, count=1):
    p=Path(path); s=p.read_text(); out,n=re.subn(pattern,repl,s,count=count,flags=re.S)
    if n!=count: raise SystemExit(f'expected {count} replacement in {path}, got {n}')
    p.write_text(out)

# Release metadata
req('assets/app/mode-atlas-version.js',"var VERSION = '2.32.0';","var VERSION = '2.33.0';")
req('assets/app/mode-atlas-version.js',"var CACHE_REVISION = 'assets-2.32.0';","var CACHE_REVISION = 'assets-2.33.0';")
sub('assets/app/mode-atlas-version.js',r"var BUILD_DATE = '[^']+';","var BUILD_DATE = '2026-08-16';")
for f in ('package.json','package-lock.json','README.md'):
    p=Path(f); p.write_text(p.read_text().replace(OLD,NEW))
ch=Path('CHANGELOG.md'); txt=ch.read_text()
if not txt.startswith('## 2.33.0'):
    ch.write_text('''## 2.33.0 - 2026-08-16
- Restructured Atlas into a clean ecosystem homepage with distinct visitor and returning-user hero states and no study-stat dashboard on the homepage.
- Changed first-use onboarding from an automatic homepage interruption into a destination-aware branch-entry gate that resumes the user’s chosen branch after setup.
- Reframed Kana as the Kana Trainer sub-homepage with a calmer action-first introduction, dedicated Reading/Writing/Results paths, and progress reporting moved below the introductory area.
- Preserved trainer algorithms, result storage, cloud/save ownership, Service Worker retirement, and update/version behavior while rebuilding revisioned assets and regression coverage.

'''+txt)

# Atlas page
index=Path('index.html'); s=index.read_text()
main='''  <main class="shell ma-page-frame">
    <section class="hero ma-page-hero">
      <div class="atlas-card ma-card">
        <div class="hero-grid">
          <div class="atlas-hero-copy">
            <div data-ma-home-visitor>
              <div class="eyebrow ma-kicker">Japanese learning, mapped clearly</div>
              <h1>Build confidence one skill at a time.</h1>
              <p class="hero-line">Practise kana, grow your vocabulary, and keep moving forward with focused tools for each part of your Japanese learning.</p>
              <div class="atlas-hero-actions ma-action-row">
                <a class="ma-button ma-button--primary atlas-primary-action" href="/kana/" data-ma-branch-entry><svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg><span>Explore Kana Trainer</span></a>
                <a class="ma-button ma-button--ghost" href="#branches">Explore Mode Atlas</a>
              </div>
            </div>
            <div data-ma-home-user hidden>
              <div class="eyebrow ma-kicker">Welcome back</div>
              <h1>Ready for your next session?</h1>
              <p class="hero-line">Pick up where you left off, or choose another way to study.</p>
              <div class="home-continue ma-inset" id="homeContinueCard" aria-live="polite">
                <div class="home-continue__copy"><span class="ma-kicker">Continue studying</span><strong id="homeContinueTitle">Kana Reading</strong><span id="homeContinueMeta">Ready when you are</span></div>
                <a class="ma-button ma-button--primary home-continue__action" id="homeContinueAction" href="/reading/" data-ma-branch-entry><svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-play"></use></svg><span>Continue</span></a>
              </div>
            </div>
          </div>
          <div class="constellation" aria-label="Mode Atlas learning tools">
            <div class="node one" aria-hidden="true">か<span>Kana</span></div><div class="node two" aria-hidden="true">語<span>Words</span></div><div class="node three" aria-hidden="true">学<span>Atlas</span></div><div class="node four" aria-hidden="true">読<span>Reading</span></div><div class="node five" aria-hidden="true">文<span>More ahead</span></div>
          </div>
        </div>
      </div>
    </section>
    <section class="branches ma-page-section" id="branches">
      <div class="section-head"><div><div class="section-kicker">Learn your way</div><h2>Choose what you want to build next.</h2></div></div>
      <div class="branch-grid">
        <a class="branch kana" href="/kana/" data-ma-branch-entry><div class="branch-top"><div class="branch-meta"><div class="branch-label">Kana Trainer</div><div class="branch-chip">Available</div></div><div class="branch-title">Make kana feel automatic.</div><div class="branch-copy">Build fast recognition and confident recall across hiragana, katakana, dakuten, yōon, and more.</div></div><div class="branch-bottom"><span>Open Kana Trainer</span><span class="branch-arrow" aria-hidden="true"><svg class="ma-icon"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></span></div></a>
        <a class="branch words" href="/wordbank/" data-ma-branch-entry><div class="branch-top"><div class="branch-meta"><div class="branch-label">Word Bank</div><div class="branch-chip">Available</div></div><div class="branch-title">Keep the words worth remembering.</div><div class="branch-copy">Save Japanese vocabulary in your own collection so the words you meet have somewhere useful to live.</div></div><div class="branch-bottom"><span>Open Word Bank</span><span class="branch-arrow" aria-hidden="true"><svg class="ma-icon"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></span></div></a>
      </div>
    </section>
    <section class="atlas-benefits ma-page-section" aria-label="What Mode Atlas helps you do">
      <div class="atlas-benefit"><span class="section-kicker">Practise</span><strong>Turn recognition into instinct.</strong><p>Short, focused sessions help you spend more time recalling Japanese and less time searching for what to study.</p></div>
      <div class="atlas-benefit"><span class="section-kicker">Remember</span><strong>Keep useful Japanese close.</strong><p>Build a vocabulary collection around the words you actually want to remember.</p></div>
      <div class="atlas-benefit"><span class="section-kicker">Grow</span><strong>More ways to learn are on the way.</strong><p>Kana and vocabulary are the beginning, with new Japanese learning tools planned for Mode Atlas.</p></div>
    </section>
    <section class="future-section ma-page-section" aria-labelledby="futureTitle"><div class="section-head"><div><div class="section-kicker">Coming later</div><h2 id="futureTitle">More Japanese, one step at a time.</h2></div></div><div class="future-row" aria-label="Future learning tools"><div class="future-tile"><span>Coming soon</span><strong>Listening</strong></div><div class="future-tile"><span>Coming soon</span><strong>Grammar</strong></div><div class="future-tile"><span>Coming soon</span><strong>Reading Comprehension</strong></div></div></section>
    <footer class="footer"><div><strong>Mode Atlas</strong> · Japanese learning · v<span data-ma-app-version></span></div><div><a href="/">mode-atlas.app</a> · <a href="mailto:support@mode-atlas.com">support@mode-atlas.com</a></div></footer>
  </main>'''
s,n=re.subn(r'  <main class="shell ma-page-frame">[\s\S]*?</main>',main,s,count=1)
if n!=1: raise SystemExit('Atlas main block not found')
s=s.replace('Mode Atlas is a Japanese study app for learning kana, practising hiragana and katakana, tracking progress, and building a personal vocabulary bank.','Mode Atlas brings focused Japanese learning tools together for kana practice, vocabulary building, and more ways to learn over time.')
index.write_text(s)

Path('assets/pages/mode-atlas-home-page.js').write_text(r'''(function ModeAtlasHomePage(){
  'use strict';
  if(window.__modeAtlasHomePageLoaded)return; window.__modeAtlasHomePageLoaded=true;
  const Store=window.ModeAtlasStorage,$=selector=>document.querySelector(selector);
  function read(key,fallback=''){try{return Store?.get?.(key,fallback)??fallback}catch{return fallback}}
  function readJSON(key,fallback){try{return Store?.json?.(key,fallback)??fallback}catch{return fallback}}
  const onboarded=()=>read('modeAtlasOnboardingComplete','')==='true'||read('modeAtlasStarterSeen','')==='true';
  function relativeTime(value){const ts=Number(value||0);if(!ts)return'Ready when you are';const m=Math.floor(Math.max(0,Date.now()-ts)/60000);if(m<1)return'Last studied just now';if(m<60)return`Last studied ${m}m ago`;const h=Math.floor(m/60);if(h<24)return`Last studied ${h}h ago`;return`Last studied ${Math.floor(h/24)}d ago`}
  function normalizeHref(raw){const href=String(raw||'').toLowerCase();if(href.includes('reverse')||href.includes('/writing'))return'/writing/';if(href.includes('wordbank'))return'/wordbank/';if(href.includes('results')||href.includes('test.html'))return'/results/';if(href.includes('kana'))return'/kana/';return'/reading/'}
  function normalizeTitle(last){const page=String(last?.page||'').trim();if(/writing/i.test(page))return'Kana Writing';if(/word bank/i.test(page))return'Word Bank';if(/results/i.test(page))return'Test Results';if(/kana/i.test(page)&&!/reading/i.test(page))return'Kana Trainer';return'Kana Reading'}
  function render(){const isUser=onboarded();document.body.dataset.maHomeState=isUser?'returning':'visitor';document.querySelectorAll('[data-ma-home-visitor]').forEach(el=>{el.hidden=isUser});document.querySelectorAll('[data-ma-home-user]').forEach(el=>{el.hidden=!isUser});if(!isUser)return;const last=readJSON('modeAtlasLastMode',null),action=$('#homeContinueAction'),title=$('#homeContinueTitle'),meta=$('#homeContinueMeta');if(action)action.href=normalizeHref(last?.href);if(title)title.textContent=normalizeTitle(last);if(meta)meta.textContent=relativeTime(read('modeAtlasLastStudiedAt','0'))}
  render();document.addEventListener('ma:ui-refresh',render);document.addEventListener('ma:onboarding-complete',render);window.addEventListener('modeAtlasCloudDataChanged',render);window.addEventListener('pageshow',event=>{if(event.persisted)render()});
})();
''')

# Atlas CSS additions + remove obsolete homepage stat block
hp=Path('assets/css/mode-atlas-home-page.css'); css=hp.read_text()
css=re.sub(r'\.home-study-status\{[\s\S]*?\.home-status-item strong\{[\s\S]*?\}\n','',css,count=1)
css += '''\n/* 2.33 Atlas homepage hierarchy */\n[data-ma-home-visitor][hidden],[data-ma-home-user][hidden]{display:none!important;}\n.atlas-hero-actions{--ma-action-gap:12px;margin-top:clamp(26px,4vw,38px);}\n.atlas-primary-action{--ma-button-bg:linear-gradient(180deg,color-mix(in srgb,var(--ma-atlas) 35%,var(--ma-card-2)),color-mix(in srgb,var(--ma-atlas) 20%,var(--ma-card-3)));--ma-button-border:color-mix(in srgb,var(--ma-atlas) 58%,var(--ma-border));}\n.atlas-benefits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ma-space-4);padding-block:clamp(32px,5vw,64px);}\n.atlas-benefit{min-width:0;padding:clamp(22px,3vw,30px);border-top:1px solid var(--ma-border);}\n.atlas-benefit strong{display:block;margin-top:10px;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.28rem,2.3vw,1.8rem);line-height:1.08;letter-spacing:-.03em;}\n.atlas-benefit p{margin:12px 0 0;color:var(--ma-muted);line-height:1.65;}\n.future-section{padding-block:clamp(26px,4vw,48px) clamp(42px,6vw,72px);}\nbody[data-ma-home-state="visitor"] .atlas-card{--ma-card-bg:radial-gradient(circle at 85% 12%,color-mix(in srgb,var(--ma-atlas) 17%,transparent),transparent 36%),radial-gradient(circle at 5% 92%,color-mix(in srgb,var(--ma-kana) 8%,transparent),transparent 32%),var(--ma-surface);}\nbody[data-ma-home-state="returning"] .atlas-card{--ma-card-bg:radial-gradient(circle at 86% 10%,color-mix(in srgb,var(--ma-reading) 10%,transparent),transparent 34%),radial-gradient(circle at 9% 94%,color-mix(in srgb,var(--ma-atlas) 12%,transparent),transparent 32%),var(--ma-surface);}\n@media(max-width:820px){.atlas-benefits{grid-template-columns:1fr}.atlas-benefit{padding-inline:4px}.atlas-hero-actions{align-items:stretch}.atlas-hero-actions .ma-button{width:100%}}\n'''
hp.write_text(css)

# Kana top hierarchy
kana=Path('kana/index.html'); ks=kana.read_text()
m=re.search(r'    <section class="kana-hub-hero[\s\S]*?    </section>\n\n    <main class="kana-hub ma-page-section" id="kanaHub">',ks)
if not m: raise SystemExit('Kana hero block not found')
block='''    <section class="kana-hub-hero glass ma-card ma-page-hero">
        <div class="kana-hero-main"><div class="hero-tagline"><span aria-hidden="true">かな</span><span class="ma-kicker">Kana Trainer</span></div><h1>Build kana confidence.</h1><p class="kana-hero-lead">Practise recognition and recall until hiragana and katakana feel natural.</p><div class="kana-hero-actions ma-action-row"><a class="kana-primary-action ma-button" id="kanaContinueAction" href="/reading/"><svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-play"></use></svg><span class="kana-primary-action__copy"><span>Continue practice</span><strong id="kanaContinueHint">Recommended next step</strong></span></a></div></div>
    </section>
    <section class="kana-pathways ma-page-section" aria-label="Kana Trainer study areas">
        <a class="kana-pathway kana-pathway--reading" href="/reading/"><span class="ma-kicker">Recognise</span><strong>Reading</strong><p>See kana and recall the matching romaji quickly and accurately.</p><span class="kana-pathway__action">Start reading <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></span></a>
        <a class="kana-pathway kana-pathway--writing" href="/writing/"><span class="ma-kicker">Recall</span><strong>Writing</strong><p>See the romaji and choose or type the kana from memory.</p><span class="kana-pathway__action">Start writing <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></span></a>
        <a class="kana-pathway kana-pathway--results" href="/results/"><span class="ma-kicker">Understand</span><strong>Results</strong><p>Review formal tests, performance trends, and the kana that need more work.</p><span class="kana-pathway__action">View results <svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-arrow"></use></svg></span></a>
    </section>
    <main class="kana-hub ma-page-section" id="kanaHub">
        <header class="kana-progress-intro"><span class="ma-kicker">Your progress</span><h2>See where to focus next.</h2><p>Your practice history, mastery, and recommendations live here when you want the detail.</p></header>
        <section class="kana-today-card ma-card ma-card--flat" id="kanaTodayCard" aria-live="polite"><div class="ma-skeleton-text">Progress snapshot</div><div class="ma-skeleton-block"></div><div class="ma-skeleton-block"></div></section>'''
ks=ks[:m.start()]+block+ks[m.end():]; kana.write_text(ks)

kp=Path('assets/css/mode-atlas-kana-page.css'); kc=kp.read_text()
kc=kc.replace('''    display: grid;\n    grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr);\n    gap: clamp(20px, 4vw, 48px);\n    align-items: stretch;''','''    display: block;''')
kc=kc.replace('font-size: clamp(3rem, 7vw, 6.4rem);','font-size: clamp(2.8rem, 6vw, 5.4rem);',1)
kc += '''\n/* 2.33 Kana sub-homepage hierarchy */\n.kana-hub-hero{padding-block:clamp(34px,6vw,72px);}\n.kana-hero-main{max-width:920px;}\n.kana-pathways{width:min(1180px,calc(100vw - 48px));margin:0 auto;padding-block:clamp(18px,3vw,32px) clamp(44px,6vw,72px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ma-space-4);}\n.kana-pathway{min-width:0;display:flex;flex-direction:column;min-height:220px;padding:clamp(20px,3vw,28px);border:1px solid var(--ma-border);border-radius:var(--ma-radius-lg);background:var(--ma-surface-soft);box-shadow:var(--ma-shadow-soft);color:inherit;text-decoration:none;transition:transform var(--ma-motion-fast) ease,border-color var(--ma-motion-fast) ease,box-shadow var(--ma-motion-fast) ease;}\n.kana-pathway:hover{transform:translateY(-2px);box-shadow:var(--ma-shadow);}.kana-pathway:focus-visible{outline:3px solid var(--ma-focus-ring);outline-offset:3px;}\n.kana-pathway--reading:hover{border-color:color-mix(in srgb,var(--ma-reading) 48%,var(--ma-border));}.kana-pathway--writing:hover{border-color:color-mix(in srgb,var(--ma-writing) 48%,var(--ma-border));}.kana-pathway--results:hover{border-color:color-mix(in srgb,var(--ma-results) 48%,var(--ma-border));}\n.kana-pathway strong{margin-top:12px;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(1.7rem,3vw,2.5rem);line-height:1;letter-spacing:-.04em;}.kana-pathway p{margin:12px 0 24px;color:var(--ma-muted);line-height:1.55;}\n.kana-pathway__action{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:14px;border-top:1px solid var(--ma-border);font-weight:850;color:var(--ma-text-soft);}.kana-pathway__action .ma-icon{width:18px;height:18px;}\n.kana-progress-intro{width:min(920px,100%);margin:0 0 clamp(20px,3vw,32px);}.kana-progress-intro h2{margin:7px 0 0;color:var(--ma-text-strong);font-family:var(--ma-font-display);font-size:clamp(2rem,4vw,3.2rem);letter-spacing:-.04em;}.kana-progress-intro p{margin:10px 0 0;color:var(--ma-muted);line-height:1.6;}\n#kanaHub>.kana-today-card{margin-bottom:var(--ma-space-4);}\n@media(max-width:900px){.kana-pathways{grid-template-columns:1fr}.kana-pathway{min-height:0}}\n@media(max-width:600px){.kana-pathways{width:calc(100vw - 28px);padding-bottom:38px}.kana-hub-hero{padding-block:30px}}\n'''; kp.write_text(kc)

# Single onboarding owner becomes destination-aware and does not interrupt Atlas load.
vf=Path('assets/app/mode-atlas-visit-flows.js'); v=vf.read_text()
v=v.replace("const K={first:'modeAtlasStarterSeen',return:'modeAtlasDailyReturnSeenDate',lastVisit:'modeAtlasLastVisitStudyDate',streak:'modeAtlasVisitStreak',lastStudied:'modeAtlasLastStudiedAt',lastMode:'modeAtlasLastMode',forceFirst:'modeAtlasForceFirstVisit',forceReturn:'modeAtlasForceDailyReturn'};","const K={first:'modeAtlasStarterSeen',complete:'modeAtlasOnboardingComplete',pending:'modeAtlasPendingDestination',return:'modeAtlasDailyReturnSeenDate',lastVisit:'modeAtlasLastVisitStudyDate',streak:'modeAtlasVisitStreak',lastStudied:'modeAtlasLastStudiedAt',lastMode:'modeAtlasLastMode',forceFirst:'modeAtlasForceFirstVisit',forceReturn:'modeAtlasForceDailyReturn'};")
v=v.replace("  function vEl(tag, className='', text=''){","  const BRANCH_PATHS=new Set(['/kana/','/reading/','/writing/','/results/','/wordbank/']);\n  const onboardingComplete=()=>storeGet(K.complete)==='true'||storeGet(K.first)==='true';\n  function branchDestination(raw){try{const u=new URL(raw||location.href,location.origin);return u.origin===location.origin&&BRANCH_PATHS.has(u.pathname)?u.pathname+u.search+u.hash:''}catch{return''}}\n  function destinationLabel(raw){const p=branchDestination(raw);if(p.startsWith('/wordbank/'))return'Word Bank';if(p.startsWith('/writing/'))return'Kana Writing';if(p.startsWith('/results/'))return'Kana Results';if(p.startsWith('/reading/'))return'Kana Reading';return'Kana Trainer'}\n  function vEl(tag, className='', text=''){")
v=v.replace('  function first(){\n    ensure();','  function first(destination){\n    ensure();\n    const target=branchDestination(destination)||branchDestination(storeGet(K.pending))||\'/kana/\';\n    storeSet(K.pending,target);')
v=v.replace("vEl('p','ma-visit-copy','Choose a starting preset for Mode Atlas. This sets your first study session layout for all our branches and can be changed or customised later. We will also send you to Kana Trainer - Reading mode to get you started.')","vEl('p','ma-visit-copy',`Choose your Kana Trainer starting level, then continue to ${destinationLabel(target)}. You can change your practice setup whenever you want.`)")
v=v.replace("      closeModal(true);\n      navigateApp('reading/');","      const destination=branchDestination(storeGet(K.pending))||'/kana/';\n      storeRemove(K.pending);\n      closeModal(true);\n      try{document.dispatchEvent(new CustomEvent('ma:onboarding-complete'))}catch{}\n      navigateApp(destination);")
pat=r"  let visitDecisionMade=false;\n  async function maybe\(\)\{[\s\S]*?\n  function triggerFirst\(\)"
rep="""  let visitDecisionMade=false;\n  async function maybe(){\n    if(visitDecisionMade)return;\n    const q=new URLSearchParams(location.search),ff=sessionStorage.getItem(K.forceFirst)==='1'||q.has('devFirstVisit')||q.has('setup'),fr=sessionStorage.getItem(K.forceReturn)==='1'||q.has('devReturn');\n    sessionStorage.removeItem(K.forceFirst);sessionStorage.removeItem(K.forceReturn);storeRemove(K.forceFirst);storeRemove(K.forceReturn);\n    let initialCloudReady=true;\n    try{\n      if(window.KanaCloudSync?.waitForInitialHydration)initialCloudReady=await window.KanaCloudSync.waitForInitialHydration();\n      else if(window.KanaCloudSync?.beforePageLoad)await window.KanaCloudSync.beforePageLoad();\n      else if(window.KanaCloudSync?.ready)await window.KanaCloudSync.ready;\n    }catch{initialCloudReady=false}\n    if(visitDecisionMade)return;\n    if(ff){visitDecisionMade=true;return first(branchDestination(location.href)||'/kana/');}\n    if(fr){visitDecisionMade=true;return ret();}\n    if(!initialCloudReady&&window.KanaCloudSync?.getUser?.())return;\n    if(onboardingComplete()){if(hasData())streak();return;}\n    const current=branchDestination(location.href);\n    if(current){visitDecisionMade=true;return first(current);}\n  }\n  function triggerFirst()"""
v,n=re.subn(pat,rep,v,count=1)
if n!=1: raise SystemExit('visit decision block not found')
v=v.replace("function triggerFirst(){storeRemove(K.forceFirst);sessionStorage.removeItem(K.forceFirst);if(page()==='index.html')first();else{sessionStorage.setItem(K.forceFirst,'1');navigateApp('/?devFirstVisit=1')}}","function triggerFirst(){storeRemove(K.forceFirst);sessionStorage.removeItem(K.forceFirst);first(branchDestination(location.href)||'/kana/')}")
v=v.replace("  function reset(){[K.first,K.return,K.forceFirst,K.forceReturn,K.lastVisit,K.streak].forEach(k=>storeRemove(k));console.info('Mode Atlas visit flags reset')}","  function reset(){[K.first,K.complete,K.pending,K.return,K.forceFirst,K.forceReturn,K.lastVisit,K.streak].forEach(k=>storeRemove(k));console.info('Mode Atlas visit flags reset')}")
v=v.replace("  function init(){track();maybe();window.addEventListener('kanaCloudSyncStatusChanged',maybe);document.addEventListener('ma:ui-refresh',maybe)}","  function init(){track();document.addEventListener('click',event=>{if(onboardingComplete()||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target.closest?.('a[href]');if(!link)return;const target=branchDestination(link.href);if(!target)return;event.preventDefault();visitDecisionMade=true;first(target)});maybe();window.addEventListener('kanaCloudSyncStatusChanged',maybe);document.addEventListener('ma:ui-refresh',maybe)}")
vf.write_text(v)

# New regression contract
tests=Path('tests/frontend.test.js'); t=tests.read_text()
if "test('2.33 experience restructure keeps Atlas clean and onboarding destination-aware'" not in t:
    t += r'''


test('2.33 experience restructure keeps Atlas clean and onboarding destination-aware', () => {
  const home = read('index.html');
  const homeJs = read('assets/pages/mode-atlas-home-page.js');
  const visit = read('assets/app/mode-atlas-visit-flows.js');
  const kana = read('kana/index.html');
  assert.match(home, /data-ma-home-visitor/);
  assert.match(home, /data-ma-home-user/);
  assert.match(home, /Explore Kana Trainer/);
  assert.doesNotMatch(home, /homeVisitStreak|homeReadingDaily|homeWritingDaily|Study status/);
  assert.match(homeJs, /dataset\.maHomeState=isUser\?'returning':'visitor'/);
  assert.doesNotMatch(homeJs, /dailyDone\(|homeVisitStreak|homeReadingDaily|homeWritingDaily/);
  assert.match(visit, /BRANCH_PATHS=new Set/);
  assert.match(visit, /waitForInitialHydration/);
  assert.match(visit, /storeSet\(K\.pending,target\)/);
  assert.match(visit, /navigateApp\(destination\)/);
  assert.doesNotMatch(visit, /if\(nd&&storeGet\(K\.first\)!=='true'\)/);
  assert.ok(kana.indexOf('kana-pathways') < kana.indexOf('kana-progress-intro'));
  assert.ok(kana.indexOf('kana-progress-intro') < kana.indexOf('id="kanaTodayCard"'));
});
'''
    tests.write_text(t)
