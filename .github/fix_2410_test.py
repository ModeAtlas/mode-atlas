from pathlib import Path

path = Path('tests/frontend.test.js')
text = path.read_text()
old = """  assert.doesNotMatch(storage.match(/const APP_BACKUP_EXACT[\\s\\S]*?\\];/)?.[0] || '', /modeAtlasProgressDeviceId/,\n    'device identity is local-only and must not be exported as account progress');"""
new = """  const backupBlock = storage.split('const APP_BACKUP_EXACT', 2)[1]?.split('const APP_LOCAL_EXACT', 1)[0] || '';\n  assert.doesNotMatch(backupBlock, /modeAtlasProgressDeviceId/,\n    'device identity is local-only and must not be exported as account progress');"""
assert text.count(old) == 1, 'progress backup assertion not found exactly once'
path.write_text(text.replace(old, new, 1))
