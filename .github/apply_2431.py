from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    count = s.count(old)
    assert count == 1, f"{path}: expected one match, found {count}: {old[:90]!r}"
    p.write_text(s.replace(old, new, 1))


# Release metadata.
replace_once(
    'assets/app/mode-atlas-version.js',
    "  var VERSION = '2.43.0';\n  var CACHE_REVISION = 'assets-2.43.0';",
    "  var VERSION = '2.43.1';\n  var CACHE_REVISION = 'assets-2.43.1';"
)

# Changelog.
p = Path('CHANGELOG.md')
s = p.read_text()
entry = """## 2.43.1 - 2026-08-16
- Rebalanced achievement tile composition so status, icon, title, requirement, and progress use the available card height without crowding the progress bar.
- Increased visual separation between bronze and gold rank accents while retaining the restrained five-rank palette.
- Replaced the ambiguous achievement detail Close / Back pairing with an icon-style dialog close control and an explicit Back to achievements action.
- Kept achievement categories, thresholds, rank progression, legacy unlock IDs, Atlas Level integration, and unlock history unchanged.

"""
assert not s.startswith('## 2.43.1')
p.write_text(entry + s)

# Ranked palette and achievement tile/detail markup.
replace_once(
    'assets/achievements/mode-atlas-achievements-ui.js',
    "  const RANK_ACCENTS = Object.freeze(['180,119,74','148,163,184','245,195,93','167,139,250','103,232,249']);",
    "  const RANK_ACCENTS = Object.freeze(['184,92,62','148,163,184','248,196,70','167,139,250','103,232,249']);"
)
replace_once(
    'assets/achievements/mode-atlas-achievements-ui.js',
    "    tile.append(top,graphic,achEl('strong','',track.name),achEl('small','',state.rank.short),meter);",
    "    const copy=achEl('div','ma-ach-copy');\n    copy.append(achEl('strong','',track.name),achEl('small','',state.rank.short));\n    tile.append(top,graphic,copy,meter);"
)
replace_once(
    'assets/achievements/mode-atlas-achievements-ui.js',
    "  function createInfoTopbar({branch, cls='', done=false, accent='96,165,250', rankAccentValue='', symbol='✦', kicker='', title='', tier=''}){",
    "  function createInfoTopbar({branch, cls='', done=false, accent='96,165,250', rankAccentValue='', symbol='✦', kicker='', title='', tier='', backLabel='← Back'}){"
)
replace_once(
    'assets/achievements/mode-atlas-achievements-ui.js',
    "    const back=achButton('ma-button ma-button--ghost ma-button--small ma-ach-info-back','Back'); back.dataset.maFeatureBack='';\n    topbar.append(hero,back); return topbar;",
    "    const back=achButton('ma-button ma-button--ghost ma-button--small ma-ach-info-back',backLabel); back.dataset.maFeatureBack='';\n    topbar.append(back,hero); return topbar;"
)
replace_once(
    'assets/achievements/mode-atlas-achievements-ui.js',
    "body.append(createInfoTopbar({branch:categoryKey,done:state.complete,accent:meta.accent,rankAccentValue:rankAccent(viewIndex),symbol:track.icon||meta.icon,kicker:meta.title,title:track.name,tier:ranked?`Rank ${rank.tier}`:''}),achEl('p','ma-ach-info-copy',rank.detail),progress);",
    "body.append(createInfoTopbar({branch:categoryKey,done:state.complete,accent:meta.accent,rankAccentValue:rankAccent(viewIndex),symbol:track.icon||meta.icon,kicker:meta.title,title:track.name,tier:ranked?`Rank ${rank.tier}`:'',backLabel:'← Back to achievements'}),achEl('p','ma-ach-info-copy',rank.detail),progress);"
)
replace_once(
    'assets/achievements/mode-atlas-achievements-ui.js',
    "body.append(createInfoTopbar({branch:'kana',cls:item.label.cls,accent:'80,220,155',symbol:ch,kicker:'Mastery Map',title:ch,tier:item.label.label}),achEl('p','ma-ach-info-copy',item.label.detail),progress,stats,achEl('p','ma-ach-info-copy','Mastered needs 50+ correct, 95%+ accuracy, and an average recognition time of 1.0s or faster.'));",
    "body.append(createInfoTopbar({branch:'kana',cls:item.label.cls,accent:'80,220,155',symbol:ch,kicker:'Mastery Map',title:ch,tier:item.label.label,backLabel:'← Back to Mastery Map'}),achEl('p','ma-ach-info-copy',item.label.detail),progress,stats,achEl('p','ma-ach-info-copy','Mastered needs 50+ correct, 95%+ accuracy, and an average recognition time of 1.0s or faster.'));"
)
replace_once(
    'assets/achievements/mode-atlas-achievements-ui.js',
    "window.ModeAtlasDialog.feature({kicker:kind==='mastery'?'Kana progress':'Mode Atlas progress',title:kind==='mastery'?'Mastery Map':'Achievements',message:kind==='mastery'?'A full kana grid showing accuracy, repetition, and speed progress.':'Achievement tracks across Mode Atlas. Ranked tracks advance in place as you reach each milestone.',contentNode:buildFeatureContent(kind),size:'large'}).finally(()=>{featureOpen=false;});",
    "window.ModeAtlasDialog.feature({kicker:kind==='mastery'?'Kana progress':'Mode Atlas progress',title:kind==='mastery'?'Mastery Map':'Achievements',message:kind==='mastery'?'A full kana grid showing accuracy, repetition, and speed progress.':'Achievement tracks across Mode Atlas. Ranked tracks advance in place as you reach each milestone.',contentNode:buildFeatureContent(kind),size:'large',closeLabel:'×',closeAriaLabel:kind==='mastery'?'Close Mastery Map':'Close achievements',closeIcon:true}).finally(()=>{featureOpen=false;});"
)

# Shared dialog supports per-feature close presentation without changing defaults.
replace_once(
    'assets/app/mode-atlas-dialog.js',
    "    opts.cancelLabel = opts.cancelLabel || 'Cancel';\n    opts.dismissOnBackdrop = opts.dismissOnBackdrop !== false;",
    "    opts.cancelLabel = opts.cancelLabel || 'Cancel';\n    opts.closeLabel = opts.closeLabel || 'Close';\n    opts.closeAriaLabel = opts.closeAriaLabel || 'Close dialog';\n    opts.closeIcon = opts.closeIcon === true;\n    opts.dismissOnBackdrop = opts.dismissOnBackdrop !== false;"
)
replace_once(
    'assets/app/mode-atlas-dialog.js',
    "    close.hidden = opts.hideClose === true;",
    "    close.textContent = opts.closeLabel;\n    close.setAttribute('aria-label', opts.closeAriaLabel);\n    close.classList.toggle('ma-dialog__close--icon', opts.closeIcon);\n    close.hidden = opts.hideClose === true;"
)

# Shared close icon styling belongs with the dialog shell.
replace_once(
    'assets/css/mode-atlas-components.css',
    ".ma-dialog__close{flex:0 0 auto;}",
    ".ma-dialog__close{flex:0 0 auto;}\n.ma-dialog__close--icon{--ma-button-padding:0;width:var(--ma-control-height-sm);min-width:var(--ma-control-height-sm);height:var(--ma-control-height-sm);font-size:1.25rem;line-height:1;}"
)

# Achievement tile layout and detail navigation presentation.
css = Path('assets/css/mode-atlas-achievements.css')
s = css.read_text()
replacements = [
(
".ma-achievement-tile{--ma-ach-rank:148,163,184;position:relative;min-height:160px;appearance:none;border:1px solid rgba(var(--ma-ach-rank),.38);border-radius:22px;padding:12px;text-align:left;color:var(--ma-text);background:radial-gradient(circle at 18% 0%,rgba(var(--ma-ach-accent),.14),transparent 48%),var(--ma-surface-soft);box-shadow:var(--ma-shadow-soft);cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}",
".ma-achievement-tile{--ma-ach-rank:148,163,184;position:relative;display:flex;flex-direction:column;box-sizing:border-box;min-height:190px;appearance:none;border:1px solid rgba(var(--ma-ach-rank),.38);border-radius:22px;padding:16px;text-align:left;color:var(--ma-text);background:radial-gradient(circle at 18% 0%,rgba(var(--ma-ach-accent),.14),transparent 48%),var(--ma-surface-soft);box-shadow:var(--ma-shadow-soft);cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}"
),
(
".ma-ach-graphic{display:grid;place-items:center;width:48px;height:48px;margin:16px 0 13px;border-radius:16px;color:rgb(var(--ma-ach-rank));background:rgba(var(--ma-ach-rank),.12);border:1px solid rgba(var(--ma-ach-rank),.2);font-size:1.45rem;font-weight:950}",
".ma-ach-graphic{display:grid;place-items:center;width:48px;height:48px;margin:18px 0 16px;border-radius:16px;color:rgb(var(--ma-ach-rank));background:rgba(var(--ma-ach-rank),.12);border:1px solid rgba(var(--ma-ach-rank),.2);font-size:1.45rem;font-weight:950}"
),
(
".ma-achievement-tile strong{display:block;color:var(--ma-text);font-size:1rem;line-height:1.12;letter-spacing:-.025em}\n.ma-achievement-tile small{display:block;margin-top:5px;color:var(--ma-muted);font-size:.78rem;font-weight:760;line-height:1.3}\n.ma-ach-meter{position:absolute;left:12px;right:12px;bottom:11px;height:5px;border-radius:999px;background:var(--ma-control);overflow:hidden}",
".ma-ach-copy{display:grid;gap:7px;min-width:0;margin-bottom:18px}\n.ma-achievement-tile strong{display:block;color:var(--ma-text);font-size:1rem;line-height:1.16;letter-spacing:-.025em}\n.ma-achievement-tile small{display:block;color:var(--ma-muted);font-size:.78rem;font-weight:760;line-height:1.35}\n.ma-ach-meter{position:relative;width:100%;height:6px;margin-top:auto;border-radius:999px;background:var(--ma-control);overflow:hidden}"
),
(
".ma-ach-info-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}",
".ma-ach-info-topbar{display:grid;gap:16px;align-items:start}\n.ma-ach-info-back{justify-self:start}"
),
(
"  .ma-achievement-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ma-achievement-tile{min-height:148px;border-radius:18px;padding:10px}.ma-ach-graphic{width:42px;height:42px;margin:13px 0 11px}.ma-achievement-tile strong{font-size:.9rem}.ma-achievement-tile small{font-size:.71rem}.ma-ach-meter{left:10px;right:10px}",
"  .ma-achievement-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.ma-achievement-tile{min-height:170px;border-radius:18px;padding:12px}.ma-ach-graphic{width:42px;height:42px;margin:14px 0 13px}.ma-ach-copy{gap:5px;margin-bottom:14px}.ma-achievement-tile strong{font-size:.9rem}.ma-achievement-tile small{font-size:.71rem}"
),
(
"  .ma-ach-info-topbar{align-items:center}.ma-ach-info-body h3{font-size:1.35rem}",
"  .ma-ach-info-topbar{gap:13px}.ma-ach-info-body h3{font-size:1.35rem}"
),
(
"@media(max-width:480px){.ma-ach-overview{grid-template-columns:1fr}.ma-achievement-grid{grid-template-columns:1fr}.ma-achievement-tile{min-height:140px}.ma-ach-future-placeholder",
"@media(max-width:480px){.ma-ach-overview{grid-template-columns:1fr}.ma-achievement-grid{grid-template-columns:1fr}.ma-achievement-tile{min-height:158px}.ma-ach-future-placeholder"
)
]
for old,new in replacements:
    count=s.count(old)
    assert count==1, f"achievements css expected one match, found {count}: {old[:80]!r}"
    s=s.replace(old,new,1)
css.write_text(s)

# Focused regression for the reported UI issues.
tests = Path('tests/frontend.test.js')
s = tests.read_text().rstrip() + '\n\n'
s += r"""test('2.43.1 achievement tiles breathe and detail navigation has distinct destinations', () => {
  const achievements = read('assets/achievements/mode-atlas-achievements-ui.js');
  const achievementCss = read('assets/css/mode-atlas-achievements.css');
  const dialog = read('assets/app/mode-atlas-dialog.js');
  const components = read('assets/css/mode-atlas-components.css');

  assert.match(achievements, /const RANK_ACCENTS = Object\.freeze\(\['184,92,62','148,163,184','248,196,70'/);
  assert.match(achievements, /const copy=achEl\('div','ma-ach-copy'\)/);
  assert.match(achievementCss, /\.ma-achievement-tile\{[^}]*display:flex;flex-direction:column[^}]*min-height:190px/);
  assert.match(achievementCss, /\.ma-ach-copy\{[^}]*margin-bottom:18px/);
  assert.match(achievementCss, /\.ma-ach-meter\{[^}]*position:relative[^}]*margin-top:auto/);

  assert.match(achievements, /backLabel:'← Back to achievements'/);
  assert.match(achievements, /backLabel:'← Back to Mastery Map'/);
  assert.doesNotMatch(achievements, /ma-ach-info-back','Back'/);
  assert.match(achievements, /closeLabel:'×'/);
  assert.match(achievements, /Close achievements/);
  assert.match(dialog, /close\.classList\.toggle\('ma-dialog__close--icon', opts\.closeIcon\)/);
  assert.match(components, /\.ma-dialog__close--icon/);
});
"""
tests.write_text(s)

print('Applied Mode Atlas 2.43.1 achievement UI refinement')
