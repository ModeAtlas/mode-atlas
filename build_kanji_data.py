"""Build the bundled Kanji curriculum from a pinned OpenJLPT checkout.

Run with --source /path/to/OpenJLPT after reviewing an upstream monthly update.
Only dictionary data and one example word per character enter the runtime.
No sentence corpus, name readings or third-party application code is shipped.
"""
from argparse import ArgumentParser
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent


def build(source: Path):
    base = source / 'data/json'
    bands = {str(n): json.loads((base / f'kanji/n{n}.json').read_text()) for n in range(5, 0, -1)}
    vocabulary = [w for n in range(5, 0, -1) for w in json.loads((base / f'vocab/n{n}.json').read_text())]
    levels = {r['character']: int(n) for n, rows in bands.items() for r in rows}
    words = {}
    for word in vocabulary:
        if not word.get('jmdict_id') or not re.fullmatch(r'[ぁ-ゖァ-ヺー]+', word['reading']):
            continue
        for char in set(word['word']) & levels.keys():
            words.setdefault(char, []).append(word)
    records = []
    for level, rows in bands.items():
        for row in rows:
            char = row['character']
            # Familiar, short words first; do not introduce a harder kanji just
            # to demonstrate an easier one. Single-character words are clearest.
            candidates = [w for w in words.get(char, []) if len(w['word']) <= 5 and all(levels.get(c, 5) >= int(level) for c in w['word'])]
            candidates.sort(key=lambda w: (w['word'] != char, -int(w['level'][1]), len(w['word']), len(w['reading']), w['word']))
            example = None
            if candidates:
                w = candidates[0]
                readings = sorted({x['reading'] for x in candidates if x['word'] == w['word']})
                example = {'word': w['word'], 'kana': w['reading'], 'readings': readings, 'meanings': w['meanings']}
            meanings = [m for m in row['meanings'] if not re.search(r'radical \(no\.|Kangxi radical', m, re.I)] or row['meanings']
            records.append({'char': char, 'level': int(level), 'strokes': row['strokes'], 'on': row.get('onyomi', []), 'kun': row.get('kunyomi', []), 'meanings': meanings, 'example': example})
    prefix = '/* Derived from OpenJLPT / EDRDG / Jonathan Waller. CC BY-SA 4.0. See /assets/data/kanji-NOTICE.txt. */\n'
    def module(name, payload):
        return prefix + f"(function(root,factory){{if(typeof module==='object'&&module.exports)module.exports=factory();else root.{name}=factory();}})(typeof window==='undefined'?globalThis:window,function(){{'use strict';return " + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';});\n'
    data = ROOT / 'assets/data'
    data.mkdir(exist_ok=True)
    (data / 'mode-atlas-kanji-data.js').write_text(module('ModeAtlasKanjiData', records))
    curriculum = [{'level': int(n), 'name': {5:'Foundations',4:'Everyday',3:'Connections',2:'Fluency',1:'Advanced'}[int(n)], 'chars': ''.join(r['character'] for r in rows)} for n, rows in bands.items()]
    (data / 'mode-atlas-kanji-curriculum.js').write_text(module('ModeAtlasKanjiCurriculum', curriculum))
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
    meta = json.loads((base / 'meta.json').read_text())
    notice = f'''Kanji learning data — Mode Atlas

Adapted from OpenJLPT, https://github.com/evanclan/OpenJLPT
Upstream commit: {sha}
KANJIDIC2 / JMdict source date: {meta['sources']['kanjidic2']['created']}

Dictionary readings, meanings and stroke counts: Copyright James William Breen
and the Electronic Dictionary Research and Development Group (EDRDG).
https://www.edrdg.org/wiki/KANJIDIC_Project.html
https://www.edrdg.org/jmdict/j_jmdict.html
https://www.edrdg.org/edrdg/licence.html
Level estimates: Jonathan Waller, https://www.tanos.co.uk/jlpt/ (CC BY).
Data preparation and corrections: OpenJLPT contributors (CC BY-SA 4.0).

This adapted dataset is distributed under CC BY-SA 4.0:
https://creativecommons.org/licenses/by-sa/4.0/
The full licence is included in kanji-LICENSE.txt.
Changes: selected fields, filtered non-learning glosses, selected dictionary-
verified short example words, and separated the lightweight level index.
No Tatoeba sentences or KanjiVG artwork are included.

N5–N1 are approximate study bands. The JLPT does not publish an official kanji
syllabus; Mode Atlas is independent of the JLPT organisers.

Maintainers: review upstream data monthly; regenerate using build_kanji_data.py.
Source updates are reviewed with content and curriculum regression checks before
release. Existing character identifiers retain their learning history.
'''
    (data / 'kanji-NOTICE.txt').write_text(notice)
    shutil.copyfile(source / 'LICENSE', data / 'kanji-LICENSE.txt')
    print(f'Built {len(records)} kanji; {sum(bool(r["example"]) for r in records)} contextual word examples.')
    print('Bands: ' + ', '.join(f'N{n}: {len(rows)}' for n, rows in bands.items()))


if __name__ == '__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    build(parser.parse_args().source)
