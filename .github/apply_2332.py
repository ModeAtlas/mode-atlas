from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def write(rel,text): (ROOT/rel).write_text(text,encoding='utf-8')
def replace_once(src,old,new,label):
    count=src.count(old)
    if count!=1: raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return src.replace(old,new,1)

visit=read('assets/app/mode-atlas-visit-flows.js')
visit=replace_once(visit,
"  const onboardingComplete=()=>storeGet(K.complete)==='true'||storeGet(K.first)==='true';\n  const kanaSetupComplete=()=>storeGet(K.kanaSetup)==='true'||storeGet(K.first)==='true';",
"  const onboardingComplete=()=>storeGet(K.complete)==='true'||storeGet(K.first)==='true';\n  const legacyKanaSetupAtLoad=storeGet(K.first)==='true'&&(hasObj('settings')||hasObj('reverseSettings')||Boolean(storeGet('modeAtlasOnboardingPreset'))||Boolean(storeGet('modeAtlasActivePreset'))||Boolean(storeGet('modeAtlasDefaultPreset')));\n  if(legacyKanaSetupAtLoad&&storeGet(K.kanaSetup)!=='true')storeSet(K.kanaSetup,'true');\n  const kanaSetupComplete=()=>storeGet(K.kanaSetup)==='true';",
'legacy Kana setup migration')
visit=replace_once(visit,
"    const target=branchDestination(link.href);if(!target||!needsSetup(target))return;\n    event.preventDefault();\n    const cloudReady=await waitForInitialCloudState();\n    if(!cloudReady&&window.KanaCloudSync?.getUser?.()){navigateApp(target);return;}\n    if(!needsSetup(target)){navigateApp(target);return;}\n    visitDecisionMade=true;\n    first(target);",
"    const target=branchDestination(link.href);\n    // Branch-specific setup belongs to the destination page so its own module\n    // dependencies are present. Link interception only owns general Mode Atlas setup.\n    if(!target||onboardingComplete()||requiresKanaSetup(target))return;\n    event.preventDefault();\n    const cloudReady=await waitForInitialCloudState();\n    if(!cloudReady&&window.KanaCloudSync?.getUser?.()){navigateApp(target);return;}\n    if(onboardingComplete()){navigateApp(target);return;}\n    visitDecisionMade=true;\n    first(target);",
'destination-owned setup gate')
write('assets/app/mode-atlas-visit-flows.js',visit)

storage=read('assets/app/mode-atlas-storage.js')
storage=replace_once(storage,
"    'modeAtlasOnboardingComplete',\n    'modeAtlasOnboardingPreset',",
"    'modeAtlasOnboardingComplete',\n    'modeAtlasOnboardingPreset',\n    'modeAtlasKanaSetupComplete',",
'backup Kana setup key')
storage=replace_once(storage,
"    'modeAtlasLocalImportGuardUntil',\n    'modeAtlasSectionTimestamps',",
"    'modeAtlasLocalImportGuardUntil',\n    'modeAtlasPendingDestination',\n    'modeAtlasSectionTimestamps',",
'local pending destination key')
write('assets/app/mode-atlas-storage.js',storage)

version=read('assets/app/mode-atlas-version.js').replace("var VERSION = '2.33.1';","var VERSION = '2.33.2';").replace("var CACHE_REVISION = 'assets-2.33.1';","var CACHE_REVISION = 'assets-2.33.2';")
write('assets/app/mode-atlas-version.js',version)
for rel in ('package.json','package-lock.json'):
    data=json.loads(read(rel));data['version']='2.33.2'
    if rel=='package-lock.json': data.setdefault('packages',{}).setdefault('',{})['version']='2.33.2'
    write(rel,json.dumps(data,indent=2)+'\n')
write('README.md',read('README.md').replace('Version: 2.33.1','Version: 2.33.2'))
changelog=read('CHANGELOG.md')
entry="""## 2.33.2 - 2026-08-16
- Moved Kana starting-level setup to the Kana/Reading/Writing destination page so Word Bank never has to host or load Kana preset logic.
- Fixed Word Bank → Kana first-use flow: after general Mode Atlas consent, navigation reaches Kana and Kana setup opens there before practice begins.
- Added the Kana-setup flag to the canonical Mode Atlas save/storage ownership registry and made pending onboarding destinations app-owned local state.
- Tightened legacy onboarding migration so old `modeAtlasStarterSeen` only migrates to Kana setup when real existing Kana configuration is present, instead of permanently bypassing the new branch-specific setup.

"""
if not changelog.startswith('## 2.33.2'): changelog=entry+changelog
write('CHANGELOG.md',changelog)

tests=read('tests/frontend.test.js')
append=r'''

test('2.33.2 Kana setup is destination-owned and persisted as app state', () => {
  const visit = read('assets/app/mode-atlas-visit-flows.js');
  const storage = read('assets/app/mode-atlas-storage.js');
  const wordbank = read('wordbank/index.html');
  const kana = read('kana/index.html');
  assert.match(visit, /legacyKanaSetupAtLoad=storeGet\(K\.first\)==='true'&&/);
  assert.match(visit, /const kanaSetupComplete=\(\)=>storeGet\(K\.kanaSetup\)==='true'/);
  assert.match(visit, /if\(!target\|\|onboardingComplete\(\)\|\|requiresKanaSetup\(target\)\)return/);
  assert.match(visit, /if\(needsSetup\(current\)\)\{visitDecisionMade=true;return first\(current\);\}/);
  assert.match(storage, /'modeAtlasKanaSetupComplete'/);
  assert.match(storage, /'modeAtlasPendingDestination'/);
  assert.doesNotMatch(wordbank, /mode-atlas-presets\.assets-/);
  assert.match(kana, /mode-atlas-presets\.assets-2\.33\.2\.js/);
});
'''
if '2.33.2 Kana setup is destination-owned' not in tests: tests=tests.rstrip()+append
write('tests/frontend.test.js',tests)
