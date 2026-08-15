from pathlib import Path
import re
import tinycss2
from tinycss2.ast import QualifiedRule, AtRule, Declaration

OLD = '2.31.4'
NEW = '2.32.0'
WRAPPER_AT_RULES = {'media', 'supports', 'container', 'layer', 'document', 'scope'}


def replace_once(path, old, new):
    p = Path(path)
    source = p.read_text()
    if old not in source:
        raise SystemExit(f'missing expected source in {path}: {old!r}')
    p.write_text(source.replace(old, new, 1))


def selector_text(rule):
    return re.sub(r'\s+', ' ', tinycss2.serialize(rule.prelude).strip())


def value_text(decl):
    return re.sub(r'\s+', ' ', tinycss2.serialize(decl.value).strip())


def consolidate_rules(rules):
    removed_decls = 0
    removed_rules = 0

    for rule in rules:
        if isinstance(rule, AtRule) and rule.content is not None and rule.lower_at_keyword in WRAPPER_AT_RULES:
            nested = tinycss2.parse_rule_list(rule.content, skip_comments=False, skip_whitespace=False)
            rd, rr = consolidate_rules(nested)
            removed_decls += rd
            removed_rules += rr
            rule.content = tinycss2.parse_component_value_list(tinycss2.serialize(nested))

    groups = {}
    for rule in rules:
        if isinstance(rule, QualifiedRule):
            groups.setdefault(selector_text(rule), []).append(rule)

    remove_ids = set()
    for occurrences in groups.values():
        if len(occurrences) < 2:
            continue
        parsed = []
        signatures = {}
        order = 0
        for rule in occurrences:
            nodes = tinycss2.parse_declaration_list(rule.content, skip_comments=False, skip_whitespace=False)
            parsed.append((rule, nodes))
            for node_index, node in enumerate(nodes):
                if not isinstance(node, Declaration):
                    continue
                sig = (node.lower_name, value_text(node), bool(node.important))
                signatures.setdefault(sig, []).append((order, nodes, node_index))
                order += 1

        removals = {}
        for hits in signatures.values():
            if len(hits) < 2:
                continue
            for _, nodes, node_index in hits[:-1]:
                removals.setdefault(id(nodes), set()).add(node_index)

        for rule, nodes in parsed:
            indexes = removals.get(id(nodes), set())
            if indexes:
                removed_decls += len(indexes)
                rule.content = tinycss2.parse_component_value_list(
                    tinycss2.serialize([node for idx, node in enumerate(nodes) if idx not in indexes])
                )

        for rule in occurrences[:-1]:
            remaining = tinycss2.parse_declaration_list(rule.content, skip_comments=True, skip_whitespace=True)
            if not any(isinstance(node, Declaration) for node in remaining):
                remove_ids.add(id(rule))

    if remove_ids:
        before = len(rules)
        rules[:] = [rule for rule in rules if id(rule) not in remove_ids]
        removed_rules += before - len(rules)
    return removed_decls, removed_rules


def declaration_map(path, prefix):
    rules = tinycss2.parse_stylesheet(Path(path).read_text(), skip_comments=False, skip_whitespace=False)
    found = {}
    for rule in rules:
        if not isinstance(rule, QualifiedRule):
            continue
        selector = selector_text(rule)
        if not selector.startswith(prefix):
            continue
        declarations = set()
        for node in tinycss2.parse_declaration_list(rule.content, skip_comments=True, skip_whitespace=True):
            if isinstance(node, Declaration):
                declarations.add((node.lower_name, value_text(node), bool(node.important)))
        found.setdefault(selector, set()).update(declarations)
    return found


# Release metadata.
replace_once('assets/app/mode-atlas-version.js', "var VERSION = '2.31.4';", "var VERSION = '2.32.0';")
replace_once('assets/app/mode-atlas-version.js', "var CACHE_REVISION = 'assets-2.31.4';", "var CACHE_REVISION = 'assets-2.32.0';")
for path in ('package.json', 'package-lock.json', 'README.md'):
    p = Path(path)
    p.write_text(p.read_text().replace(OLD, NEW))

changelog = Path('CHANGELOG.md')
entry = '''## 2.32.0 - 2026-08-15
- Consolidated canonical CSS source without changing page design or application behaviour, removing only identical same-selector declarations while preserving differing cascade rules.
- Made the shared setting-row component the responsive geometry owner; Settings now supplies layout variables instead of overriding component geometry with a higher-specificity grid rule.
- Removed retired Profile sign-in/sign-out visibility selectors left behind by the single state-aware Google account action.
- Reduced duplicate CSS ownership in trainer, Achievements, Kana, Results, and shared theme sources where declarations were provably identical.
- Rebuilt revisioned assets and revalidated the project audit and full regression suite.

'''
if not changelog.read_text().startswith('## 2.32.0'):
    changelog.write_text(entry + changelog.read_text())

# Shared Settings owns geometry. The Settings drawer supplies values only.
components = Path('assets/css/mode-atlas-components.css')
source = components.read_text()
old = '  grid-template-columns:minmax(0,1fr) minmax(180px,auto);\n'
new = '  grid-template-columns:var(--ma-setting-row-columns,minmax(0,1fr) minmax(180px,auto));\n'
if old not in source:
    raise SystemExit('shared setting-row grid declaration not found')
source = source.replace(old, new, 1)
old = '.ma-setting-row__control{justify-self:end;min-width:0;}'
new = '.ma-setting-row__control{justify-self:var(--ma-setting-control-justify,end);width:var(--ma-setting-control-width,auto);min-width:0;}'
if old not in source:
    raise SystemExit('shared setting control declaration not found')
components.write_text(source.replace(old, new, 1))

profile_css = Path('assets/css/mode-atlas-profile-settings.css')
source = profile_css.read_text()
old = '.ma-shared-settings-drawer .ma-settings-section .ma-setting-row{grid-template-columns:minmax(96px,120px) minmax(0,1fr);gap:var(--ma-space-3);}\n.ma-shared-settings-drawer .ma-settings-section .ma-setting-row__control{justify-self:stretch;width:100%;}'
new = '.ma-shared-settings-drawer .ma-settings-section{\n  --ma-setting-row-columns:minmax(96px,120px) minmax(0,1fr);\n  --ma-setting-control-justify:stretch;\n  --ma-setting-control-width:100%;\n}\n.ma-shared-settings-drawer .ma-settings-section .ma-setting-row{gap:var(--ma-space-3);}'
if old not in source:
    raise SystemExit('Settings geometry override block not found')
source = source.replace(old, new, 1)
old = 'html[data-ma-signed-in="true"] [data-profile-sign-in],\nhtml[data-ma-signed-in="true"] [data-ma-sign-in],\nhtml[data-ma-signed-in="false"] [data-profile-sign-out],\nhtml[data-ma-signed-in="false"] [data-ma-sign-out]{display:none;visibility:hidden;pointer-events:none;}\nhtml[data-ma-signed-in="true"] [data-profile-sign-out],\nhtml[data-ma-signed-in="true"] [data-ma-sign-out],\nhtml[data-ma-signed-in="false"] [data-profile-sign-in],\nhtml[data-ma-signed-in="false"] [data-ma-sign-in]{visibility:visible;pointer-events:auto;}'
new = 'html[data-ma-signed-in="true"] [data-ma-sign-in],\nhtml[data-ma-signed-in="false"] [data-ma-sign-out]{display:none;visibility:hidden;pointer-events:none;}\nhtml[data-ma-signed-in="true"] [data-ma-sign-out],\nhtml[data-ma-signed-in="false"] [data-ma-sign-in]{visibility:visible;pointer-events:auto;}'
if old not in source:
    raise SystemExit('retired Profile auth selector block not found')
profile_css.write_text(source.replace(old, new, 1))

# Remove only identical declarations repeated under the exact same selector and at-rule context.
total_decls = total_rules = 0
for path in sorted(Path('assets/css').glob('*.css')):
    if '.assets-' in path.name:
        continue
    rules = tinycss2.parse_stylesheet(path.read_text(), skip_comments=False, skip_whitespace=False)
    rd, rr = consolidate_rules(rules)
    total_decls += rd
    total_rules += rr
    if rd or rr:
        path.write_text(tinycss2.serialize(rules))
    print(f'{path}: removed {rd} identical declarations; {rr} empty rules')

# Dedicated modifier-menu stylesheet wins only for declarations that are exactly duplicated.
owner = declaration_map('assets/css/mode-atlas-modifier-menu.css', '.bottom-shell.ma-modifiers-only')
study = Path('assets/css/mode-atlas-study-shared.css')
rules = tinycss2.parse_stylesheet(study.read_text(), skip_comments=False, skip_whitespace=False)
new_rules = []
cross_removed = 0
for rule in rules:
    if isinstance(rule, QualifiedRule):
        selector = selector_text(rule)
        repeated = owner.get(selector, set())
        if repeated:
            nodes = tinycss2.parse_declaration_list(rule.content, skip_comments=False, skip_whitespace=False)
            kept = []
            for node in nodes:
                if isinstance(node, Declaration) and (node.lower_name, value_text(node), bool(node.important)) in repeated:
                    cross_removed += 1
                    continue
                kept.append(node)
            rule.content = tinycss2.parse_component_value_list(tinycss2.serialize(kept))
            remaining = tinycss2.parse_declaration_list(rule.content, skip_comments=True, skip_whitespace=True)
            if not any(isinstance(node, Declaration) for node in remaining):
                continue
    new_rules.append(rule)
study.write_text(tinycss2.serialize(new_rules))
print(f'cross-file modifier declarations removed: {cross_removed}')
print(f'total redundant declarations removed: {total_decls + cross_removed}; empty rules removed: {total_rules}')

# Migrate the 2.31.4 test from literal page-owned grid geometry to the 2.32 shared-owner contract.
tests = Path('tests/frontend.test.js')
test_source = tests.read_text()
old_assert = '  assert.match(css, /grid-template-columns:minmax\\(96px,120px\\) minmax\\(0,1fr\\)/);'
new_assert = '  assert.match(css, /--ma-setting-row-columns:minmax\\(96px,120px\\) minmax\\(0,1fr\\)/);'
if old_assert not in test_source:
    raise SystemExit('2.31.4 Settings geometry regression assertion not found')
test_source = test_source.replace(old_assert, new_assert, 1)

marker = "test('2.32 CSS consolidation keeps Settings and Profile ownership canonical'"
if marker not in test_source:
    test_source += r'''

test('2.32 CSS consolidation keeps Settings and Profile ownership canonical', () => {
  const components = read('assets/css/mode-atlas-components.css');
  const profile = read('assets/css/mode-atlas-profile-settings.css');
  const trainer = read('assets/css/mode-atlas-study-shared.css');
  const modifiers = read('assets/css/mode-atlas-modifier-menu.css');
  assert.match(components, /grid-template-columns:var\(--ma-setting-row-columns,/);
  assert.match(components, /justify-self:var\(--ma-setting-control-justify,end\)/);
  assert.match(profile, /--ma-setting-row-columns:minmax\(96px,120px\) minmax\(0,1fr\)/);
  assert.doesNotMatch(profile, /data-profile-sign-in|data-profile-sign-out/);
  assert.doesNotMatch(profile, /\.ma-shared-settings-drawer \.ma-settings-section \.ma-setting-row\{grid-template-columns:/);
  assert.match(modifiers, /bottom-shell\.ma-modifiers-only/);
  assert.ok(!trainer.includes('max-height:min(72vh,720px)'), 'modifier drawer max-height must remain owned by modifier-menu.css');
});
'''
tests.write_text(test_source)
