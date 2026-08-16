from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'audit_project.py'
src=path.read_text(encoding='utf-8')
old='''    wordbank_markup = text(ROOT / 'wordbank/index.html')
    library_pos = wordbank_markup.find('class=\\\"panel library-panel ma-card\\\"')
    add_pos = wordbank_markup.find('id=\\\"wordBankAddPanel\\\"')
    if (
        library_pos < 0 or add_pos <= library_pos
        or 'id=\\\"wordBankAddJumpBtn\\\"' not in wordbank_markup
        or 'id=\\\"wordBankActionsBtn\\\"' not in wordbank_markup
        or 'id=\\\"wordBankActionsPanel\\\"' not in wordbank_markup
        or '<details class=\\\"wordbank-tools\\\">' in wordbank_markup
        or 'id=\\\"exportBtn\\\"' in wordbank_markup
        or 'id=\\\"importFile\\\"' in wordbank_markup
    ):
        fail(errors, 'Word Bank library-first hierarchy or collection settings ownership drifted')
'''
new='''    wordbank_markup = text(ROOT / 'wordbank/index.html')
    library_pos = wordbank_markup.find('class=\\\"wordbank-library ma-page-section\\\"')
    add_pos = wordbank_markup.find('id=\\\"wordBankAddPanel\\\"')
    if (
        library_pos < 0 or add_pos <= library_pos
        or 'id=\\\"wordBankAddJumpBtn\\\"' not in wordbank_markup
        or 'id=\\\"wordBankActionsBtn\\\"' not in wordbank_markup
        or 'id=\\\"wordBankActionsPanel\\\"' not in wordbank_markup
        or 'id=\\\"wordBankResultsMeta\\\"' not in wordbank_markup
        or '<details class=\\\"wordbank-tools\\\">' in wordbank_markup
        or 'library-panel ma-card' in wordbank_markup
        or 'id=\\\"exportBtn\\\"' in wordbank_markup
        or 'id=\\\"importFile\\\"' in wordbank_markup
    ):
        fail(errors, 'Word Bank library-first hierarchy or collection settings ownership drifted')
'''
if src.count(old)!=1:
    raise RuntimeError(f'Word Bank audit contract: expected 1 old block, found {src.count(old)}')
path.write_text(src.replace(old,new,1),encoding='utf-8')
