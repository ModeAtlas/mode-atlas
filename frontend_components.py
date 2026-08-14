"""Build-time shared frontend components for Mode Atlas.

The shipped site stays static: this module renders common HTML into each document
at build time so navigation has one source without adding a runtime fragment fetch.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parent
NAV_START = '<!-- MODE_ATLAS_NAV_START -->'
NAV_END = '<!-- MODE_ATLAS_NAV_END -->'
NAV_REGION_RE = re.compile(
    re.escape(NAV_START) + r'.*?' + re.escape(NAV_END),
    re.S,
)


TRAINER_START = '<!-- MODE_ATLAS_TRAINER_START -->'
TRAINER_END = '<!-- MODE_ATLAS_TRAINER_END -->'
TRAINER_REGION_RE = re.compile(
    re.escape(TRAINER_START) + r'.*?' + re.escape(TRAINER_END),
    re.S,
)

@dataclass(frozen=True)
class TrainerConfig:
    mode: str
    title: str
    subline: str
    daily_title: str
    test_badge: str
    prompt_kind: str
    beta: bool = False
    answer_input_controls: bool = False

TRAINER_CONFIGS: dict[str, TrainerConfig] = {
    'reading/index.html': TrainerConfig(
        mode='reading', title='Reading Practice', subline='Enter the matching romaji',
        daily_title='Reading Daily Challenge', test_badge='Reading Test Mode · Full kana test run',
        prompt_kind='reading',
    ),
    'writing/index.html': TrainerConfig(
        mode='writing', title='Writing Practice', subline='Match the romaji prompt to the correct kana',
        daily_title='Writing Daily Challenge', test_badge='Writing Test Mode · Full kana test run',
        prompt_kind='writing', beta=True, answer_input_controls=True,
    ),
}

@dataclass(frozen=True)
class NavConfig:
    key: str
    mark: str
    kicker: str
    title: str
    brand_href: str = '/'
    accent: str = 'atlas'
    account_actions: bool = True
    hideable: bool = False

NAV_CONFIGS: dict[str, NavConfig] = {
    'index.html': NavConfig('atlas', 'あア', 'Mode Atlas', 'Study ecosystem'),
    'kana/index.html': NavConfig('kana', 'かな', 'Mode Atlas', 'Kana Trainer', accent='kana'),
    'reading/index.html': NavConfig('reading', '読', 'Kana Trainer', 'Reading Practice', accent='reading', hideable=True),
    'writing/index.html': NavConfig('writing', '書', 'Kana Trainer', 'Writing Practice', accent='writing', hideable=True),
    'results/index.html': NavConfig('results', '測', 'Kana Trainer', 'Test Results', brand_href='/kana/', accent='results'),
    'wordbank/index.html': NavConfig('wordbank', '語', 'Mode Atlas', 'Word Bank', accent='words'),
    'privacy/index.html': NavConfig('privacy', 'あア', 'Mode Atlas', 'Privacy Policy', account_actions=False),
    'terms/index.html': NavConfig('terms', 'あア', 'Mode Atlas', 'Terms of Use', account_actions=False),
}

PRIMARY_LINKS = (
    ('atlas', 'Atlas', '/'),
    ('kana', 'Kana', '/kana/'),
    ('reading', 'Reading', '/reading/'),
    ('writing', 'Writing', '/writing/'),
    ('results', 'Results', '/results/'),
    ('wordbank', 'Word Bank', '/wordbank/'),
)

LEGAL_LINKS = (
    ('atlas', 'Atlas', '/'),
    ('privacy', 'Privacy', '/privacy/'),
    ('terms', 'Terms', '/terms/'),
)


def _attr(value: str) -> str:
    return html.escape(value, quote=True)


def render_navigation(config: NavConfig) -> str:
    links = LEGAL_LINKS if config.key in {'privacy', 'terms'} else PRIMARY_LINKS
    link_markup = []
    for key, label, href in links:
        active = key == config.key
        classes = 'ma-nav__link' + (' is-active' if active else '')
        current = ' aria-current="page"' if active else ''
        link_markup.append(
            f'<a class="{classes}" data-ma-nav-item="{_attr(key)}" href="{_attr(href)}"{current}>{html.escape(label)}</a>'
        )

    action_markup = ''
    if config.account_actions:
        hide_action = ''
        if config.hideable:
            hide_action = '<button class="ma-nav__action ma-nav__action--quiet ma-nav__focus" id="studyNavHideBtn" type="button" aria-label="Enter focus mode" title="Focus mode"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-focus"></use></svg><span class="ma-nav__action-label">Focus mode</span></button>'
        action_markup = f'''
      <div class="ma-nav__actions">
        <button class="ma-nav__action ma-nav__profile" id="profileOpenBtn" type="button" data-profile-open aria-haspopup="dialog" aria-controls="profileDrawer">
          <span class="ma-nav__avatar" id="topProfileDot" aria-hidden="true">M</span>
          <span class="ma-nav__action-label">Profile</span>
        </button>
        <button class="ma-nav__action ma-nav__settings" type="button" data-settings-open aria-haspopup="dialog" aria-controls="settingsDrawer" aria-label="Open settings" title="Settings">
          <svg class="ma-icon ma-nav__settings-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-settings"></use></svg>
          <span class="ma-nav__action-label">Settings</span>
        </button>
        {hide_action}
      </div>'''

    nav_id = ' id="studyNav"' if config.hideable else ''
    handle = ''
    if config.hideable:
        handle = '\n<button class="ma-nav-handle" id="studyNavShowBtn" type="button"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-focus"></use></svg><span>Exit focus mode</span></button>'

    return f'''{NAV_START}
<nav class="ma-nav ma-nav--{_attr(config.accent)}"{nav_id} data-ma-navigation="shared" data-ma-page="{_attr(config.key)}" aria-label="Mode Atlas navigation">
  <a class="ma-nav__brand" href="{_attr(config.brand_href)}" aria-label="Mode Atlas home">
    <span class="ma-nav__mark" aria-hidden="true">{html.escape(config.mark)}</span>
    <span class="ma-nav__brand-copy">
      <span class="ma-nav__kicker">{html.escape(config.kicker)}</span>
      <span class="ma-nav__title">{html.escape(config.title)}</span>
    </span>
  </a>
  <div class="ma-nav__content">
    <div class="ma-nav__links">{' '.join(link_markup)}</div>{action_markup}
  </div>
</nav>{handle}
{NAV_END}'''

HEAD_ASSETS_START = '<!-- MODE_ATLAS_HEAD_ASSETS_START -->'
HEAD_ASSETS_END = '<!-- MODE_ATLAS_HEAD_ASSETS_END -->'
STYLE_ASSETS_START = '<!-- MODE_ATLAS_STYLE_ASSETS_START -->'
STYLE_ASSETS_END = '<!-- MODE_ATLAS_STYLE_ASSETS_END -->'
EARLY_ASSETS_START = '<!-- MODE_ATLAS_EARLY_ASSETS_START -->'
EARLY_ASSETS_END = '<!-- MODE_ATLAS_EARLY_ASSETS_END -->'
BODY_ASSETS_START = '<!-- MODE_ATLAS_BODY_ASSETS_START -->'
BODY_ASSETS_END = '<!-- MODE_ATLAS_BODY_ASSETS_END -->'
LOADER_START = '<!-- MODE_ATLAS_LOADER_START -->'
LOADER_END = '<!-- MODE_ATLAS_LOADER_END -->'

HEAD_ASSET_REGION_RE = re.compile(re.escape(HEAD_ASSETS_START) + r'.*?' + re.escape(HEAD_ASSETS_END), re.S)
STYLE_ASSET_REGION_RE = re.compile(re.escape(STYLE_ASSETS_START) + r'.*?' + re.escape(STYLE_ASSETS_END), re.S)
EARLY_ASSET_REGION_RE = re.compile(re.escape(EARLY_ASSETS_START) + r'.*?' + re.escape(EARLY_ASSETS_END), re.S)
BODY_ASSET_REGION_RE = re.compile(re.escape(BODY_ASSETS_START) + r'.*?' + re.escape(BODY_ASSETS_END), re.S)
LOADER_REGION_RE = re.compile(re.escape(LOADER_START) + r'.*?' + re.escape(LOADER_END), re.S)


@dataclass(frozen=True)
class FrontendAssetConfig:
    styles: tuple[str, ...]
    body_scripts: tuple[str, ...]


HEAD_SCRIPTS = (
    'assets/app/mode-atlas-version.js',
    'assets/app/mode-atlas-legacy-sw-retirement.js',
    'assets/app/mode-atlas-version-check.js',
    'assets/app/mode-atlas-head-bootstrap.js',
)
EARLY_BODY_SCRIPTS = ('assets/app/mode-atlas-early-loader.js',)

INTERACTIVE_CHROME_STYLES = (
    'assets/css/mode-atlas-dev-console.css',
    'assets/css/mode-atlas-app-modals.css',
    'assets/css/mode-atlas-profile-settings.css',
)
INTERACTIVE_TAIL_STYLES = (
    'assets/css/mode-atlas-achievements.css',
    'assets/css/mode-atlas-theme.css',
    'assets/css/mode-atlas-components.css',
    'assets/css/mode-atlas-navigation.css',
    'assets/css/mode-atlas-responsive.css',
)
INTERACTIVE_STYLES = (
    'assets/css/mode-atlas-page-shared.css',
) + INTERACTIVE_CHROME_STYLES + INTERACTIVE_TAIL_STYLES
TRAINER_STYLES = (
    'assets/css/mode-atlas-page-shared.css',
    'assets/css/mode-atlas-study-shared.css',
) + INTERACTIVE_CHROME_STYLES + (
    'assets/css/mode-atlas-modifier-menu.css',
) + INTERACTIVE_TAIL_STYLES
LEGAL_STYLES = (
    'assets/css/mode-atlas-page-shared.css',
    'assets/css/mode-atlas-theme.css',
    'assets/css/mode-atlas-home-page.css',
    'assets/css/mode-atlas-components.css',
    'assets/css/mode-atlas-navigation.css',
    'assets/css/mode-atlas-responsive.css',
)

INTERACTIVE_SCRIPTS_BEFORE_STORAGE = (
    'assets/app/mode-atlas-toast.js',
    'assets/app/mode-atlas-dialog.js',
    'assets/app/mode-atlas-feedback.js',
    'assets/app/mode-atlas-theme.js',
    'assets/app/mode-atlas-display-mode.js',
    'assets/app/mode-atlas-storage.js',
)
INTERACTIVE_SCRIPTS_AFTER_STORAGE = (
    'assets/app/mode-atlas-save-repair.js',
    'assets/app/mode-atlas-page-state.js',
    'assets/app/mode-atlas-dev-console.js',
    'assets/app/mode-atlas-pwa.js',
    'assets/app/mode-atlas-about.js',
    'assets/app/mode-atlas-visit-flows.js',
    'assets/app/mode-atlas-import-export.js',
    'assets/app/mode-atlas-date.js',
    'assets/data/mode-atlas-kana-data.js',
    'assets/app/mode-atlas-kana-metrics.js',
    'assets/achievements/mode-atlas-achievements-ui.js',
)
ACCOUNT_SCRIPTS = (
    'firebase-config.js',
    'cloud-sync.js',
    'assets/ui/mode-atlas-profile-menu.js',
    'assets/ui/mode-atlas-settings-menu.js',
    'assets/ui/mode-atlas-profile-drawer-bindings.js',
)
LEGAL_BODY_SCRIPTS = (
    'assets/app/mode-atlas-toast.js',
    'assets/app/mode-atlas-theme.js',
    'assets/app/mode-atlas-display-mode.js',
    'assets/app/mode-atlas-page-state.js',
)


def _interactive_scripts(
    *,
    after_storage: tuple[str, ...] = (),
    include_presets: bool = False,
    page_scripts: tuple[str, ...] = (),
) -> tuple[str, ...]:
    preset = ('assets/app/mode-atlas-presets.js',) if include_presets else ()
    return (
        INTERACTIVE_SCRIPTS_BEFORE_STORAGE
        + after_storage
        + INTERACTIVE_SCRIPTS_AFTER_STORAGE
        + preset
        + ACCOUNT_SCRIPTS
        + page_scripts
        + ('assets/app/mode-atlas-sounds.js',)
    )


PAGE_ASSETS: dict[str, FrontendAssetConfig] = {
    'index.html': FrontendAssetConfig(
        styles=INTERACTIVE_STYLES + ('assets/css/mode-atlas-home-page.css',),
        body_scripts=_interactive_scripts(include_presets=True, page_scripts=('assets/pages/mode-atlas-home-page.js',)),
    ),
    'kana/index.html': FrontendAssetConfig(
        styles=INTERACTIVE_STYLES + ('assets/css/mode-atlas-kana-page.css',),
        body_scripts=_interactive_scripts(
            include_presets=True,
            page_scripts=('assets/pages/mode-atlas-kana-page.js',),
        ),
    ),
    'reading/index.html': FrontendAssetConfig(
        styles=TRAINER_STYLES + ('assets/css/mode-atlas-default-page.css',),
        body_scripts=_interactive_scripts(
            include_presets=True,
            page_scripts=(
                'assets/ui/mode-atlas-study-nav-hidden.js',
                'assets/trainer/mode-atlas-trainer-core.js',
                'assets/trainer/mode-atlas-trainer-shared.js',
                'assets/results/mode-atlas-results-storage.js',
                'assets/pages/mode-atlas-default-page.js',
                'assets/trainer/mode-atlas-modifier-menu.js',
                'assets/trainer/mode-atlas-session-controls.js',
                'assets/trainer/mode-atlas-trainer-controls.js',
            ),
        ),
    ),
    'writing/index.html': FrontendAssetConfig(
        styles=TRAINER_STYLES + ('assets/css/mode-atlas-reverse-page.css',),
        body_scripts=_interactive_scripts(
            include_presets=True,
            page_scripts=(
                'assets/ui/mode-atlas-study-nav-hidden.js',
                'assets/trainer/mode-atlas-trainer-core.js',
                'assets/trainer/mode-atlas-trainer-shared.js',
                'assets/results/mode-atlas-results-storage.js',
                'assets/pages/mode-atlas-reverse-page.js',
                'assets/trainer/mode-atlas-input-controls.js',
                'assets/trainer/mode-atlas-modifier-menu.js',
                'assets/trainer/mode-atlas-session-controls.js',
                'assets/trainer/mode-atlas-trainer-controls.js',
            ),
        ),
    ),
    'results/index.html': FrontendAssetConfig(
        styles=INTERACTIVE_STYLES + ('assets/css/mode-atlas-test-page.css',),
        body_scripts=_interactive_scripts(
            page_scripts=(
                'assets/results/mode-atlas-results-storage.js',
                'assets/results/mode-atlas-results-engine.js',
                'assets/results/mode-atlas-results-ui.js',
                'assets/pages/mode-atlas-test-page.js',
            ),
        ),
    ),
    'wordbank/index.html': FrontendAssetConfig(
        styles=INTERACTIVE_STYLES + ('assets/css/mode-atlas-wordbank-page.css',),
        body_scripts=_interactive_scripts(
            after_storage=('assets/pages/mode-atlas-wordbank-page.js',),
        ),
    ),
    'privacy/index.html': FrontendAssetConfig(styles=LEGAL_STYLES, body_scripts=LEGAL_BODY_SCRIPTS),
    'terms/index.html': FrontendAssetConfig(styles=LEGAL_STYLES, body_scripts=LEGAL_BODY_SCRIPTS),
}

LEGACY_REDIRECTS = {
    'kana.html': '/kana/',
    'default.html': '/reading/',
    'reverse.html': '/writing/',
    'test.html': '/results/',
    'wordbank.html': '/wordbank/',
}


def _asset_url(page_rel: str, asset: str) -> str:
    depth = len(Path(page_rel).parent.parts)
    prefix = './' if depth == 0 else '../' * depth
    return prefix + asset


def _render_script_region(marker_start: str, marker_end: str, page_rel: str, assets: tuple[str, ...], *, defer: bool) -> str:
    suffix = ' defer' if defer else ''
    lines = [marker_start]
    lines.extend(f'<script src="{_asset_url(page_rel, asset)}"{suffix}></script>' for asset in assets)
    lines.append(marker_end)
    return '\n'.join(lines)


def _render_style_region(page_rel: str, assets: tuple[str, ...]) -> str:
    lines = [STYLE_ASSETS_START]
    lines.extend(f'<link rel="stylesheet" href="{_asset_url(page_rel, asset)}" />' for asset in assets)
    lines.append(STYLE_ASSETS_END)
    return '\n'.join(lines)


def render_loading_screen() -> str:
    return f'''{LOADER_START}
<div class="ma-loading-screen" id="maLoadingScreen" aria-live="polite">
  <div class="ma-loading-card">
    <div class="ma-loading-head">
      <div class="ma-loading-mark">学</div>
      <div>
        <div class="ma-loading-title">Mode Atlas</div>
        <div class="ma-loading-sub">Preparing your study space…</div>
      </div>
    </div>
    <div class="ma-skeleton"></div>
    <div class="ma-skeleton"></div>
    <div class="ma-skeleton short"></div>
  </div>
</div>
{LOADER_END}'''


def _replace_region(source: str, pattern: re.Pattern[str], rendered: str, rel: str, label: str) -> str:
    updated, count = pattern.subn(rendered, source, count=1)
    if count != 1:
        raise RuntimeError(f'Missing or duplicate {label} build region in {rel}')
    return updated


def apply_frontend_assets(root: Path = ROOT) -> list[Path]:
    '''Render every local JS/CSS dependency from one build-time manifest.'''
    changed: list[Path] = []
    for rel, config in PAGE_ASSETS.items():
        path = root / rel
        if not path.exists():
            raise RuntimeError(f'Missing page for frontend asset manifest: {rel}')
        source = path.read_text(encoding='utf-8')
        updated = source
        updated = _replace_region(
            updated,
            HEAD_ASSET_REGION_RE,
            _render_script_region(HEAD_ASSETS_START, HEAD_ASSETS_END, rel, HEAD_SCRIPTS, defer=False),
            rel,
            'head asset',
        )
        updated = _replace_region(updated, STYLE_ASSET_REGION_RE, _render_style_region(rel, config.styles), rel, 'style asset')
        updated = _replace_region(
            updated,
            EARLY_ASSET_REGION_RE,
            _render_script_region(EARLY_ASSETS_START, EARLY_ASSETS_END, rel, EARLY_BODY_SCRIPTS, defer=False),
            rel,
            'early asset',
        )
        updated = _replace_region(
            updated,
            BODY_ASSET_REGION_RE,
            _render_script_region(BODY_ASSETS_START, BODY_ASSETS_END, rel, config.body_scripts, defer=True),
            rel,
            'body asset',
        )
        if updated != source:
            path.write_text(updated, encoding='utf-8')
            changed.append(path)
    return changed


def apply_loading_screen(root: Path = ROOT) -> list[Path]:
    '''Render the static early loading screen without adding a runtime fragment dependency.'''
    changed: list[Path] = []
    rendered = render_loading_screen()
    for rel in PAGE_ASSETS:
        path = root / rel
        source = path.read_text(encoding='utf-8')
        updated = _replace_region(source, LOADER_REGION_RE, rendered, rel, 'loader')
        if updated != source:
            path.write_text(updated, encoding='utf-8')
            changed.append(path)
    return changed


def render_legacy_redirect(target: str) -> str:
    escaped_target = _attr(target)
    canonical = 'https://mode-atlas.app' + target
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="0; url={escaped_target}" />
  <link rel="canonical" href="{_attr(canonical)}" />
  <title>Redirecting • Mode Atlas</title>
  <script>
    (function() {{
      var target = new URL('{escaped_target}', location.origin);
      var source = new URLSearchParams(location.search);
      source.forEach(function(value, key) {{ if (key !== 'build' && key !== 'v' && key !== 'reload') target.searchParams.set(key, value); }});
      target.hash = location.hash;
      location.replace(target.href);
    }})();
  </script>
</head>
<body>
  <p>Redirecting to <a href="{escaped_target}">{escaped_target}</a>…</p>
</body>
</html>
'''


def apply_legacy_redirects(root: Path = ROOT) -> list[Path]:
    '''Generate compatibility redirect documents from one destination map.'''
    changed: list[Path] = []
    for rel, target in LEGACY_REDIRECTS.items():
        path = root / rel
        rendered = render_legacy_redirect(target)
        source = path.read_text(encoding='utf-8') if path.exists() else ''
        if source != rendered:
            path.write_text(rendered, encoding='utf-8')
            changed.append(path)
    return changed


def _trainer_scoreline() -> str:
    return '''        <div class="ma-session-hud" data-ma-session-hud="shared">
            <div class="scoreline" data-ma-trainer-scores="shared">
                <div class="score-pill ma-pill ma-trainer-score">Streak <strong id="streak">0</strong></div>
                <div class="score-pill ma-pill ma-trainer-score">Best <strong id="highScore">0</strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="endlessTotalPill" hidden>Total <strong id="endlessTotal">0</strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="endlessWrongPill" hidden>Incorrect <strong id="endlessWrong">0</strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="trialTimerPill" hidden>Time <strong id="trialTimer">0</strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="dailyProgressPill" hidden>Question <strong><span id="dailyProgress">0</span>/20</strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="dailyCorrectPill" hidden>Correct <strong id="dailyCorrect">0</strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="dailyWrongPill" hidden>Wrong <strong id="dailyWrong">0</strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="dailyOfficialPill" hidden>Official <strong id="dailyOfficial">—</strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="testQuestionPill" hidden>Question <strong><span id="testQuestion">0</span>/<span id="testTotal">0</span></strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="testCorrectPill" hidden>Correct <strong id="testCorrect">0</strong></div>
                <div class="score-pill ma-pill ma-trainer-score" id="testWrongPill" hidden>Wrong <strong id="testWrong">0</strong></div>
            </div>
            <div class="ma-session-progress" id="sessionProgressBar" hidden aria-live="polite">
                <div class="ma-session-progress__meta"><span id="sessionProgressLabel">Session progress</span><strong id="sessionProgressValue">0 / 0</strong></div>
                <div class="ma-progress"><span class="ma-progress__fill" id="sessionProgressFill"></span></div>
            </div>
        </div>'''


def _trainer_prompt(config: TrainerConfig) -> str:
    if config.prompt_kind == 'reading':
        return '''        <div class="hiragana-wrap ma-trainer-prompt-wrap">
            <div id="hiragana" class="hiragana">—</div>
            <div id="hint" class="hint"></div>
            <div id="comboTierNotice" class="combo-tier-notice"></div>
        </div>

        <div class="input-wrap ma-trainer-answer-wrap">
            <input class="ma-input ma-trainer-input" id="input" type="text" placeholder="Type romaji..." aria-label="Type the romaji answer" autocomplete="off" spellcheck="false" disabled />
        </div>'''
    return '''        <div class="prompt-wrap ma-trainer-prompt-wrap">
            <div id="prompt" class="prompt">—</div>
            <div id="hint" class="hint"></div>
            <div id="comboTierNotice" class="combo-tier-notice"></div>
        </div>

        <div id="choiceGrid" class="choice-grid cols-2"></div>

        <div class="keyboard-wrap ma-trainer-answer-wrap" id="keyboardWrap" hidden>
            <input class="ma-input ma-trainer-input" id="input" type="text" placeholder="Type kana..." aria-label="Type the kana answer" autocomplete="off" spellcheck="false" disabled />
            <div class="keyboard-note">Keyboard mode is optional. Buttons are the default writing practice input method.</div>
        </div>'''


def _trainer_score_panels(config: TrainerConfig) -> str:
    return f'''    <div class="side-panel ma-card ma-card--flat ma-trainer-side-panel left-panel">
        <div class="panel-header" id="scoresHeader"><span>Records</span><span id="scoresChevron">▼</span></div>
        <div class="panel-content" id="scoresContent">
            <a class="ma-button ma-button--small ma-button--wide ma-trainer-results-link" href="/results/"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-chart"></use></svg><span>View full Results</span></a>
            <div class="score-block ma-card ma-card--flat ma-trainer-score-card">
                <h3>Endless Best</h3>
                <div class="score-row"><span>Total</span><span id="bestEndlessTotal">0</span></div>
                <div class="score-row"><span>Correct</span><span id="bestEndlessCorrect">0</span></div>
                <div class="score-row"><span>Wrong</span><span id="bestEndlessWrong">0</span></div>
            </div>
            <div class="score-block ma-card ma-card--flat ma-trainer-score-card">
                <h3>Combo Kana Best</h3>
                <div class="score-row"><span>Same Row</span><span id="comboSameRowBest">0</span></div>
                <div class="score-row"><span>Random</span><span id="comboRandomBest">0</span></div>
            </div>
            <div class="score-block ma-card ma-card--flat ma-trainer-score-card">
                <h3>{html.escape(config.daily_title)}</h3>
                <div class="score-row"><span>Today</span><span id="dailyTodayScore">—</span></div>
                <div class="score-row"><span>Attempts</span><span id="dailyTodayAttempts">0</span></div>
                <div class="score-subtitle">Previous Days</div>
                <div id="dailyHistoryList"></div>
            </div>
            <div class="score-block ma-card ma-card--flat ma-trainer-score-card"><h3>Speed Run Top 3</h3><div id="speedRunTop3"></div></div>
            <div class="score-block ma-card ma-card--flat ma-trainer-score-card"><h3>Time Trial Top 3</h3><div id="timeTrialTop3"></div></div>
        </div>
    </div>

    <div class="side-panel ma-card ma-card--flat ma-trainer-side-panel right-panel">
        <div class="panel-header" id="statsHeader"><span>Mastery</span><span id="statsChevron">▼</span></div>
        <div class="panel-content" id="statsContent"><div id="heatmap" class="heatmap"></div></div>
    </div>'''


def _trainer_modifier_shell(config: TrainerConfig) -> str:
    input_controls = ''
    if config.answer_input_controls:
        input_controls = '''
            <div>
                <div class="section-title">Input method</div>
                <div class="button-grid tight">
                    <button class="btn ma-button ma-trainer-button" id="buttonsModeBtn" type="button">Buttons</button>
                    <button class="btn ma-button ma-trainer-button" id="keyboardModeBtn" type="button">Keyboard</button>
                    <button class="btn ma-button ma-trainer-button" id="choice4Btn" type="button">4 Choices</button>
                    <button class="btn ma-button ma-trainer-button" id="choice6Btn" type="button">6 Choices</button>
                    <button class="btn ma-button ma-trainer-button" id="choice8Btn" type="button">8 Choices</button>
                </div>
            </div>'''
    return f'''<div id="popup" class="popup" hidden></div>

<div class="bottom-shell ma-modifiers-only" data-ma-trainer-modifiers="shared">
    <div class="tab-row"><div class="tab-button" id="modifiersTab">Practice setup ▼</div></div>
    <div class="drawer-content" id="modifiersContent">
        <div class="ma-practice-setup-head"><div><span class="ma-kicker">Before you start</span><h2>Practice setup</h2><p>Choose a preset or customise the question flow, input and kana included in this session.</p></div></div>
        <div class="options-stack">
            <div class="ma-settings-section"><div id="modifierOptions" class="button-grid"></div></div>{input_controls}
            <div class="ma-kana-selection"><div><div class="section-title">Hiragana rows</div><div id="rowOptions" class="rows-grid"></div></div>
            <div><div class="section-title">Katakana rows</div><div id="katakanaRowOptions" class="rows-grid"></div></div></div>
        </div>
    </div>
</div>'''


def render_trainer_shell(config: TrainerConfig) -> str:
    beta = ''
    if config.beta:
        beta = '        <div class="beta-badge writing-beta-badge">Experimental Feature <span class="beta-badge-muted">Beta</span></div>\n'
    daily_badge = f"{config.daily_title} · First try sets today's official score"
    return f'''{TRAINER_START}
<div class="app-shell ma-trainer-shell" data-ma-trainer-shell="shared" data-ma-trainer-mode="{_attr(config.mode)}">
    <div class="main ma-card ma-trainer-card">
{beta}        <h1>{html.escape(config.title)}</h1>
        <div class="subline">{html.escape(config.subline)}</div>
        <div id="dailyBadge" class="daily-badge">{html.escape(daily_badge)}</div>
        <div id="testBadge" class="daily-badge test-badge-{_attr(config.mode)}" hidden>{html.escape(config.test_badge)}</div>

{_trainer_scoreline()}

{_trainer_prompt(config)}

        <div class="trial-config" id="trialConfig" hidden>
            <div class="trial-box"><label for="trialTime">Time (mins)</label><input class="ma-input ma-trainer-input ma-trainer-input--number" id="trialTime" type="number" min="0.1" step="0.1" value="0.5" /></div>
            <div class="trial-box"><label for="trialTarget">Target</label><input class="ma-input ma-trainer-input ma-trainer-input--number" id="trialTarget" type="number" min="1" step="1" value="20" /></div>
        </div>

        <div class="trial-config" id="comboConfig" hidden>
            <div class="trial-box"><label>Kana Combos</label><div class="bottom-actions">
                <button class="btn ma-button ma-trainer-button" id="comboSameRowBtn" type="button">Same Row</button>
                <button class="btn ma-button ma-trainer-button" id="comboRandomBtn" type="button">Random</button>
            </div></div>
        </div>

        <div class="start-wrap" id="startWrap"><button class="btn btn-start ma-button ma-button--accent ma-trainer-button" id="startBtn" type="button"><svg class="ma-icon" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-play"></use></svg><span>Start practice</span></button></div>
        <div class="session-actions" id="sessionActions" hidden>
            <button class="btn btn-secondary ma-button ma-button--ghost ma-trainer-button ma-trainer-skip" id="skipKanaBtn" type="button"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-skip"></use></svg><span>I don’t know</span></button>
            <button class="btn btn-secondary ma-button ma-trainer-button" id="pauseSessionBtn" type="button"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-pause"></use></svg><span data-ma-pause-label>Pause</span></button>
            <button class="btn btn-secondary ma-button ma-trainer-button" id="endSessionBtn" type="button"><svg class="ma-icon ma-icon--sm" aria-hidden="true"><use href="/assets/mode-atlas-icons.svg#icon-stop"></use></svg><span>End session</span></button>
        </div>
        <div id="gameOver" class="game-over" hidden><div class="game-over-title">Wrong</div><div id="gameOverAnswer" class="game-over-answer"></div><button class="btn ma-button ma-trainer-button" id="retryBtn" type="button" hidden>Try Again</button></div>
    </div>

{_trainer_score_panels(config)}
</div>

{_trainer_modifier_shell(config)}
{TRAINER_END}'''


def apply_trainer_shell(root: Path = ROOT) -> list[Path]:
    changed: list[Path] = []
    for rel, config in TRAINER_CONFIGS.items():
        path = root / rel
        if not path.exists():
            raise RuntimeError(f'Missing trainer page: {rel}')
        source = path.read_text(encoding='utf-8')
        if TRAINER_START not in source or TRAINER_END not in source:
            raise RuntimeError(f'Missing shared trainer shell markers in {rel}')
        rendered = render_trainer_shell(config)
        updated, count = TRAINER_REGION_RE.subn(rendered, source, count=1)
        if count != 1:
            raise RuntimeError(f'Could not replace shared trainer shell in {rel}')
        if updated != source:
            path.write_text(updated, encoding='utf-8')
            changed.append(path)
    return changed

def apply_navigation(root: Path = ROOT) -> list[Path]:
    changed: list[Path] = []
    for rel, config in NAV_CONFIGS.items():
        path = root / rel
        if not path.exists():
            raise RuntimeError(f'Missing page for shared navigation: {rel}')
        source = path.read_text(encoding='utf-8')
        if NAV_START not in source or NAV_END not in source:
            raise RuntimeError(f'Missing shared navigation markers in {rel}')
        rendered = render_navigation(config)
        updated, count = NAV_REGION_RE.subn(rendered, source, count=1)
        if count != 1:
            raise RuntimeError(f'Could not replace shared navigation in {rel}')
        if updated != source:
            path.write_text(updated, encoding='utf-8')
            changed.append(path)
    return changed



if __name__ == '__main__':
    changed = apply_navigation(ROOT)
    trainers = apply_trainer_shell(ROOT)
    assets = apply_frontend_assets(ROOT)
    loaders = apply_loading_screen(ROOT)
    redirects = apply_legacy_redirects(ROOT)
    print(
        f'Rendered shared navigation into {len(NAV_CONFIGS)} pages, trainer shells into {len(TRAINER_CONFIGS)} pages, '
        f'asset manifests/loaders into {len(PAGE_ASSETS)} pages, and {len(LEGACY_REDIRECTS)} legacy redirects; '
        f'changed {len(changed)} nav files, {len(trainers)} trainer files, {len(assets)} asset files, '
        f'{len(loaders)} loader files, and {len(redirects)} redirect files.'
    )
