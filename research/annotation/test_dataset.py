import hashlib,json,unittest
from pathlib import Path
from .build import resolve
ROOT=Path(__file__).resolve().parents[1]
def load(path):return [json.loads(s) for s in path.read_text().splitlines()]
class ExpandedDatasetTests(unittest.TestCase):
 def test_every_parent_has_an_explicit_decision(self):
  parents=load(ROOT/'datasets/development.jsonl')+load(ROOT/'datasets/test.jsonl')
  decisions=json.loads((ROOT/'datasets/expanded/decisions.json').read_text())
  self.assertEqual(len(decisions),98)
  self.assertEqual({r['id'] for r in parents},{r['id'] for r in decisions})
  self.assertEqual(len({r['id'] for r in decisions}),len(decisions))
 def test_spans_and_parent_provenance(self):
  parents={r['id']:r for r in load(ROOT/'datasets/development.jsonl')+load(ROOT/'datasets/test.jsonl')}
  for split in ['development','test']:
   for row in load(ROOT/f'datasets/expanded/{split}.jsonl'):
    parent=parents[row['parent_id']]
    self.assertEqual(row['source_id'],parent['source_id']);self.assertEqual(row['split'],parent['split'])
    self.assertIn(row['text'],parent['text'])
    self.assertEqual(hashlib.sha256(row['text'].encode()).hexdigest(),row['text_sha256'])
    self.assertNotIn('\\displaystyle',row['text'])
    self.assertEqual(row['none'],not row['annotations'])
    if row['none']:self.assertTrue(row['none_reason'])
    for a in row['annotations']:
     self.assertGreaterEqual(a['start'],0);self.assertLess(a['start'],a['end']);self.assertLessEqual(a['end'],len(row['text']))
     self.assertEqual(row['text'][a['start']:a['end']],a['text']);self.assertEqual(a['text'].strip(),a['text'])
 def test_sources_do_not_cross_partitions(self):
  dev=load(ROOT/'datasets/expanded/development.jsonl');test=load(ROOT/'datasets/expanded/test.jsonl')
  self.assertFalse({r['source_id'] for r in dev}&{r['source_id'] for r in test})
  self.assertEqual({r['topic'] for r in test},{'math','physics','programming','biology','history','mixed'})
 def test_excluded_is_not_negative(self):
  excluded=json.loads((ROOT/'datasets/expanded/excluded.json').read_text())
  self.assertEqual(len(excluded),25)
  self.assertTrue(all(r['reason'] for r in excluded))
  self.assertFalse(any('none' in r for r in excluded))
 def test_all_labels_and_explicit_negatives_present(self):
  rows=load(ROOT/'datasets/expanded/development.jsonl')+load(ROOT/'datasets/expanded/test.jsonl')
  self.assertEqual({a['label'] for r in rows for a in r['annotations']},{'DEFINITION_TERM','DEFINITION','IMPORTANT','EXAMPLE','KEY_TERM'})
  self.assertEqual(sum(r['none'] for r in rows),4)
 def test_literal_boundaries_never_guess_missing_text(self):
  with self.assertRaises(ValueError):resolve('Определение.',[('KEY_TERM','несуществующая фраза')])
  a=resolve('😀 Термин — смысл.',[('DEFINITION_TERM','Термин')])[0];self.assertEqual(a['start'],2)
