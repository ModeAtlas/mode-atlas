from pathlib import Path

path = Path('tests/frontend.test.js')
source = path.read_text(encoding='utf-8')
old = "  assert.match(visit, /navigateApp\\(destination\\)/);"
new = "  assert.match(visit, /const next=branchDestination\\(storeGet\\(K\\.pending\\)\\)\\|\\|target/);\n  assert.match(visit, /storeRemove\\(K\\.pending\\)/);\n  assert.match(visit, /navigateApp\\(next\\)/);"
if source.count(old) != 1:
    raise RuntimeError(f'expected one obsolete 2.33 destination assertion, found {source.count(old)}')
path.write_text(source.replace(old, new, 1), encoding='utf-8')
