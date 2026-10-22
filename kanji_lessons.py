"""Apply editorial teaching choices without changing stable character IDs.

Dictionary validation is automated; independent educator approval is separate.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent


def curate(records):
    lessons = json.loads((ROOT / 'content/kanji-lessons.json').read_text())
    for record in records:
        lesson = lessons.get(record['char'])
        if not lesson:
            continue
        old = record.get('example')
        if old and 'legacyReadings' not in record:
            record['legacyReadings'] = old['readings']
        record.update(lesson)
    return records
