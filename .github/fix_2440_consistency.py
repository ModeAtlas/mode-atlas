from pathlib import Path


def replace_one(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one {old!r}, found {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# Finish canonical Word Bank feedback vocabulary missed by the first transformer.
replace_one('assets/pages/mode-atlas-wordbank-page.js',
            "showStatus('Kana cannot be empty.', 'err');",
            "showStatus('Kana cannot be empty.', 'error');")
replace_one('assets/pages/mode-atlas-wordbank-page.js',
            "showStatus(`Cannot save. \"${nextKana}\" already exists in your word bank.`, 'err');",
            "showStatus(`Cannot save. \"${nextKana}\" already exists in your Word Bank.`, 'error');")
replace_one('assets/pages/mode-atlas-wordbank-page.js',
            "if (saved) showStatus(`Saved ${nextKana}.`, 'ok');",
            "if (saved) showStatus(`Saved ${nextKana}.`, 'success');")

wordbank = Path('assets/pages/mode-atlas-wordbank-page.js').read_text(encoding='utf-8')
for legacy in ("'warn'", "'ok'", "'err'"):
    if legacy in wordbank:
        raise SystemExit(f'Word Bank still contains legacy feedback tone {legacy}')

# Historical UI contracts follow the canonical copy while retaining their behavioural checks.
replace_one('tests/frontend.test.js', 'assert.match(settings, /Data & app/);', 'assert.match(settings, /Data and app/);')
replace_one('tests/frontend.test.js', 'assert.match(js, /Clear search & filters/);', 'assert.match(js, /Clear search and filters/);')

print('Completed 2.44 Word Bank feedback and historical regression migration')
