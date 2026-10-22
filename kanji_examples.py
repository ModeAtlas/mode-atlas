"""Validate selected words and supplement missing contextual words from a pinned, licensed JMdict XML.

Respect spelling/reading and sense restrictions; exclude obsolete, irregular,
rare, name-only, and dialect readings. Do not copy sentence corpora.
"""
from pathlib import Path
import hashlib
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent

def supplement(records, source):
    missing = {row['char'] for row in records if not row.get('example')}
    requested = {row['char']: row.get('example') for row in records}
    candidates = {}
    validated = {}
    prior = {char: (word['word'], word['kana']) for char, word in requested.items() if word}
    updated = []
    reject = re.compile(r'archaic|obsolete|rare|irregular|out-dated|outdated|name|vulgar|derogatory', re.I)
    for _, entry in ET.iterparse(source, events=('end',)):
        if entry.tag != 'entry':
            continue
        for spelling in entry.findall('k_ele'):
            word = spelling.findtext('keb', '')
            target = set(word) & requested.keys()
            if not target or not 1 <= len(word) <= 8 or any(reject.search(x.text or '') for x in spelling.findall('ke_inf')):
                continue
            for reading in entry.findall('r_ele'):
                kana = reading.findtext('reb', '')
                restrictions = [x.text for x in reading.findall('re_restr')]
                if reading.find('re_nokanji') is not None or restrictions and word not in restrictions:
                    continue
                if not re.fullmatch('[ぁ-ゖァ-ヺー]+', kana) or any(reject.search(x.text or '') for x in reading.findall('re_inf')):
                    continue
                meanings = []
                for sense in entry.findall('sense'):
                    spellings = [x.text for x in sense.findall('stagk')]
                    readings = [x.text for x in sense.findall('stagr')]
                    if spellings and word not in spellings or readings and kana not in readings:
                        continue
                    if sense.find('dial') is not None or any(reject.search(x.text or '') for x in sense.findall('misc')):
                        continue
                    meanings.extend(x.text for x in sense.findall('gloss') if x.get('{http://www.w3.org/XML/1998/namespace}lang', 'eng') == 'eng' and x.text)
                if not meanings:
                    continue
                priority = [x.text for x in spelling.findall('ke_pri') + reading.findall('re_pri')]
                common = any(x in ['ichi1', 'news1', 'spec1', 'gai1'] for x in priority)
                kana = ''.join(chr(ord(c)-0x60) if 'ァ' <= c <= 'ヶ' else c for c in kana)
                example = {'word': word, 'kana': kana, 'readings': [kana], 'meanings': list(dict.fromkeys(meanings))[:4], 'jmdictId': entry.findtext('ent_seq')}
                for char in target:
                    rank = (not common, word != char, len(word), len(kana), word, kana)
                    if char not in candidates or rank < candidates[char][0]:
                        candidates[char] = (rank, example)
                    if prior.get(char) == (word, kana):
                        desired = requested[char].get('dictionaryId') or requested[char].get('jmdictId')
                        if not desired or str(desired) == entry.findtext('ent_seq'):
                            validated[char] = example
        entry.clear()
    for row in records:
        char = row['char']
        example = validated.get(char) or (candidates.get(char) or (None, None))[1]
        old = row.get('example')
        if old and example and (old['word'], old['kana']) != (example['word'], example['kana']):
            updated.append({'char': char, 'from': old['word'], 'to': example['word']})
        row['example'] = example
    report = {'source': 'JMdict / EDRDG', 'sha256': hashlib.sha256(Path(source).read_bytes()).hexdigest(), 'license': 'CC BY-SA 4.0', 'method': 'Every selected spelling, reading and English sense checked against JMdict restrictions; not independent educator review', 'validatedSelections': len(validated), 'reselected': updated, 'supplemented': len(missing)-sum(not row.get('example') for row in records), 'withoutContext': [row['char'] for row in records if not row.get('example')]}
    (ROOT/'content/kanji-example-coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    return records
