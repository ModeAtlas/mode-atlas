from pathlib import Path

path = Path(__file__).with_name('apply_2450.py')
text = path.read_text(encoding='utf-8')
old_a = '    "return f\'\'\'{NAV_START}\\n<nav class=\\"ma-nav",\n'
new_a = '    "return f\\"\\"\\"{NAV_START}\\n<nav class=\\"ma-nav",\n'
old_b = '    "return f\'\'\'{NAV_START}\\n<a class=\\"ma-skip-link\\" href=\\"#mainContent\\">Skip to main content</a>\\n<nav class=\\"ma-nav"\n'
new_b = '    "return f\\"\\"\\"{NAV_START}\\n<a class=\\"ma-skip-link\\" href=\\"#mainContent\\">Skip to main content</a>\\n<nav class=\\"ma-nav"\n'
if old_a not in text or old_b not in text:
    raise RuntimeError('Expected navigation transformer strings were not found')
text = text.replace(old_a, new_a, 1).replace(old_b, new_b, 1)
path.write_text(text, encoding='utf-8')
print('Corrected 2.45 navigation transformer quote style')
