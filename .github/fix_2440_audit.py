from pathlib import Path

path = Path('audit_project.py')
text = path.read_text(encoding='utf-8')
old = "    if 'ma-setting-row' not in settings_menu or 'Data & app' not in settings_menu:\n        fail(errors, 'Settings drawer is missing the standard preference/data hierarchy')"
new = "    settings_hierarchy_markers = ('ma-setting-row', 'ma-settings-disclosure', 'ma-settings-data-list', 'ma-save-section', 'ma-tools-panel')\n    if any(marker not in settings_menu for marker in settings_hierarchy_markers):\n        fail(errors, 'Settings drawer is missing the standard preference/data hierarchy')"
if text.count(old) != 1:
    raise SystemExit(f'Expected one legacy Settings hierarchy audit, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Updated Settings hierarchy audit to semantic structure markers')
