import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import kanji_examples


class DictionaryRestrictions(unittest.TestCase):
    def test_reading_and_spelling_restrictions_exclude_other_senses(self):
        xml = '''<JMdict><entry><ent_seq>1</ent_seq><k_ele><keb>生</keb></k_ele>
        <r_ele><reb>せい</reb></r_ele><r_ele><reb>しょう</reb></r_ele>
        <sense><stagr>せい</stagr><gloss>life</gloss></sense>
        <sense><stagr>しょう</stagr><gloss>birth</gloss></sense>
        <sense><stagk>別</stagk><gloss>unrelated spelling</gloss></sense></entry></JMdict>'''
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root/'content').mkdir(); source=root/'dictionary.xml'; source.write_text(xml)
            row={'char':'生','example':{'word':'生','kana':'せい','readings':['せい','しょう'],'meanings':['life','birth']}}
            with patch.object(kanji_examples,'ROOT',root):
                result=kanji_examples.supplement([row],source)
            self.assertEqual(result[0]['example']['readings'],['せい'])
            self.assertEqual(result[0]['example']['meanings'],['life'])
            self.assertEqual(json.loads((root/'content/kanji-example-coverage.json').read_text())['validatedSelections'],1)

    def test_rare_spelling_is_replaced_by_valid_common_word(self):
        xml='''<JMdict><entry><ent_seq>1</ent_seq><k_ele><keb>清む</keb><ke_inf>rare</ke_inf></k_ele><r_ele><reb>すむ</reb></r_ele><sense><gloss>clear</gloss></sense></entry>
        <entry><ent_seq>2</ent_seq><k_ele><keb>清潔</keb><ke_pri>ichi1</ke_pri></k_ele><r_ele><reb>せいけつ</reb></r_ele><sense><gloss>cleanliness</gloss></sense></entry></JMdict>'''
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'content').mkdir();source=root/'dictionary.xml';source.write_text(xml)
            with patch.object(kanji_examples,'ROOT',root):
                result=kanji_examples.supplement([{'char':'清','example':{'word':'清む','kana':'すむ'}}],source)
            self.assertEqual(result[0]['example']['word'],'清潔')
