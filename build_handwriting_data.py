"""Bundle ordered KanjiVG paths; source artwork is CC BY-SA 3.0.

Run with --source /path/to/kanjivg. Runtime downloads only the requested study
band, and the same six immutable shards are packaged for offline iOS use.
"""
from argparse import ArgumentParser
from pathlib import Path
import json
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent


def build(source):
    curriculum = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./assets/data/mode-atlas-kanji-curriculum.js')))"], cwd=ROOT, text=True))
    groups = {f'n{b["level"]}': b['chars'] for b in curriculum}
    groups['kana'] = ''.join(chr(c) for start, stop in [(0x3041, 0x3097), (0x30a1, 0x30fb)] for c in range(start, stop)) + 'ー'
    total = 0
    missing = []
    for name, chars in groups.items():
        data = {}
        for char in chars:
            file = source / 'kanji' / f'{ord(char):05x}.svg'
            if not file.exists():
                missing.append(char)
                continue
            doc = ET.parse(file)
            paths = [node.attrib['d'] for node in doc.iter('{http://www.w3.org/2000/svg}path') if re.search(r'-s\d+$', node.get('id', ''))]
            assert paths and all(re.fullmatch(r'[MmLlHhVvCcSsQqTtAaZz0-9.,+eE\s-]+', p) for p in paths), char
            data[char] = paths
        payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        (ROOT / f'assets/data/mode-atlas-strokes-{name}.js').write_text('/* KanjiVG © Ulrich Apel, CC BY-SA 3.0. Ordered paths extracted from SVG. See handwriting-NOTICE.txt. */\n' + '(function(root){Object.assign(root.ModeAtlasStrokeData||(root.ModeAtlasStrokeData=Object.create(null)),' + payload + ');})(window);\n')
        total += len(data)
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
    (ROOT / 'assets/data/handwriting-NOTICE.txt').write_text(f'''Stroke-order artwork — Mode Atlas

KanjiVG, copyright © 2009–2026 Ulrich Apel and contributors.
https://kanjivg.tagaini.net/ — https://github.com/KanjiVG/kanjivg
Pinned source revision: {sha}

Distributed under Creative Commons Attribution–ShareAlike 3.0:
https://creativecommons.org/licenses/by-sa/3.0/
Full licence: handwriting-LICENSE.txt.

Adaptation: extracted stroke paths in their original order and 109 × 109
coordinate space; grouped the selected characters by study band and kana.
Original path geometry is unchanged. The adapted path datasets retain CC BY-SA
3.0. Application controllers and teaching text are separate works.

To refresh: review the upstream changes, check out the selected revision, run
python3 build_handwriting_data.py --source /path/to/kanjivg, and validate coverage,
path safety and drawing behaviour. No live third-party requests are made in app.
''')
    shutil.copyfile(source / 'COPYING', ROOT / 'assets/data/handwriting-LICENSE.txt')
    print(f'Bundled {total} characters in {len(groups)} shards; missing: {"".join(missing) or "none"}')


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    build(parser.parse_args().source)
