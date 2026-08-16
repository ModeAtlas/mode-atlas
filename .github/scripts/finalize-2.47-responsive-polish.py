from pathlib import Path


def replace_exact(path, old, new, expected=1):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} matches for {old!r}, found {count}')
    p.write_text(text.replace(old, new), encoding='utf-8')


# The trainer element still carries the historical `.main` class. Keep those
# directly-related responsive declarations aligned with the canonical
# `.ma-trainer-card` geometry so they cannot reintroduce the retired tall idle
# card through selector/source-order changes.
replace_exact(
    'assets/css/mode-atlas-study-shared.css',
    'padding: 20px 14px 130px;',
    'padding: 20px 14px 28px;',
    expected=2,
)
replace_exact(
    'assets/css/mode-atlas-study-shared.css',
    'min-height: calc(100svh - 230px);',
    'min-height: auto;',
)
replace_exact(
    'assets/css/mode-atlas-study-shared.css',
    'padding: 18px 12px 126px;',
    'padding: 18px 12px 28px;',
)

# The existing consolidation guard encoded the old 126px value. Update the
# contract to the compact idle-phone geometry rather than weakening the guard.
replace_exact(
    'tests/frontend.test.js',
    '''  assert.match(trainerCss, /body\\[data-effective-display-mode="phone"\\] \\.ma-trainer-card\\{[\\s\\S]*?padding:18px 12px 126px;/,
    'phone trainer card must retain compact responsive padding');''',
    '''  assert.match(trainerCss, /body\\[data-effective-display-mode="phone"\\] \\.ma-trainer-card\\{[\\s\\S]*?padding:18px 12px 28px;[\\s\\S]*?min-height:auto;/,
    'idle phone trainer card must remain content-height with compact responsive padding');''',
)
