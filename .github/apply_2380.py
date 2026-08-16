from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')


def replace_once(src, old, new, label):
    count = src.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return src.replace(old, new, 1)


# Release metadata. build_revision_assets.py owns npm/README synchronization.
version = read('assets/app/mode-atlas-version.js')
version = replace_once(version, "var VERSION = '2.37.0';", "var VERSION = '2.38.0';", 'VERSION')
version = replace_once(version, "var CACHE_REVISION = 'assets-2.37.0';", "var CACHE_REVISION = 'assets-2.38.0';", 'CACHE_REVISION')
write('assets/app/mode-atlas-version.js', version)

# Give the build-time shared trainer shell explicit presentation regions. IDs,
# modes, inputs, scoring elements and session controls remain unchanged.
frontend = read('frontend_components.py')
old = '''    <div class="main ma-card ma-trainer-card">
{beta}        <h1>{html.escape(config.title)}</h1>
        <div class="subline">{html.escape(config.subline)}</div>
        <div id="dailyBadge" class="daily-badge">{html.escape(daily_badge)}</div>
        <div id="testBadge" class="daily-badge test-badge-{_attr(config.mode)}" hidden>{html.escape(config.test_badge)}</div>

{_trainer_scoreline()}

{_trainer_prompt(config)}

        <div class="trial-config" id="trialConfig" hidden>'''
new = '''    <div class="main ma-card ma-trainer-card">
        <header class="ma-trainer-header">
{beta}            <h1>{html.escape(config.title)}</h1>
            <div class="subline">{html.escape(config.subline)}</div>
            <div id="dailyBadge" class="daily-badge">{html.escape(daily_badge)}</div>
            <div id="testBadge" class="daily-badge test-badge-{_attr(config.mode)}" hidden>{html.escape(config.test_badge)}</div>
        </header>

        <div class="ma-trainer-stage">
{_trainer_scoreline()}

{_trainer_prompt(config)}
        </div>

        <div class="ma-trainer-session-controls">
        <div class="trial-config" id="trialConfig" hidden>'''
frontend = replace_once(frontend, old, new, 'trainer semantic regions opening')
old = '''        <div id="gameOver" class="game-over" hidden><div class="game-over-title">Wrong</div><div id="gameOverAnswer" class="game-over-answer"></div><button class="btn ma-button ma-trainer-button" id="retryBtn" type="button" hidden>Try Again</button></div>
    </div>

{_trainer_score_panels(config)}'''
new = '''        <div id="gameOver" class="game-over" hidden><div class="game-over-title">Wrong</div><div id="gameOverAnswer" class="game-over-answer"></div><button class="btn ma-button ma-trainer-button" id="retryBtn" type="button" hidden>Try Again</button></div>
        </div>
    </div>

{_trainer_score_panels(config)}'''
frontend = replace_once(frontend, old, new, 'trainer semantic regions closing')
write('frontend_components.py', frontend)

# Replace DOM-shape inference (:has(#startWrap[hidden])) with the canonical
# trainer-session-active state already owned by createTrainerUiVisibilityControls.
css = read('assets/css/mode-atlas-study-shared.css')
start_marker = '/* Setup and active practice are distinct visual states. Session state is'
start = css.find(start_marker)
if start < 0:
    raise RuntimeError('trainer active-state block start not found')
end_marker = '@media(prefers-reduced-motion:reduce){'
end_start = css.find(end_marker, start)
if end_start < 0:
    raise RuntimeError('trainer active-state reduced-motion block not found')
end = css.find('}', end_start)
if end < 0:
    raise RuntimeError('trainer active-state block end not found')
end += 1
new_block = r'''/* Setup and active practice are distinct visual states. The shared trainer
   visibility owner toggles body.trainer-session-active; presentation consumes
   that state directly instead of re-deriving session state from DOM shape. */
.ma-trainer-header{
  display:grid;
  justify-items:center;
  gap:0;
}
.ma-trainer-stage{
  width:100%;
  display:grid;
  justify-items:center;
  gap:0;
}
.ma-trainer-session-controls{
  width:100%;
  display:grid;
  justify-items:center;
}

body.trainer-session-active .ma-trainer-card{
  width:min(660px,calc(100vw - 32px));
  padding:18px 34px 24px;
  border-color:color-mix(in srgb,var(--ma-trainer-accent) 36%,var(--ma-border));
  box-shadow:var(--ma-shadow),0 0 0 1px color-mix(in srgb,var(--ma-trainer-accent) 10%,transparent);
}
body.trainer-session-active .ma-trainer-header{
  min-height:28px;
  margin-bottom:2px;
}
body.trainer-session-active .ma-trainer-header h1{
  margin:0;
  color:var(--ma-text-soft);
  font-size:.88rem;
  font-weight:850;
  letter-spacing:.1em;
  text-transform:uppercase;
  text-shadow:none;
}
body.trainer-session-active .ma-trainer-header .subline,
body.trainer-session-active .writing-beta-badge{
  display:none;
}
body.trainer-session-active .daily-badge:not([hidden]){
  margin:8px auto 0;
}
body.trainer-session-active .ma-trainer-stage{
  gap:10px;
  padding-top:4px;
}
body.trainer-session-active .ma-session-hud{
  width:100%;
  padding:0 0 12px;
  border-bottom:1px solid color-mix(in srgb,var(--ma-trainer-accent) 14%,var(--ma-border));
}
body.trainer-session-active .ma-session-hud .scoreline{
  margin-bottom:0;
}
body.trainer-session-active .ma-session-progress{
  margin-top:10px;
}
body.trainer-session-active .ma-trainer-prompt-wrap{
  min-height:220px;
  margin:0;
  padding:14px 0 6px;
}
body.trainer-session-active.ma-reading-page .hiragana{
  font-size:clamp(8rem,13vw,10.5rem);
}
body.trainer-session-active.ma-writing-page .prompt{
  font-size:clamp(6.5rem,10vw,8.25rem);
}
body.trainer-session-active.ma-writing-page .prompt-small{
  font-size:clamp(5rem,8vw,6.5rem);
}
body.trainer-session-active .ma-trainer-answer-wrap{
  width:100%;
  margin-top:0;
}
body.trainer-session-active .ma-trainer-input{
  width:min(340px,100%);
  min-height:56px;
  font-size:26px;
  border-radius:var(--ma-radius-control);
}
body.trainer-session-active.ma-writing-page .choice-grid{
  width:min(480px,100%);
  gap:12px;
  margin:0 auto;
}
body.trainer-session-active.ma-writing-page .choice-btn{
  min-height:78px;
  padding:16px 8px;
  border-color:color-mix(in srgb,var(--ma-trainer-accent) 18%,var(--ma-border));
}
body.trainer-session-active .ma-trainer-session-controls{
  margin-top:16px;
  padding-top:14px;
  border-top:1px solid color-mix(in srgb,var(--ma-trainer-accent) 10%,var(--ma-border));
}
body.trainer-session-active .session-actions{
  width:100%;
  margin-top:0;
  justify-content:center;
}
body.trainer-session-active .session-actions .ma-button{
  min-height:38px;
  padding:7px 12px;
  font-size:.82rem;
}
body.trainer-session-active .session-actions .ma-trainer-skip{
  opacity:.68;
}
body.trainer-session-active .session-actions .ma-trainer-skip:hover,
body.trainer-session-active .session-actions .ma-trainer-skip:focus-visible{
  opacity:1;
}

body.trainer-session-active .ma-trainer-side-panel{
  opacity:.24;
  transform:scale(.985);
  transition:opacity var(--ma-motion-fast) ease,transform var(--ma-motion-fast) ease;
}
body.trainer-session-active .ma-trainer-side-panel:hover,
body.trainer-session-active .ma-trainer-side-panel:focus-within{
  opacity:1;
  transform:none;
}
body.trainer-session-active .bottom-shell.ma-modifiers-only{
  opacity:0;
  transform:translateY(102%);
  pointer-events:none;
  transition:opacity var(--ma-motion-fast) ease,transform var(--ma-motion-medium) ease;
}
body:not(.trainer-session-active) .bottom-shell.ma-modifiers-only{
  opacity:1;
  transform:translateY(0);
  transition:opacity var(--ma-motion-fast) ease,transform var(--ma-motion-medium) ease;
}
body.study-nav-hidden .ma-trainer-side-panel{display:none;}
body.study-nav-hidden .ma-trainer-card{width:min(700px,calc(100vw - 32px));}
body.study-nav-hidden.trainer-session-active .ma-trainer-card{width:min(760px,calc(100vw - 32px));}

@media(max-width:900px){
  .ma-kana-selection{grid-template-columns:1fr;}
}
@media(max-width:760px){
  .ma-session-hud .scoreline{gap:7px;}
  .ma-session-hud .ma-trainer-score{width:auto!important;min-width:0!important;flex:1 1 calc(50% - 7px);font-size:.78rem;}
  .ma-session-hud .ma-trainer-score strong{font-size:.86rem;}
  .ma-practice-setup-head{align-items:flex-start;}
  body.trainer-session-active .ma-trainer-card{
    width:100%;
    margin-bottom:18px;
    padding:14px 12px 18px;
    min-height:calc(100svh - 150px);
  }
  body.trainer-session-active .ma-trainer-header{min-height:22px;}
  body.trainer-session-active .ma-trainer-header h1{font-size:.72rem;letter-spacing:.11em;}
  body.trainer-session-active .ma-trainer-prompt-wrap{
    min-height:clamp(185px,34svh,285px);
    padding:10px 0 2px;
  }
  body.trainer-session-active.ma-reading-page .hiragana{font-size:clamp(6.8rem,33vw,9rem);}
  body.trainer-session-active.ma-writing-page .prompt{font-size:clamp(5.2rem,24vw,7rem);}
  body.trainer-session-active.ma-writing-page .prompt-small{font-size:clamp(4rem,19vw,5.5rem);}
  body.trainer-session-active .ma-trainer-input{width:min(100%,340px);min-height:52px;font-size:22px;}
  body.trainer-session-active.ma-writing-page .choice-grid{gap:9px;}
  body.trainer-session-active.ma-writing-page .choice-btn{min-height:64px;padding:12px 6px;}
  body.trainer-session-active .ma-trainer-side-panel{display:none;}
  body.trainer-session-active .session-actions{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px;
  }
  body.trainer-session-active .session-actions .ma-button{width:100%;min-width:0;}
  body.trainer-session-active .session-actions .ma-trainer-skip{
    grid-column:1 / -1;
    order:3;
  }
}

body[data-effective-display-mode="tablet"].trainer-session-active .ma-trainer-card{
  width:min(760px,calc(100vw - 28px));
  margin-bottom:22px;
  padding:18px 28px 24px;
}
body[data-effective-display-mode="tablet"].trainer-session-active .ma-trainer-side-panel{
  display:none;
}

@media(prefers-reduced-motion:reduce){
  body.trainer-session-active .ma-trainer-side-panel,
  body.trainer-session-active .bottom-shell.ma-modifiers-only,
  body:not(.trainer-session-active) .bottom-shell.ma-modifiers-only{transition:none;}
}'''
css = css[:start] + new_block + css[end:]
write('assets/css/mode-atlas-study-shared.css', css)

# Release note.
changelog = read('CHANGELOG.md')
entry = '''## 2.38.0 - 2026-08-16
- Reworked active Reading and Writing sessions into a focused shared practice stage: compact mode context, session HUD, large prompt, answer area, and quieter session controls now form one clear hierarchy.
- Made the existing shared `trainer-session-active` state the sole presentation owner for active practice, removing duplicate CSS session detection based on `:has(#startWrap[hidden])`.
- Kept Records and Mastery reachable but visually secondary on desktop during practice, while tablet and phone sessions remove those side panels from the active question flow.
- Hid Practice Setup while a session is active and restored it automatically when the shared session state ends, without changing trainer settings or session lifecycle logic.
- Preserved all trainer IDs, Reading/Writing input modes, presets, modifiers, Daily Challenge, Test Mode, scoring, SRS, pause/skip/end behavior, result storage, save schema, and cloud sync.

'''
if not changelog.startswith('## 2.37.0'):
    raise RuntimeError('unexpected CHANGELOG head')
write('CHANGELOG.md', entry + changelog)

# Add a release-specific ownership regression without weakening existing tests.
tests = read('tests/frontend.test.js')
new_test = r'''

test('2.38 trainer sessions use one active-state owner and a focused shared stage', () => {
  const frontend = read('frontend_components.py');
  const shared = read('assets/trainer/mode-atlas-trainer-shared.js');
  const css = read('assets/css/mode-atlas-study-shared.css');
  const reading = read('reading/index.html');
  const writing = read('writing/index.html');

  for (const marker of ['ma-trainer-header', 'ma-trainer-stage', 'ma-trainer-session-controls']) {
    assert.match(frontend, new RegExp(marker), `shared trainer shell missing ${marker}`);
    assert.match(reading, new RegExp(marker), `Reading generated shell missing ${marker}`);
    assert.match(writing, new RegExp(marker), `Writing generated shell missing ${marker}`);
  }
  assert.match(shared, /document\.body\.classList\.toggle\("trainer-session-active", !!visible\)/,
    'shared UI visibility helper must own trainer active state');
  assert.doesNotMatch(css, /:has\(#startWrap\[hidden\]\)/,
    'trainer CSS must not infer session state from the Start wrapper');
  assert.match(css, /body\.trainer-session-active \.ma-trainer-card/);
  assert.match(css, /body\.trainer-session-active \.bottom-shell\.ma-modifiers-only/);
  assert.match(css, /body\.trainer-session-active \.ma-trainer-side-panel/);
  assert.match(css, /data-effective-display-mode="tablet"\]\.trainer-session-active \.ma-trainer-side-panel/);
  assert.match(css, /body\.trainer-session-active\.ma-reading-page \.hiragana/);
  assert.match(css, /body\.trainer-session-active\.ma-writing-page \.prompt/);
});
'''
if "2.38 trainer sessions use one active-state owner" in tests:
    raise RuntimeError('2.38 test already present')
write('tests/frontend.test.js', tests.rstrip() + new_test + '\n')
